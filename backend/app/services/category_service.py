# app/services/category_service.py

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.services.domain_validation import MAX_CATEGORY_DEPTH


# -------------------
# ⚙️ CONFIG
# -------------------

# -------------------
# 🌲 BUILD TREE
# -------------------

def build_tree(categories, direct_stats=None):
    direct_stats = direct_stats or {}

    tree_nodes = {
        c.id: {
            "id": c.id,
            "name": c.name,
            "parent_id": c.parent_id,
            "child_count": 0,
            "stats": {
                "total_books": direct_stats.get(c.id, (0, 0))[0],
                "read_books": direct_stats.get(c.id, (0, 0))[1],
                "unread_books": (
                    direct_stats.get(c.id, (0, 0))[0]
                    - direct_stats.get(c.id, (0, 0))[1]
                ),
            },
            "children": [],
        }
        for c in categories
    }

    root = []

    for c in categories:
        node = tree_nodes[c.id]

        if (
            c.parent_id
            and c.parent_id in tree_nodes
        ):
            tree_nodes[c.parent_id][
                "children"
            ].append(node)
        else:
            root.append(node)

    def attach_subtree_stats(node):
        node["child_count"] = len(node["children"])

        for child in node["children"]:
            child_stats = attach_subtree_stats(child)
            node["stats"]["total_books"] += child_stats["total_books"]
            node["stats"]["read_books"] += child_stats["read_books"]
            node["stats"]["unread_books"] += child_stats["unread_books"]

        return node["stats"]

    for node in root:
        attach_subtree_stats(node)

    return root


# -------------------
# 🌲 DEPTH HELPERS
# -------------------

def get_category_depth(category):
    depth = 1

    current = category

    while current.parent is not None:
        depth += 1

        current = current.parent

    return depth


def _owned_hierarchy(db: Session, user_id: int):
    rows = (
        db.query(models.Category.id, models.Category.parent_id)
        .filter(models.Category.owner_id == user_id)
        .all()
    )
    parents = {category_id: parent_id for category_id, parent_id in rows}
    children = {}
    for category_id, parent_id in rows:
        children.setdefault(parent_id, []).append(category_id)
    return parents, children


def _parent_depth(parent_id: int | None, parents: dict[int, int | None]) -> int:
    depth = 0
    current = parent_id
    seen = set()
    while current is not None:
        if current in seen:
            raise ValueError("Category hierarchy contains a cycle")
        if current not in parents:
            raise ValueError("Parent category not found")
        seen.add(current)
        depth += 1
        current = parents[current]
    return depth


def _subtree_ids_and_height(root_id: int, children: dict[int | None, list[int]]):
    descendants = set()
    maximum_height = 0
    pending = [(root_id, 1)]
    while pending:
        current, height = pending.pop()
        if current in descendants:
            raise ValueError("Category hierarchy contains a cycle")
        descendants.add(current)
        maximum_height = max(maximum_height, height)
        pending.extend(
            (child_id, height + 1)
            for child_id in children.get(current, [])
        )
    return descendants, maximum_height


def validate_depth(
    db: Session,
    user_id: int,
    parent_id: int | None,
):
    parents, _ = _owned_hierarchy(db, user_id)
    depth = _parent_depth(parent_id, parents) + 1

    if depth > MAX_CATEGORY_DEPTH:
        raise ValueError(
            f"Maximum category depth is {MAX_CATEGORY_DEPTH}"
        )


# -------------------
# 📚 GET
# -------------------

def get_categories(
    db: Session,
    user_id: int,
):
    categories = (
        db.query(models.Category)
        .filter(
            models.Category.owner_id
            == user_id
        )
        .all()
    )

    direct_stats = {
        category_id: (total_books, read_books)
        for category_id, total_books, read_books in (
            db.query(
                models.Book.category_id,
                func.count(models.Book.id),
                func.count(models.Book.id).filter(models.Book.read.is_(True)),
            )
            .filter(
                models.Book.owner_id == user_id,
                models.Book.category_id.isnot(None),
            )
            .group_by(models.Book.category_id)
            .all()
        )
    }

    return build_tree(categories, direct_stats)


