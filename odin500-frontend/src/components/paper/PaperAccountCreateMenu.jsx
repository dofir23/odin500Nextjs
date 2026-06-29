'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

const MENU_PORTAL_Z = 12000;

function OptionTag({ tag }) {
  if (!tag) return null;
  const label = tag === 'auto' ? 'Auto' : tag;
  return (
    <span className={'wl-flyout__select-item-tag wl-flyout__select-item-tag--' + tag}>{label}</span>
  );
}

/**
 * @param {{
 *   title: string,
 *   description: string,
 *   tag?: 'auto',
 *   onClick: () => void,
 *   tourId?: string
 * }} props
 */
function CreateMenuOption({ title, description, tag, onClick, tourId }) {
  return (
    <li role="none">
      <button
        type="button"
        className="app-dropdown__item app-dropdown__item--stacked"
        role="menuitem"
        data-tour={tourId}
        onClick={onClick}
      >
        <span className="app-dropdown__item-row paper-create-menu__item-head">
          {tag ? <OptionTag tag={tag} /> : null}
          <span className="app-dropdown__item-name">{title}</span>
        </span>
        <span className="paper-create-menu__desc">{description}</span>
      </button>
    </li>
  );
}

/**
 * @param {{
 *   onManualAccount: () => void,
 *   onStrategyAccount: () => void,
 *   disabled?: boolean
 * }} props
 */
export function PaperAccountCreateMenu({ onManualAccount, onStrategyAccount, disabled = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  const syncMenuPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const width = Math.max(248, r.width + 160);
    let left = r.left;
    left = Math.min(left, window.innerWidth - width - 8);
    left = Math.max(8, left);
    setMenuPos({ top: r.bottom + gap, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
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
  }, [open, syncMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event) => {
      const t = event.target;
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

  function pickManual() {
    setOpen(false);
    onManualAccount();
  }

  function pickStrategy() {
    setOpen(false);
    onStrategyAccount();
  }

  const menuEl =
    open && menuPos
      ? createPortal(
          <ul
            ref={menuRef}
            className="app-dropdown__menu app-dropdown__menu--portal paper-create-menu__menu"
            role="menu"
            aria-label="Add paper account"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              minWidth: menuPos.width,
              zIndex: MENU_PORTAL_Z,
              margin: 0
            }}
          >
            <CreateMenuOption
              title="Manual account"
              description="Place your own trades with the order ticket"
              onClick={pickManual}
            />
            <CreateMenuOption
              title="Strategy account"
              description="Let Odin rules buy and sell for you"
              tag="auto"
              tourId="paper-new-strategy-account"
              onClick={pickStrategy}
            />
          </ul>,
          document.body
        )
      : null;

  return (
    <div className="paper-create-menu app-dropdown app-dropdown--menu-match" ref={wrapRef}>
      <button
        type="button"
        className={
          'paper-btn paper-btn--icon paper-btn--ghost paper-create-menu__trigger' +
          (open ? ' paper-create-menu__trigger--open' : '')
        }
        disabled={disabled}
        aria-label="Add paper account"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Add a manual or automated paper account"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="paper-btn__icon" aria-hidden />
      </button>
      {menuEl}
    </div>
  );
}
