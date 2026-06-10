import { Head } from 'vite-react-ssg';

const SITE_NAME = 'PrepFinity';
const SITE_TAGLINE = 'AI Mock Interview Practice';
const SITE_URL = 'https://prepfinity.co';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_DESCRIPTION =
  'Practice real technical interviews with an AI interviewer. Voice or text, real-time scoring, weak-topic analytics. Free to start — no credit card needed.';

interface SeoHeadProps {
  /** Page-specific title. Rendered as `${title} | PrepFinity`. Omit for the brand default. */
  title?: string;
  /** ~150–160 chars. Shown in Google snippets and social shares. */
  description?: string;
  /** Relative path (e.g. "/pricing"). Used for canonical + og:url. */
  canonical?: string;
  /** Absolute URL to a 1200x630 image. Defaults to the brand OG image. */
  image?: string;
  /** Set true on auth, account, and legal pages to keep them out of Google's index. */
  noIndex?: boolean;
  /** og:type — set to "article" on blog posts so crawlers/shares treat them as articles. */
  type?: 'website' | 'article';
  /** JSON-LD object(s) rendered as <script type="application/ld+json"> in <head>. */
  jsonLd?: object | object[];
}

export default function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  image = DEFAULT_IMAGE,
  noIndex = false,
  type = 'website',
  jsonLd,
}: SeoHeadProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE}`;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : SITE_URL;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Structured data */}
      {jsonLd &&
        (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).map((obj, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(obj)}
          </script>
        ))}
    </Head>
  );
}
