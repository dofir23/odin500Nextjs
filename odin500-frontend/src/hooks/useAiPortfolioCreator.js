'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth, canFetchProtectedApi } from '../store/apiStore.js';
import { toast } from '../utils/toast.js';

/**
 * Provider call failures come back as `"Anthropic error 400: {\"type\":\"error\",...}"`
 * (raw upstream JSON, sometimes truncated) — pull out just the human-readable
 * `message` field so the toast/chat bubble isn't a wall of JSON.
 */
function cleanProviderErrorMessage(raw) {
  const str = String(raw || '');
  const providerMatch = str.match(/^([A-Za-z]+) error \d+: /);
  if (!providerMatch) return str;
  const jsonMatch = str.slice(providerMatch[0].length).match(/"message"\s*:\s*"([^"]+)"/);
  return jsonMatch ? `${providerMatch[1]}: ${jsonMatch[1]}` : str;
}

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.error || payload?.message || 'Request failed');
    err.status = res.status;
    err.code = payload?.code;
    throw err;
  }
  return payload;
}

/** Which AI engines the server has API keys configured for. Requires auth — pass `enabled: false`
 *  (e.g. while logged out) to skip the call instead of it failing with a silent 401. */
export function useAiEngines({ enabled = true } = {}) {
  const [engines, setEngines] = useState([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setEngines([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchWithAuth(apiUrl('/api/paper/ai-portfolios/engines'));
        const payload = await parseJson(res);
        if (!cancelled) setEngines(Array.isArray(payload.engines) ? payload.engines : []);
      } catch {
        if (!cancelled) setEngines([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { engines, loading };
}

/**
 * Stateless-config chat thread that proposes a brand-new AI-managed portfolio,
 * then confirms (creates + publishes) it. Mirrors usePortfolioAssistant.js's
 * shape but there's no existing accountId — config is passed in instead.
 * @param {{ engine: string, indexFocus: string, direction: string, positionCount: number,
 *           sizing: string, positionQty: number|null, criteria: string, cadence: string }} config
 */
export function useAiPortfolioCreator(config) {
  const { engine, indexFocus, direction, positionCount, sizing, positionQty, criteria, cadence } = config;
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmErrorCode, setConfirmErrorCode] = useState('');

  const sendMessage = useCallback(
    async (text) => {
      const content = String(text || '').trim();
      if (!content || !canFetchProtectedApi()) return null;
      if (!engine || !indexFocus || !direction || !positionCount || !sizing || !criteria || !cadence) {
        setError('Choose an AI engine, index, direction, position count, sizing, criteria, and cadence first.');
        return null;
      }

      const userMsg = { id: `u-${Date.now()}`, role: 'user', content, at: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setError('');

      try {
        const history = [...messages, userMsg]
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetchWithAuth(apiUrl('/api/paper/ai-portfolios/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine,
            index_focus: indexFocus,
            direction,
            position_count: positionCount,
            sizing,
            position_qty: positionQty,
            criteria,
            cadence,
            messages: history
          })
        });
        const payload = await parseJson(res);

        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: String(payload.reply || '').trim() || 'Done.',
          at: Date.now()
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (payload.proposal) setProposal(payload.proposal);
        return assistantMsg;
      } catch (err) {
        const msg = cleanProviderErrorMessage(
          err instanceof Error ? err.message : 'AI portfolio chat failed'
        );
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: `I couldn’t complete that: ${msg}`,
            at: Date.now(),
            isError: true
          }
        ]);
        toast.error(msg);
        return null;
      } finally {
        setSending(false);
      }
    },
    [engine, indexFocus, direction, positionCount, sizing, positionQty, criteria, cadence, messages]
  );

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  /**
   * Alternative to chatting: upload an .xlsx to seed a proposal directly. The file's own
   * "Settings" sheet can supply the whole config, so this works before the wizard is answered —
   * anything already chosen here is sent along and takes precedence server-side.
   */
  const importHoldingsFile = useCallback(
    async (file) => {
      if (!file || !canFetchProtectedApi()) return null;
      setImporting(true);
      setImportError('');
      try {
        const form = new FormData();
        form.append('file', file);
        if (engine) form.append('engine', engine);
        if (indexFocus) form.append('index_focus', indexFocus);
        if (direction) form.append('direction', direction);
        if (criteria) form.append('criteria', criteria);
        if (cadence) form.append('cadence', cadence);
        // Position count comes from the file's own rows, so only sizing is worth forwarding.
        if (sizing) form.append('sizing', sizing);
        if (positionQty) form.append('position_qty', String(positionQty));

        const res = await fetchWithAuth(apiUrl('/api/paper/ai-portfolios/import'), {
          method: 'POST',
          body: form
        });
        const payload = await parseJson(res);
        if (payload.proposal) {
          setProposal(payload.proposal);
          setMessages((prev) => [
            ...prev,
            {
              id: `u-${Date.now()}`,
              role: 'user',
              content: `Uploaded ${file.name}`,
              at: Date.now()
            },
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: 'I built a portfolio from your uploaded holdings — review it below.',
              at: Date.now()
            }
          ]);
        }
        return payload.proposal || null;
      } catch (err) {
        const msg = cleanProviderErrorMessage(
          err instanceof Error ? err.message : 'Failed to import file'
        );
        setImportError(msg);
        toast.error(msg);
        return null;
      } finally {
        setImporting(false);
      }
    },
    [engine, indexFocus, direction, sizing, positionQty, criteria, cadence]
  );

  const confirmProposal = useCallback(async () => {
    if (!proposal) return null;
    setConfirming(true);
    setConfirmError('');
    setConfirmErrorCode('');
    try {
      const res = await fetchWithAuth(apiUrl('/api/paper/ai-portfolios'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal)
      });
      const payload = await parseJson(res);
      toast.success(`AI portfolio "${payload.account?.name || proposal.name}" created and published`);
      // A typed share count that wouldn't fit gets reduced server-side rather than failing the
      // create — say so, otherwise the position sizes look wrong for no visible reason.
      if (payload.sizing?.clamped) {
        toast.info(
          `${payload.sizing.requested_qty} shares each would have cost more than the starting capital — bought ${payload.sizing.qty_per_position} of each instead.`
        );
      }
      return payload.account || null;
    } catch (err) {
      const msg = cleanProviderErrorMessage(
        err instanceof Error ? err.message : 'Failed to create the portfolio'
      );
      setConfirmError(msg);
      setConfirmErrorCode(err?.code || '');
      // Duplicate-name conflicts are resolved inline in the proposal card — no need to toast those too.
      if (err?.code !== 'DUPLICATE_NAME') toast.error(msg);
      return null;
    } finally {
      setConfirming(false);
    }
  }, [proposal]);

  /** Updates just the proposal's name in place — used for the pre-confirm name field / duplicate-name retries. */
  const renameProposal = useCallback((name) => {
    setProposal((prev) => (prev ? { ...prev, name } : prev));
    setConfirmError('');
    setConfirmErrorCode('');
  }, []);

  const dismissProposal = useCallback(() => {
    setProposal(null);
    setConfirmError('');
    setConfirmErrorCode('');
  }, []);

  const clearThread = useCallback(() => {
    setMessages([]);
    setError('');
    setProposal(null);
    setConfirmError('');
    setConfirmErrorCode('');
  }, []);

  return {
    messages,
    sending,
    error,
    proposal,
    confirming,
    confirmError,
    confirmErrorCode,
    importing,
    importError,
    sendMessage,
    importHoldingsFile,
    confirmProposal,
    renameProposal,
    dismissProposal,
    clearThread,
    setProposal
  };
}
