#!/usr/bin/env node
/**
 * Blog post drafting agent.
 *
 * Reads content/topics.json, pops the next unused topic, calls OpenAI to draft
 * a 1300–1700 word MDX post, validates the output against the style guide's
 * anti-AI-smell rules, and writes it to client/src/content/blog/auto/.
 *
 * Run modes:
 *   node scripts/generate-blog-post.mjs            # generate one draft
 *   node scripts/generate-blog-post.mjs --dry-run  # prompt only, no API call
 *
 * Env: OPENAI_API_KEY (required for live runs)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOPICS_PATH = path.join(ROOT, 'content/topics.json');
const STYLE_GUIDE_PATH = path.join(__dirname, 'lib/style-guide.md');
const BLOG_DIR = path.join(ROOT, 'client/src/content/blog');
const AUTO_DIR = path.join(BLOG_DIR, 'auto');

const MODEL = process.env.BLOG_AGENT_MODEL ?? 'gpt-4o';
const RECENT_POSTS_FOR_CONTEXT = 3;

// ── Banned phrases — taken from style-guide.md. Hard-fail if any appear. ──────
const BANNED_PHRASES = [
  // Banned openers
  'in today',
  'in recent years',
  'have you ever',
  'in the world of',
  'are you struggling with',
  "let's dive into",
  'in this article',
  'picture this:',
  // Filler
  'delve',
  'delving',
  'navigate the complexities',
  'navigating the complexities',
  'in the realm of',
  'the landscape of',
  'leveraging',
  'seamless',
  'cutting-edge',
  'game-changer',
  'revolutionize',
  'myriad',
  'plethora',
  'tapestry',
  'in essence',
  'at the end of the day',
  'moving forward',
  'needless to say',
  'in conclusion',
  "it's important to note that",
];

const isDryRun = process.argv.includes('--dry-run');

main().catch((err) => {
  console.error('Blog agent failed:', err.message);
  process.exit(1);
});

async function main() {
  console.log('PrepFinity blog drafting agent');
  console.log('==============================');
  console.log(`Model: ${MODEL}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log('');

  await fs.mkdir(AUTO_DIR, { recursive: true });

  // 1. Load inputs
  const styleGuide = await fs.readFile(STYLE_GUIDE_PATH, 'utf8');
  const topicsFile = JSON.parse(await fs.readFile(TOPICS_PATH, 'utf8'));
  const topic = topicsFile.topics.find((t) => !t.used);
  if (!topic) {
    throw new Error(
      'Topic queue is empty. Add more topics to content/topics.json before the next run.',
    );
  }

  console.log(`Next topic: "${topic.title}"`);
  console.log(`Target keyword: ${topic.targetKeyword}`);
  console.log('');

  // 2. Load up to N most recent published posts for voice consistency
  const recentPosts = await loadRecentPosts(RECENT_POSTS_FOR_CONTEXT);
  console.log(`Loaded ${recentPosts.length} recent posts for style context.`);

  // 3. Build prompts
  const systemPrompt = styleGuide;
  const userPrompt = buildUserPrompt(topic, recentPosts);

  if (isDryRun) {
    console.log('\n── DRY RUN: not calling OpenAI. Prompts below. ──\n');
    console.log('--- SYSTEM PROMPT (first 500 chars) ---');
    console.log(systemPrompt.slice(0, 500) + '...');
    console.log('\n--- USER PROMPT ---');
    console.log(userPrompt);
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY env var is required.');
  }

  // 4. Call OpenAI
  console.log('\nCalling OpenAI...');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  const draft = completion.choices[0]?.message?.content?.trim();
  if (!draft) throw new Error('OpenAI returned an empty response.');

  // 5. Validate
  console.log('Validating draft...');
  const validation = validateDraft(draft, topic);
  if (!validation.ok) {
    console.error('Validation failed:');
    for (const issue of validation.issues) console.error(`  - ${issue}`);
    throw new Error('Draft failed validation. Not writing file.');
  }
  console.log('Validation passed.');

  // 6. Write the file
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = extractSlug(draft) ?? slugify(topic.title);
  const filename = `${today}-${slug}.mdx`;
  const outPath = path.join(AUTO_DIR, filename);
  await fs.writeFile(outPath, draft + '\n', 'utf8');
  console.log(`\nWrote draft to ${path.relative(ROOT, outPath)}`);

  // 7. Mark topic as used
  topic.used = true;
  topic.draftedAt = new Date().toISOString();
  topic.draftFile = `client/src/content/blog/auto/${filename}`;
  await fs.writeFile(TOPICS_PATH, JSON.stringify(topicsFile, null, 2) + '\n', 'utf8');
  console.log(`Marked topic as used in ${path.relative(ROOT, TOPICS_PATH)}.`);

  // 8. Emit values the GitHub Action consumes via GITHUB_OUTPUT
  if (process.env.GITHUB_OUTPUT) {
    const out = await fs.open(process.env.GITHUB_OUTPUT, 'a');
    await out.appendFile(`slug=${slug}\n`);
    await out.appendFile(`filename=${filename}\n`);
    await out.appendFile(`title=${escapeForGhOutput(topic.title)}\n`);
    await out.close();
  }

  console.log('\nDone.');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loadRecentPosts(n) {
  const entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.mdx'))
    .map((e) => e.name)
    .sort()
    .reverse()
    .slice(0, n);

  const posts = [];
  for (const f of files) {
    const content = await fs.readFile(path.join(BLOG_DIR, f), 'utf8');
    // Keep size sane — first 2500 chars is plenty for voice/style.
    posts.push({ name: f, snippet: content.slice(0, 2500) });
  }
  return posts;
}

function buildUserPrompt(topic, recentPosts) {
  const links = (topic.internalLinks ?? []).map((l) => `https://prepfinity.co${l}`).join(', ');
  const recentSection = recentPosts.length
    ? recentPosts
        .map((p, i) => `### Previous post ${i + 1} (${p.name})\n\n${p.snippet}\n`)
        .join('\n')
    : '_(No previous posts yet.)_';

  return [
    `# Today's brief`,
    ``,
    `Write one blog post following the style guide in the system prompt.`,
    ``,
    `**Working title:** ${topic.title}`,
    `**Target keyword (must rank for this query):** ${topic.targetKeyword}`,
    `**Unique angle:** ${topic.angle}`,
    `**Internal links to include:** ${links || 'https://prepfinity.co/register at minimum.'}`,
    `**Today's date:** ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `## Voice reference — previous PrepFinity posts`,
    ``,
    `Match this voice. Do not copy structure or content; match cadence, opinion strength, and specificity level.`,
    ``,
    recentSection,
    ``,
    `## Output format`,
    ``,
    `Output ONLY the MDX file content. Start with the \`---\` frontmatter line. End with the closing italic CTA. No commentary. No code fences around the file.`,
  ].join('\n');
}

function validateDraft(draft, topic) {
  const issues = [];
  const lower = draft.toLowerCase();

  // Frontmatter present
  if (!draft.startsWith('---\n')) issues.push('Draft does not start with --- frontmatter.');
  const fmEnd = draft.indexOf('\n---', 4);
  if (fmEnd === -1) issues.push('Frontmatter is not properly closed.');

  const frontmatter = fmEnd > 0 ? draft.slice(4, fmEnd) : '';
  const body = fmEnd > 0 ? draft.slice(fmEnd + 4).trim() : draft;

  // Required frontmatter fields
  for (const field of ['title:', 'description:', 'date:', 'slug:', 'author:', 'readingMinutes:']) {
    if (!frontmatter.includes(field)) issues.push(`Frontmatter missing field "${field.slice(0, -1)}".`);
  }

  // Word count
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words < 1300) issues.push(`Word count ${words} is below 1300.`);
  if (words > 1750) issues.push(`Word count ${words} is above 1750.`);

  // Banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) issues.push(`Contains banned phrase: "${phrase}".`);
  }

  // Em-dash count cap
  const emDashes = (draft.match(/—/g) ?? []).length;
  if (emDashes > 4) issues.push(`Too many em-dashes (${emDashes}). Cap is 4 including frontmatter.`);

  // Heading count
  const h2Count = (body.match(/^## /gm) ?? []).length;
  if (h2Count < 6) issues.push(`Only ${h2Count} H2 headings. Need at least 6.`);
  if (h2Count > 14) issues.push(`Too many H2 headings (${h2Count}). Cap at 14.`);

  // Target keyword presence (case-insensitive, body only)
  const kw = topic.targetKeyword.toLowerCase();
  const bodyLower = body.toLowerCase();
  const kwCount = bodyLower.split(kw).length - 1;
  if (kwCount < 1) issues.push(`Target keyword "${topic.targetKeyword}" does not appear in body.`);
  if (kwCount > 5) issues.push(`Target keyword "${topic.targetKeyword}" appears ${kwCount} times — likely stuffing.`);

  // First 100 words must contain keyword
  const first100 = body.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  if (!first100.includes(kw)) {
    issues.push('Target keyword must appear in the first 100 words of the body.');
  }

  // Internal link to prepfinity.co
  if (!body.includes('prepfinity.co')) {
    issues.push('Body must contain at least one prepfinity.co internal link.');
  }

  return { ok: issues.length === 0, issues };
}

function extractSlug(draft) {
  const m = draft.match(/^slug:\s*"?([a-z0-9-]+)"?/m);
  return m?.[1];
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function escapeForGhOutput(s) {
  // GITHUB_OUTPUT requires multiline values to use a heredoc-style; we'll keep it single-line.
  return s.replace(/\n/g, ' ').slice(0, 200);
}
