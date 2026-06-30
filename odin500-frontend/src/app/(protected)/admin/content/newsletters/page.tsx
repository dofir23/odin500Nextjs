import type { Metadata } from 'next';
import AdminNewslettersPage from '@/views/Admin/AdminNewslettersPage.jsx';

export const metadata: Metadata = {
  title: 'Admin Newsletters',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <AdminNewslettersPage />;
}
