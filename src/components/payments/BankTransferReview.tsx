import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface BankTransferReviewProps {
  paymentOrderId: string;
  amount: number;
  utr: string | null;
  screenshotPath: string | null;
  onDecided: (action: 'approve' | 'reject') => void;
}

const inr = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);

export default function BankTransferReview({
  paymentOrderId,
  amount,
  utr,
  screenshotPath,
  onDecided,
}: BankTransferReviewProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openReceipt = async () => {
    if (!screenshotPath) return;
    setError(null);
    const { data, error: signError } = await supabase.storage.from('payment-proofs').createSignedUrl(screenshotPath, 300);
    if (signError || !data?.signedUrl) {
      setError('The screenshot could not be opened.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('payment-review', {
      body: { action, paymentOrderId },
    });
    setBusy(false);
    const message = data?.error || invokeError?.message;
    if (invokeError || data?.error) {
      setError(message && message !== 'Edge Function returned a non-2xx status code'
        ? message
        : 'The decision could not be saved.');
      return;
    }
    onDecided(action);
  };

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h4 className="font-semibold text-amber-900">NEFT or RTGS waiting for your confirmation</h4>
      <p className="mt-1 text-sm text-amber-800">Check this credit in your bank account, then confirm or reject it.</p>
      <dl className="mt-3 space-y-1 text-sm text-slate-700">
        <div className="flex justify-between gap-3"><dt>Amount</dt><dd className="font-semibold">{inr(amount)}</dd></div>
        <div className="flex justify-between gap-3"><dt>UTR</dt><dd className="font-mono">{utr || 'Not provided'}</dd></div>
      </dl>
      {screenshotPath && (
        <button type="button" onClick={openReceipt} className="mt-3 text-sm font-medium text-primary-700 hover:underline">
          View payment screenshot
        </button>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide('approve')}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Confirm receipt
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide('reject')}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
