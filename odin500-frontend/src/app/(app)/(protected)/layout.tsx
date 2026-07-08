import { AppChromeServer } from '@/ssr/layout/AppChromeServer';
import ProtectedLayout from '@/components/ProtectedLayout.jsx';

export default function ProtectedRootLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout serverNav={<AppChromeServer />}>{children}</ProtectedLayout>;
}
