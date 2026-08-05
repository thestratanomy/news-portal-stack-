import GhostContentAPI from '@tryghost/content-api';
import { GhostPost } from './types';
import { logError } from './logger';

const url = process.env.GHOST_URL || 'http://localhost:2368';
const key = process.env.GHOST_CONTENT_API_KEY || 'ghost_demo_key';

export const ghostApi = new GhostContentAPI({
  url,
  key,
  version: 'v5.0'
});

export async function getPosts(): Promise<GhostPost[]> {
  try {
    const posts = await ghostApi.posts.browse({
      limit: 'all',
      include: ['tags', 'authors']
    });
    return posts as unknown as GhostPost[];
  } catch (error) {
    logError('Error fetching Ghost posts', { error: String(error) });
    return [];
  }
}

export async function getSinglePost(slug: string): Promise<GhostPost | null> {
  try {
    const post = await ghostApi.posts.read(
      { slug },
      { include: ['tags', 'authors'] }
    );
    return post as unknown as GhostPost;
  } catch (error) {
    logError(`Error fetching Ghost post ${slug}`, { error: String(error) });
    return null;
  }
}
