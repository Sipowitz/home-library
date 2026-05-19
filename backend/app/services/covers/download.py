import os

import uuid

import httpx


COVERS_DIR = "/app/covers"

TIMEOUT = 10.0


async def download_cover(
    remote_url: str | None,
) -> str | None:
    if not remote_url:
        return None

    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT,
        ) as client:
            response = await client.get(
                remote_url
            )

        if response.status_code != 200:
            return None

        content_type = response.headers.get(
            "content-type",
            ""
        )

        if not content_type.startswith(
            "image/"
        ):
            return None

        extension = (
            content_type.split("/")[-1]
            .lower()
            .split(";")[0]
        )

        if extension not in [
            "jpg",
            "jpeg",
            "png",
            "webp",
        ]:
            extension = "jpg"

        filename = (
            f"{uuid.uuid4()}.{extension}"
        )

        filepath = os.path.join(
            COVERS_DIR,
            filename,
        )

        with open(filepath, "wb") as file:
            file.write(response.content)

        return f"/covers/{filename}"

    except Exception:
        return None