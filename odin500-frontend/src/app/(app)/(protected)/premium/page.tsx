import { toNextMetadata } from '@/seo/metadata';

export const metadata = toNextMetadata('/premium');
export const revalidate = 300;

import { PageServerShell } from '@/seo/PageServerShell';
import { PremiumPageServer } from '@/ssr/pages/PremiumPageServer';
import Pricing from '@/views/Pricing.jsx';

export default function Page() {
  return (
    <PageServerShell
      pathname="/premium"
      seoData={{ premium: true }}
      serverContent={<PremiumPageServer />}
    >
      <Pricing />
    </PageServerShell>
  );
}
