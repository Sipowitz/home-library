# app/services/category_service.py

from sqlalchemy.orm import Session
from app import models


# -------------------
# 🌲 BUILD TREE
# -------------------

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


# -------------------
# 📚 GET
# -------------------

def get_categories(db: Session, user_id: int):
    categories = (
        db.query(models.Category)
        .filter(models.Category.owner_id == user_id)
        .all()
    )

    return build_tree(categories)


# -------------------
# ➕ CREATE
# -------------------

def create_category(db: Session, user_id: int, data: dict):
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
            path = f"{prefix}{child.name}"

            result.append(path)

            walk(child, f"{path} > ")

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
        .filter(models.Category.id == category_id)
        .filter(models.Category.owner_id == user_id)
        .first()
    )

    if not category:
        return None

    # -------------------
    # 🛑 PREVENT SELF-PARENT
    # -------------------

    new_parent_id = data.get("parent_id")

    if new_parent_id == category.id:
        raise ValueError("Category cannot be its own parent")

    # -------------------
    # 🛑 PREVENT CYCLES
    # -------------------

    if new_parent_id:
        descendants = []

        def collect_ids(node):
            for child in node.children:
                descendants.append(child.id)
                collect_ids(child)

        collect_ids(category)

        if new_parent_id in descendants:
            raise ValueError(
                "Cannot move category inside its own descendant"
            )

    # -------------------
    # ✏️ UPDATE FIELDS
    # -------------------

    if "name" in data and data["name"] is not None:
        category.name = data["name"]

    category.parent_id = new_parent_id

    db.commit()
    db.refresh(category)

    return category


# -------------------
# 🗑️ DELETE
# -------------------

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

    # -------------------
    # ⚠️ HAS CHILDREN
    # -------------------

    descendants = get_descendant_names(category)

    if descendants and not cascade:
        return {
            "error": True,
            "message": {
                "message": "Category has child categories",
                "descendants": descendants,
                "count": len(descendants),
            },
        }

    # -------------------
    # 🗑️ DELETE
    # -------------------

    db.delete(category)

    db.commit()

    return {
        "success": True,
    }