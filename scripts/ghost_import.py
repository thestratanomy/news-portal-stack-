#!/usr/bin/env python3
"""Create a draft post in Ghost via the Admin API.

Usage: python3 ghost_import.py <title> <html_file> [tag1,tag2,...]
Reads GHOST_ADMIN_API_KEY and GHOST_ADMIN_URL from the environment.
"""
import sys
import os
import json
import time
import jwt
import requests

GHOST_ADMIN_URL = os.environ.get("GHOST_ADMIN_URL", "http://localhost:2368")
GHOST_ADMIN_API_KEY = os.environ["GHOST_ADMIN_API_KEY"]


def make_token():
    key_id, secret = GHOST_ADMIN_API_KEY.split(":")
    iat = int(time.time())
    header = {"alg": "HS256", "typ": "JWT", "kid": key_id}
    payload = {
        "iat": iat,
        "exp": iat + 300,
        "aud": "/admin/",
    }
    return jwt.encode(payload, bytes.fromhex(secret), algorithm="HS256", headers=header)


def create_draft(title, html, tags=None):
    token = make_token()
    headers = {
        "Authorization": f"Ghost {token}",
        "Content-Type": "application/json",
    }
    post = {
        "posts": [
            {
                "title": title,
                "html": html,
                "status": "draft",
                "tags": [{"name": t} for t in (tags or [])],
            }
        ]
    }
    resp = requests.post(
        f"{GHOST_ADMIN_URL}/ghost/api/admin/posts/?source=html",
        headers=headers,
        data=json.dumps(post),
    )
    resp.raise_for_status()
    return resp.json()["posts"][0]


if __name__ == "__main__":
    title = sys.argv[1]
    html_file = sys.argv[2]
    tags = sys.argv[3].split(",") if len(sys.argv) > 3 else []
    with open(html_file, "r") as f:
        html = f.read()
    result = create_draft(title, html, tags)
    print(f"Created draft: {result['url']} (id={result['id']})")
