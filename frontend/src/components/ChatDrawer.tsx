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
