#!/usr/bin/env node
/**
 * Blog post drafting agent.
 *
 * Reads content/topics.json, pops the next unused topic, calls Claude to draft
 * a 1300–1700 word MDX post, validates the output against the style guide's
 * anti-AI-smell rules, and writes it to client/src/content/blog/auto/.
 *
 * Run modes:
 *   node scripts/generate-blog-post.mjs            # generate one draft
 *   node scripts/generate-blog-post.mjs --dry-run  # prompt only, no API call
 *
 * Env: ANTHROPIC_API_KEY (required for live runs)
 *
 * Why Claude over GPT-4o: we tried GPT-4o first. It consistently produced
 * 500–900 word drafts no matter how loudly the prompt demanded 1300+. That
 * is a documented GPT-4o trait (RLHF-trained for concision) and not a prompt
 * problem. Claude Sonnet hits target word counts reliably on long-form and
 * produces noticeably less AI-smelly prose, which matters for SEO.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOPICS_PATH = path.join(ROOT, 'content/topics.json');
const STYLE_GUIDE_PATH = path.join(__dirname, 'lib/style-guide.md');
const BLOG_DIR = path.join(ROOT, 'client/src/content/blog');
const AUTO_DIR = path.join(BLOG_DIR, 'auto');

// Default to Sonnet 4.6 — best long-form quality at $3/M input, $15/M output.
// A 1500-word post costs ~$0.10 input + ~$0.05 output ≈ $0.15 per draft.
const MODEL = process.env.BLOG_AGENT_MODEL ?? 'claude-sonnet-4-6';
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
    console.log('\n── DRY RUN: not calling Claude. Prompts below. ──\n');
    console.log('--- SYSTEM PROMPT (first 500 chars) ---');
    console.log(systemPrompt.slice(0, 500) + '...');
    console.log('\n--- USER PROMPT ---');
    console.log(userPrompt);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY env var is required.');
  }

  // 4. Call Claude — with one-shot retry if the first draft fails validation.
  // The retry sends the failing draft back with the specific issues so the
  // model can correct them; costs ~2x the credit of a single call but
  // salvages most posts that would otherwise have been thrown away.
  console.log('\nCalling Claude...');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Anthropic's system prompt is a top-level field, not a message role.
  // messages[] only contains user/assistant turns.
  const baseMessages = [{ role: 'user', content: userPrompt }];

  let draft = await callModel(anthropic, systemPrompt, baseMessages);
  console.log('Validating draft...');
  let validation = validateDraft(draft, topic);

  if (!validation.ok) {
    console.log('First draft failed validation:');
    for (const issue of validation.issues) console.log(`  - ${issue}`);
    console.log('\nAsking the model to fix it (one retry)...');

    const fixMessages = [
      ...baseMessages,
      { role: 'assistant', content: draft },
      { role: 'user', content: buildRetryPrompt(validation.issues) },
    ];
    draft = await callModel(anthropic, systemPrompt, fixMessages);
    validation = validateDraft(draft, topic);
  }

  if (!validation.ok) {
    console.error('\nDraft failed validation after retry:');
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

async function callModel(anthropic, systemPrompt, messages) {
  const response = await anthropic.messages.create({
    model: MODEL,
    system: systemPrompt,
    messages,
    temperature: 0.7,
    // 1500 English words ≈ 2000 tokens, plus markdown + frontmatter overhead.
    // 6000 leaves comfortable headroom and is well under Sonnet's 8192 max.
    max_tokens: 6000,
  });
  // Anthropic returns content as an array of blocks; for text-only output
  // the first block holds the full response.
  const block = response.content[0];
  const draft = block && block.type === 'text' ? block.text.trim() : '';
  if (!draft) throw new Error('Claude returned an empty response.');
  return draft;
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
    `## Hard constraints (the post will be auto-rejected if any are missed)`,
    ``,
    `- **Word count: 1300-1700 words in the body** (do NOT count the frontmatter). Aim for 1500 — a too-short post fails validation and the draft is thrown away.`,
    `- **At least 8 H2 headings** (lines starting with "## "). Each H2 = one short section. This is how Google reads the structure.`,
    `- **Em-dash count: keep it under 6 across the entire file.** Use commas, periods, or parentheses instead. If you find yourself wanting a 7th em-dash, rewrite that sentence.`,
    `- **Target keyword "${topic.targetKeyword}" must appear once in the first 100 words of the body**, and 2-3 times total in the body. Not more.`,
    `- **At least 2 internal links to prepfinity.co** (use the ones listed above).`,
    `- **No banned phrases.** See the style guide. The validator checks for them and rejects the draft if any appear.`,
    ``,
    `## Voice reference — previous PrepFinity posts`,
    ``,
    `Match this voice. Do not copy structure or content; match cadence, opinion strength, and specificity level.`,
    ``,
    recentSection,
    ``,
    `## Output format`,
    ``,
    `Output ONLY the MDX file content. Start with the \`---\` frontmatter line. End with the closing italic CTA. No commentary. No code fences around the file. No "Here is your post" preamble.`,
  ].join('\n');
}

function buildRetryPrompt(issues) {
  return [
    `Your draft failed validation with the following issues:`,
    ``,
    ...issues.map((i) => `- ${i}`),
    ``,
    `Rewrite the entire post to fix every issue listed above. Keep the parts that were working — the title, structure, target keyword placement, and voice are fine if they passed.`,
    ``,
    `**Most common fix for "Word count below 1300":** every section needs 2-3 more concrete sentences. Add a specific example, a real interview question, a number, or a counterexample to each H2 section. Do not pad with filler sentences.`,
    ``,
    `**Most common fix for "Too many em-dashes":** replace em-dashes with commas, periods, or parentheses. A sentence like "The answer is simple — practice more" becomes "The answer is simple. Practice more."`,
    ``,
    `Output ONLY the corrected MDX file. No commentary.`,
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

  // Em-dash count cap. Real human prose hits 5-6 em-dashes in 1500 words;
  // capping at 4 pushed the model into awkward phrasing. 6 keeps AI-smell
  // out without being unrealistic.
  const emDashes = (draft.match(/—/g) ?? []).length;
  if (emDashes > 6) issues.push(`Too many em-dashes (${emDashes}). Cap is 6 across the whole file.`);

  // Heading count
  const h2Count = (body.match(/^## /gm) ?? []).length;
  if (h2Count < 8) issues.push(`Only ${h2Count} H2 headings. Need at least 8.`);
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
