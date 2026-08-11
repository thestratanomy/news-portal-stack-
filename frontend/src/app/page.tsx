import Link from 'next/link';
import Header from '../components/Header';
import NewsCard from '../components/NewsCard';
import ChatDrawer from '../components/ChatDrawer';
import { getPosts } from '../lib/ghost';

export const revalidate = 60;

export default async function HomePage() {
  const posts = await getPosts();
  const [lead, ...rest] = posts;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {posts.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-slate-500">No articles published yet. Connect Ghost CMS to start writing!</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10 mb-10 border-b border-slate-200">
              {lead.feature_image && (
                <Link href={`/posts/${lead.slug}`} className="block overflow-hidden rounded-sm">
                  <img
                    src={lead.feature_image}
                    alt={lead.title}
                    className="w-full h-72 lg:h-full object-cover hover:scale-[1.02] transition duration-500"
                  />
                </Link>
              )}
              <div className="flex flex-col justify-center">
                {lead.tags && lead.tags.length > 0 && (
                  <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                    {lead.tags[0].name}
                  </span>
                )}
                <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-black leading-tight text-slate-900">
                  <Link href={`/posts/${lead.slug}`} className="hover:underline decoration-2 underline-offset-2">
                    {lead.title}
                  </Link>
                </h1>
                <p className="mt-4 text-base text-slate-600 leading-relaxed">
                  {lead.custom_excerpt || lead.excerpt}
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                  <span>{new Date(lead.published_at).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>{lead.reading_time} min read</span>
                </div>
              </div>
            </section>

            <div className="mb-6 flex items-center gap-3">
              <h2 className="font-serif text-sm font-bold uppercase tracking-widest text-slate-900">More Stories</h2>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
              {rest.map((post) => (
                <NewsCard key={post.id} post={post} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-xs text-slate-500">
          <p className="font-serif text-lg font-bold text-slate-900 mb-1">Quiet Disclosure</p>
          <p>&copy; {new Date().getFullYear()} Quiet Disclosure. All rights reserved.</p>
        </div>
      </footer>

      <ChatDrawer />
    </div>
  );
}
