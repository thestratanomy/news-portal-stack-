# Local Dev & Deployment Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the news-portal-stack for real local development (`docker compose up` runs everything) and production robustness, replacing the chatbot's stub OpenAI dependency with real Gemini-backed responses.

**Architecture:** No topology change — Ghost (Render/Aiven), Next.js (Vercel), Streamlit chatbot (own service) stay as three separately-deployed services. This plan adds: Gemini LLM wiring in the chatbot, Dockerfiles for frontend/chatbot plus docker-compose additions, hardened webhook auth, loading/error UI states, unit tests (Vitest + pytest), a GitHub Actions CI workflow, and structured JSON logging on both sides.

**Tech Stack:** Next.js 14 (App Router, TypeScript), `@tryghost/content-api`, Vitest; Python 3.11, Streamlit, `google-generativeai`, pytest; Docker/docker-compose; GitHub Actions.

## Global Constraints

- Deployment topology stays at 4 targets: Aiven MySQL, Render (Ghost Docker), Vercel (Next.js), Streamlit Cloud/Render (chatbot). Do not merge or remove any of these.
- Chatbot LLM provider is Gemini via the `google-generativeai` Python SDK — not OpenAI, not Vertex AI.
- Webhook auth keeps the existing `?secret=` query-param model — no HMAC/`X-Ghost-Signature` verification.
- All new local-dev services run via Docker (`docker compose up`) — no instructions to run frontend/chatbot natively for local dev.
- Frontend tests use Vitest. Chatbot tests use pytest. No e2e/browser test tooling in this plan.
- Structured logging is plain JSON lines to stdout/stderr — no external logging service/dependency.
- Never expose `GHOST_ADMIN_API_KEY` or `GEMINI_API_KEY` to the client bundle; both are server/Python-only.

---

### Task 1: Chatbot structured logger + Gemini client with tests

**Files:**
- Create: `chatbot/utils/logger.py`
- Create: `chatbot/utils/gemini_client.py`
- Create: `chatbot/tests/__init__.py`
- Create: `chatbot/tests/test_gemini_client.py`
- Modify: `chatbot/requirements.txt`

**Interfaces:**
- Consumes: nothing from other tasks (this is the first task).
- Produces:
  - `chatbot/utils/logger.py`: `get_logger(name: str) -> logging.Logger` — returns a logger configured with a JSON formatter (`{"level": ..., "msg": ..., "logger": ..., ...extra}`).
  - `chatbot/utils/gemini_client.py`: `is_configured() -> bool`; `stream_reply(prompt: str, context_article: dict | None) -> Iterator[str]` — yields text chunks; on missing API key, API error, or timeout, yields a single fallback string chunk (`"I'm having trouble answering right now — please try again shortly."`) instead of raising.

- [ ] **Step 1: Write the failing tests for the Gemini client**

Create `chatbot/tests/__init__.py` (empty file, makes `tests` a package).

Create `chatbot/tests/test_gemini_client.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd chatbot && python -m pytest tests/test_gemini_client.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'utils.gemini_client'` (or similar import error).

- [ ] **Step 3: Add `google-generativeai` and remove `openai` from requirements**

Modify `chatbot/requirements.txt` — replace the `openai>=1.12.0` line with `google-generativeai>=0.5.0`:

```
streamlit>=1.31.0
requests>=2.31.0
google-generativeai>=0.5.0
python-dotenv>=1.0.1
pytest>=8.0.0
```

Run: `cd chatbot && pip install -r requirements.txt`

- [ ] **Step 4: Write the logger module**

Create `chatbot/utils/logger.py`:

```python
import json
import logging
import sys


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(stream=sys.stdout)
        handler.setFormatter(_JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger
```

- [ ] **Step 5: Write the Gemini client implementation**

Create `chatbot/utils/gemini_client.py`:

```python
import os
from typing import Iterator, Optional

import google.generativeai as genai

from utils.logger import get_logger

logger = get_logger(__name__)

GEMINI_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")

FALLBACK_MESSAGE = "I'm having trouble answering right now — please try again shortly."


def is_configured() -> bool:
    return bool(GEMINI_KEY)


def _get_model():
    genai.configure(api_key=GEMINI_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


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
        yield FALLBACK_MESSAGE
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd chatbot && python -m pytest tests/test_gemini_client.py -v`
Expected: PASS (5 passed)

