export interface GhostPost {
  id: string;
  uuid: string;
  title: string;
  slug: string;
  html: string;
  comment_id: string;
  feature_image: string | null;
  featured: boolean;
  visibility: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  custom_excerpt: string | null;
  excerpt: string;
  reading_time: number;
  authors?: Array<{
    id: string;
    name: string;
    slug: string;
    profile_image: string | null;
  }>;
  tags?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}
