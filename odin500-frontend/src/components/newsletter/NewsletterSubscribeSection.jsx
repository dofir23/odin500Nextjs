'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIsLoggedIn } from '@/hooks/useIsLoggedIn';

/** Signup CTA for guests; dashboard link when already signed in. */
export function NewsletterSubscribeSection({ initialLoggedIn = false }) {
  const clientLoggedIn = useIsLoggedIn();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loggedIn = hydrated ? clientLoggedIn : initialLoggedIn;

  if (loggedIn) {
    return (
      <section className="newsletter-subscribe" aria-labelledby="newsletter-subscribe-title">
        <h2 id="newsletter-subscribe-title" className="newsletter-section-title">
          Explore live data
        </h2>
        <p className="newsletter-subscribe__text">
          You&apos;re signed in. Open the market dashboard and Odin Signals to follow the metrics
          referenced in each weekly recap.
        </p>
        <Link href="/market" className="newsletter-subscribe__btn">
          Open market dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="newsletter-subscribe" aria-labelledby="newsletter-subscribe-title">
      <h2 id="newsletter-subscribe-title" className="newsletter-section-title">
        Get the weekly recap
      </h2>
      <p className="newsletter-subscribe__text">
        New issues are published on this page each week. Create a free Odin500 account to access live
        dashboards and signals referenced in every edition.
      </p>
      <Link href="/signup" className="newsletter-subscribe__btn">
        Sign up for free
      </Link>
    </section>
  );
}
