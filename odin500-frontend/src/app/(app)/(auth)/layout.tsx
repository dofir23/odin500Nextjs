import type { ReactNode } from 'react';
import { AppChromeServer } from '@/ssr/layout/AppChromeServer';

export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout-ssr">
      <AppChromeServer />
      <div className="auth-layout-ssr__main">{children}</div>
    </div>
  );
}
