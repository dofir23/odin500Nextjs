'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIsLoggedIn } from '@/hooks/useIsLoggedIn';
import { useNewsletterSubscription } from '@/hooks/useNotifications';

/**
 * @param {{ initialLoggedIn?: boolean, variant?: 'header' | 'section' }} props
 */
export function NewsletterSubscribeSection({ initialLoggedIn = false, variant = 'section' }) {
  const clientLoggedIn = useIsLoggedIn();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loggedIn = hydrated ? clientLoggedIn : initialLoggedIn;
  const { subscribed, busy, error, subscribe, unsubscribe } = useNewsletterSubscription({
    enabled: loggedIn
  });

  const isHeader = variant === 'header';

  if (!loggedIn) {
    return (
      <div
        className={
          isHeader ? 'newsletter-subscribe newsletter-subscribe--header' : 'newsletter-subscribe'
        }
        aria-labelledby={isHeader ? undefined : 'newsletter-subscribe-title'}
      >
        {!isHeader ? (
          <>
            <h2 id="newsletter-subscribe-title" className="newsletter-section-title">
              Get the weekly recap
            </h2>
            <p className="newsletter-subscribe__text">
              Sign in or create a free account to get Sunday email and in-app alerts for each new
              issue.
            </p>
          </>
        ) : (
          <p className="newsletter-subscribe__text newsletter-subscribe__text--header">
            Get email and in-app alerts
          </p>
        )}
        <Link href="/signup" className="newsletter-subscribe__btn">
          Sign up to subscribe
        </Link>
      </div>
    );
  }

  return (
    <div
      className={
        isHeader ? 'newsletter-subscribe newsletter-subscribe--header' : 'newsletter-subscribe'
      }
      aria-labelledby={isHeader ? undefined : 'newsletter-subscribe-title'}
    >
      {!isHeader ? (
        <>
          <h2 id="newsletter-subscribe-title" className="newsletter-section-title">
            {subscribed ? "You're subscribed" : 'Subscribe to Odin500 Weekly'}
          </h2>
          <p className="newsletter-subscribe__text">
            {subscribed
              ? "You'll get an email and an in-app notification every Sunday when a new recap is published."
              : 'Get a Sunday email and in-app notification when each weekly market recap is published.'}
          </p>
        </>
      ) : subscribed ? (
        <p className="newsletter-subscribe__status newsletter-subscribe__status--on">
          Subscribed to weekly alerts
        </p>
      ) : null}

      {error ? <p className="newsletter-subscribe__err">{error}</p> : null}
      <button
        type="button"
        className={
          'newsletter-subscribe__btn' +
          (subscribed && isHeader ? ' newsletter-subscribe__btn--outline' : '')
        }
        disabled={busy}
        onClick={() => void (subscribed ? unsubscribe() : subscribe())}
      >
        {busy ? 'Saving…' : subscribed ? 'Unsubscribe' : 'Subscribe'}
      </button>
    </div>
  );
}
