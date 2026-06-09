// Generates public/sitemap.xml from the same source of truth the site uses:
// the static public routes plus every MDX blog post under src/content/blog
// (including the auto/ dir where the drafting agent lands new posts). Run
// automatically before each build (see package.json "build"), so a new blog
// post can never be orphaned from the sitemap again.
//
// Blog <lastmod> comes from the post's frontmatter `date`; static routes use
// today's date so a redeploy signals freshness to Google.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://prepfinity.co';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const today = new Date().toISOString().slice(0, 10);

// Public, indexable routes. Login/register/policy pages are intentionally
// excluded — they carry noIndex in SeoHead, so listing them in the sitemap
// would just send Google mixed signals.
const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
  { path: '/contact', changefreq: 'yearly', priority: '0.4' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
];

// Parse `slug` and `date` out of an MDX frontmatter block.
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const block = match[1];
  const get = (key) => {
    const m = block.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm'));
    return m ? m[1].trim() : null;
  };
  return { slug: get('slug'), date: get('date') };
}

function collectPosts() {
  const blogDir = join(root, 'src/content/blog');
  const dirs = [blogDir, join(blogDir, 'auto')];
  const posts = [];
  for (const dir of dirs) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue; // auto/ may not exist yet
    }
    for (const file of entries) {
      if (!file.endsWith('.mdx')) continue;
      const fm = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
      if (fm?.slug) posts.push({ slug: fm.slug, date: fm.date || today });
    }
  }
  // Newest first — matches posts.ts ordering.
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

const entries = [
  ...staticRoutes.map((r) =>
    urlEntry({ loc: `${SITE_URL}${r.path}`, lastmod: today, changefreq: r.changefreq, priority: r.priority }),
  ),
  ...collectPosts().map((p) =>
    urlEntry({ loc: `${SITE_URL}/blog/${p.slug}`, lastmod: p.date, changefreq: 'monthly', priority: '0.7' }),
  ),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'sitemap.xml'), xml);
console.log(`[sitemap] wrote ${entries.length} URLs to public/sitemap.xml`);
