'use client';
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseIcon } from './ModalCloseIcon.jsx';
import { ChartExportSocialShare } from './ChartExportSocialShare.jsx';

/**
 * Preview + download modal for chart PNG exports (shared np-export-modal styles).
 * @param {{
 *   open: boolean,
 *   status: 'idle' | 'capturing' | 'ready' | 'error',
 *   error?: string,
 *   previewUrl?: string | null,
 *   onClose: () => void,
 *   onDownload: () => void,
 *   title?: string,
 *   titleId?: string,
 *   previewAlt?: string,
 *   shareLabel?: string,
 *   sharePageUrl?: string,
 *   exportFilename?: string,
 * }} props
 */
export function ChartSnapshotExportModal({
  open,
  status,
  error = '',
  previewUrl = null,
  onClose,
  onDownload,
  title = 'Export chart',
  titleId = 'chart-export-modal-title',
  previewAlt = 'Exported chart',
  shareLabel,
  sharePageUrl,
  exportFilename = 'odin500-chart.png'
}) {
  const shareChartLabel = shareLabel || previewAlt || title;
  const resolvedPageUrl = useMemo(() => {
    if (sharePageUrl) return sharePageUrl;
    if (typeof window !== 'undefined') return window.location.href;
    return '';
  }, [sharePageUrl, open]);

  if (!open || typeof document === 'undefined') return null;

  const showShare = Boolean(previewUrl && status === 'ready');

  return createPortal(
    <div
      className="np-export-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="np-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="np-export-modal__head">
          <h2 id={titleId} className="np-export-modal__title">
            {title}
          </h2>
          <button type="button" className="np-export-modal__close" onClick={onClose} aria-label="Close">
            <ModalCloseIcon className="wl-manage-modal__close-icon" />
          </button>
        </div>
        <div className="np-export-modal__body">
          {status === 'capturing' ? <div className="np-export-modal__status">Generating preview…</div> : null}
          {status === 'error' ? (
            <div className="np-export-modal__status np-export-modal__status--error" role="alert">
              {error || 'Something went wrong.'}
            </div>
          ) : null}
          {previewUrl ? (
            <div className="np-export-modal__preview-wrap">
              <img src={previewUrl} alt={previewAlt} className="np-export-modal__preview" />
            </div>
          ) : null}
        </div>
        <div className="np-export-modal__foot">
          {showShare ? (
            <ChartExportSocialShare
              chartLabel={shareChartLabel}
              pageUrl={resolvedPageUrl}
              previewUrl={previewUrl}
              filename={exportFilename}
              variant="inline"
            />
          ) : (
            <span className="np-export-modal__foot-spacer" aria-hidden />
          )}
          <div className="np-export-modal__foot-actions">
            <button type="button" className="np-export-modal__btn np-export-modal__btn--ghost" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="np-export-modal__btn np-export-modal__btn--primary"
              onClick={onDownload}
              disabled={!previewUrl}
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
