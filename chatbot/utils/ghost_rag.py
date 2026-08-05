import os
import requests
import streamlit as st

from utils.logger import get_logger

logger = get_logger(__name__)

GHOST_URL = os.getenv("GHOST_URL", "http://localhost:2368")
GHOST_KEY = os.getenv("GHOST_CONTENT_API_KEY")


def _is_configured() -> bool:
    return bool(GHOST_URL and GHOST_KEY)


@st.cache_data(ttl=300)
def fetch_ghost_articles():
    if not _is_configured():
        st.warning("Ghost API key is not configured — showing no articles.", icon="⚠️")
        return []

    endpoint = f"{GHOST_URL}/ghost/api/content/posts/?key={GHOST_KEY}&include=tags,authors&limit=10"
    try:
        response = requests.get(endpoint, timeout=5)
        if response.status_code == 200:
            return response.json().get("posts", [])
        st.warning(f"Ghost API returned status {response.status_code}.", icon="⚠️")
        return []
    except requests.exceptions.Timeout:
        st.warning("Ghost API request timed out. Try again shortly.", icon="⚠️")
        return []
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to Ghost API: {e}")
        st.warning("Unable to reach the Ghost API right now.", icon="⚠️")
        return []


@st.cache_data(ttl=300)
def fetch_single_article(slug: str):
    if not _is_configured():
        st.warning("Ghost API key is not configured — article unavailable.", icon="⚠️")
        return None

    endpoint = f"{GHOST_URL}/ghost/api/content/posts/slug/{slug}/?key={GHOST_KEY}"
    try:
        response = requests.get(endpoint, timeout=5)
        if response.status_code == 200:
            posts = response.json().get("posts", [])
            return posts[0] if posts else None
        st.warning(f"Ghost API returned status {response.status_code}.", icon="⚠️")
        return None
    except requests.exceptions.Timeout:
        st.warning("Ghost API request timed out. Try again shortly.", icon="⚠️")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error connecting to Ghost API for slug {slug}: {e}")
        st.warning("Unable to reach the Ghost API right now.", icon="⚠️")
        return None
