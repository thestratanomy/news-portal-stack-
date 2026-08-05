import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b bg-white border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-2xl text-slate-900 tracking-tight">
          THE DAILY <span className="text-blue-600">NEWS</span>
        </Link>
        <nav className="flex space-x-6 text-sm font-medium text-slate-600">
          <Link href="/" className="hover:text-blue-600 transition">Latest</Link>
          <a href={process.env.NEXT_PUBLIC_GHOST_ADMIN_URL ? `${process.env.NEXT_PUBLIC_GHOST_ADMIN_URL}/ghost` : '#'} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            Writer Login
          </a>
        </nav>
      </div>
    </header>
  );
}
