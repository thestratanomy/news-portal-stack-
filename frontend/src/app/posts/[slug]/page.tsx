import { notFound } from 'next/navigation';
import Header from '../../../components/Header';
import ChatDrawer from '../../../components/ChatDrawer';
import { getSinglePost, getPosts } from '../../../lib/ghost';

interface PageProps {
  params: { slug: string };
}

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function PostPage({ params }: PageProps) {
  const post = await getSinglePost(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-white border-x border-slate-200 my-6 rounded-lg shadow-sm">
        <header className="mb-8">
          {post.tags && post.tags.length > 0 && (
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">
              {post.tags[0].name}
            </span>
          )}
          <h1 className="text-4xl font-extrabold text-slate-900 mt-3 leading-tight">{post.title}</h1>
          <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 border-b border-slate-100 pb-4">
            <span>Published {new Date(post.published_at).toLocaleDateString()}</span>
            <span>•</span>
            <span>{post.reading_time} min read</span>
          </div>
        </header>

        {post.feature_image && (
          <img
            src={post.feature_image}
            alt={post.title}
            className="w-full max-h-[450px] object-cover rounded-lg mb-8"
          />
        )}

        <div
          className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-blue-600"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </main>

      <ChatDrawer currentSlug={post.slug} />
    </div>
  );
}
