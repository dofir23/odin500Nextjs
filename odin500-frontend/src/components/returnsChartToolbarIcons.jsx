'use client';
import { useId } from 'react';

/** Icons for returns chart toolbars (stroke follows `currentColor`). */

/** Pie-chart badge icon: white in dark theme, slate-900 in light (`returns-chart-pie-icon` in CSS). */
export function ReturnsChartPieIcon({ className = '', ...props }) {
  const clipId = useId().replace(/:/g, '');
  const rootClass = ['returns-chart-pie-icon', className].filter(Boolean).join(' ');
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={rootClass}
      aria-hidden
      {...props}
    >
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M7.82031 1.25781V6.17969H12.7422C12.7422 4.87433 12.2236 3.62243 11.3006 2.6994C10.3776 1.77637 9.12567 1.25781 7.82031 1.25781Z"
          stroke="currentColor"
          strokeWidth="0.875"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.17969 2.89844C5.20623 2.89844 4.25464 3.1871 3.44524 3.72792C2.63584 4.26875 2.005 5.03744 1.63247 5.93679C1.25995 6.83615 1.16248 7.82577 1.35239 8.78052C1.5423 9.73527 2.01106 10.6123 2.6994 11.3006C3.38774 11.9889 4.26473 12.4577 5.21948 12.6476C6.17423 12.8375 7.16386 12.7401 8.06321 12.3675C8.96257 11.995 9.73126 11.3642 10.2721 10.5548C10.8129 9.74536 11.1016 8.79377 11.1016 7.82031H6.17969V2.89844Z"
          stroke="currentColor"
          strokeWidth="0.875"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id={clipId}>
          <rect width="14" height="14" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function ReturnsChartIcoViewMore() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 3.00001H21L21 9.00001M21 3.00001L12 12M10 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { StatsCmpIcoTable as ReturnsChartIcoTable, StatsCmpIcoDownload as ReturnsChartIcoDownload } from './statsCmpChartToolbarIcons.jsx';
