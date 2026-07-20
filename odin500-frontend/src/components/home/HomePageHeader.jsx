'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from '@/navigation/appRouterCompat.jsx';
import { Odin500BrandLink } from '@/components/Odin500BrandLink.jsx';
import { HOME_NAV_PRODUCT } from '@/content/homePageContent';
import { useHeaderProfile } from '@/hooks/useHeaderProfile.js';
import { initAuthSessionOnLoad } from '@/store/apiStore.js';
import { useAuthStore } from '@/store/authStore.js';
import { HomeThemeToggle } from './HomeThemeToggle.jsx';

export function HomePageHeader() {
  const authReady = useAuthStore((s) => s.hydrated);
  const storeLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { loggedIn, profileName, initials, avatarUrl, handleSignOut } = useHeaderProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileWrapRef = useRef(null);

  const showProfile = authReady && (loggedIn || storeLoggedIn);

  useEffect(() => {
    const finish = () => useAuthStore.getState().markHydrated();
    void initAuthSessionOnLoad().finally(finish);
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (profileWrapRef.current && !profileWrapRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (!showProfile) setProfileOpen(false);
  }, [showProfile]);

  return (
    <header className="home-header">
      <div className="home-header__inner">
        <Odin500BrandLink to="/market" title="Odin500 market dashboard" className="home-header__brand" />
        <nav className="home-header__nav" aria-label="Product navigation">
          {HOME_NAV_PRODUCT.map((item) => (
            <a key={item.href} href={item.href} className="home-header__nav-link">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="home-header__actions">
          <HomeThemeToggle />
          {showProfile ? (
            <div className="header-util-wrap home-header__profile" ref={profileWrapRef}>
              <button
                type="button"
                className={
                  'header-avatar-btn' + (profileOpen ? ' header-avatar-btn--active' : '')
                }
                title={profileName || 'Profile'}
                aria-label="Profile menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((v) => !v)}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="header-avatar-image" aria-hidden />
                ) : (
                  <span className="header-avatar-placeholder">{initials}</span>
                )}
              </button>
              {profileOpen ? (
                <div className="header-pop header-pop--profile" role="menu" aria-label="Profile menu">
                  <div className="header-pop__profile-top">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="header-pop__profile-image" aria-hidden />
                    ) : (
                      <span className="header-pop__profile-icon" aria-hidden>
                        {initials}
                      </span>
                    )}
                    <span className="header-pop__profile-name" title={profileName || undefined}>
                      {profileName}
                    </span>
                  </div>
                  <Link
                    to="/profile"
                    className="header-pop__item"
                    onClick={() => setProfileOpen(false)}
                  >
                    Your Profile
                  </Link>
                  <button
                    type="button"
                    className="header-pop__item"
                    onClick={() => setProfileOpen(false)}
                  >
                    Setting
                  </button>
                  <button
                    type="button"
                    className="header-pop__item header-pop__item--danger"
                    onClick={() => {
                      setProfileOpen(false);
                      handleSignOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <a href="/login" className="home-header__login">
                Log in
              </a>
              <a href="/signup" className="home-header__signup">
                <span className="home-header__signup-full">Sign up for free</span>
                <span className="home-header__signup-short">Sign up</span>
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
