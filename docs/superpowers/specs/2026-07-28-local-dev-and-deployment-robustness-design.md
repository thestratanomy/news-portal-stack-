# Local Dev & Deployment Robustness — Design Spec

**Date:** 2026-07-28
**Status:** Approved for planning

## Purpose

Finalize the news-portal-stack (Ghost + Next.js + Streamlit) described in `CLAUDE.md` for real local development and production deployment. Two concrete gaps drove this work:

1. The chatbot's chat reply is a hardcoded echo string — no real LLM call, despite an LLM dependency in `requirements.txt`.
2. There is no single local dev workflow (no Dockerfiles for frontend/chatbot, no docs), and several production-hardening gaps exist (webhook secret comparison, missing loading/error states, no tests, no CI, ad-hoc logging).

The overall 4-target deployment architecture (Aiven MySQL, Render/Ghost, Vercel/Next.js, Streamlit chatbot) is **not** changing. Only the chatbot's LLM provider changes, from OpenAI to Gemini.

## Architecture (unchanged)

```
Ghost Admin (editors) → Ghost CMS (Render, Docker, Aiven MySQL)
                              │  @tryghost/content-api
                              ▼
                        Next.js (Vercel)  ←── webhook ──  Ghost (on publish/update)
                              │  iframe + postMessage
                              ▼
                     Streamlit Chatbot (own service)
                              │  Gemini API
                              ▼
                         Google Gemini
```

Ghost remains a strict headless CMS. Next.js remains RSC-first, fetching only through `src/lib/ghost.ts`. The chatbot remains a separate Streamlit service embedded via iframe, receiving article context via `?slug=` query param synced through `postMessage`.

## A. Chatbot: Gemini integration

- Replace `openai` with `google-generativeai` in `chatbot/requirements.txt`.
- New `chatbot/utils/gemini_client.py`: wraps `genai.GenerativeModel`, builds a prompt grounding the model in the active article (from `ghost_rag.fetch_single_article`) plus the user's question, exposes `stream_reply(prompt: str, context_article: dict | None) -> Iterator[str]`.
- `chatbot/components/chat_ui.py`: replace the hardcoded echo reply with `st.write_stream(stream_reply(prompt, context_article))`.
- Fallback behavior (matches `ghost_rag.py`'s existing pattern): missing `GEMINI_API_KEY`, quota errors, or timeouts must show an `st.warning` plus a static "assistant is temporarily unavailable" message — never an unhandled exception or crashed session.
- Env var rename: `OPENAI_API_KEY` → `GEMINI_API_KEY` in `.env.example`, `CLAUDE.md`, and Streamlit secrets docs.

## B. Local development (Docker for everything)

- Extend `docker-compose.yml` with `frontend` and `chatbot` services alongside the existing `ghost` and `db`:
  ```yaml
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    env_file: frontend/.env.local
    depends_on: [ghost]
  chatbot:
    build: ./chatbot
    ports: ["8501:8501"]
    env_file: chatbot/.env
    depends_on: [ghost]
  ```
- Add `frontend/Dockerfile` — multi-stage: `node:20-alpine` build stage → slim runtime stage running `next start`.
- Add `chatbot/Dockerfile` — `python:3.11-slim`, installs `requirements.txt`, runs `streamlit run app.py --server.port=8501 --server.address=0.0.0.0`.
- `docker compose up` is the single command for full local parity (local `db` service substitutes for Aiven, which is cloud-only).
- Root `README.md` gains a "Local Development" section: prerequisites, copying `.env.example` into `frontend/.env.local` and `chatbot/.env`, then `docker compose up`.

## C. Webhook auth robustness

`frontend/src/app/api/revalidate/route.ts` keeps the existing `?secret=` query-param model (already wired into `render.yaml` and the Ghost webhook setup) but hardens it:

- Compare the secret using Node's `crypto.timingSafeEqual` (constant-time), not `!==`, to avoid timing side-channels. Both operands must be equal-length buffers; compare lengths first and only then do the constant-time compare (calling `timingSafeEqual` directly on mismatched-length buffers throws).
- Failure responses stay generic (`400`/`401` with a fixed message) — never leak internal error detail to the client. Log failure details (source IP, timestamp) server-side only.
- Add a lightweight in-memory rate limit (token bucket keyed by IP, max 10 requests/minute) since this is a public endpoint that's only secret-gated. This is a single-instance in-memory limiter — acceptable given Vercel's serverless model doesn't guarantee shared state across instances, so this is a best-effort throttle, not a hard guarantee.

## D. Robustness: loading/error states, tests, CI, logging

**Loading/error states**
- `frontend/src/app/loading.tsx` and `frontend/src/app/posts/[slug]/loading.tsx`: skeleton placeholders (matching `NewsCard`/article layout dimensions) shown during server-side fetch.
- `frontend/src/app/error.tsx` and `frontend/src/app/posts/[slug]/error.tsx`: friendly "couldn't load articles" message with a retry button (Next.js App Router `error.tsx` convention, client component with `reset()`).
- `ChatDrawer.tsx`: show a spinner over the iframe until it fires `onLoad`, and a fallback message ("Assistant is unavailable right now") if the iframe fails to load within a timeout.

**Automated tests**
- Frontend (Vitest): `frontend/src/lib/ghost.test.ts` (mocks `@tryghost/content-api`; covers success and thrown-error → `[]`/`null` paths), `frontend/src/app/api/revalidate/route.test.ts` (valid secret passes, invalid secret 401s, rate-limit trips after threshold).
- Chatbot (pytest): `chatbot/tests/test_ghost_rag.py` (missing key, timeout, non-200 status all hit fallback paths), `chatbot/tests/test_gemini_client.py` (missing key, API error → fallback string, mocked successful stream).

**CI**
- `.github/workflows/ci.yml`, two jobs, both on push/PR:
  - `frontend`: `npm ci` → `next lint` → `vitest run` → `next build`
  - `chatbot`: `pip install -r requirements.txt` → `pytest`

**Structured logging**
- `frontend/src/lib/logger.ts`: minimal helper emitting single-line JSON (`{level, msg, ...meta}`) to stdout/stderr; replaces `console.error` calls in `ghost.ts` and `route.ts`. No external logging service — Vercel/Render both capture stdout natively.
- `chatbot/utils/logger.py`: Python `logging` module configured with a JSON formatter; replaces `print()` calls in `ghost_rag.py`.

## E. Environment variable schema (final)

```
# Root (docker-compose / local only)
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=ghost

# frontend/.env.local (and Vercel env vars)
GHOST_URL=
GHOST_CONTENT_API_KEY=
NEXT_PUBLIC_STREAMLIT_URL=
REVALIDATION_SECRET=

# chatbot/.env (and Streamlit secrets)
GHOST_URL=
GHOST_CONTENT_API_KEY=
GEMINI_API_KEY=
ALLOWED_ORIGIN=
```

`CLAUDE.md`'s "Environment Variables Schema" section and `.env.example` must be updated to match (Gemini replaces OpenAI everywhere).

## Out of scope

- Changing the deployment topology (still Aiven + Render + Vercel + Streamlit Cloud/Render).
- Any Rust or alternative chatbot runtime (considered and rejected — Streamlit/Python stays).
- HMAC-signature webhook verification (considered; query-param secret was explicitly kept).
- Multi-region, autoscaling, or paid-tier infra changes.

## Testing strategy

Unit tests only (Vitest for frontend, pytest for chatbot), run locally and in CI. No e2e/browser tests in this scope — the existing manual QA checklist (visiting `/`, a post page, and opening the chat drawer) remains the acceptance check for full-stack wiring, since e2e infra isn't part of this design.
