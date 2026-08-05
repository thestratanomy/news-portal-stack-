from unittest.mock import MagicMock, patch

import requests

from utils import ghost_rag


def test_fetch_ghost_articles_returns_empty_when_not_configured(monkeypatch):
    monkeypatch.setattr(ghost_rag, "GHOST_KEY", None)
    ghost_rag.fetch_ghost_articles.clear()
    assert ghost_rag.fetch_ghost_articles() == []


def test_fetch_ghost_articles_returns_empty_on_timeout(monkeypatch):
    monkeypatch.setattr(ghost_rag, "GHOST_KEY", "fake-key")
    ghost_rag.fetch_ghost_articles.clear()
    with patch("utils.ghost_rag.requests.get", side_effect=requests.exceptions.Timeout):
        assert ghost_rag.fetch_ghost_articles() == []


def test_fetch_ghost_articles_returns_empty_on_non_200(monkeypatch):
    monkeypatch.setattr(ghost_rag, "GHOST_KEY", "fake-key")
    ghost_rag.fetch_ghost_articles.clear()
    mock_response = MagicMock(status_code=500)
    with patch("utils.ghost_rag.requests.get", return_value=mock_response):
        assert ghost_rag.fetch_ghost_articles() == []


def test_fetch_ghost_articles_returns_posts_on_success(monkeypatch):
    monkeypatch.setattr(ghost_rag, "GHOST_KEY", "fake-key")
    ghost_rag.fetch_ghost_articles.clear()
    mock_response = MagicMock(status_code=200)
    mock_response.json.return_value = {"posts": [{"title": "A"}]}
    with patch("utils.ghost_rag.requests.get", return_value=mock_response):
        assert ghost_rag.fetch_ghost_articles() == [{"title": "A"}]


def test_fetch_single_article_returns_none_when_not_configured(monkeypatch):
    monkeypatch.setattr(ghost_rag, "GHOST_KEY", None)
    ghost_rag.fetch_single_article.clear()
    assert ghost_rag.fetch_single_article("some-slug") is None


def test_fetch_single_article_returns_none_on_timeout(monkeypatch):
    monkeypatch.setattr(ghost_rag, "GHOST_KEY", "fake-key")
    ghost_rag.fetch_single_article.clear()
    with patch("utils.ghost_rag.requests.get", side_effect=requests.exceptions.Timeout):
        assert ghost_rag.fetch_single_article("some-slug") is None
