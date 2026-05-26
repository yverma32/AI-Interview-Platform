import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'InterviewReady';
const SITE_URL = 'https://interviewready.in';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

interface SeoHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  noIndex?: boolean;
}

export default function SeoHead({
  title,
  description = 'Practice technical interviews with an AI interviewer. Voice or text, real-time scoring, weak-topic analytics. Free to start.',
  canonical,
  image = DEFAULT_IMAGE,
  noIndex = false,
}: SeoHeadProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — AI Mock Interview Practice`;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
