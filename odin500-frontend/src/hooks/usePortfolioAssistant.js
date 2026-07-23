'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth, canFetchProtectedApi } from '../store/apiStore.js';

async function parseJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.error || payload?.message || 'Request failed');
    err.status = res.status;
    err.code = payload?.code;
    err.payload = payload;
    throw err;
  }
  return payload;
}

/**
 * Session-local chat thread for the portfolio assistant.
 * @param {string} accountId
 */
export function usePortfolioAssistant(accountId) {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [openaiConfigured, setOpenaiConfigured] = useState(true);
  const accountRef = useRef(accountId);

  useEffect(() => {
    if (accountRef.current !== accountId) {
      accountRef.current = accountId;
      setMessages([]);
      setError('');
      setSending(false);
    }
  }, [accountId]);

  const sendMessage = useCallback(
    async (text) => {
      const content = String(text || '').trim();
      const id = String(accountId || '').trim();
      if (!content || !id || !canFetchProtectedApi()) return null;

      const userMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        content,
        at: Date.now()
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setError('');

      try {
        const history = [...messages, userMsg]
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetchWithAuth(apiUrl('/api/paper/assistant/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: id, messages: history })
        });
        const payload = await parseJson(res);
        setOpenaiConfigured(payload.openai_configured !== false);

        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: String(payload.reply || '').trim() || 'Done.',
          proposals: Array.isArray(payload.proposals) ? payload.proposals : [],
          at: Date.now()
        };
        setMessages((prev) => [...prev, assistantMsg]);
        return assistantMsg;
      } catch (err) {
        if (err?.code === 'OPENAI_MISSING' || err?.status === 503) {
          setOpenaiConfigured(false);
        }
        const msg = err instanceof Error ? err.message : 'Assistant failed';
        setError(msg);
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: `I couldn’t complete that: ${msg}`,
            proposals: [],
            at: Date.now(),
            isError: true
          }
        ]);
        return null;
      } finally {
        setSending(false);
      }
    },
    [accountId, messages]
  );

  const clearThread = useCallback(() => {
    setMessages([]);
    setError('');
  }, []);

  const dismissProposal = useCallback((messageId, proposalId) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          proposals: (m.proposals || []).map((p) =>
            p.id === proposalId ? { ...p, dismissed: true } : p
          )
        };
      })
    );
  }, []);

  const markProposalApplied = useCallback((messageId, proposalId) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          proposals: (m.proposals || []).map((p) =>
            p.id === proposalId ? { ...p, applied: true } : p
          )
        };
      })
    );
  }, []);

  return {
    messages,
    sending,
    error,
    openaiConfigured,
    sendMessage,
    clearThread,
    dismissProposal,
    markProposalApplied
  };
}
