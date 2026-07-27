import os
from unittest.mock import MagicMock, patch

import pytest

from utils import gemini_client


def test_is_configured_false_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(gemini_client, "GEMINI_KEY", None)
    assert gemini_client.is_configured() is False


def test_is_configured_true_with_key(monkeypatch):
    monkeypatch.setattr(gemini_client, "GEMINI_KEY", "fake-key")
    assert gemini_client.is_configured() is True


def test_stream_reply_falls_back_when_not_configured(monkeypatch):
    monkeypatch.setattr(gemini_client, "GEMINI_KEY", None)
    chunks = list(gemini_client.stream_reply("hello", None))
    assert len(chunks) == 1
    assert "trouble" in chunks[0].lower()


def test_stream_reply_streams_model_chunks(monkeypatch):
    monkeypatch.setattr(gemini_client, "GEMINI_KEY", "fake-key")

    fake_chunk_1 = MagicMock(text="Hello ")
    fake_chunk_2 = MagicMock(text="world!")

    mock_model = MagicMock()
    mock_model.generate_content.return_value = [fake_chunk_1, fake_chunk_2]

    with patch.object(gemini_client, "_get_model", return_value=mock_model):
        chunks = list(gemini_client.stream_reply("hi", {"title": "Test Article"}))

    assert chunks == ["Hello ", "world!"]
    mock_model.generate_content.assert_called_once()


def test_stream_reply_falls_back_on_api_error(monkeypatch):
    monkeypatch.setattr(gemini_client, "GEMINI_KEY", "fake-key")

    mock_model = MagicMock()
    mock_model.generate_content.side_effect = Exception("quota exceeded")

    with patch.object(gemini_client, "_get_model", return_value=mock_model):
        chunks = list(gemini_client.stream_reply("hi", None))

    assert len(chunks) == 1
    assert "trouble" in chunks[0].lower()
