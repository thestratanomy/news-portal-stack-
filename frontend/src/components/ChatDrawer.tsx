'use client';

import { useState } from 'react';
import { Bot, X } from 'lucide-react';

export default function ChatDrawer({ currentSlug }: { currentSlug?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const streamlitUrl = process.env.NEXT_PUBLIC_STREAMLIT_URL || 'http://localhost:8501';

  const embedUrl = currentSlug
    ? `${streamlitUrl}/?slug=${encodeURIComponent(currentSlug)}`
    : streamlitUrl;

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
          <div className="flex-1 w-full h-full bg-slate-50">
            <iframe
              src={embedUrl}
              className="w-full h-full border-none"
              title="Streamlit News AI Chatbot"
            />
          </div>
        </div>
      )}
    </>
  );
}
