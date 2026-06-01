import type { ComponentType } from 'react';

export interface PostFrontmatter {
  title: string;
  description: string;
  date: string;
  slug: string;
  author: string;
  readingMinutes: number;
  tags?: string[];
}

export interface PostModule {
  frontmatter: PostFrontmatter;
  default: ComponentType;
}

// Eagerly import every MDX file in this directory at build time. The `frontmatter`
// named export comes from remark-mdx-frontmatter (configured in vite.config.ts).
// Eager loading is required so vite-react-ssg can statically enumerate posts via
// `getStaticPaths` and pre-render every slug to HTML.
const modules = import.meta.glob<PostModule>('./*.mdx', { eager: true });

export const posts: PostModule[] = Object.values(modules)
  // Newest first.
  .sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date));

export const postBySlug = new Map(posts.map((p) => [p.frontmatter.slug, p]));

export function getAllSlugs(): string[] {
  return posts.map((p) => p.frontmatter.slug);
}
