import Link from 'next/link';

export default function Header() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100">
        <span>{today}</span>
        <a
          href={process.env.NEXT_PUBLIC_GHOST_ADMIN_URL ? `${process.env.NEXT_PUBLIC_GHOST_ADMIN_URL}/ghost` : '#'}
          target="_blank"
          rel="noreferrer"
          className="hover:text-slate-900 transition"
        >
          Writer Login
        </a>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
        <Link href="/" className="inline-block">
          <span className="font-serif font-black text-4xl sm:text-5xl tracking-tight text-slate-900">
            Quiet Disclosure
          </span>
        </Link>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
          Independent Reporting &amp; Analysis
        </p>
      </div>

      <nav className="border-y border-slate-900 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-8 h-11 text-xs font-semibold uppercase tracking-wider text-slate-700 overflow-x-auto">
          <Link href="/" className="hover:text-red-700 transition whitespace-nowrap">Latest</Link>
          <Link href="/" className="hover:text-red-700 transition whitespace-nowrap">Opinion</Link>
          <Link href="/" className="hover:text-red-700 transition whitespace-nowrap">Politics</Link>
          <Link href="/" className="hover:text-red-700 transition whitespace-nowrap">Economy</Link>
          <Link href="/" className="hover:text-red-700 transition whitespace-nowrap">History</Link>
        </div>
      </nav>
    </header>
  );
}
