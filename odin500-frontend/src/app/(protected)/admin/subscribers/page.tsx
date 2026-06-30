import type { Metadata } from 'next';
import AdminSubscribersPage from '@/views/Admin/AdminSubscribersPage.jsx';

export const metadata: Metadata = {
  title: 'Admin Subscribers',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <AdminSubscribersPage />;
}
