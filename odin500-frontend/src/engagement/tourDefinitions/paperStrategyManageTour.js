/** @typedef {import('driver.js').DriveStep} DriveStep */

/** @returns {DriveStep[]} */
export function buildPaperStrategyManageSteps() {
  return [
    {
      element: '[data-tour="paper-strategy-panel-intro"]',
      disableActiveInteraction: true,
      popover: {
        title: 'Your strategy',
        description:
          'This panel shows automation status, last run time, and errors. Use the controls on the right to pause, resume, or test a run.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '[data-tour="paper-strategy-controls"]',
      disableActiveInteraction: true,
      popover: {
        title: 'Run automation',
        description:
          'Pause stops scheduled runs. Resume turns automation back on. Run now evaluates all rules immediately (useful for testing).',
        side: 'bottom',
        align: 'end'
      }
    },
    {
      element: '[data-tour="paper-strategy-watchlist"]',
      popover: {
        title: 'Watchlist signals',
        description:
          'Pick a watchlist to see each ticker\'s Odin signal. Check tickers, then add quick rules or push them into the rule form below.',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '[data-tour="paper-strategy-rules"]',
      popover: {
        title: 'Rules',
        description:
          'Each rule defines when to Buy, Short, Sell, or Cover. Set qty per run, max position for entries, or Close all (ALL) for exits.',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '[data-tour="paper-strategy-log"]',
      popover: {
        title: 'Execution log',
        description:
          'See what the scheduler did: triggered orders, skips, and errors. Check here after Run now or on the hourly schedule.',
        side: 'top',
        align: 'start',
        onNextClick: (_element, _step, { driver: tourDriver }) => {
          document
            .querySelector('[data-tour="paper-blotter-tabs-row"]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.setTimeout(() => tourDriver.moveNext(), 450);
        }
      }
    },
    {
      element: '[data-tour="paper-blotter-tabs-row"]',
      popover: {
        title: 'Monitor results',
        description:
          'Use Positions, Orders, and Closed trades to verify fills and P&L. Switch tabs here anytime to track what your strategy did.',
        side: 'bottom',
        align: 'center'
      }
    }
  ];
}
