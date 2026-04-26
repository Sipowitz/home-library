from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException  # ✅ ADD

from .database import engine, Base
from .routers import books, auth, locations, categories, search, stats, backup

# ✅ Error handlers
from .core.error_handlers import (
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler,
)

app = FastAPI(redirect_slashes=False)

# ✅ Create tables
Base.metadata.create_all(bind=engine)

# ✅ CORS (open for now — tighten later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# ✅ REGISTER ERROR HANDLERS
# ---------------------------
app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # ✅ FIX
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# ---------------------------
# ✅ ROUTERS
# ---------------------------
app.include_router(books.router)
app.include_router(auth.router)
app.include_router(locations.router)
app.include_router(categories.router)
app.include_router(search.router)
app.include_router(stats.router)
app.include_router(backup.router)

@app.get("/")
def root():
    return {"message": "Library API is running"}