'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function ChevronDownIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" />
    </svg>
  );
}

/** z-index above charts, rails, and most modals so portaled menus stay visible */
const MENU_PORTAL_Z = 12000;

function OptionTag({ tag }) {
  if (!tag) return null;
  const label =
    tag === 'ai' ? 'AI' : tag === 'auto' ? 'Auto' : tag === 'user' ? 'Yours' : 'Default';
  const cls =
    'wl-flyout__select-item-tag' +
    (tag === 'ai'
      ? ' wl-flyout__select-item-tag--ai'
      : tag === 'auto'
        ? ' wl-flyout__select-item-tag--auto'
        : tag === 'user'
          ? ' wl-flyout__select-item-tag--user'
          : ' wl-flyout__select-item-tag--default');
  return <span className={cls}>{label}</span>;
}

function OptionLabel({ opt }) {
  if (!opt?.tag) return opt?.label ?? '';
  return (
    <span className="app-dropdown__item-row">
      <OptionTag tag={opt.tag} />
      <span className="app-dropdown__item-name">{opt.label}</span>
    </span>
  );
}

/**
 * Shared menu-style dropdown for dark/light themes.
 * @param {{
 *   value: string,
 *   options: Array<{ id: string, label: string, tag?: 'ai' | 'auto' | 'user' | 'default', disabled?: boolean, disabledTitle?: string }>,
 *   onChange: (next: string) => void,
 *   icon?: import('react').ReactNode,
 *   title?: string,
 *   ariaLabelPrefix?: string,
 *   labelFallback?: string,
 *   size?: 'md' | 'sm',
 *   menuMaxHeight?: string,
 *   className?: string,
 *   style?: import('react').CSSProperties,
 *   buttonId?: string,
 *   wideLabel?: boolean,
 *   menuMatchTriggerWidth?: boolean,
 *   disabled?: boolean,
 *   menuPortal?: boolean,
 *   multiple?: boolean,
 * }} props
 * `menuPortal` defaults to true: menu is rendered in `document.body` with fixed position so it is not clipped by overflow-x ancestors (e.g. returns toolbars). Set false to keep the menu inside the trigger (legacy).
 *
 * `multiple` turns the menu into checkable items: `value` becomes an array of ids, `onChange`
 * receives the next array, and picking an item keeps the menu open so several can be chosen in
 * one go. Mark one option `isNone: true` to act as the "nothing selected" entry — choosing it
 * clears the selection, and its label is what the trigger shows while nothing is picked.
 * Single-select behaviour is unchanged when `multiple` is false (the default).
 */
