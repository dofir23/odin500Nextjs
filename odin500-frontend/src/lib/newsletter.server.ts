import 'server-only';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import type { NewsletterFrontmatter, NewsletterIssue } from './newsletter.shared';

const NEWSLETTER_DIR = path.join(process.cwd(), 'src', 'content', 'newsletter');

function parseIssueFile(filename: string): NewsletterIssue | null {
  if (!filename.endsWith('.md')) return null;
  const slug = filename.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(NEWSLETTER_DIR, filename), 'utf8');
  const { data, content } = matter(raw);
  const meta = data as NewsletterFrontmatter;
  if (!meta?.title || !meta?.publishedAt) return null;

  return {
    slug,
    meta: {
      title: String(meta.title),
      description: String(meta.description || ''),
      publishedAt: String(meta.publishedAt),
      weekLabel: meta.weekLabel ? String(meta.weekLabel) : undefined,
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : undefined,
      author: meta.author ? String(meta.author) : 'Odin500'
    },
    content,
    html: marked.parse(content, { async: false }) as string
  };
}

/** All published issues, newest first. */
export function getAllNewsletters(): NewsletterIssue[] {
  if (!fs.existsSync(NEWSLETTER_DIR)) return [];

  const files = fs.readdirSync(NEWSLETTER_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const issues = files
    .map(parseIssueFile)
    .filter((issue): issue is NewsletterIssue => issue !== null);

  return issues.sort(
    (a, b) => new Date(b.meta.publishedAt).getTime() - new Date(a.meta.publishedAt).getTime()
  );
}

export function getNewsletterSlugs(): string[] {
  return getAllNewsletters().map((issue) => issue.slug);
}

export function getNewsletterBySlug(slug: string): NewsletterIssue | null {
  const file = path.join(NEWSLETTER_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return parseIssueFile(`${slug}.md`);
}
