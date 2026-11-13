import { useEffect, useState } from 'react';
import { CheckCircle, Clock, IndianRupee as Rupee, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PaymentOptionsModal from './payments/PaymentOptionsModal';

interface AdvanceRow {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  payment_method: string | null;
}

interface RequestRow {
  id: string;
  amount: number;
  note: string | null;
  status: string;
  payment_order_id: string | null;
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
}

interface BillPaymentsSectionProps {
  projectId: string;
  billId: string;
  billTotal: number;
  mode: 'designer' | 'customer';
  editorTotal?: number;
  onUpdated?: () => void;
}

const inr = (amount: number) =>
  Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function readInvokeError(error: unknown, data: { error?: string } | null): Promise<string | null> {
  if (data?.error) return data.error;
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
    } catch {
      return 'The payment request could not be sent. Please try again.';
    }
  }
  const message = (error as { message?: string } | null)?.message;
  if (message && message !== 'Edge Function returned a non-2xx status code') return message;
  if (error) return 'The payment request could not be sent. Please try again.';
  return null;
}

const methodLabel = (method: string | null) => {
  if (method === 'upi') return 'UPI';
  if (method === 'razorpay') return 'Razorpay';
  return '';
};

const receivedWhen = (value: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const receiptDetail = (status: string, paidAt: string | null, createdAt: string, method: string | null) => {
  const parts = [statusLabel[status] || status];
  if (status === 'paid') {
    const when = receivedWhen(paidAt || createdAt);
    const how = methodLabel(method);
    if (when) parts.push(when);
    if (how) parts.push(how);
  }
  return parts.join(' · ');
};

const statusLabel: Record<string, string> = {
  paid: 'Received',
  requested: 'Requested',
  awaiting_review: 'Awaiting confirmation',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

export default function BillPaymentsSection({
  projectId,
  billId,
  billTotal,
  mode,
  editorTotal,
  onUpdated,
}: BillPaymentsSectionProps) {
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<RequestRow | null>(null);

  const load = async () => {
    const [advanceResult, requestResult] = await Promise.all([
      supabase
        .from('quote_advance_payments')
        .select('id, amount, status, paid_at, created_at, payment_method')
        .eq('project_id', projectId)
        .in('status', ['paid', 'pending'])
        .order('created_at', { ascending: true }),
      supabase
        .from('project_payment_requests')
        .select('id, amount, note, status, payment_order_id, created_at, paid_at, payment_method')
        .eq('bill_id', billId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true }),
    ]);
    if (!advanceResult.error) setAdvances(advanceResult.data || []);
    if (!requestResult.error) setRequests(requestResult.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId, billId]);

  const received = advances
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + Number(row.amount), 0)
    + requests
      .filter((row) => row.status === 'paid')
      .reduce((sum, row) => sum + Number(row.amount), 0);
  const balance = Math.max(0, Number(billTotal) - received);
  const openRequest = requests.find((row) => row.status === 'requested' || row.status === 'awaiting_review');
  const unsaved = mode === 'designer' && editorTotal !== undefined && Math.abs(Number(editorTotal) - Number(billTotal)) > 0.01;

  const requestPayment = async () => {
    const value = Math.round(Number(amount) * 100) / 100;
    setError(null);
    setMessage(null);
    if (!(value > 0)) {
      setError('Enter the amount to request.');
      return;
    }
    if (value - balance > 0.01) {
      setError(`The amount cannot be more than the balance of Rs ${inr(balance)}.`);
      return;
    }
    setBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke('send-payment-request-email', {
      body: { billId, amount: value, note: note.trim() || null },
    });
    setBusy(false);
    const reason = await readInvokeError(invokeError, data);
    if (invokeError || !data?.success) {
      setError(reason || 'The payment request could not be sent. Please try again.');
      return;
    }
    setAmount('');
    setNote('');
    setMessage(data?.emailWarning || 'The customer has been asked for this payment.');
    await load();
    onUpdated?.();
  };

  const review = async (paymentOrderId: string, action: 'approve' | 'reject') => {
    setBusy(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('payment-review', {
      body: { action, paymentOrderId },
    });
    setBusy(false);
    const reason = await readInvokeError(invokeError, data);
    if (reason) {
      setError(reason);
      return;
    }
    setMessage(action === 'approve' ? 'Payment confirmed and applied to the bill.' : 'Payment proof was rejected. The customer can submit it again.');
    await load();
    onUpdated?.();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Payments received</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading payments
        </div>
      ) : (
        <div className="space-y-3">
          {advances.length === 0 && requests.length === 0 && (
            <p className="text-sm text-gray-500">No payments have been recorded for this project yet.</p>
          )}
          {advances.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium text-gray-800">Quotation confirmation</p>
                <p className="text-xs text-gray-500">{receiptDetail(row.status, row.paid_at, row.created_at, row.payment_method)}</p>
              </div>
              <span className={row.status === 'paid' ? 'font-medium text-green-700' : 'text-gray-500'}>
                <Rupee className="w-3.5 h-3.5 inline -mt-0.5" />
                {inr(row.amount)}
              </span>
            </div>
          ))}
          {requests.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-3 text-sm border-t border-gray-100 pt-3">
              <div>
                <p className="font-medium text-gray-800">
                  {row.status === 'requested' ? 'Payment requested' : 'Project payment'}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  {row.status === 'paid' ? <CheckCircle className="w-3 h-3 text-green-600" /> : <Clock className="w-3 h-3" />}
                  {receiptDetail(row.status, row.paid_at, row.created_at, row.payment_method)}
                  {row.note ? ` · ${row.note}` : ''}
                </p>
                {mode === 'customer' && row.status === 'requested' && (
                  <button
                    onClick={() => setPaying(row)}
                    className="mt-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700"
                  >
                    Pay now
                  </button>
                )}
                {mode === 'customer' && row.status === 'awaiting_review' && (
                  <p className="text-xs text-amber-700 mt-1">Waiting for the designer to confirm your UPI payment.</p>
                )}
                {mode === 'designer' && row.status === 'awaiting_review' && row.payment_order_id && (
                  <div className="flex gap-2 mt-2">
                    <button
                      disabled={busy}
                      onClick={() => review(row.payment_order_id!, 'approve')}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
                    >
                      Confirm receipt
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => review(row.payment_order_id!, 'reject')}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
              <span className={row.status === 'paid' ? 'font-medium text-green-700' : 'text-gray-500'}>
                <Rupee className="w-3.5 h-3.5 inline -mt-0.5" />
                {inr(row.amount)}
              </span>
            </div>
          ))}

          <div className="border-t border-gray-200 pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Bill total</span>
              <span className="font-medium text-gray-800">Rs {inr(billTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Received</span>
              <span className="font-medium text-green-700">Rs {inr(received)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-900">Balance due</span>
              <span className="font-bold text-teal-700">Rs {inr(balance)}</span>
            </div>
          </div>

          {mode === 'designer' && balance > 0 && !openRequest && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-800">Request next payment</p>
              {unsaved && (
                <p className="text-xs text-amber-700">Save the bill before requesting a payment so the balance matches the latest total.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="number"
                  min="1"
                  max={balance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full sm:w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="Note for the customer"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <button
                type="button"
                onClick={requestPayment}
                disabled={busy}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {busy ? 'Sending...' : 'Request payment'}
              </button>
            </div>
          )}
          {message && <p className="text-sm text-green-700">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {paying && (
        <PaymentOptionsModal
          purpose="project_payment"
          referenceId={paying.id}
          title="Project payment"
          description="Pay the amount requested by your designer. The Razorpay option adds a 2% processing fee. The fee is not added to the project bill."
          baseAmount={Number(paying.amount)}
          onPaid={() => {
            setPaying(null);
            setMessage('Payment received and applied to the bill.');
            load();
            onUpdated?.();
          }}
          onSubmitted={() => {
            setPaying(null);
            setMessage('Payment proof submitted. It will be applied to the bill after the designer confirms it.');
            load();
            onUpdated?.();
          }}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}
