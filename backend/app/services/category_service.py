from sqlalchemy.orm import Session
from app import models


def build_tree(categories):
    tree_nodes = {
        c.id: {
            "id": c.id,
            "name": c.name,
            "parent_id": c.parent_id,
            "children": [],
        }
        for c in categories
    }

    root = []

    for c in categories:
        node = tree_nodes[c.id]

        if c.parent_id and c.parent_id in tree_nodes:
            tree_nodes[c.parent_id]["children"].append(node)
        else:
            root.append(node)

    return root


def get_categories(db: Session, user_id: int):
    categories = (
        db.query(models.Category)
        .filter(models.Category.owner_id == user_id)
        .all()
    )

    return build_tree(categories)


def create_category(db: Session, user_id: int, data: dict):
    category = models.Category(**data)
    category.owner_id = user_id

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


def delete_category(db: Session, user_id: int, category_id: int):
    category = (
        db.query(models.Category)
        .filter(models.Category.id == category_id)
        .filter(models.Category.owner_id == user_id)
        .first()
    )

    if not category:
        return False

    db.delete(category)
    db.commit()

    return True