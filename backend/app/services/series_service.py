from __future__ import annotations

from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import asc, case, literal, or_
from app import models
from app.services.book_service import _owned_subtree_ids, apply_book_ordering, author_surname_expression


class SeriesConflict(ValueError):
    pass


def _owned_series(db: Session, user_id: int, series_id: int):
    return db.query(models.Series).filter_by(id=series_id, owner_id=user_id).first()


def _owned_book(db: Session, user_id: int, book_id: int):
    return db.query(models.Book).filter_by(id=book_id, owner_id=user_id).first()


def _require_parent(db: Session, user_id: int, parent_id: int | None):
    if parent_id is None:
        return None
    parent = _owned_series(db, user_id, parent_id)
    if parent is None:
        raise ValueError("Parent Collection not found")
    return parent


def _root(db: Session, node: models.Series):
    current, seen = node, set()
    while current.parent_id is not None:
        if current.id in seen:
            raise SeriesConflict("Collection hierarchy contains a cycle")
        seen.add(current.id)
        current = db.get(models.Series, current.parent_id)
        if current is None or current.owner_id != node.owner_id:
            raise SeriesConflict("Collection hierarchy has an invalid parent")
    return current


def _descendant_ids(db: Session, user_id: int, root_id: int) -> set[int]:
    children = defaultdict(list)
    for node_id, parent_id in db.query(models.Series.id, models.Series.parent_id).filter_by(owner_id=user_id):
        children[parent_id].append(node_id)
    result, pending = set(), [root_id]
    while pending:
        for child_id in children[pending.pop()]:
            if child_id not in result:
                result.add(child_id)
                pending.append(child_id)
    return result


def _validate_node(node_type: str, parent, author):
    if node_type == "group":
        if parent is not None:
            raise ValueError("Group must be a root node")
    elif node_type != "series":
        raise ValueError("Node type must be group or series")


def create_series(db: Session, user_id: int, data: dict):
    parent = _require_parent(db, user_id, data.get("parent_id"))
    _validate_node(data.get("node_type", "series"), parent, data.get("author"))
    row = models.Series(owner_id=user_id, **data)
    db.add(row); db.commit(); db.refresh(row)
    return row


def get_series(db: Session, user_id: int, series_id: int):
    return _owned_series(db, user_id, series_id)


def get_tree(db: Session, user_id: int):
    rows = db.query(models.Series).filter_by(owner_id=user_id).order_by(models.Series.name, models.Series.id).all()
    nodes = {row.id: {"id": row.id, "owner_id": row.owner_id, "name": row.name, "node_type": row.node_type,
        "author": row.author, "description": row.description, "cover_url": row.cover_url, "parent_id": row.parent_id,
        "created_at": row.created_at, "updated_at": row.updated_at, "children": []} for row in rows}
    roots = []
    for row in rows:
        (nodes[row.parent_id]["children"] if row.parent_id in nodes else roots).append(nodes[row.id])
    return roots


def update_series(db: Session, user_id: int, series_id: int, data: dict):
    row = _owned_series(db, user_id, series_id)
    if row is None: return None
    parent_id = data.get("parent_id", row.parent_id)
    parent = _require_parent(db, user_id, parent_id)
    if parent_id == row.id: raise ValueError("Series cannot be its own parent")
    if parent_id in _descendant_ids(db, user_id, row.id): raise ValueError("Cannot move Series inside its own descendant")
    _validate_node(row.node_type, parent, data.get("author", row.author))
    if row.parent_id != parent_id and db.query(models.BookSeriesMembership.id).filter_by(series_id=row.id).first():
        raise SeriesConflict("Move would change the root of existing book memberships; remove them first")
    for key, value in data.items(): setattr(row, key, value)
    db.commit(); db.refresh(row)
    return row


