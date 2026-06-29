'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseIcon } from '../ModalCloseIcon.jsx';

/**
 * Centered modal shell — same pattern as watchlist create (`wl-manage-overlay` / `wl-manage-modal`).
 */
export function PaperManageModal({ open, title, titleId, onClose, children, footer, modalClassName = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="wl-manage-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={'wl-manage-modal' + (modalClassName ? ` ${modalClassName}` : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wl-manage-modal__head">
          <h3 id={titleId} className="wl-manage-modal__title">
            {title}
          </h3>
          <button type="button" className="wl-manage-modal__close" onClick={onClose} aria-label="Close">
            <ModalCloseIcon className="wl-manage-modal__close-icon" />
          </button>
        </div>
        <div className="wl-manage-modal__body">{children}</div>
        {footer ? <div className="wl-manage-modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
