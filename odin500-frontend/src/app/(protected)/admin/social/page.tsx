import type { Metadata } from 'next';
import AdminSocialPage from '@/views/admin/AdminSocialPage.jsx';

export const metadata: Metadata = {
  title: 'Social drafts',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <AdminSocialPage />;
}
