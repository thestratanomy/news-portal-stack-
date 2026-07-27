import Link from 'next/link';
import { GhostPost } from '../lib/types';

export default function NewsCard({ post }: { post: GhostPost }) {
  return (
    <article className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
      {post.feature_image && (
        <img
          src={post.feature_image}
          alt={post.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-5">
        {post.tags && post.tags.length > 0 && (
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">
            {post.tags[0].name}
          </span>
        )}
        <h2 className="mt-3 text-xl font-bold text-slate-900 line-clamp-2 hover:text-blue-600 transition">
          <Link href={`/posts/${post.slug}`}>{post.title}</Link>
        </h2>
        <p className="mt-2 text-sm text-slate-600 line-clamp-3">
          {post.custom_excerpt || post.excerpt}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>{new Date(post.published_at).toLocaleDateString()}</span>
          <span>{post.reading_time} min read</span>
        </div>
      </div>
    </article>
  );
}
