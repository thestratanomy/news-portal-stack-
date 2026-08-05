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
