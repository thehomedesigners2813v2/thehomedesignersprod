import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, Check, X, Eye, Search, Smartphone, CreditCard } from 'lucide-react';

type PaymentRow = {
  id: string;
  purpose: string;
  method: 'razorpay' | 'upi';
  status: 'pending' | 'awaiting_review' | 'paid' | 'rejected' | 'failed';
  base_amount: number;
  fee_amount: number;
  total_amount: number;
  currency: string;
  upi_transaction_id: string | null;
  upi_screenshot_path: string | null;
  razorpay_payment_id: string | null;
  review_note: string | null;
  created_at: string;
  paid_at: string | null;
};

const PURPOSE_LABELS: Record<string, string> = {
  designer_subscription: 'Designer subscription',
  ai_subscription: 'AI plan',
  wallpaper_order: '3D wallpaper order',
  quote_advance: 'Quotation advance',
  project_payment: 'Project payment',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  awaiting_review: 'bg-amber-50 text-amber-700 border border-amber-200',
  paid: 'bg-green-50 text-green-700 border border-green-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  failed: 'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  awaiting_review: 'Awaiting review',
  paid: 'Paid',
  rejected: 'Rejected',
  failed: 'Failed',
};

const formatCurrency = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount) || 0);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [methodFilter, setMethodFilter] = useState<'all' | 'razorpay' | 'upi'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentRow['status']>('all');
  const [search, setSearch] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('payment_orders')
      .select('id, purpose, method, status, base_amount, fee_amount, total_amount, currency, upi_transaction_id, upi_screenshot_path, razorpay_payment_id, review_note, created_at, paid_at')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message || 'Failed to load payments');
    } else {
      setPayments((data || []) as PaymentRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const pendingUpi = useMemo(
    () => payments.filter((p) => p.method === 'upi' && p.status === 'awaiting_review'),
    [payments],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (methodFilter !== 'all' && p.method !== methodFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!term) return true;
      return (
        p.id.toLowerCase().includes(term) ||
        (p.upi_transaction_id || '').toLowerCase().includes(term) ||
        (p.razorpay_payment_id || '').toLowerCase().includes(term)
      );
    });
  }, [payments, methodFilter, statusFilter, search]);

  const decide = async (paymentId: string, action: 'approve' | 'reject') => {
    setBusyId(paymentId);
    setActionError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('payment-review', {
      body: { action, paymentOrderId: paymentId, note: notes[paymentId]?.trim() || null },
    });
    setBusyId(null);
    if (invokeError || (data && data.error)) {
      setActionError(data?.error || invokeError?.message || 'The decision could not be saved.');
      return;
    }
    setNotes((prev) => {
      const next = { ...prev };
      delete next[paymentId];
      return next;
    });
    fetchPayments();
  };

  const viewScreenshot = async (path: string) => {
    const { data, error: signError } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 300);
    if (signError || !data?.signedUrl) {
      setActionError('The screenshot could not be opened.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">Approve UPI transfers and review every payment on the platform.</p>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{actionError}</div>
      )}

      <section className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">UPI approval queue</h2>
          <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
            {pendingUpi.length} pending
          </span>
        </div>

        {pendingUpi.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">No UPI payments are waiting for approval.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pendingUpi.map((p) => (
              <li key={p.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-gray-900">
                    {PURPOSE_LABELS[p.purpose] || p.purpose} · {formatCurrency(p.total_amount, p.currency)}
                  </p>
                  <p className="text-sm text-gray-600">
                    Transaction ID: <span className="font-mono">{p.upi_transaction_id}</span>
                  </p>
                  <p className="text-xs text-gray-400">Submitted {formatDate(p.created_at)}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 lg:w-[28rem]">
                  <input
                    type="text"
                    value={notes[p.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Note (optional)"
                    maxLength={500}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                  <div className="flex gap-2">
                    {p.upi_screenshot_path && (
                      <button
                        type="button"
                        onClick={() => viewScreenshot(p.upi_screenshot_path as string)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" /> Screenshot
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => decide(p.id, 'reject')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => decide(p.id, 'approve')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {busyId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center gap-3">
          <h2 className="font-semibold text-gray-900 flex-1">All payments</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, UPI or Razorpay ID"
              className="pl-9 pr-3 py-2 w-64 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as typeof methodFilter)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All methods</option>
            <option value="razorpay">Razorpay</option>
            <option value="upi">UPI</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {Object.keys(STATUS_LABELS).map((key) => (
              <option key={key} value={key}>{STATUS_LABELS[key]}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">No payments match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Purpose</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium text-right">Base</th>
                  <th className="px-5 py-3 font-medium text-right">Fee</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 whitespace-nowrap text-gray-600">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-3 text-gray-900">{PURPOSE_LABELS[p.purpose] || p.purpose}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        {p.method === 'upi' ? <Smartphone className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                        {p.method === 'upi' ? 'UPI' : 'Razorpay'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatCurrency(p.base_amount, p.currency)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatCurrency(p.fee_amount, p.currency)}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(p.total_amount, p.currency)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] || ''}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">
                      {p.upi_transaction_id || p.razorpay_payment_id || p.id.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminPayments;
