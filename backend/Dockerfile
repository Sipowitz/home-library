FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY ./app ./app
COPY alembic.ini ./alembic.ini
COPY ./alembic ./alembic

RUN mkdir -p /app/covers

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
