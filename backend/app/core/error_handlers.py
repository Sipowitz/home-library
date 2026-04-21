from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

import logging

logger = logging.getLogger(__name__)


# ---------------------------
# 🔥 HTTP EXCEPTIONS (expected)
# ---------------------------
async def http_exception_handler(request: Request, exc: HTTPException):
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