- [ ] **Step 7: Commit**

```bash
git add chatbot/utils/logger.py chatbot/utils/gemini_client.py chatbot/tests/__init__.py chatbot/tests/test_gemini_client.py chatbot/requirements.txt
git commit -m "feat(chatbot): add Gemini client and JSON logger with tests"
```

---

### Task 2: Wire Gemini into chat UI; add ghost_rag tests; use structured logger

**Files:**
- Modify: `chatbot/components/chat_ui.py`
- Modify: `chatbot/utils/ghost_rag.py`
- Create: `chatbot/tests/test_ghost_rag.py`

**Interfaces:**
- Consumes: `gemini_client.stream_reply(prompt: str, context_article: dict | None) -> Iterator[str]` and `logger.get_logger(name: str) -> logging.Logger` from Task 1.
- Produces: `chat_ui.render_chat_interface(context_article=None)` (signature unchanged, now streams real replies); `ghost_rag.fetch_ghost_articles()` / `ghost_rag.fetch_single_article(slug)` (signatures unchanged, now log via `get_logger` instead of `print`).

- [ ] **Step 1: Write the failing tests for ghost_rag fallback behavior**

Create `chatbot/tests/test_ghost_rag.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd chatbot && python -m pytest tests/test_ghost_rag.py -v`
Expected: FAIL or ERROR — `ghost_rag` currently uses `print()` (not itself a test failure) but this step's real purpose is confirming the test harness runs against the *current* file before edits. If all pass immediately because current fallback logic already matches, note that and proceed directly to Step 3 (logger swap) since that's the actual code change this task makes.

- [ ] **Step 3: Replace `print` with structured logger in ghost_rag.py**

Modify `chatbot/utils/ghost_rag.py` — add the logger import and replace both `print(...)` calls:

```python
import os
import requests
import streamlit as st

from utils.logger import get_logger

logger = get_logger(__name__)

GHOST_URL = os.getenv("GHOST_URL", "http://localhost:2368")
GHOST_KEY = os.getenv("GHOST_CONTENT_API_KEY")
```

Replace `print(f"Error connecting to Ghost API: {e}")` with `logger.error(f"Error connecting to Ghost API: {e}")`.

Replace `print(f"Error connecting to Ghost API for slug {slug}: {e}")` with `logger.error(f"Error connecting to Ghost API for slug {slug}: {e}")`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd chatbot && python -m pytest tests/test_ghost_rag.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Wire chat_ui.py to stream real Gemini replies**

Modify `chatbot/components/chat_ui.py`:

```python
import streamlit as st

from utils.gemini_client import stream_reply


def render_chat_interface(context_article=None):
    if "messages" not in st.session_state:
        st.session_state.messages = [
            {"role": "assistant", "content": "Hello! I am your AI News Assistant. Ask me anything about today's articles!"}
        ]

    if context_article:
        st.info(f"Reading Context: **{context_article.get('title')}**")

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("Ask a question about the news..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            reply = st.write_stream(stream_reply(prompt, context_article))
            st.session_state.messages.append({"role": "assistant", "content": reply})
```

- [ ] **Step 6: Run the full chatbot test suite**

Run: `cd chatbot && python -m pytest -v`
Expected: PASS (all tests from Task 1 and Task 2)

- [ ] **Step 7: Commit**

```bash
git add chatbot/components/chat_ui.py chatbot/utils/ghost_rag.py chatbot/tests/test_ghost_rag.py
git commit -m "feat(chatbot): stream real Gemini replies and log via structured logger"
```

---

