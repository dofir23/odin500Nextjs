import type { Metadata } from 'next';
import AdminPortfoliosPage from '@/views/admin/AdminPortfoliosPage.jsx';

export const metadata: Metadata = {
  title: 'Admin Published Portfolios',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <AdminPortfoliosPage />;
}