# -------------------
# ➕ CREATE
# -------------------

def create_category(
    db: Session,
    user_id: int,
    data: dict,
):
    validate_depth(
        db,
        user_id,
        data.get("parent_id"),
    )

    category = models.Category(**data)

    category.owner_id = user_id

    db.add(category)

    db.commit()

    db.refresh(category)

    return category


# -------------------
# 🔍 DESCENDANT NAMES
# -------------------

def get_descendant_names(category):
    result = []

    def walk(node, prefix=""):
        for child in node.children:
            path = (
                f"{prefix}{child.name}"
            )

            result.append(path)

            walk(
                child,
                f"{path} > ",
            )

    walk(category)

    return result


# -------------------
# ✏️ UPDATE
# -------------------

def update_category(
    db: Session,
    user_id: int,
    category_id: int,
    data: dict,
):
    category = (
        db.query(models.Category)
        .filter(
            models.Category.id
            == category_id
        )
        .filter(
            models.Category.owner_id
            == user_id
        )
        .first()
    )

    if not category:
        return None

    # -------------------
    # 🛑 PARENT VALIDATION
    # -------------------

    if "parent_id" in data:
        new_parent_id = data.get(
            "parent_id"
        )

        parents, children = _owned_hierarchy(db, user_id)

        # 🛑 SELF PARENT
        if (
            new_parent_id
            == category.id
        ):
            raise ValueError(
                "Category cannot be its own parent"
            )

        # 🛑 PREVENT CYCLES
        descendants, subtree_height = _subtree_ids_and_height(
            category.id,
            children,
        )
        if new_parent_id:
            if new_parent_id in descendants:
                raise ValueError(
                    "Cannot move category inside its own descendant"
                )

        parent_depth = _parent_depth(new_parent_id, parents)
        if parent_depth + subtree_height > MAX_CATEGORY_DEPTH:
            raise ValueError(
                f"Maximum category depth is {MAX_CATEGORY_DEPTH}"
            )

        category.parent_id = (
            new_parent_id
        )

    # -------------------
    # ✏️ NAME
    # -------------------

    if (
        "name" in data
        and data["name"] is not None
    ):
        category.name = data["name"]

    db.commit()

    db.refresh(category)

    return category


# -------------------
# 🗑️ DELETE
# -------------------

def _get_subtree_ids(db: Session, user_id: int, category_id: int):
    categories = (
        db.query(models.Category.id, models.Category.parent_id)
        .filter(models.Category.owner_id == user_id)
        .all()
    )
    children = {}
    for current_id, parent_id in categories:
        children.setdefault(parent_id, []).append(current_id)

    result = []
    pending = [category_id]
    seen = set()
    while pending:
        current_id = pending.pop()
        if current_id in seen:
            continue
        seen.add(current_id)
        result.append(current_id)
        pending.extend(children.get(current_id, []))
    return result


def delete_category(
    db: Session,
    user_id: int,
    category_id: int,
    cascade: bool = False,
):
    category = (
        db.query(models.Category)
        .filter(models.Category.id == category_id)
        .filter(models.Category.owner_id == user_id)
        .first()
    )

    if not category:
        return {
            "error": True,
            "message": "Category not found",
        }

    subtree_ids = _get_subtree_ids(db, user_id, category_id)
    child_exists = len(subtree_ids) > 1
    if child_exists and not cascade:
        descendants = get_descendant_names(category)
        return {
            "error": True,
            "message": {
                "message": "Category has child categories",
                "descendants": descendants,
                "count": len(descendants),
            },
        }

    # Detach every affected book before deleting the category tree.  This is
    # intentionally explicit even with the database SET NULL FK: it keeps the
    # behavior correct for loaded ORM objects and makes subtree semantics clear.
    db.query(models.Book).filter(
        models.Book.owner_id == user_id,
        models.Book.category_id.in_(subtree_ids),
    ).update(
        {models.Book.category_id: None},
        synchronize_session=False,
    )

    db.delete(category)
    db.commit()

    return {"success": True}
