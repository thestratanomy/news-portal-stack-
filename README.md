# News Portal Stack

Headless Ghost CMS + Next.js frontend + Streamlit AI chatbot.

## Local Development

1. **Prerequisites:** Docker and Docker Compose installed.

2. **Set up environment files:**
   ```bash
   cp .env.example frontend/.env.local
   cp .env.example chatbot/.env
   ```
   Edit each file to fill in real values. For local dev, `GHOST_URL` in both should point to `http://ghost:2368` (the in-network service name, used for server-side Ghost API calls). In `frontend/.env.local` specifically, also set `NEXT_PUBLIC_GHOST_ADMIN_URL="http://localhost:2368"` — this is a separate variable because it's rendered into a link your browser opens directly, and your browser can't resolve `ghost` as a hostname the way containers on the Docker network can. `GEMINI_API_KEY` needs a real key from Google AI Studio for the chatbot to respond with real answers (it falls back gracefully if omitted).

3. **Start everything:**
   ```bash
   docker compose up --build
   ```
   This starts Ghost (`:2368`), MySQL, the Next.js frontend (`:3000`), and the Streamlit chatbot (`:8501`).

4. **First-time Ghost setup:** visit `http://localhost:2368/ghost` and complete the admin setup wizard, then create a custom integration to get a Content API key for `frontend/.env.local` and `chatbot/.env`.

## Deployment

See `render.yaml` (Ghost on Render + Aiven MySQL), `frontend/vercel.json` (Next.js on Vercel), and `chatbot/.streamlit/config.toml` (Streamlit Cloud). Full environment variable schema is documented in `CLAUDE.md`.
