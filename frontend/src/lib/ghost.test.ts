import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getPosts, getSinglePost, ghostApi } from './ghost';

describe('ghost.ts', () => {
  let mockBrowse: any;
  let mockRead: any;

  beforeEach(() => {
    mockBrowse = vi.fn();
    mockRead = vi.fn();
    ghostApi.posts.browse = mockBrowse;
    ghostApi.posts.read = mockRead;
  });

  it('getPosts returns posts on success', async () => {
    mockBrowse.mockResolvedValue([{ id: '1', title: 'Post 1' }]);
    const posts = await getPosts();
    expect(posts).toEqual([{ id: '1', title: 'Post 1' }]);
  });

  it('getPosts returns [] when the API throws', async () => {
    mockBrowse.mockRejectedValue(new Error('network error'));
    const posts = await getPosts();
    expect(posts).toEqual([]);
  });

  it('getSinglePost returns the post on success', async () => {
    mockRead.mockResolvedValue({ id: '1', slug: 'hello' });
    const post = await getSinglePost('hello');
    expect(post).toEqual({ id: '1', slug: 'hello' });
  });

  it('getSinglePost returns null when the API throws', async () => {
    mockRead.mockRejectedValue(new Error('not found'));
    const post = await getSinglePost('missing');
    expect(post).toBeNull();
  });
});
