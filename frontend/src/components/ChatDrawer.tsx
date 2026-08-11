'use client';

import { Bot } from 'lucide-react';

export default function ChatDrawer({ currentSlug }: { currentSlug?: string }) {
  const streamlitUrl = process.env.NEXT_PUBLIC_STREAMLIT_URL || 'http://localhost:8501';
  const chatUrl = currentSlug
    ? `${streamlitUrl}/?slug=${encodeURIComponent(currentSlug)}`
    : streamlitUrl;

  return (
    <button
      onClick={() => window.open(chatUrl, '_blank', 'noopener,noreferrer')}
      className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium"
    >
      <Bot size={24} />
      <span className="hidden sm:inline">Ask AI News Assistant</span>
    </button>
  );
}
