import { toNextMetadata } from '@/seo/metadata';
import { PageServerShell } from '@/seo/PageServerShell';
import { HomePageServer } from '@/ssr/pages/HomePageServer';
import HomePage from '@/views/HomePage.jsx';

export const metadata = toNextMetadata('/');
export const revalidate = 300;

export default function HomePageRoute() {
  return (
    <PageServerShell pathname="/" serverContent={<HomePageServer />}>
      <HomePage />
    </PageServerShell>
  );
}