def delete_series(db: Session, user_id: int, series_id: int):
    row = _owned_series(db, user_id, series_id)
    if row is None: return False
    label = row.node_type.title()
    if db.query(models.Series.id).filter_by(owner_id=user_id, parent_id=series_id).first(): raise SeriesConflict(f"{label} has child Series and cannot be deleted")
    if db.query(models.BookSeriesMembership.id).filter_by(series_id=series_id).first(): raise SeriesConflict(f"{label} has book memberships and cannot be deleted")
    if db.query(models.BookSeriesOrdering.id).filter_by(series_id=series_id).first() or db.query(models.BookSeriesReadingOrder.id).filter_by(series_id=series_id).first(): raise SeriesConflict(f"{label} has ordering metadata and cannot be deleted")
    db.delete(row); db.commit()
    return True


def add_membership(db: Session, user_id: int, series_id: int, book_id: int):
    node = _owned_series(db, user_id, series_id)
    if node is None: return None
    if _owned_book(db, user_id, book_id) is None: raise ValueError("Book not found")
    if db.query(models.BookSeriesMembership).filter_by(book_id=book_id, series_id=series_id).first(): raise SeriesConflict(f"Book is already a member of {node.name}")
    root = _root(db, node)
    if node.id != root.id and db.query(models.BookSeriesMembership).filter_by(book_id=book_id, series_id=root.id).first() is None:
        db.add(models.BookSeriesMembership(book_id=book_id, series_id=root.id)); db.flush()
        _append_to_custom_reading(db, root, book_id)
    row = models.BookSeriesMembership(book_id=book_id, series_id=series_id)
    db.add(row); db.flush(); _append_to_custom_reading(db, node, book_id); db.commit(); db.refresh(row)
    return row


def _append_to_custom_reading(db: Session, node: models.Series, book_id: int):
    if node.node_type != "series": return
    last = db.query(models.BookSeriesReadingOrder).filter_by(series_id=node.id).order_by(models.BookSeriesReadingOrder.position.desc()).first()
    if last is not None:
        db.add(models.BookSeriesReadingOrder(book_id=book_id, series_id=node.id, position=last.position + 1))


def root_removal_impact(db: Session, user_id: int, series_id: int, book_id: int):
    node = _owned_series(db, user_id, series_id)
    if node is None or node.parent_id is not None: return None
    descendants = _descendant_ids(db, user_id, node.id)
    affected = db.query(models.Series).join(models.BookSeriesMembership).filter(models.Series.owner_id == user_id,
        models.Series.id.in_(descendants), models.BookSeriesMembership.book_id == book_id).order_by(models.Series.name).all()
    return {"requires_confirmation": bool(affected), "affected_series": affected}


def _normalize_after_removal(db: Session, series_ids: set[int], root_id: int):
    for series_id in series_ids:
        rows = db.query(models.BookSeriesReadingOrder).filter_by(series_id=series_id).order_by(models.BookSeriesReadingOrder.position).all()
        for position, item in enumerate(rows, 1): item.position = position
    rows = db.query(models.BookSeriesOrdering).filter_by(series_id=root_id).all()
    for field in ("publication_order", "chronological_order"):
        ordered = sorted((row for row in rows if getattr(row, field) is not None), key=lambda row: getattr(row, field))
        for position, item in enumerate(ordered, 1): setattr(item, field, position)


def remove_membership(db: Session, user_id: int, series_id: int, book_id: int, cascade=False):
    node = _owned_series(db, user_id, series_id)
    if node is None or _owned_book(db, user_id, book_id) is None: return False
    row = db.query(models.BookSeriesMembership).filter_by(book_id=book_id, series_id=series_id).first()
    if row is None: return False
    if node.parent_id is None:
        impact = root_removal_impact(db, user_id, series_id, book_id)
        if impact["requires_confirmation"] and not cascade:
            raise SeriesConflict("Confirmation required; book is also a member of: " + ", ".join(item.name for item in impact["affected_series"]))
        ids = _descendant_ids(db, user_id, node.id) | {node.id}
        db.query(models.BookSeriesReadingOrder).filter(models.BookSeriesReadingOrder.book_id == book_id, models.BookSeriesReadingOrder.series_id.in_(ids)).delete(synchronize_session=False)
        db.query(models.BookSeriesOrdering).filter_by(book_id=book_id, series_id=node.id).delete(synchronize_session=False)
        descendant_ids = ids - {node.id}
        if descendant_ids:
            db.query(models.BookSeriesMembership).filter(models.BookSeriesMembership.book_id == book_id, models.BookSeriesMembership.series_id.in_(descendant_ids)).delete(synchronize_session=False)
            db.flush()
        db.delete(row)
        _normalize_after_removal(db, ids, node.id)
    else:
        db.query(models.BookSeriesReadingOrder).filter_by(book_id=book_id, series_id=node.id).delete(synchronize_session=False)
        db.delete(row)
        db.flush(); _normalize_after_removal(db, {node.id}, _root(db, node).id)
    db.commit(); return True


