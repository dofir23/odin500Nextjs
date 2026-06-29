import { NewsletterIndexContent } from '@/components/newsletter/NewsletterIndexContent';

export default function NewsletterIndex({ issues, initialLoggedIn = false }) {
  return <NewsletterIndexContent issues={issues} initialLoggedIn={initialLoggedIn} />;
}
