/**
 * Generate Odin500 Weekly markdown issues.
 *
 * Usage:
 *   npm run newsletter:generate
 *   npm run newsletter:generate -- --week 2026-06-28
 *   npm run newsletter:generate -- --week 2026-06-28 --force
 *   npm run newsletter:generate -- --backfill
 *
 * Loads odin500-frontend/.env automatically (Next.js does not run for this script).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNewsletterMarkdown } from '../src/lib/newsletter/buildNewsletterMarkdown';
import { generateNewsletterContent } from '../src/lib/newsletter/generateNewsletterAi';
import {
  getCompletedWeek,
  getWeekEndingSunday,
  listWeeksBetween,
  type NewsletterWeek
} from '../src/lib/newsletter/newsletterWeek';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NEWSLETTER_DIR = path.join(ROOT, 'src', 'content', 'newsletter');

/** Load .env into process.env (CLI does not use Next.js env loading). */
function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('[newsletter] No .env file at', envPath);
    return;
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function parseArgs(argv: string[]) {
  let week: string | null = null;
  let backfill = false;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backfill') backfill = true;
    else if (a === '--force') force = true;
    else if (a === '--week' && argv[i + 1]) {
      week = argv[++i].slice(0, 10);
    } else if (a.startsWith('--week=')) {
      week = a.split('=')[1]?.slice(0, 10) || null;
    }
  }

  return { week, backfill, force };
}

function latestPublishedSunday(): string | null {
  if (!fs.existsSync(NEWSLETTER_DIR)) return null;
  const dates: string[] = [];
  for (const file of fs.readdirSync(NEWSLETTER_DIR)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const raw = fs.readFileSync(path.join(NEWSLETTER_DIR, file), 'utf8');
    const m = raw.match(/^publishedAt:\s*["']?(\d{4}-\d{2}-\d{2})/m);
    if (m) dates.push(m[1]);
  }
  if (!dates.length) return null;
  dates.sort();
  return dates[dates.length - 1];
}

function issuePath(week: NewsletterWeek) {
  return path.join(NEWSLETTER_DIR, `${week.slug}.md`);
}

async function generateOne(
  week: NewsletterWeek,
  force: boolean
): Promise<'created' | 'skipped'> {
  const out = issuePath(week);
  if (fs.existsSync(out) && !force) {
    console.log(`skip  ${week.slug} (already exists — use --force to overwrite)`);
    return 'skipped';
  }

  if (fs.existsSync(out) && force) {
    console.log(`force ${week.slug} — overwriting existing issue`);
  } else {
    console.log(`gen   ${week.slug} — ${week.weekLabel}`);
  }

  const { content, source } = await generateNewsletterContent(week);
  const markdown = buildNewsletterMarkdown(week, content);

  fs.mkdirSync(NEWSLETTER_DIR, { recursive: true });
  fs.writeFileSync(out, markdown, 'utf8');
  console.log(`wrote ${out} (generator: ${source})`);
  return 'created';
}

function weeksToGenerate(week: string | null, backfill: boolean): NewsletterWeek[] {
  const lastCompleted = week ? getWeekEndingSunday(week) : getCompletedWeek();

  if (backfill) {
    const after = latestPublishedSunday();
    return listWeeksBetween(after, lastCompleted);
  }

  return [lastCompleted];
}

async function main() {
  loadEnvFile();

  const keyPresent = Boolean(process.env.OPENAI_API_KEY?.trim());
  console.log(
    `[newsletter] OPENAI_API_KEY: ${keyPresent ? 'loaded from .env' : 'NOT SET — template only'}`
  );

  const { week, backfill, force } = parseArgs(process.argv.slice(2));
  const weeks = weeksToGenerate(week, backfill);

  if (!weeks.length) {
    console.log('No missing weeks to generate.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const w of weeks) {
    const result = await generateOne(w, force);
    if (result === 'created') created += 1;
    else skipped += 1;
  }

  console.log(`Done. created=${created} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