### Task 3: Frontend structured logger + ghost.ts using it, with Vitest tests

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/lib/logger.ts`
- Create: `frontend/src/lib/logger.test.ts`
- Modify: `frontend/src/lib/ghost.ts`
- Create: `frontend/src/lib/ghost.test.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: nothing from other tasks (independent of chatbot tasks).
- Produces: `frontend/src/lib/logger.ts`: `logError(msg: string, meta?: Record<string, unknown>) -> void`, `logInfo(msg: string, meta?: Record<string, unknown>) -> void` — both write one JSON line to stdout/stderr. `getPosts()`/`getSinglePost(slug)` in `ghost.ts` keep their existing signatures (`Promise<GhostPost[]>` / `Promise<GhostPost | null>`).

- [ ] **Step 1: Add Vitest tooling to package.json**

Modify `frontend/package.json` — add a `test` script and devDependencies:

```json
{
  "name": "news-portal-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@tryghost/content-api": "^1.4.13",
    "lucide-react": "^0.300.0",
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.10",
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vitest": "^1.3.1"
  }
}
```

Run: `cd frontend && npm install`

- [ ] **Step 2: Create Vitest config**

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write the failing logger test**

Create `frontend/src/lib/logger.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { logError, logInfo } from './logger';

describe('logger', () => {
  it('logInfo writes a JSON line to stdout with level=info', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logInfo('hello', { foo: 'bar' });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(line).toMatchObject({ level: 'info', msg: 'hello', foo: 'bar' });
    spy.mockRestore();
  });

  it('logError writes a JSON line to stderr with level=error', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logError('oops', { code: 500 });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(line).toMatchObject({ level: 'error', msg: 'oops', code: 500 });
    spy.mockRestore();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/logger.test.ts`
Expected: FAIL with "Cannot find module './logger'"

- [ ] **Step 5: Write the logger implementation**

Create `frontend/src/lib/logger.ts`:

```typescript
type LogMeta = Record<string, unknown>;

function writeLine(stream: NodeJS.WriteStream, level: 'info' | 'error', msg: string, meta?: LogMeta) {
  const payload = { level, msg, ...meta };
  stream.write(JSON.stringify(payload) + '\n');
}

export function logInfo(msg: string, meta?: LogMeta): void {
  writeLine(process.stdout, 'info', msg, meta);
}

export function logError(msg: string, meta?: LogMeta): void {
  writeLine(process.stderr, 'error', msg, meta);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/logger.test.ts`
Expected: PASS (2 passed)

- [ ] **Step 7: Write the failing ghost.ts tests**

Create `frontend/src/lib/ghost.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockBrowse = vi.fn();
const mockRead = vi.fn();

vi.mock('@tryghost/content-api', () => ({
  default: vi.fn().mockImplementation(() => ({
    posts: { browse: mockBrowse, read: mockRead },
  })),
}));

import { getPosts, getSinglePost } from './ghost';

describe('ghost.ts', () => {
  beforeEach(() => {
    mockBrowse.mockReset();
    mockRead.mockReset();
  });

  it('getPosts returns posts on success', async () => {
    mockBrowse.mockResolvedValue([{ id: '1', title: 'Post 1' }]);
    const posts = await getPosts();
    expect(posts).toEqual([{ id: '1', title: 'Post 1' }]);
  });

  it('getPosts returns [] when the API throws', async () => {
    mockBrowse.mockRejectedValue(new Error('network error'));
    const posts = await getPosts();
    expect(posts).toEqual([]);
  });

  it('getSinglePost returns the post on success', async () => {
    mockRead.mockResolvedValue({ id: '1', slug: 'hello' });
    const post = await getSinglePost('hello');
    expect(post).toEqual({ id: '1', slug: 'hello' });
  });

  it('getSinglePost returns null when the API throws', async () => {
    mockRead.mockRejectedValue(new Error('not found'));
    const post = await getSinglePost('missing');
    expect(post).toBeNull();
  });
});
```

- [ ] **Step 8: Run test to verify current behavior (should already pass functionally, but confirm)**

Run: `cd frontend && npx vitest run src/lib/ghost.test.ts`
Expected: PASS (4 passed) — the existing try/catch in `ghost.ts` already returns `[]`/`null` on error, so this step validates that behavior before we touch the file for logging.

- [ ] **Step 9: Replace console.error with structured logger in ghost.ts**

Modify `frontend/src/lib/ghost.ts`:

