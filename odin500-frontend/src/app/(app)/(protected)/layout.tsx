import ProtectedLayout from '@/components/ProtectedLayout.jsx';

/**
 * No `serverNav`: AppChromeServer rendered a nav that CSS kept at `display: none` on every
 * content page, so those links existed for crawlers and for no visitor — the pattern Google
 * treats as hidden links. The client sidebar already provides this navigation to users, and
 * Google renders JavaScript, so it sees the sidebar too.
 */
export default function ProtectedRootLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
