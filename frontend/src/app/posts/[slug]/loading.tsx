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
