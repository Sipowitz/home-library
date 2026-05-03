# app/services/category_service.py

from collections import defaultdict

from sqlalchemy.orm import Session, joinedload

from app import models


# -------------------
# 📊 CATEGORY STATS
# -------------------

def build_category_stats(categories):
    direct_stats = defaultdict(
        lambda: {
            "total_books": 0,
            "read_books": 0,
            "unread_books": 0,
        }
    )

    for category in categories:
        total_books = len(category.books)

        read_books = sum(
            1 for book in category.books if book.read
        )

        direct_stats[category.id] = {
            "total_books": total_books,
            "read_books": read_books,
            "unread_books": total_books - read_books,
        }

    recursive_stats = {}

    category_map = {
        category.id: category
        for category in categories
    }

    def aggregate(category_id):
        if category_id in recursive_stats:
            return recursive_stats[category_id]

        category = category_map[category_id]

        totals = {
            "total_books": direct_stats[category_id]["total_books"],
            "read_books": direct_stats[category_id]["read_books"],
            "unread_books": direct_stats[category_id]["unread_books"],
        }

        for child in category.children:
            child_totals = aggregate(child.id)

            totals["total_books"] += child_totals["total_books"]
            totals["read_books"] += child_totals["read_books"]
            totals["unread_books"] += child_totals["unread_books"]

        recursive_stats[category_id] = totals

        return totals

    for category in categories:
        aggregate(category.id)

    return recursive_stats


# -------------------
# 🌲 BUILD TREE
# -------------------

def build_tree(categories):
    stats_map = build_category_stats(categories)

    tree_nodes = {
        c.id: {
            "id": c.id,
            "name": c.name,
            "parent_id": c.parent_id,

            "stats": stats_map.get(
                c.id,
                {
                    "total_books": 0,
                    "read_books": 0,
                    "unread_books": 0,
                },
            ),

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
        .options(
            joinedload(models.Category.books),
            joinedload(models.Category.children),
        )
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