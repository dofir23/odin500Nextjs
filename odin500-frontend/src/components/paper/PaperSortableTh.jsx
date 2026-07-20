'use client';

/** Sort chevrons matching FigmaDataTable / historical data table. */
export function PaperSortHeaderIcon({ active, dir, className = 'paper-table__sort-icon' }) {
  const base = className;
  if (!active) {
    return (
      <svg
        className={`${base} ${base}--neutral`}
        width="11"
        height="12"
        viewBox="0 0 11 12"
        fill="none"
        aria-hidden
      >
        <path d="M5.5 1.5L8.25 4.25H2.75L5.5 1.5Z" fill="currentColor" opacity="0.45" />
        <path d="M5.5 10.5L2.75 7.75H8.25L5.5 10.5Z" fill="currentColor" opacity="0.45" />
      </svg>
    );
  }
  if (dir === 'asc') {
    return (
      <svg className={`${base} ${base}--active`} width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
        <path d="M5.5 2.5L9 7H2L5.5 2.5Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={`${base} ${base}--active`} width="11" height="12" viewBox="0 0 11 12" fill="none" aria-hidden>
      <path d="M5.5 9.5L2 5H9L5.5 9.5Z" fill="currentColor" />
    </svg>
  );
}

export function PaperSortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
  title,
  className = ''
}) {
  const active = activeKey === sortKey;
  const ariaSort = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      title={title}
      className={[align === 'right' ? 'paper-table__th--num' : '', className].filter(Boolean).join(' ') || undefined}
    >
      <button
        type="button"
        className={`paper-table__sort${active ? ' is-active' : ''}`}
        aria-label={`Sort by ${label}`}
        onClick={() => onSort(sortKey)}
      >
        <span className="paper-table__sort-label">{label}</span>
        <PaperSortHeaderIcon active={active} dir={dir} />
      </button>
    </th>
  );
}
