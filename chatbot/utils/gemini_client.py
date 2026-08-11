import os
from typing import Iterator, Optional

import google.generativeai as genai
import streamlit as st

from utils.logger import get_logger

logger = get_logger(__name__)

GEMINI_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")

FALLBACK_MESSAGE = "I'm having trouble answering right now — please try again shortly."


def is_configured() -> bool:
    return bool(GEMINI_KEY)


def _get_model():
    genai.configure(api_key=GEMINI_KEY)
    return genai.GenerativeModel("gemini-flash-latest")


def _build_prompt(prompt: str, context_article: Optional[dict]) -> str:
    if context_article:
        title = context_article.get("title", "")
        excerpt = context_article.get("excerpt", "")
        return (
            f"You are a news assistant. The reader is currently viewing this article:\n"
            f"Title: {title}\nExcerpt: {excerpt}\n\n"
            f"Answer the reader's question, grounded in this article when relevant.\n"
            f"Question: {prompt}"
        )
    return f"You are a news assistant. Answer this reader question: {prompt}"


def stream_reply(prompt: str, context_article: Optional[dict]) -> Iterator[str]:
    if not is_configured():
        logger.warning("Gemini API key not configured; returning fallback reply")
        yield FALLBACK_MESSAGE
        return

    try:
        model = _get_model()
        full_prompt = _build_prompt(prompt, context_article)
        response_chunks = model.generate_content(full_prompt, stream=True)
        for chunk in response_chunks:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        st.warning("The assistant is temporarily unavailable — using a fallback response.", icon="⚠️")
        yield FALLBACK_MESSAGE
