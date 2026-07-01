'use client';

import { PaperManageModal } from '../paper/PaperManageModal.jsx';

/**
 * Admin confirmation dialog — same shell as paper portfolio delete (`PaperManageModal`).
 */
export function AdminConfirmModal({
  open,
  title,
  titleId = 'admin-confirm-title',
  message,
  confirmLabel = 'Confirm',
  busy = false,
  error = '',
  onClose,
  onConfirm
}) {
  return (
    <PaperManageModal
      open={open}
      title={title}
      titleId={titleId}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="wl-manage-btn wl-manage-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="wl-manage-btn wl-manage-btn--danger"
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="paper-modal-msg">{message}</p>
      {error ? <p className="wl-manage-err">{error}</p> : null}
    </PaperManageModal>
  );
}
