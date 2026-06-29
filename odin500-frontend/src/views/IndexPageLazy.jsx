'use client';
import IndexPage from './IndexPage.jsx';

/** Direct import — SSR data is passed from the App Router page.tsx wrapper. */
export default function IndexPageLazy(props) {
  return <IndexPage {...props} />;
}
