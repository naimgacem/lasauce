"""Seed demo lost & found reports, with photos.

Creates a demo reporter, posts a spread of lost/found items across several
wilayas, and attaches a real photo to each so the browse grid has something to
show. Idempotent-ish: re-running adds duplicates, so wipe first if needed.

Usage:  docker compose exec api python -m app.db.seed_demo
"""
from __future__ import annotations

import io
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

import os

# Runs against the API over HTTP so it exercises the real validation and
# image pipeline. Inside the api container the default is correct.
API = os.environ.get("SEED_API_URL", "http://localhost:8000/api/v1")
EMAIL = "demo@lasauce.dz"
PASSWORD = "supersecret123"

# (type, title, description, wilaya_code, category_slug, colour, claim_question, photo_seed)
ITEMS = [
    (
        "found", "Single AirPod — obviously the expensive half",
        "Found by the tram stop in Algiers. Its twin is presumably living a better "
        "life somewhere warm. Comes with 4% battery and a great deal of regret.",
        16, "electronics", "white",
        "Which side is it, left or right?", "airpod",
    ),
    (
        "lost", "House keys on a keychain that says 'DON'T LOSE ME'",
        "The irony has been noted by everyone I've told. Unlike the keys, which "
        "have not been noted by anyone. Three keys, one bottle opener I'll miss most.",
        31, "keys", "silver",
        "What does the keychain say?", "keys",
    ),
    (
        "found", "Umbrella, in a country where it rains four times a year",
        "Someone left this at a café in Oran. It was actively raining. They chose "
        "to walk into it. Genuinely one of the bravest things I've witnessed.",
        31, "other", "navy",
        "What colour is the handle?", "umbrella",
    ),
    (
        "lost", "Prescription glasses. I cannot see this post.",
        "Black frames, fairly strong prescription. If you find them, wave at me. "
        "I won't see you, but I'll appreciate the gesture on principle.",
        23, "other", "black",
        "What shape are the frames?", "glasses",
    ),
    (
        "found", "USB stick labelled 'FINAL_final_v3_REAL'",
        "Found in a lecture hall in Constantine. Someone's entire thesis is on "
        "here and I refuse to look at it out of respect. Please claim it before "
        "your deadline, I'm begging you.",
        25, "electronics", "blue",
        "What's written on the label?", "usb",
    ),
    (
        "lost", "Black wallet — mostly empty, sentimentally priceless",
        "Contained 200 DA, an expired gym card, and a coffee loyalty card with 9 "
        "stamps out of 10. The free coffee was RIGHT THERE.",
        16, "wallets-purses", "black",
        "How many stamps are on the loyalty card?", "wallet",
    ),
    (
        "found", "One (1) shoe. Size 43. Left foot only.",
        "Found on the beach in Annaba. I have several questions, chief among them: "
        "how do you leave with one shoe and not immediately notice?",
        23, "clothing", "brown",
        "What brand is it?", "shoe",
    ),
    (
        "lost", "Water bottle that survived 3 years and 1 airport",
        "Dented, covered in stickers, structurally questionable, irreplaceable. "
        "Answers to 'the blue one'. Has outlived two phones and one relationship.",
        19, "other", "blue",
        "Name one sticker on it.", "bottle",
    ),
    (
        "found", "Charging cable — the good kind that actually fits",
        "Found under a seat on bus 12 in Blida. I am guarding it with my life "
        "until the rightful owner appears. Do not test me.",
        9, "electronics", "white",
        "What connector does it have?", "cable",
    ),
    (
        "lost", "Umbrella I lost while looking for my other umbrella",
        "Yes. I'm aware. Lost somewhere between the market and home in Tizi Ouzou. "
        "At this point I'd settle for either one.",
        15, "other", "green",
        "What pattern is on it?", "umbrella2",
    ),
]


def call(path: str, data=None, token=None, method=None):
    url = f"{API}{path}"
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method or ("POST" if body else "GET"))
    if body:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def upload_photo(item_id: str, token: str, image: bytes, name: str) -> bool:
    """Multipart upload built by hand to avoid a requests dependency."""
    boundary = "----seedboundary7MA4YWxkTrZu0gW"
    parts = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="{name}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + image + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{API}/items/{item_id}/images", data=parts, method="POST"
    )
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60):
            return True
    except urllib.error.HTTPError as e:
        print(f"      upload failed: {e.code} {e.read()[:160]!r}")
        return False


def fetch_photo(seed: str) -> bytes | None:
    """Real photography from picsum; falls back to a generated gradient."""
    try:
        url = f"https://picsum.photos/seed/{seed}/1200/900"
        with urllib.request.urlopen(url, timeout=20) as r:
            return r.read()
    except Exception:
        return None


def generate_photo(seed: str) -> bytes:
    """Deterministic gradient, used when there's no internet."""
    from PIL import Image, ImageDraw

    h = sum(ord(c) for c in seed) % 360
    img = Image.new("RGB", (1200, 900))
    d = ImageDraw.Draw(img)
    for y in range(900):
        t = y / 900
        d.line(
            [(0, y), (1200, y)],
            fill=(
                int(40 + 120 * t + (h % 60)),
                int(70 + 90 * t + (h % 40)),
                int(90 + 70 * t + (h % 80)),
            ),
        )
    d.ellipse([420, 270, 780, 630], outline=(255, 255, 255), width=8)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88)
    return buf.getvalue()


def main() -> int:
    # Reporter account
    try:
        call("/auth/register", {
            "email": EMAIL, "password": PASSWORD,
            "full_name": "Yacine Demo", "phone": "0770 11 22 33",
        })
        print(f"registered {EMAIL}")
    except urllib.error.HTTPError as e:
        if e.code != 409:
            raise
        print(f"{EMAIL} already exists")

    token = call("/auth/login", {"email": EMAIL, "password": PASSWORD})["access_token"]
    cats = {c["slug"]: c["id"] for c in call("/categories")}

    online = fetch_photo("probe") is not None
    print(f"photos: {'picsum (real photography)' if online else 'generated gradients (offline)'}\n")

    created = 0
    for kind, title, desc, wilaya, slug, colour, question, seed in ITEMS:
        item = call("/items", {
            "type": kind,
            "title": title,
            "description": desc,
            "category_id": cats.get(slug),
            "color": colour,
            "wilaya_code": wilaya,
            "lost_or_found_at": "2026-07-26T10:00:00Z",
            "claim_questions": [question],
        }, token=token)

        photo = fetch_photo(seed) if online else generate_photo(seed)
        ok = upload_photo(item["id"], token, photo, f"{seed}.jpg") if photo else False
        created += 1
        print(f"  [{kind:5}] {title[:52]:54} {'photo ok' if ok else 'no photo'}")

    print(f"\nseeded {created} items as {EMAIL} / {PASSWORD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
