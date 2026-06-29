'use client';
export function AutomatedAccountBanner() {
  return (
    <div className="paper-auto-banner" role="status">
      <strong>Automated portfolio</strong>
      <span>
        This account runs a custom strategy on a schedule. Use the Strategy tab to pause, edit rules, or
        run now.
      </span>
    </div>
  );
}
