import Link from 'next/link';
import { GhostPost } from '../lib/types';

export default function NewsCard({ post }: { post: GhostPost }) {
  return (
    <article className="group">
      {post.feature_image && (
        <Link href={`/posts/${post.slug}`} className="block overflow-hidden rounded-sm mb-3">
          <img
            src={post.feature_image}
            alt={post.title}
            className="w-full h-48 object-cover group-hover:scale-105 transition duration-500"
          />
        </Link>
      )}
      {post.tags && post.tags.length > 0 && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">
          {post.tags[0].name}
        </span>
      )}
      <h2 className="mt-1 font-serif text-xl font-bold leading-snug text-slate-900 group-hover:underline decoration-2 underline-offset-2">
        <Link href={`/posts/${post.slug}`}>{post.title}</Link>
      </h2>
      <p className="mt-2 text-sm text-slate-600 line-clamp-2">
        {post.custom_excerpt || post.excerpt}
      </p>
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
        <span>{new Date(post.published_at).toLocaleDateString()}</span>
        <span>·</span>
        <span>{post.reading_time} min read</span>
      </div>
    </article>
  );
}
