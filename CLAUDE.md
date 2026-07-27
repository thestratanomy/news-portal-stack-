Steering File: Headless Ghost + Next.js News Platform + Streamlit Chatbot

## 1. Core Architecture Principles
- **Headless CMS Strategy:** Ghost is used strictly as a Headless CMS. Non-technical editors write posts via Ghost Admin (`/ghost`). Next.js fetches data exclusively through `@tryghost/content-api`.
- **Zero-Cost Production Stack:**
  - **Database:** Managed Aiven Cloud DB (Aiven MySQL for Ghost).
  - **CMS Backend:** Render Free Web Service running Docker `ghost:5-alpine`.
  - **Frontend:** Next.js (App Router) on Vercel with free custom domain SSL.
  - **AI Chatbot:** Streamlit Community Cloud / Render.
- **On-Demand Cache Invalidation:** Ghost Webhooks trigger Next.js Server Actions/Route Handlers (`/api/revalidate`) using `revalidateTag` to update articles instantly without full rebuilds.
- **AI Integration:** Streamlit handles interactive AI search, article summarization, and reader Q&A, embedded into Next.js using a responsive iframe with postMessage communication.

---

## 2. Directory Structure Conventions

```text
root/
├── render.yaml                  # Render Infrastructure-as-Code for Ghost Docker container
├── CLAUDE.md                    # Developer Steering Rules
│
├── frontend/                    # Next.js App Router (TypeScript + Tailwind CSS)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Static News Homepage
│   │   │   ├── posts/[slug]/    # Dynamic Blog Pages (SSG + Revalidation)
│   │   │   └── api/
│   │   │       └── revalidate/  # Webhook handler for Ghost publishing events
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── NewsCard.tsx
│   │   │   └── ChatDrawer.tsx   # Iframe wrapper for Streamlit with postMessage
│   │   └── lib/
│   │       ├── ghost.ts         # Ghost Content API SDK wrapper
│   │       └── types.ts         # TypeScript definitions for Ghost Posts/Authors
│   ├── vercel.json              # Vercel header & route routing rules
│   └── next.config.mjs
│
└── chatbot/                     # Streamlit Assistant (Python 3.11+)
    ├── .streamlit/
    │   └── config.toml          # Iframe & CORS configuration
    ├── app.py                   # Main Streamlit UI entry point
    ├── components/
    │   └── chat_ui.py           # Chat UI layout & streaming handler
    ├── utils/
    │   └── ghost_rag.py         # Fetches Ghost news metadata to ground LLM responses
    └── requirements.txt
3. Technology Stack & Coding Standards
Frontend (Next.js & TypeScript)
Use React Server Components (RSC) by default for optimal SEO and performance.

Wrap all Ghost Content API calls inside src/lib/ghost.ts using tagged fetch requests:

TypeScript
fetch(url, { next: { tags: ['ghost-posts'] } })
Sanitize and render Ghost HTML using @tailwindcss/typography (prose class) inside dynamic post pages.

Enforce strict TypeScript types; avoid any for Ghost article payloads.

Chatbot (Streamlit & Python)
Set page configuration at the top of app.py:

Python
st.set_page_config(page_title="News AI Assistant", layout="wide")
Stream responses using st.write_stream for real-time feedback.

Cache Ghost API requests in Python using @st.cache_data(ttl=300).

Handle postMessage events safely to sync active article context from Next.js to Streamlit.

4. Key Security & Environment Protocol
Never expose GHOST_ADMIN_API_KEY on the frontend. Use GHOST_CONTENT_API_KEY for public read operations.

Verify incoming webhook signatures inside /api/revalidate using a shared REVALIDATION_SECRET.

Secure cross-origin iframe communication: restrict postMessage targets specifically to your frontend and Streamlit URLs instead of using target origin *.

5. Environment Variables Schema
Render (Ghost Backend)
Code snippet
url="[https://your-ghost-service.onrender.com](https://your-ghost-service.onrender.com)"
database__client="mysql"
database__connection__host="your-aiven-mysql-host.aivencloud.com"
database__connection__port="your_aiven_port"
database__connection__user="avnadmin"
database__connection__password="your_aiven_password"
database__connection__database="defaultdb"
database__connection__ssl__rejectUnauthorized="true"
Next.js (frontend/.env.local / Vercel)
Code snippet
GHOST_URL="[https://your-ghost-service.onrender.com](https://your-ghost-service.onrender.com)"
GHOST_CONTENT_API_KEY="your_ghost_content_api_key"
NEXT_PUBLIC_STREAMLIT_URL="[https://your-app.streamlit.app](https://your-app.streamlit.app)"
REVALIDATION_SECRET="your_shared_webhook_secret"
Streamlit (chatbot/.env or st.secrets)
Code snippet
GHOST_URL="[https://your-ghost-service.onrender.com](https://your-ghost-service.onrender.com)"
GHOST_CONTENT_API_KEY="your_ghost_content_api_key"
OPENAI_API_KEY="your_llm_api_key"
6. Implementation Rules for Claude Code
Keep the Next.js client bundle thin: isolate interactive components (like the Streamlit iframe drawer) using 'use client'.

Ensure non-developers can publish from Ghost Admin without breaking Next.js hydration or routing.

Handle API fallback states gracefully: if Ghost or Streamlit services are loading, display skeleton UI components.


---

### Final 1-Click Prompt for Claude Code

Paste this prompt directly into your AI developer agent to generate all deployment configs for **Aiven + Render + Vercel + Streamlit**:

```text
Act as a Principal Cloud Engineer. Configure our news portal repository for production deployment using Aiven (Database), Render (Ghost CMS Docker), Vercel (Next.js Frontend), and Streamlit Community Cloud (AI Chatbot).

Perform the following automated setup steps:

1. RENDER & AIVEN INTEGRATION:
   - Create a production `render.yaml` at the root directory deploying image `ghost:5-alpine`.
   - Configure environment variable placeholders matching Aiven MySQL specs: `database__client=mysql`, `database__connection__host`, `database__connection__port`, `database__connection__user`, `database__connection__password`, `database__connection__database`, and `database__connection__ssl__rejectUnauthorized=true`.

2. VERCEL CONFIGURATION:
   - Create `frontend/vercel.json` with security headers configured to allow embedding the Streamlit Chatbot iframe without X-Frame-Options blocking.
   - Verify that `/api/revalidate` in Next.js correctly validates the incoming secret and purges the `ghost-posts` cache tag.

3. STREAMLIT CONFIGURATION:
   - Create `chatbot/.streamlit/config.toml` setting `enableCORS = false`, `enableXsrfProtection = false`, and setting the theme to match the Next.js UI palette.
   - Ensure `chatbot/utils/ghost_rag.py` gracefully handles network timeouts or missing Ghost API keys without crashing the Streamlit app.

Output all new/updated configuration files and provide a step-by-step checklist for connecting Ghost Webhooks to Vercel and linking Streamlit Secrets.