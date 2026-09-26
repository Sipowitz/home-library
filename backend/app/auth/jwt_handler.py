from datetime import datetime, timedelta
from jose import jwt
from app.core.config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_YEARS = 10
ACCESS_TOKEN_EXPIRE_DELTA = timedelta(days=365 * ACCESS_TOKEN_EXPIRE_YEARS)


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.utcnow() + ACCESS_TOKEN_EXPIRE_DELTA
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
