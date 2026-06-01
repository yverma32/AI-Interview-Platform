import { Link } from 'react-router-dom';
import { Target, ArrowRight, Calendar, Clock } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { posts } from '../content/blog/posts';
import './Blog.css';

export default function BlogIndexPage() {
  return (
    <div className="blog-page">
      <SeoHead
        title="Blog — Interview Prep Tips & Strategies"
        description="Practical guides on cracking technical interviews. AI mock interview tips, company-specific prep, DSA strategies, and more from the PrepFinity team."
        canonical="/blog"
      />

      <header className="blog-nav">
        <Link to="/" className="blog-brand">
          <Target size={22} aria-hidden />
          <span>PrepFinity</span>
        </Link>
        <nav className="blog-nav-links">
          <Link to="/pricing" className="nav-link">Pricing</Link>
          <Link to="/login" className="nav-link">Sign In</Link>
          <Link to="/register" className="nav-cta">Get Started</Link>
        </nav>
      </header>

      <section className="blog-hero">
        <h1 className="blog-hero-title">The PrepFinity Blog</h1>
        <p className="blog-hero-sub">
          Honest, practical guides on cracking technical interviews. Written by the
          team that runs thousands of AI mock interviews every month.
        </p>
      </section>

      <section className="blog-list">
        {posts.length === 0 ? (
          <p className="blog-empty">No posts yet — check back soon.</p>
        ) : (
          posts.map(({ frontmatter }) => (
            <Link
              key={frontmatter.slug}
              to={`/blog/${frontmatter.slug}`}
              className="blog-card"
            >
              <h2 className="blog-card-title">{frontmatter.title}</h2>
              <p className="blog-card-desc">{frontmatter.description}</p>
              <div className="blog-card-meta">
                <span><Calendar size={14} aria-hidden /> {formatDate(frontmatter.date)}</span>
                <span><Clock size={14} aria-hidden /> {frontmatter.readingMinutes} min read</span>
                <span className="blog-card-cta">Read post <ArrowRight size={14} aria-hidden /></span>
              </div>
            </Link>
          ))
        )}
      </section>

      <footer className="blog-footer">
        <div className="footer-brand">
          <Target size={16} aria-hidden />
          <span>PrepFinity</span>
        </div>
        <div className="footer-links">
          <Link to="/">Home</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund">Refund</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </footer>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
