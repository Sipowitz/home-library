from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

import logging

logger = logging.getLogger(__name__)


# ---------------------------
# 🔥 HTTP EXCEPTIONS (expected)
# ---------------------------
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
        },
    )


# ---------------------------
# ❌ VALIDATION ERRORS
# ---------------------------
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "message": "Validation error",
            "details": exc.errors(),
        },
    )


# ---------------------------
# 💥 UNHANDLED EXCEPTIONS
# ---------------------------
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)

    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "Internal server error",
        },
    )


# ---------------------------
# 🚀 REGISTER HANDLERS
# ---------------------------
def register_error_handlers(app):
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)