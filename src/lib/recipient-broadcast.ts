/**
 * Cross-tab recipient hand-off between the Companies/People pages and an open
 * campaign composer. React context is per-tab, so when the composer is open in a
 * DIFFERENT browser tab we can't reach it via context — BroadcastChannel bridges
 * the tabs. An ack handshake lets the sender know whether an open composer handled
 * the recipients (so it doesn't spawn a duplicate composer as a fallback).
 */
export type LeanRecipient = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_id?: string;
  companies?: { name?: string | null } | null;
};

const CHANNEL = 'leadboosters-campaign-recipients';

/**
 * Send recipients to an open campaign composer in ANY tab.
 * Resolves true if a composer acknowledged handling them, false if none did in time.
 */
export function sendRecipientsToOpenComposer(
  action: 'add' | 'replace',
  recipients: LeanRecipient[],
  timeoutMs = 450,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === 'undefined') { resolve(false); return; }
    let ch: BroadcastChannel;
    try { ch = new BroadcastChannel(CHANNEL); } catch { resolve(false); return; }
    const nonce = Math.random().toString(36).slice(2);
    let done = false;
    const finish = (v: boolean) => { if (done) return; done = true; try { ch.close(); } catch { /* noop */ } resolve(v); };
    ch.onmessage = (e) => { if (e.data?.type === 'ack' && e.data.nonce === nonce) finish(true); };
    ch.postMessage({ type: 'recipients', action, recipients, nonce });
    setTimeout(() => finish(false), timeoutMs);
  });
}

/** Subscribe an open composer to incoming recipients. Returns an unsubscribe fn. */
export function subscribeToRecipients(
  handler: (action: 'add' | 'replace', recipients: LeanRecipient[]) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => { /* noop */ };
  let ch: BroadcastChannel;
  try { ch = new BroadcastChannel(CHANNEL); } catch { return () => { /* noop */ }; }
  ch.onmessage = (e) => {
    if (e.data?.type === 'recipients') {
      try { handler(e.data.action, e.data.recipients || []); } finally {
        try { ch.postMessage({ type: 'ack', nonce: e.data.nonce }); } catch { /* noop */ }
      }
    }
  };
  return () => { try { ch.close(); } catch { /* noop */ } };
}
