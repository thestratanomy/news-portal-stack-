import Header from '../components/Header';
import NewsCard from '../components/NewsCard';
import ChatDrawer from '../components/ChatDrawer';
import { getPosts } from '../lib/ghost';

export const revalidate = 60;

export default async function HomePage() {
  const posts = await getPosts();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-extrabold text-slate-900">Latest Headlines</h1>
          <p className="text-slate-600 text-sm mt-1">Real-time coverage & in-depth insights.</p>
        </div>

        {posts.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">No articles published yet. Connect Ghost CMS to start writing!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <NewsCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>

      <ChatDrawer />
    </div>
  );
}
