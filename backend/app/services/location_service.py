from sqlalchemy.orm import Session
from app import models
from app.models import Location, Book


def build_tree(locations):
    tree_nodes = {
        l.id: {
            "id": l.id,
            "name": l.name,
            "parent_id": l.parent_id,
            "children": [],
        }
        for l in locations
    }

    root = []

    for l in locations:
        node = tree_nodes[l.id]

        # ✅ FIX: do NOT drop nodes if parent missing
        if l.parent_id is not None and l.parent_id in tree_nodes:
            tree_nodes[l.parent_id]["children"].append(node)
        else:
            root.append(node)

    return root


def get_locations(db: Session, user_id: int):
    locations = (
        db.query(Location)
        .filter(Location.owner_id == user_id)
        .all()
    )

    return build_tree(locations)


def create_location(db: Session, user_id: int, data: dict):
    # ✅ FIX: treat 0 as null
    if data.get("parent_id") == 0:
        data["parent_id"] = None

    location = Location(**data)
    location.owner_id = user_id

    db.add(location)
    db.commit()
    db.refresh(location)

    return location


# 🔥 helper: get full subtree
def _get_descendant_ids(db: Session, user_id: int, parent_id: int):
    all_locations = (
        db.query(Location)
        .filter(Location.owner_id == user_id)
        .all()
    )

    children_map = {}
    for loc in all_locations:
        children_map.setdefault(loc.parent_id, []).append(loc.id)

    result = []
    stack = [parent_id]

    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(children_map.get(current, []))

    return result


def delete_location(db: Session, user_id: int, location_id: int):
    location = (
        db.query(Location)
        .filter(Location.id == location_id)
        .filter(Location.owner_id == user_id)
        .first()
    )

    if not location:
        return False

    # 🔥 get full subtree (parent + all children)
    location_ids = _get_descendant_ids(db, user_id, location_id)

    # 🔥 detach books from ALL affected locations
    db.query(Book).filter(
        Book.location_id.in_(location_ids),
        Book.owner_id == user_id,
    ).update(
        {Book.location_id: None},
        synchronize_session=False,
    )

    # 🔥 delete all locations in subtree
    db.query(Location).filter(
        Location.id.in_(location_ids),
        Location.owner_id == user_id,
    ).delete(synchronize_session=False)

    db.commit()

    return True