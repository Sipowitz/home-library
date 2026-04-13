from fastapi import FastAPI
from .database import engine, Base
from .routers import books

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(books.router)


@app.get("/")
def root():
    return {"message": "Library API is running"}



from .routers import books, auth

app.include_router(books.router)
app.include_router(auth.router)


from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
