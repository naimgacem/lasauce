"""Media route (`/media/{key}`) — the dev storage backend's read path.

Mounted at the application root, not under `/api/v1`: these URLs are embedded in
`<img>` tags and shared, so they should not carry an API version.

Item photos are public by design (browsing is public), so there is no per-request
access check here — the guard that matters is `LocalStorage._resolve`, which
refuses any key escaping the media root. In production `STORAGE_PROVIDER=s3`
serves signed URLs straight from the bucket and this route is unused.
"""

from __future__ import annotations

from fastapi import APIRouter, Response

from app.core.exceptions import NotFoundError
from app.storage import get_storage

router = APIRouter(tags=["media"])

# Extension -> content type. Only formats the pipeline can produce.
CONTENT_TYPES = {
    "webp": "image/webp",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
}


@router.get("/media/{key:path}", summary="Serve a stored object")
async def serve_media(key: str) -> Response:
    extension = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    content_type = CONTENT_TYPES.get(extension)
    if content_type is None:
        raise NotFoundError("Media not found")

    try:
        data = await get_storage().open(key)
    except (FileNotFoundError, ValueError) as exc:
        # ValueError = traversal attempt rejected by the backend. Answering 404
        # rather than 403 avoids confirming what lies outside the media root.
        raise NotFoundError("Media not found") from exc

    return Response(
        content=data,
        media_type=content_type,
        headers={
            # Keys are content-addressed (a new upload gets a new uuid), so the
            # bytes behind a key never change and can be cached hard.
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )
