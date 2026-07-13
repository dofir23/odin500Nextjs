'use client';

import NextLink from 'next/link';
import {
  useRouter,
  usePathname,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams
} from 'next/navigation';
import { forwardRef, startTransition, useCallback } from 'react';
import { resetRouteNavigationAbort } from './routeNavigationAbort.js';

export function useNavigate() {
  const router = useRouter();
  return (to, options = {}) => {
    const target = typeof to === 'string' ? to : to?.pathname || '/';
    const navOpts = options.scroll === false ? { scroll: false } : undefined;
    resetRouteNavigationAbort({ force: true });
    startTransition(() => {
      if (options.replace) router.replace(target, navOpts);
      else router.push(target, navOpts);
    });
  };
}

export function useLocation() {
  const pathname = usePathname() || '/';
  // Avoid useSearchParams during SSR/static render — it forces CSR bailout.
  // Read query from window after mount via the returned object shape consumers expect.
  let search = '';
  if (typeof window !== 'undefined') {
    search = window.location.search || '';
  }
  return {
    pathname,
    search,
    hash: typeof window !== 'undefined' ? window.location.hash || '' : '',
    key: search ? `${pathname}${search}` : pathname
  };
}

export { usePathname };

export function useParams() {
  return useNextParams() || {};
}

/** React Router–compatible `[searchParams, setSearchParams]` tuple for migrated views. */
export function useSearchParams() {
  const searchParams = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname() || '/';

  const setSearchParams = useCallback(
    (next, options = {}) => {
      let params;
      if (typeof next === 'function') {
        params = next(new URLSearchParams(searchParams.toString()));
      } else if (next instanceof URLSearchParams) {
        params = next;
      } else {
        params = new URLSearchParams(next);
      }
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      resetRouteNavigationAbort({ force: true });
      startTransition(() => {
        if (options.replace) router.replace(url);
        else router.push(url);
      });
    },
    [router, pathname, searchParams]
  );

  return [searchParams, setSearchParams];
}

function shouldHandleSoftNav(event) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  return true;
}

function navigateSoft(router, dest, replace = false) {
  resetRouteNavigationAbort({ force: true });
  startTransition(() => {
    if (replace) router.replace(dest);
    else router.push(dest);
  });
}

export const Link = forwardRef(function Link(
  { to, href, children, prefetch = true, onClick, replace = false, ...rest },
  ref
) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const dest = href ?? to ?? '/';

  return (
    <NextLink
      href={dest}
      prefetch={prefetch}
      ref={ref}
      onClick={(event) => {
        onClick?.(event);
        if (!shouldHandleSoftNav(event)) return;
        let nextPath = dest;
        let nextSearch = '';
        try {
          const url = new URL(String(dest), window.location.origin);
          if (url.origin !== window.location.origin) return;
          nextPath = url.pathname;
          nextSearch = url.search;
        } catch {
          return;
        }
        if (nextPath === pathname && nextSearch === (typeof window !== 'undefined' ? window.location.search : '')) {
          return;
        }
        event.preventDefault();
        navigateSoft(router, dest, replace);
      }}
      {...rest}
    >
      {children}
    </NextLink>
  );
});

export function NavLink({ to, className, children, end, prefetch = true, onClick, replace = false, ...rest }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const dest = to || '/';
  const active = end ? pathname === dest : pathname === dest || pathname.startsWith(`${dest}/`);
  const resolvedClass =
    typeof className === 'function' ? className({ isActive: active }) : className;
  return (
    <NextLink
      href={dest}
      prefetch={prefetch}
      className={resolvedClass}
      onClick={(event) => {
        onClick?.(event);
        if (!shouldHandleSoftNav(event)) return;
        let nextPath = dest;
        try {
          const url = new URL(String(dest), window.location.origin);
          nextPath = url.pathname;
        } catch {
          /* keep dest */
        }
        if (nextPath === pathname) return;
        event.preventDefault();
        navigateSoft(router, dest, replace);
      }}
      {...rest}
    >
      {typeof children === 'function' ? children({ isActive: active }) : children}
    </NextLink>
  );
}
