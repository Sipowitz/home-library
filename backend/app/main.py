from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import books, auth, locations, categories

app = FastAPI()

# ✅ Create tables
Base.metadata.create_all(bind=engine)

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Include routers
app.include_router(books.router)
app.include_router(auth.router)
app.include_router(locations.router)
app.include_router(categories.router)


@app.get("/")
def root():
    return {"message": "Library API is running"}