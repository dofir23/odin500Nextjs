'use client';

import NextLink from 'next/link';
import {
  useRouter,
  usePathname,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams
} from 'next/navigation';
import { forwardRef, useCallback } from 'react';

export function useNavigate() {
  const router = useRouter();
  return (to, options = {}) => {
    const target = typeof to === 'string' ? to : to?.pathname || '/';
    const navOpts = options.scroll === false ? { scroll: false } : undefined;
    if (options.replace) router.replace(target, navOpts);
    else router.push(target, navOpts);
  };
}

export function useLocation() {
  const pathname = usePathname() || '/';
  const searchParams = useNextSearchParams();
  const qs = searchParams?.toString();
  return {
    pathname,
    search: qs ? `?${qs}` : '',
    hash: '',
    key: qs ? `${pathname}?${qs}` : pathname
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
      if (options.replace) router.replace(url);
      else router.push(url);
    },
    [router, pathname, searchParams]
  );

  return [searchParams, setSearchParams];
}

export const Link = forwardRef(function Link({ to, href, children, prefetch = true, ...rest }, ref) {
  const dest = href ?? to ?? '/';
  return (
    <NextLink href={dest} prefetch={prefetch} ref={ref} {...rest}>
      {children}
    </NextLink>
  );
});

export function NavLink({ to, className, children, end, prefetch = true, ...rest }) {
  const pathname = usePathname() || '/';
  const dest = to || '/';
  const active = end ? pathname === dest : pathname === dest || pathname.startsWith(`${dest}/`);
  const resolvedClass =
    typeof className === 'function' ? className({ isActive: active }) : className;
  return (
    <NextLink href={dest} prefetch={prefetch} className={resolvedClass} {...rest}>
      {typeof children === 'function' ? children({ isActive: active }) : children}
    </NextLink>
  );
}