def replace_root_order(db: Session, user_id: int, series_id: int, kind: str, ordered_book_ids: list[int]):
    root = _owned_series(db, user_id, series_id)
    if root is None: return None
    if root.parent_id is not None: raise ValueError("Publication and chronological order can only be edited at the root")
    if kind not in ("publication", "chronological"): raise ValueError("Unknown order type")
    if len(ordered_book_ids) != len(set(ordered_book_ids)): raise ValueError("Ordered books must be unique")
    member_ids = {row[0] for row in db.query(models.BookSeriesMembership.book_id).filter_by(series_id=root.id)}
    if not set(ordered_book_ids) <= member_ids: raise ValueError("Ordering can contain only root member books")
    existing = {row.book_id: row for row in db.query(models.BookSeriesOrdering).filter_by(series_id=root.id)}
    publication = {bid: row.publication_order for bid, row in existing.items() if row.publication_order is not None}
    chronological = {bid: row.chronological_order for bid, row in existing.items() if row.chronological_order is not None}
    target = publication if kind == "publication" else chronological
    target.clear(); target.update({book_id: position for position, book_id in enumerate(ordered_book_ids, 1)})
    db.query(models.BookSeriesOrdering).filter_by(series_id=root.id).delete(synchronize_session=False); db.flush()
    for book_id in set(publication) | set(chronological):
        db.add(models.BookSeriesOrdering(book_id=book_id, series_id=root.id, publication_order=publication.get(book_id), chronological_order=chronological.get(book_id)))
    db.commit(); return get_effective_books(db, user_id, series_id)


def replace_reading_order(db: Session, user_id: int, series_id: int, ordered_book_ids: list[int]):
    node = _owned_series(db, user_id, series_id)
    if node is None: return None
    if node.node_type != "series": raise ValueError("Groups do not have a Reading order")
    member_ids = {row[0] for row in db.query(models.BookSeriesMembership.book_id).filter_by(series_id=node.id)}
    if len(ordered_book_ids) != len(set(ordered_book_ids)) or set(ordered_book_ids) != member_ids: raise ValueError("Custom Reading order must contain every Series member exactly once")
    db.query(models.BookSeriesReadingOrder).filter_by(series_id=node.id).delete(synchronize_session=False); db.flush()
    for position, book_id in enumerate(ordered_book_ids, 1): db.add(models.BookSeriesReadingOrder(book_id=book_id, series_id=node.id, position=position))
    db.commit(); return get_effective_books(db, user_id, series_id)


def reset_reading_order(db: Session, user_id: int, series_id: int):
    node = _owned_series(db, user_id, series_id)
    if node is None: return False
    if node.node_type != "series": raise ValueError("Groups do not have a Reading order")
    db.query(models.BookSeriesReadingOrder).filter_by(series_id=node.id).delete(synchronize_session=False); db.commit(); return True


def get_book_relationships(db: Session, user_id: int, book_id: int):
    if _owned_book(db, user_id, book_id) is None: return None
    rows = db.query(models.Series).join(models.BookSeriesMembership).filter(models.Series.owner_id == user_id, models.BookSeriesMembership.book_id == book_id).order_by(models.Series.name).all()
    result = []
    for node in rows:
        root = _root(db, node); ordering = db.query(models.BookSeriesOrdering).filter_by(book_id=book_id, series_id=root.id).first(); reading = db.query(models.BookSeriesReadingOrder).filter_by(book_id=book_id, series_id=node.id).first()
        result.append({"series": node, "direct": True, "publication_order": ordering.publication_order if ordering else None, "chronological_order": ordering.chronological_order if ordering else None, "reading_order": reading.position if reading else None})
    return result


