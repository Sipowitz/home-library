from __future__ import annotations

import warnings
from pathlib import Path

from PIL import Image, UnidentifiedImageError

MAX_IMAGE_PIXELS = 80_000_000
SUPPORTED_IMAGES = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}


class ImageValidationError(ValueError):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


def validate_image(path: Path, expected_media_type: str | None = None) -> tuple[str, str]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                width, height = image.size
                image_format = image.format
                if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                    raise ImageValidationError("dimensions")
                image.load()
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning, OSError, ValueError) as exc:
        raise ImageValidationError("invalid") from exc

    if image_format not in SUPPORTED_IMAGES:
        raise ImageValidationError("unsupported")
    media_type, extension = SUPPORTED_IMAGES[image_format]
    if expected_media_type and expected_media_type != media_type:
        raise ImageValidationError("media_type_mismatch")
    return media_type, extension
