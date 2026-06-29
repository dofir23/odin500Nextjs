import matter from 'gray-matter';
import type { NewsletterWeek } from './newsletterWeek';
import type { GeneratedNewsletterContent } from './generateNewsletterTemplate';

export type NewsletterFrontmatterOutput = {
  title: string;
  description: string;
  publishedAt: string;
  weekLabel: string;
  tags: string[];
  author: string;
  generator?: 'ai' | 'template';
};

export function buildNewsletterMarkdown(
  week: NewsletterWeek,
  content: GeneratedNewsletterContent
): string {
  const frontmatter: NewsletterFrontmatterOutput = {
    title: content.title,
    description: content.description,
    publishedAt: week.publishedAt,
    weekLabel: week.weekLabel,
    tags: content.tags.length ? content.tags : ['market-recap'],
    author: 'Odin500',
    ...(content.generator ? { generator: content.generator } : {})
  };

  return matter.stringify(content.body.trim() + '\n', frontmatter);
}
