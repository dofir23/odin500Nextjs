import type { Metadata } from 'next';
import AdminDashboardPage from '@/views/Admin/AdminDashboardPage.jsx';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <AdminDashboardPage />;
}
