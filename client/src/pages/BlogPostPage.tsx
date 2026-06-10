import { Link, Navigate, useParams } from 'react-router-dom';
import { Target, ArrowLeft, Calendar, Clock } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { postBySlug } from '../content/blog/posts';
import './Blog.css';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? postBySlug.get(slug) : undefined;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const { frontmatter, default: MDXContent } = post;

  const postUrl = `https://prepfinity.co/blog/${frontmatter.slug}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: frontmatter.title,
      description: frontmatter.description,
      datePublished: frontmatter.date,
      dateModified: frontmatter.date,
      author: { '@type': 'Person', name: frontmatter.author },
      publisher: {
        '@type': 'Organization',
        name: 'PrepFinity',
        logo: { '@type': 'ImageObject', url: 'https://prepfinity.co/og-image.png' },
      },
      image: 'https://prepfinity.co/og-image.png',
      mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
      keywords: frontmatter.tags?.join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://prepfinity.co/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://prepfinity.co/blog' },
        { '@type': 'ListItem', position: 3, name: frontmatter.title, item: postUrl },
      ],
    },
  ];

  return (
    <div className="blog-page blog-post">
      <SeoHead
        title={frontmatter.title}
        description={frontmatter.description}
        canonical={`/blog/${frontmatter.slug}`}
        type="article"
        jsonLd={jsonLd}
      />

      <header className="blog-nav">
        <Link to="/" className="blog-brand">
          <Target size={22} aria-hidden />
          <span>PrepFinity</span>
        </Link>
        <nav className="blog-nav-links">
          <Link to="/blog" className="nav-link">Blog</Link>
          <Link to="/pricing" className="nav-link">Pricing</Link>
          <Link to="/register" className="nav-cta">Get Started</Link>
        </nav>
      </header>

      <article className="blog-article">
        <Link to="/blog" className="blog-back">
          <ArrowLeft size={16} aria-hidden /> All posts
        </Link>

        <h1 className="blog-article-title">{frontmatter.title}</h1>

        <div className="blog-article-meta">
          <span><Calendar size={14} aria-hidden /> {formatDate(frontmatter.date)}</span>
          <span><Clock size={14} aria-hidden /> {frontmatter.readingMinutes} min read</span>
          <span>By {frontmatter.author}</span>
        </div>

        <div className="blog-article-body">
          <MDXContent />
        </div>
      </article>

      <footer className="blog-footer">
        <div className="footer-brand">
          <Target size={16} aria-hidden />
          <span>PrepFinity</span>
        </div>
        <div className="footer-links">
          <Link to="/">Home</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
