from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import books, auth, locations, categories, search, stats

app = FastAPI()

# ✅ Create tables
Base.metadata.create_all(bind=engine)

# ✅ DEBUG CORS (OPEN — guaranteed to work)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TEMP open
    allow_credentials=False,  # IMPORTANT: must be False with "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Routers
app.include_router(books.router)
app.include_router(auth.router)
app.include_router(locations.router)
app.include_router(categories.router)
app.include_router(search.router)
app.include_router(stats.router)


@app.get("/")
def root():
    return {"message": "Library API is running"}