def get_book_collection_paths(db: Session, user_id: int, book_id: int):
    """Return meaningful root-to-leaf Collection paths for an owned book.

    Nested membership automatically persists a root membership for hierarchy
    integrity.  That root is an ancestor of the selected leaf, so it is not a
    separate Book View membership.
    """
    if _owned_book(db, user_id, book_id) is None:
        return None

    owned_nodes = db.query(models.Series.id, models.Series.name, models.Series.parent_id).filter_by(owner_id=user_id).all()
    nodes = {node_id: {"id": node_id, "name": name, "parent_id": parent_id} for node_id, name, parent_id in owned_nodes}
    membership_ids = {
        series_id
        for (series_id,) in db.query(models.BookSeriesMembership.series_id)
        .join(models.Series, models.BookSeriesMembership.series_id == models.Series.id)
        .filter(models.BookSeriesMembership.book_id == book_id, models.Series.owner_id == user_id)
        .all()
        if series_id in nodes
    }

    def is_ancestor(ancestor_id: int, node_id: int) -> bool:
        current_id = nodes[node_id]["parent_id"]
        seen = set()
        while current_id is not None and current_id not in seen:
            if current_id == ancestor_id:
                return True
            seen.add(current_id)
            current = nodes.get(current_id)
            if current is None:
                return False
            current_id = current["parent_id"]
        return False

    leaf_ids = [
        node_id for node_id in membership_ids
        if not any(other_id != node_id and is_ancestor(node_id, other_id) for other_id in membership_ids)
    ]

    def path_for(node_id: int):
        path = []
        current_id = node_id
        seen = set()
        while current_id is not None and current_id not in seen:
            current = nodes.get(current_id)
            if current is None:
                break
            seen.add(current_id)
            path.append({"id": current["id"], "name": current["name"]})
            current_id = current["parent_id"]
        return list(reversed(path))

    paths = [path_for(node_id) for node_id in leaf_ids]
    paths.sort(key=lambda path: tuple((node["name"].casefold(), node["id"]) for node in path))
    return [{"nodes": path} for path in paths]


def get_effective_books(db: Session, user_id: int, series_id: int):
    node = _owned_series(db, user_id, series_id)
    if node is None: return None
    root = _root(db, node)
    memberships = db.query(models.BookSeriesMembership).join(models.Book).filter(models.Book.owner_id == user_id, models.BookSeriesMembership.series_id == node.id).all()
    book_ids = [item.book_id for item in memberships]
    books = {book.id: book for book in db.query(models.Book).filter(models.Book.id.in_(book_ids)).all()} if book_ids else {}
    root_orders = {row.book_id: row for row in db.query(models.BookSeriesOrdering).filter_by(series_id=root.id)}
    reading = {row.book_id: row.position for row in db.query(models.BookSeriesReadingOrder).filter_by(series_id=node.id)}; custom = bool(reading)
    relevant = _descendant_ids(db, user_id, root.id) | {root.id}; membership_map = defaultdict(list)
    if book_ids:
        for book_id, member_id, name in db.query(models.BookSeriesMembership.book_id, models.Series.id, models.Series.name).join(models.Series).filter(models.BookSeriesMembership.book_id.in_(book_ids), models.Series.id.in_(relevant)).order_by(models.Series.name):
            membership_map[book_id].append({"series_id": member_id, "series_name": name})
    pub_ids = sorted((bid for bid in book_ids if root_orders.get(bid) and root_orders[bid].publication_order), key=lambda bid: root_orders[bid].publication_order)
    chrono_ids = sorted((bid for bid in book_ids if root_orders.get(bid) and root_orders[bid].chronological_order), key=lambda bid: root_orders[bid].chronological_order)
    publication = {bid: pos for pos, bid in enumerate(pub_ids, 1)}; chronological = {bid: pos for pos, bid in enumerate(chrono_ids, 1)}
    result = []
    for bid in book_ids:
        book, root_order = books[bid], root_orders.get(bid)
        result.append({"book_id": bid, "title": book.title, "author": book.author, "cover_url": book.cover_url, "isbn": book.isbn, "year": book.year,
            "direct": True, "publication_order": publication.get(bid), "chronological_order": chronological.get(bid),
            "root_publication_order": root_order.publication_order if root_order else None, "root_chronological_order": root_order.chronological_order if root_order else None,
            "reading_order": reading.get(bid) if custom else publication.get(bid), "reading_order_custom": custom, "explicit_memberships": membership_map[bid]})
    return sorted(result, key=lambda item: (item["publication_order"] is None, item["publication_order"] or 0, item["title"].lower()))