export function ThemedDropdown({
  value,
  options,
  onChange,
  icon = null,
  title = 'Select',
  ariaLabelPrefix = 'Selected',
  labelFallback = 'Select',
  size = 'md',
  menuMaxHeight,
  className = '',
  style,
  buttonId,
  wideLabel = false,
  menuMatchTriggerWidth = true,
  disabled = false,
  menuPortal = true,
  multiple = false
}) {
  const selectedIds = useMemo(
    () => (multiple ? (Array.isArray(value) ? value : []) : []),
    [multiple, value]
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(/** @type {HTMLUListElement | null} */ (null));
  const [menuPos, setMenuPos] = useState(
    /** @type {{ top: number|null, bottom: number|null, left: number, width: number, maxHeight: string } | null} */ (
      null
    )
  );

  const syncMenuPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let left = r.left;
    const minMenu = size === 'sm' ? 92 : 132;
    const width = menuMatchTriggerWidth ? Math.max(r.width, minMenu) : Math.max(r.width, minMenu);
    left = Math.min(left, vw - width - 8);
    left = Math.max(8, left);

    const defaultCap = 300;
    const minCap = 140;
    const spaceBelow = vh - r.bottom - gap - 10;
    const spaceAbove = r.top - gap - 10;

    // Prefer opening downward; flip above the trigger only when there isn't room below
    // but there is more room above (e.g. a dropdown near the bottom of the viewport).
    if (spaceBelow < minCap && spaceAbove > spaceBelow) {
      const cap = menuMaxHeight ? undefined : Math.min(defaultCap, Math.max(minCap, spaceAbove));
      const maxHeight = menuMaxHeight || `${cap}px`;
      setMenuPos({ top: null, bottom: vh - r.top + gap, left, width, maxHeight });
    } else {
      const cap = menuMaxHeight ? undefined : Math.min(defaultCap, Math.max(minCap, spaceBelow));
      const maxHeight = menuMaxHeight || `${cap}px`;
      setMenuPos({ top: r.bottom + gap, bottom: null, left, width, maxHeight });
    }
  }, [size, menuMatchTriggerWidth, menuMaxHeight]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open || !menuPortal) {
      setMenuPos(null);
      return;
    }
    syncMenuPosition();
    window.addEventListener('scroll', syncMenuPosition, true);
    window.addEventListener('resize', syncMenuPosition);
    return () => {
      window.removeEventListener('scroll', syncMenuPosition, true);
      window.removeEventListener('resize', syncMenuPosition);
    };
  }, [open, menuPortal, syncMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event) => {
      const t = /** @type {Node} */ (event.target);
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onDocKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [open]);

  const noneOption = useMemo(() => options.find((opt) => opt.isNone), [options]);

  const currentLabel = useMemo(() => {
    if (!multiple) return options.find((opt) => opt.id === value)?.label ?? labelFallback;
    if (!selectedIds.length) return noneOption?.label ?? labelFallback;
    if (selectedIds.length === 1) {
      return options.find((opt) => opt.id === selectedIds[0])?.label ?? labelFallback;
    }
    return `${selectedIds.length} selected`;
  }, [multiple, options, value, selectedIds, noneOption, labelFallback]);

  const currentOption = useMemo(
    () => (multiple ? undefined : options.find((opt) => opt.id === value)),
    [multiple, options, value]
  );

  const isChecked = (opt) =>
    multiple ? (opt.isNone ? selectedIds.length === 0 : selectedIds.includes(opt.id)) : value === opt.id;

  const handlePick = (opt) => {
    if (opt.disabled) return;
    if (!multiple) {
      onChange(opt.id);
      setOpen(false);
      return;
    }
    // The "none" entry is a reset, so it closes; real options toggle and stay open.
    if (opt.isNone) {
      onChange([]);
      setOpen(false);
      return;
    }
    onChange(
      selectedIds.includes(opt.id) ? selectedIds.filter((id) => id !== opt.id) : [...selectedIds, opt.id]
    );
  };

  const rootClass =
    'app-dropdown' +
    (size === 'sm' ? ' app-dropdown--sm' : '') +
    (wideLabel ? ' app-dropdown--wide-label' : '') +
    (menuMatchTriggerWidth ? ' app-dropdown--menu-match' : '') +
    (className ? ' ' + className.trim() : '');

  const menuListClass =
    'app-dropdown__menu' +
    (menuMaxHeight || menuPortal ? ' app-dropdown__menu--scrollable' : '') +
    (menuPortal ? ' app-dropdown__menu--portal' : '');

  const menuEl = open ? (
    <ul
      ref={menuRef}
      className={menuListClass}
      role="menu"
      style={
        menuPortal && menuPos
          ? {
              position: 'fixed',
              // Always set both explicitly — the base .app-dropdown__menu class has its own
              // `top: calc(100% + 4px)`, which otherwise stays active alongside an inline
              // `bottom` (flip-up case) and produces a negative computed height.
              top: menuPos.top != null ? menuPos.top : 'auto',
              bottom: menuPos.bottom != null ? menuPos.bottom : 'auto',
              left: menuPos.left,
              width: menuPos.width,
              minWidth: menuPos.width,
              maxHeight: menuPos.maxHeight,
              zIndex: MENU_PORTAL_Z,
              margin: 0
            }
          : menuMaxHeight
            ? { maxHeight: menuMaxHeight }
            : undefined
      }
    >
      {options.map((opt) => {
        const checked = isChecked(opt);
        return (
          <li key={opt.id} role="none">
            <button
              type="button"
              role={multiple ? 'menuitemcheckbox' : 'menuitemradio'}
              aria-checked={checked}
              aria-disabled={opt.disabled || undefined}
              disabled={opt.disabled}
              title={opt.disabled ? opt.disabledTitle || opt.label : undefined}
              className={
                'app-dropdown__item' +
                (checked ? ' app-dropdown__item--active' : '') +
                (opt.disabled ? ' app-dropdown__item--disabled' : '') +
                (multiple ? ' app-dropdown__item--checkable' : '')
              }
              onClick={() => handlePick(opt)}
            >
              {multiple && !opt.isNone ? (
                <span
                  className={'app-dropdown__tick' + (checked ? ' app-dropdown__tick--on' : '')}
                  aria-hidden
                />
              ) : null}
              <OptionLabel opt={opt} />
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <div className={rootClass} style={style} ref={wrapRef}>
      <button
        type="button"
        id={buttonId}
        className="app-dropdown__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabelPrefix}: ${currentLabel}`}
        title={title}
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        {icon ? <span className="app-dropdown__icon">{icon}</span> : null}
        <span className="app-dropdown__label">
          {currentOption?.tag ? (
            <span className="app-dropdown__item-row">
              <OptionTag tag={currentOption.tag} />
              <span className="app-dropdown__item-name">{currentLabel}</span>
            </span>
          ) : (
            currentLabel
          )}
        </span>
        <ChevronDownIcon className="app-dropdown__chev" />
      </button>
      {menuPortal && menuEl && portalTarget
        ? createPortal(menuEl, portalTarget)
        : !menuPortal && menuEl}
    </div>
  );
}
