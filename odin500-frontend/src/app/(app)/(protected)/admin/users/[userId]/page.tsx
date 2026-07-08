import type { Metadata } from 'next';
import AdminUserDetailPage from '@/views/admin/AdminUserDetailPage.jsx';

export const metadata: Metadata = {
  title: 'Admin User',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <AdminUserDetailPage />;
}