```typescript
import GhostContentAPI from '@tryghost/content-api';
import { GhostPost } from './types';
import { logError } from './logger';

const url = process.env.GHOST_URL || 'http://localhost:2368';
const key = process.env.GHOST_CONTENT_API_KEY || 'ghost_demo_key';

export const ghostApi = new GhostContentAPI({
  url,
  key,
  version: 'v5.0'
});

export async function getPosts(): Promise<GhostPost[]> {
  try {
    const posts = await ghostApi.posts.browse({
      limit: 'all',
      include: ['tags', 'authors']
    });
    return posts as unknown as GhostPost[];
  } catch (error) {
    logError('Error fetching Ghost posts', { error: String(error) });
    return [];
  }
}

export async function getSinglePost(slug: string): Promise<GhostPost | null> {
  try {
    const post = await ghostApi.posts.read(
      { slug },
      { include: ['tags', 'authors'] }
    );
    return post as unknown as GhostPost;
  } catch (error) {
    logError(`Error fetching Ghost post ${slug}`, { error: String(error) });
    return null;
  }
}
```

- [ ] **Step 10: Run all frontend tests to verify they still pass**

Run: `cd frontend && npm test`
Expected: PASS (6 passed total: 2 logger + 4 ghost)

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/src/lib/logger.ts frontend/src/lib/logger.test.ts frontend/src/lib/ghost.ts frontend/src/lib/ghost.test.ts
git commit -m "feat(frontend): add Vitest, structured logger, and ghost.ts tests"
```

---

### Task 4: Harden the revalidate webhook route with tests

**Files:**
- Modify: `frontend/src/app/api/revalidate/route.ts`
- Create: `frontend/src/app/api/revalidate/route.test.ts`

**Interfaces:**
- Consumes: `logError`/`logInfo` from `frontend/src/lib/logger.ts` (Task 3).
- Produces: `POST(request: NextRequest) -> Promise<NextResponse>` (signature unchanged); internal helper `checkRateLimit(ip: string) -> boolean` (exported for testing) and `safeCompare(a: string, b: string) -> boolean` (exported for testing).

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/app/api/revalidate/route.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { POST, safeCompare, checkRateLimit, _resetRateLimitForTests } from './route';

function makeRequest(secret: string | null, ip = '1.2.3.4') {
  const url = secret === null
    ? 'https://example.com/api/revalidate'
    : `https://example.com/api/revalidate?secret=${encodeURIComponent(secret)}`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

