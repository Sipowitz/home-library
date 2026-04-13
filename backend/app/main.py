from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import books, auth

app = FastAPI()

# ✅ Create tables
Base.metadata.create_all(bind=engine)

# ✅ CORS (must be BEFORE routers is fine, but order here is safe)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Include routers (ONLY ONCE)
app.include_router(books.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {"message": "Library API is running"}
