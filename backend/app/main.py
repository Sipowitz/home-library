from fastapi import (
    FastAPI,
)

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from fastapi.exceptions import (
    RequestValidationError,
)

from fastapi.staticfiles import (
    StaticFiles,
)

from starlette.exceptions import (
    HTTPException as StarletteHTTPException,
)

from .routers import (
    books,
    auth,
    locations,
    categories,
    search,
    stats,
    backup,
    preferences,
    provider_settings,
)

from .core.error_handlers import (
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler,
)

app = FastAPI()

# ---------------------------
# ✅ STATIC COVER STORAGE
# ---------------------------

app.mount(
    "/covers",
    StaticFiles(directory="covers"),
    name="covers",
)

# ---------------------------
# ✅ CORS
# ---------------------------

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

app.add_exception_handler(
    StarletteHTTPException,
    http_exception_handler,
)

app.add_exception_handler(
    RequestValidationError,
    validation_exception_handler,
)

app.add_exception_handler(
    Exception,
    general_exception_handler,
)

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

app.include_router(preferences.router)

app.include_router(
    provider_settings.router
)


@app.get("/")
def root():
    return {
        "message": "Library API is running"
    }