describe('safeCompare', () => {
  it('returns true for equal strings', () => {
    expect(safeCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different-length strings', () => {
    expect(safeCompare('abc', 'abcdef')).toBe(false);
  });

  it('returns false for same-length different strings', () => {
    expect(safeCompare('abc123', 'xyz789')).toBe(false);
  });
});

describe('POST /api/revalidate', () => {
  const originalSecret = process.env.REVALIDATION_SECRET;

  beforeEach(() => {
    process.env.REVALIDATION_SECRET = 'test-secret';
    _resetRateLimitForTests();
  });

  afterEach(() => {
    process.env.REVALIDATION_SECRET = originalSecret;
  });

  it('returns 401 for an invalid secret', async () => {
    const res = await POST(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 200 and revalidates for a valid secret', async () => {
    const res = await POST(makeRequest('test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revalidated).toBe(true);
  });

  it('rate-limits after the threshold for the same IP', async () => {
    const ip = '9.9.9.9';
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeRequest('test-secret', ip));
      expect(res.status).toBe(200);
    }
    const blocked = await POST(makeRequest('test-secret', ip));
    expect(blocked.status).toBe(429);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it('allows up to 10 requests per IP per minute', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('5.5.5.5')).toBe(true);
    }
    expect(checkRateLimit('5.5.5.5')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/app/api/revalidate/route.test.ts`
Expected: FAIL — `safeCompare`, `checkRateLimit`, `_resetRateLimitForTests` are not exported yet.

- [ ] **Step 3: Implement the hardened route**

Modify `frontend/src/app/api/revalidate/route.ts`:

```typescript
import { timingSafeEqual } from 'crypto';
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { logError, logInfo } from '../../../lib/logger';

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

let requestLog: Map<string, number[]> = new Map();

export function _resetRateLimitForTests(): void {
  requestLog = new Map();
}

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return true;
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  if (!checkRateLimit(ip)) {
    logError('Revalidate rate limit exceeded', { ip });
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  const secret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.REVALIDATION_SECRET || '';

  if (!secret || !safeCompare(secret, expectedSecret)) {
    logError('Revalidate invalid secret', { ip });
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  try {
    revalidateTag('ghost-posts');
    logInfo('Revalidated ghost-posts tag', { ip });
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    logError('Error revalidating', { error: String(err) });
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/api/revalidate/route.test.ts`
Expected: PASS (7 passed)

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd frontend && npm test`
Expected: PASS (13 passed total)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/api/revalidate/route.ts frontend/src/app/api/revalidate/route.test.ts
git commit -m "feat(frontend): harden revalidate webhook with timing-safe compare and rate limiting"
```

---

### Task 5: Loading and error UI states for homepage and post pages

**Files:**
- Create: `frontend/src/app/loading.tsx`
- Create: `frontend/src/app/error.tsx`
- Create: `frontend/src/app/posts/[slug]/loading.tsx`
- Create: `frontend/src/app/posts/[slug]/error.tsx`

**Interfaces:**
- Consumes: existing `Header` component (`frontend/src/components/Header.tsx`, no props).
- Produces: standard Next.js App Router special files — no exports consumed by other tasks.

- [ ] **Step 1: Create homepage loading skeleton**

Create `frontend/src/app/loading.tsx`:

```typescript
import Header from '../components/Header';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 border-b border-slate-200 pb-4 animate-pulse">
          <div className="h-8 w-64 bg-slate-200 rounded" />
          <div className="h-4 w-96 bg-slate-200 rounded mt-3" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse">
              <div className="h-40 bg-slate-200 rounded mb-4" />
              <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-1/2 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create homepage error boundary**

Create `frontend/src/app/error.tsx`:

```typescript
'use client';

import Header from '../components/Header';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="p-12 text-center bg-white rounded-lg border border-slate-200">
          <p className="text-slate-700 font-medium mb-2">We couldn't load the latest articles.</p>
          <p className="text-slate-500 text-sm mb-4">Please check your connection and try again.</p>
          <button
            onClick={() => reset()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Try again
          </button>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create post-page loading skeleton**

Create `frontend/src/app/posts/[slug]/loading.tsx`:

```typescript
import Header from '../../../components/Header';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-white border-x border-slate-200 my-6 rounded-lg shadow-sm animate-pulse">
        <div className="h-4 w-24 bg-slate-200 rounded mb-4" />
        <div className="h-10 w-full bg-slate-200 rounded mb-4" />
        <div className="h-4 w-48 bg-slate-200 rounded mb-8" />
        <div className="h-64 w-full bg-slate-200 rounded mb-8" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-200 rounded" />
          <div className="h-4 w-2/3 bg-slate-200 rounded" />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create post-page error boundary**

Create `frontend/src/app/posts/[slug]/error.tsx`:

```typescript
'use client';

import Header from '../../../components/Header';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-white border-x border-slate-200 my-6 rounded-lg shadow-sm">
        <div className="p-12 text-center">
          <p className="text-slate-700 font-medium mb-2">We couldn't load this article.</p>
          <p className="text-slate-500 text-sm mb-4">Please check your connection and try again.</p>
          <button
            onClick={() => reset()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Try again
          </button>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Verify the build succeeds**

Run: `cd frontend && npm run build`
Expected: Build completes with no type or compile errors, and the route list includes `/`, `/posts/[slug]` with their `loading`/`error` boundaries recognized (no explicit test — App Router loading/error boundaries are framework-verified UI states, out of scope for Vitest per the spec's testing strategy).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/loading.tsx frontend/src/app/error.tsx "frontend/src/app/posts/[slug]/loading.tsx" "frontend/src/app/posts/[slug]/error.tsx"
git commit -m "feat(frontend): add loading skeletons and error boundaries for homepage and post pages"
```

---

### Task 6: ChatDrawer iframe loading/error handling

**Files:**
- Modify: `frontend/src/components/ChatDrawer.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ChatDrawer({ currentSlug }: { currentSlug?: string })` (signature unchanged).

- [ ] **Step 1: Add loading spinner and load-timeout fallback to the iframe**

Modify `frontend/src/components/ChatDrawer.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, X } from 'lucide-react';

const IFRAME_LOAD_TIMEOUT_MS = 8000;

export default function ChatDrawer({ currentSlug }: { currentSlug?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const streamlitUrl = process.env.NEXT_PUBLIC_STREAMLIT_URL || 'http://localhost:8501';
  const embedUrl = currentSlug
    ? `${streamlitUrl}/?slug=${encodeURIComponent(currentSlug)}`
    : streamlitUrl;

  useEffect(() => {
    if (!isOpen || iframeLoaded) return;

    timeoutRef.current = setTimeout(() => {
      setIframeFailed(true);
    }, IFRAME_LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen, iframeLoaded]);

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setIframeFailed(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium"
      >
        <Bot size={24} />
        <span className="hidden sm:inline">Ask AI News Assistant</span>
      </button>

      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-blue-400" />
              <h3 className="font-semibold text-sm">AI News Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:text-slate-300">
              <X size={20} />
            </button>
          </div>
          <div className="relative flex-1 w-full h-full bg-slate-50">
            {!iframeLoaded && !iframeFailed && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
              </div>
            )}
            {iframeFailed && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                <p className="text-slate-500 text-sm">
                  Assistant is unavailable right now. Please try again shortly.
                </p>
              </div>
            )}
            <iframe
              src={embedUrl}
              onLoad={handleIframeLoad}
              className="w-full h-full border-none"
              title="Streamlit News AI Chatbot"
              style={{ visibility: iframeLoaded ? 'visible' : 'hidden' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify the build succeeds**

Run: `cd frontend && npm run build`
Expected: Build completes with no type or compile errors (manual QA check per spec: open the chat drawer locally and confirm the spinner shows then clears once Streamlit loads — no Vitest coverage for this DOM/timer interaction, consistent with the spec's testing strategy).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatDrawer.tsx
git commit -m "feat(frontend): add loading spinner and timeout fallback to ChatDrawer iframe"
```

---

### Task 7: Dockerfiles, docker-compose, and README for full local Docker workflow

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Create: `chatbot/Dockerfile`
- Create: `chatbot/.dockerignore`
- Modify: `docker-compose.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: nothing (infra-only task).
- Produces: `docker compose up` starts `ghost`, `db`, `frontend` (port 3000), `chatbot` (port 8501).

- [ ] **Step 1: Write the frontend Dockerfile**

Create `frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
CMD ["npm", "start"]
```

Create `frontend/.dockerignore`:

```
node_modules
.next
npm-debug.log
.env.local
```

- [ ] **Step 2: Write the chatbot Dockerfile**

Create `chatbot/Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8501
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

Create `chatbot/.dockerignore`:

```
__pycache__
*.pyc
.env
tests
```

- [ ] **Step 3: Extend docker-compose.yml with frontend and chatbot services**

Modify `docker-compose.yml`:

```yaml
version: '3.8'

services:
  ghost:
    image: ghost:5-alpine
    restart: always
    ports:
      - "2368:2368"
    environment:
      database__client: mysql
      database__connection__host: db
      database__connection__user: root
      database__connection__password: ghost_db_password
      database__connection__database: ghost
      url: http://localhost:2368
    volumes:
      - ghost_data:/var/lib/ghost/content
    depends_on:
      - db

  db:
    image: mysql:8.0
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ghost_db_password
      MYSQL_DATABASE: ghost
    volumes:
      - db_data:/var/lib/mysql

  frontend:
    build: ./frontend
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - ./frontend/.env.local
    depends_on:
      - ghost

  chatbot:
    build: ./chatbot
    restart: always
    ports:
      - "8501:8501"
    env_file:
      - ./chatbot/.env
    depends_on:
      - ghost

volumes:
  ghost_data:
  db_data:
```

- [ ] **Step 4: Write the root README with local dev instructions**

Create `README.md`:

```markdown
# News Portal Stack

Headless Ghost CMS + Next.js frontend + Streamlit AI chatbot.

## Local Development

1. **Prerequisites:** Docker and Docker Compose installed.

2. **Set up environment files:**
   ```bash
   cp .env.example frontend/.env.local
   cp .env.example chatbot/.env
   ```
   Edit each file to fill in real values. For local dev, `GHOST_URL` in both should point to `http://ghost:2368` (the in-network service name), and `GEMINI_API_KEY` needs a real key from Google AI Studio for the chatbot to respond with real answers (it falls back gracefully if omitted).

3. **Start everything:**
   ```bash
   docker compose up --build
   ```
   This starts Ghost (`:2368`), MySQL, the Next.js frontend (`:3000`), and the Streamlit chatbot (`:8501`).

4. **First-time Ghost setup:** visit `http://localhost:2368/ghost` and complete the admin setup wizard, then create a custom integration to get a Content API key for `frontend/.env.local` and `chatbot/.env`.

## Deployment

See `render.yaml` (Ghost on Render + Aiven MySQL), `frontend/vercel.json` (Next.js on Vercel), and `chatbot/.streamlit/config.toml` (Streamlit Cloud). Full environment variable schema is documented in `CLAUDE.md`.
```

- [ ] **Step 5: Verify the compose stack builds**

Run: `docker compose config`
Expected: No errors — valid compose file with 4 services (`ghost`, `db`, `frontend`, `chatbot`).

- [ ] **Step 6: Commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore chatbot/Dockerfile chatbot/.dockerignore docker-compose.yml README.md
git commit -m "feat(infra): add Dockerfiles and compose services for full local Docker workflow"
```

---

### Task 8: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm test` (Task 3/4), `npm run build` (existing), `npm run lint` (existing), `pytest` (Task 1/2), `pip install -r requirements.txt` (existing).
- Produces: CI job named `frontend` and CI job named `chatbot`, both running on push/PR.

- [ ] **Step 1: Write the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm install
      - run: npm run lint
      - run: npm test
      - run: npm run build

  chatbot:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: chatbot
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: python -m pytest -v
```

- [ ] **Step 2: Verify the workflow file is valid YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: No output/error (valid YAML). If the `yaml` module is unavailable, run `cat .github/workflows/ci.yml` and visually confirm indentation/structure matches the block above.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add GitHub Actions workflow for frontend and chatbot"
```

---

### Task 9: Update CLAUDE.md and .env.example for the Gemini env var schema

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing (docs-only task).
- Produces: nothing consumed by other tasks — this is the final documentation-sync task.

- [ ] **Step 1: Update .env.example**

Modify `.env.example`:

```
# Frontend Environment Variables
GHOST_URL="https://cms.yourdomain.com"
GHOST_CONTENT_API_KEY="your_ghost_content_api_key_here"
NEXT_PUBLIC_STREAMLIT_URL="https://your-app.streamlit.app"
REVALIDATION_SECRET="your_shared_webhook_secret_here"

# Chatbot Environment Variables
GEMINI_API_KEY="your_gemini_api_key_here"
ALLOWED_ORIGIN="https://yourdomain.com"
```

- [ ] **Step 2: Update CLAUDE.md's Environment Variables Schema section**

Modify `CLAUDE.md` — in the "5. Environment Variables Schema" section, replace the "Streamlit (chatbot/.env or st.secrets)" code block's `OPENAI_API_KEY="your_llm_api_key"` line with `GEMINI_API_KEY="your_gemini_api_key"`.

- [ ] **Step 3: Verify no remaining references to OpenAI**

Run: `grep -rn "OPENAI\|openai" --include="*.md" --include="*.example" --include="*.py" --include="*.txt" . 2>/dev/null | grep -v node_modules`
Expected: No output (all OpenAI references replaced with Gemini across docs, env files, and chatbot code).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .env.example
git commit -m "docs: update env var schema to Gemini instead of OpenAI"
```
