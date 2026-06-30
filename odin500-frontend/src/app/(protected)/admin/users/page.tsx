import type { Metadata } from 'next';
import AdminUsersPage from '@/views/Admin/AdminUsersPage.jsx';

export const metadata: Metadata = {
  title: 'Admin Users',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <AdminUsersPage />;
}