def browse_collection(
    db: Session, user_id: int, collection_id: int | None, *, search: str | None = None,
    category_id: int | None = None, location_id: int | None = None, read: bool | None = None,
    sort: str = "reading", skip: int = 0, limit: int = 100,
    root_mode: str = "collections_and_books",
):
    """Return a single collection level, or the root-library collection projection.

    Membership and descendant traversal remain centralized here so root hiding and
    recursive filtered browsing cannot drift from the Series model.
    """
    if collection_id is None:
        collection = None
        children = db.query(models.Series).filter_by(owner_id=user_id, parent_id=None).order_by(models.Series.name, models.Series.id).all()
        descendant_ids: set[int] = set()
        direct_ids: set[int] = set()
    else:
        collection = _owned_series(db, user_id, collection_id)
        if collection is None:
            return None
        children = db.query(models.Series).filter_by(owner_id=user_id, parent_id=collection.id).order_by(models.Series.name, models.Series.id).all()
        direct_ids = {collection.id}
        descendant_ids = _descendant_ids(db, user_id, collection.id) | direct_ids

    active_filter = bool((search or "").strip() or category_id is not None or location_id is not None or read is not None)
    query = db.query(models.Book).filter(models.Book.owner_id == user_id, models.Book.is_checked_out.is_(False))
    if collection_id is None:
        if root_mode == "collections_only":
            query = query.filter(~models.Book.series_memberships.any())
    else:
        membership_ids = descendant_ids if active_filter else direct_ids
        query = query.join(models.BookSeriesMembership).filter(models.BookSeriesMembership.series_id.in_(membership_ids)).distinct()
        # Child assignment creates an ancestor/root membership for integrity.
        # At an ordinary level that inherited membership is not a direct book
        # tile; filtered search deliberately includes all descendants instead.
        if not active_filter:
            child_ids = descendant_ids - direct_ids
            if child_ids:
                query = query.filter(~models.Book.series_memberships.any(models.BookSeriesMembership.series_id.in_(child_ids)))
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(models.Book.title.ilike(term), models.Book.author.ilike(term)))
    if category_id == -1:
        query = query.filter(models.Book.category_id.is_(None))
    elif category_id is not None:
        category_ids = _owned_subtree_ids(db, models.Category, user_id, category_id)
        query = query.filter(models.Book.category_id.in_(category_ids)) if category_ids else query.filter(False)
    if location_id is not None:
        if location_id == -1:
            query = query.filter(models.Book.location_id.is_(None))
        else:
            location_ids = _owned_subtree_ids(db, models.Location, user_id, location_id)
            query = query.filter(models.Book.location_id.in_(location_ids)) if location_ids else query.filter(False)
    if read is not None:
        query = query.filter(models.Book.read == read)

    total = query.count()
    if collection_id is None:
        # Root tiles and books are one pageable Library sequence.  Build the
        # order in SQL so the collection surname key cannot drift from the
        # canonical Book expression or database collation.
        book_order = query.with_entities(
            literal("book").label("kind"),
            models.Book.id.label("entity_id"),
            author_surname_expression(models.Book.author).label("surname"),
            literal(0).label("authorless"),
            literal("").label("fallback_name"),
            literal(0).label("kind_rank"),
        )
        if active_filter:
            ordering = book_order.subquery()
        else:
            collection_order = db.query(
                literal("collection").label("kind"),
                models.Series.id.label("entity_id"),
                author_surname_expression(models.Series.author).label("surname"),
                case((models.Series.author.is_(None), 1), else_=0).label("authorless"),
                case((models.Series.author.is_(None), models.Series.name), else_="").label("fallback_name"),
                case((models.Series.node_type == "group", 1), else_=2).label("kind_rank"),
            ).filter(models.Series.owner_id == user_id, models.Series.parent_id.is_(None))
            ordering = book_order.union_all(collection_order).subquery()
        ordered_rows = db.query(ordering.c.kind, ordering.c.entity_id).order_by(
            asc(ordering.c.authorless),
            asc(ordering.c.surname),
            asc(ordering.c.fallback_name),
            asc(ordering.c.entity_id),
            asc(ordering.c.kind_rank),
        ).offset(skip).limit(limit).all()
        page_book_ids = [row.entity_id for row in ordered_rows if row.kind == "book"]
        page_collection_ids = [row.entity_id for row in ordered_rows if row.kind == "collection"]
        page_books = {book.id: book for book in db.query(models.Book).filter(models.Book.id.in_(page_book_ids)).all()} if page_book_ids else {}
        page_collections = {row.id: row for row in db.query(models.Series).filter(models.Series.id.in_(page_collection_ids)).all()} if page_collection_ids else {}
        items = []
        for row in ordered_rows:
            if row.kind == "book":
                book = page_books[row.entity_id]
                items.append({"kind": "book", "book": {"id": book.id, "title": book.title, "author": book.author, "cover_url": book.cover_url, "read": book.read}})
            else:
                items.append({"kind": "collection", "collection": page_collections[row.entity_id]})
        return {"collection": None, "items": items, "total": db.query(ordering).count()}

    # Root Library books must retain the same ordering as /books. Keep the
    # existing level-browse query ordering for Groups.
    if collection.node_type == "group":
        # The membership join can include the same book through several
        # descendants. Deduplicate before applying PostgreSQL's surname
        # expression, which cannot be used directly with SELECT DISTINCT.
        distinct_ids = query.with_entities(models.Book.id).distinct().subquery()
        query = db.query(models.Book).filter(models.Book.id.in_(db.query(distinct_ids.c.id)))
        query = apply_book_ordering(query)
        books = query.offset(skip).limit(limit).all()
    else:
        # Preserve the Series' Python casefold/tie-break ordering across page
        # boundaries by sorting the complete filtered result before slicing.
        books = query.all()
    root = _root(db, collection) if collection is not None else None
    root_orders = {} if root is None else {item.book_id: item for item in db.query(models.BookSeriesOrdering).filter_by(series_id=root.id)}
    reading = {} if collection is None else {item.book_id: item.position for item in db.query(models.BookSeriesReadingOrder).filter_by(series_id=collection.id)}
    results = []
    for book in books:
        ordering = root_orders.get(book.id)
        results.append({"id": book.id, "title": book.title, "author": book.author, "cover_url": book.cover_url, "read": book.read,
                        "publication_order": ordering.publication_order if ordering else None,
                        "chronological_order": ordering.chronological_order if ordering else None,
                        "reading_order": reading.get(book.id)})
    if collection is not None and collection.node_type == "series":
        field = {"publication": "publication_order", "chronological": "chronological_order", "alphabetical": None}.get(sort, "reading_order")
        if field:
            results.sort(key=lambda item: (item[field] is None, item[field] if item[field] is not None else 0, item["title"].casefold(), item["id"]))
        else:
            results.sort(key=lambda item: (item["title"].casefold(), item["id"]))
        results = results[skip:skip + limit]
    return {"collection": collection, "collections": children if not active_filter else [], "books": results, "total": total}
