import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, ThumbsUp, ThumbsDown, CreditCard as Edit3, MessageSquare, X, IndianRupee, ShieldCheck, Info, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import QuoteMessagingPanel from './QuoteMessagingPanel';
import PaymentOptionsModal from './payments/PaymentOptionsModal';

interface QuoteActionsPanelProps {
  quote: any;
  onRefresh: () => void;
}

const CHANGE_OPTIONS = [
  { key: 'reduce_budget', label: 'Reduce overall budget' },
  { key: 'change_materials', label: 'Change materials or brands' },
  { key: 'add_remove_items', label: 'Add or remove work items' },
  { key: 'alternative_designs', label: 'Explore alternative designs' },
  { key: 'revise_timeline', label: 'Revise project timeline' },
  { key: 'other', label: 'Other changes' },
];

const REJECT_REASONS = [
  { key: 'over_budget', label: 'Over budget' },
  { key: 'design_not_suitable', label: 'Design not suitable' },
  { key: 'timeline_not_suitable', label: 'Timeline not suitable' },
  { key: 'chose_another_designer', label: 'Chose another designer' },
  { key: 'other', label: 'Other' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

type ActionMode = 'accept' | 'payment' | 'changes' | 'question' | 'reject' | null;

const QuoteActionsPanel: React.FC<QuoteActionsPanelProps> = ({ quote, onRefresh }) => {
  const { user } = useAuth();
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const [paymentOrderStatus, setPaymentOrderStatus] = useState<string | null>(null);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  useEffect(() => {
    if (!user || !quote?.id) return;
    supabase
      .from('payment_orders')
      .select('status')
      .eq('purpose', 'quote_advance')
      .eq('reference_id', quote.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { status?: string } | null }) => {
        setPaymentOrderStatus(data?.status || null);
      });
  }, [user, quote?.id, quote?.status, quote?.payment_status, paymentRefreshKey]);

  // Configured advance payment config (percent + min + terms)
  const [advanceConfig, setAdvanceConfig] = useState<{ percent: number; min_amount: number; terms: string }>({ percent: 10, min_amount: 0, terms: '' });

  useEffect(() => {
    supabase
      .rpc('get_advance_payment_config')
      .then(({ data }: { data: Array<{ percent: number; min_amount: number; terms: string }> | null }) => {
        if (Array.isArray(data) && data.length > 0) {
          const row = data[0];
          setAdvanceConfig({
            percent: Number(row.percent) || 10,
            min_amount: Number(row.min_amount) || 0,
            terms: row.terms || '',
          });
        }
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  // Request Changes state
  const [changeOptions, setChangeOptions] = useState<string[]>([]);
  const [targetBudget, setTargetBudget] = useState('');
  const [changeInstructions, setChangeInstructions] = useState('');

  // Reject state
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComments, setRejectComments] = useState('');

  const quoteStatus = quote.status || 'sent';
  const paymentStatus = quote.payment_status || 'pending';
  const revisionRound = quote.revision_round || 0;
  const isConfirmed = quoteStatus === 'accepted' && paymentStatus === 'verified';
  const paymentInitiated = paymentOrderStatus === 'pending';
  const paymentAwaitingReview = paymentOrderStatus === 'awaiting_review';
  const paymentFailed = paymentOrderStatus === 'failed' || paymentOrderStatus === 'rejected';
  const isRejected = quoteStatus === 'rejected';
  const isChangesRequested = quoteStatus === 'changes_requested';
  const canAct = quoteStatus === 'sent' || quoteStatus === 'changes_requested';
  const revisionsRemaining = Math.max(0, 3 - revisionRound);

  const showActions = canAct && !isConfirmed && !isRejected && !paymentInitiated && !paymentAwaitingReview;

  const advanceAmount = Number(quote.confirmation_amount) > 0
    ? Number(quote.confirmation_amount)
    : Math.round(Number(quote.total_amount || 0) * (advanceConfig.percent / 100));

  const closeAll = () => {
    setActionMode(null);
    setError(null);
    setSuccess(null);
    setChangeOptions([]);
    setTargetBudget('');
    setChangeInstructions('');
    setRejectReason('');
    setRejectComments('');
  };

  const handleAcceptAndProceed = async () => {
    if (!user) return;
    try {
      setAccepting(true);
      setError(null);
      const { error: acceptError } = await supabase.rpc('accept_quote', {
        p_quote_id: quote.id,
        p_feedback: null,
      });
      if (acceptError) throw acceptError;
      setActionMode('payment');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Could not start the confirmation payment.');
    } finally {
      setAccepting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!user) return;
    if (changeOptions.length === 0) {
      setError('Please select at least one change you would like to request.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const { error: rpcError } = await supabase.rpc('request_quote_changes', {
        p_quote_id: quote.id,
        p_options: changeOptions,
        p_target_budget: targetBudget ? Number(targetBudget) : null,
        p_instructions: changeInstructions || null,
      });

      if (rpcError) throw rpcError;

      setSuccess('Your change request has been sent to the designer. You will be notified when a revised quotation is available.');
      setActionMode(null);
      setChangeOptions([]);
      setTargetBudget('');
      setChangeInstructions('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to submit change request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;
    try {
      setSubmitting(true);
      setError(null);
      const { error: rpcError } = await supabase.rpc('reject_quote', {
        p_quote_id: quote.id,
        p_reason: rejectReason || null,
        p_comments: rejectComments || null,
      });

      if (rpcError) throw rpcError;

      setSuccess('Quotation rejected. Your feedback has been shared with the designer.');
      setActionMode(null);
      setRejectReason('');
      setRejectComments('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to reject quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChangeOption = (key: string) => {
    setChangeOptions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // ===== Status banners =====
  const renderStatusBanner = () => {
    if (isConfirmed) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 flex items-start space-x-2">
          <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">Quotation Confirmed</p>
            <p className="text-sm text-green-700">Your {advanceConfig.percent}% confirmation payment has been verified. The designer's contact details are unlocked below and the project is now active.</p>
          </div>
        </div>
      );
    }
    if (paymentAwaitingReview) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Payment Pending Verification</p>
            <p className="text-sm text-amber-700">Your transfer proof was received. The quotation stays unaccepted until the designer or an administrator confirms the payment.</p>
          </div>
        </div>
      );
    }
    if (paymentInitiated) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-blue-800">Payment Initiated</p>
            <p className="text-sm text-blue-700">A confirmation payment was started and is not verified. The quotation is not accepted. Continue the payment or close this page; closing it does not accept the quotation.</p>
            <button
              onClick={() => { setError(null); setSuccess(null); setActionMode('payment'); }}
              className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors mt-3"
            >
              <RotateCcw className="w-4 h-4" /><span>Continue Payment</span>
            </button>
          </div>
        </div>
      );
    }
    if (paymentFailed) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-800">Payment Failed</p>
            <p className="text-sm text-red-700">The confirmation payment was not completed. The quotation remains unaccepted.</p>
            <button
              onClick={() => { setError(null); setSuccess(null); setActionMode('accept'); }}
              className="inline-flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors mt-3"
            >
              <RotateCcw className="w-4 h-4" /><span>Try Payment Again</span>
            </button>
          </div>
        </div>
      );
    }
    if (isChangesRequested) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-start space-x-2">
          <Edit3 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-800">Changes Requested</p>
            <p className="text-sm text-blue-700">The designer has been notified of your requested changes. You will be notified when a revised quotation is available.</p>
          </div>
        </div>
      );
    }
    if (isRejected) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 flex items-start space-x-2">
          <ThumbsDown className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Quotation Rejected</p>
            <p className="text-sm text-red-700">This quotation has been rejected{quote.rejection_reason ? ` (${REJECT_REASONS.find((r) => r.key === quote.rejection_reason)?.label || quote.rejection_reason})` : ''}. You can continue reviewing other quotations.</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // ===== Action buttons row =====
  const renderActionButtons = () => {
    if (!showActions) return null;
    return (
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => { setError(null); setSuccess(null); setActionMode('accept'); }}
          className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 shadow-sm"
        >
          <ThumbsUp className="w-4 h-4" />
          <span>Accept &amp; Proceed</span>
        </button>
        <button
          onClick={() => { setError(null); setSuccess(null); setActionMode('changes'); }}
          disabled={revisionsRemaining === 0}
          className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title={revisionsRemaining === 0 ? 'You have reached the 3-revision limit' : `${revisionsRemaining} revision${revisionsRemaining === 1 ? '' : 's'} remaining`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Request Changes</span>
        </button>
        <button
          onClick={() => { setError(null); setSuccess(null); setActionMode('question'); }}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Ask a Question</span>
        </button>
        <button
          onClick={() => { setError(null); setSuccess(null); setActionMode('reject'); }}
          className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <ThumbsDown className="w-4 h-4" />
          <span>Reject</span>
        </button>
      </div>
    );
  };

  // ===== Modals =====
  const renderAcceptModal = () => {
    const total = Number(quote.total_amount || 0);
    const confirmationAmountFromQuote = Number(quote.confirmation_amount || 0);
    const computed = Math.round(total * (advanceConfig.percent / 100));
    const confirmation = confirmationAmountFromQuote > 0 ? confirmationAmountFromQuote : computed;
    const balance = total - confirmation;
    const percentLabel = advanceConfig.percent;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-secondary-800">Confirm Your Acceptance</h3>
            <button onClick={closeAll} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg flex items-start space-x-2 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Quotation Total</span>
                <span className="font-semibold text-secondary-800">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{percentLabel}% Advance Amount</span>
                <span className="font-semibold text-primary-600 flex items-center"><IndianRupee className="w-3.5 h-3.5" />{Number(confirmation).toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                <span className="text-gray-600">Remaining Balance</span>
                <span className="font-semibold text-gray-700">{formatCurrency(balance)}</span>
              </div>
            </div>
            {advanceConfig.terms && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 flex items-start space-x-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{advanceConfig.terms}</span>
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-start space-x-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>The quotation is not accepted until this {percentLabel}% confirmation payment is verified. Closing this window, cancelling, or a failed payment leaves the quotation unchanged. Card and net-banking payments are verified by the payment provider. A UPI transfer stays pending until the designer or an administrator confirms the receipt.</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={closeAll} disabled={accepting} className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleAcceptAndProceed} disabled={accepting} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2">
                {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{accepting ? 'Processing...' : `Continue to ${percentLabel}% Payment`}</span>
              </button>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg flex items-start space-x-2 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderChangesModal = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-secondary-800">Request Changes</h3>
          <button onClick={closeAll} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg flex items-start space-x-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            You have <span className="font-semibold text-blue-700">{revisionsRemaining} of 3</span> revision rounds remaining for this quotation.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">What would you like to change? (Select all that apply)</label>
            <div className="space-y-2">
              {CHANGE_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={changeOptions.includes(opt.key)}
                    onChange={() => toggleChangeOption(opt.key)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Budget (optional)</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                value={targetBudget}
                onChange={(e) => setTargetBudget(e.target.value)}
                placeholder="e.g. 150000"
                className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Instructions (optional)</label>
            <textarea
              value={changeInstructions}
              onChange={(e) => setChangeInstructions(e.target.value)}
              rows={3}
              placeholder="Provide any details that will help the designer revise your quotation..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeAll} disabled={submitting} className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleRequestChanges} disabled={submitting || changeOptions.length === 0} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
              <span>Submit Request</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRejectModal = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-secondary-800">Reject Quotation</h3>
          <button onClick={closeAll} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg flex items-start space-x-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Are you sure you want to reject this quotation? This action cannot be undone, but the quotation and its history will be preserved.</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a reason...</option>
              {REJECT_REASONS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments (optional)</label>
            <textarea
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              rows={3}
              placeholder="Share any feedback for the designer..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeAll} disabled={submitting} className="flex-1 bg-gray-200 text-gray-800 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleReject} disabled={submitting} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
              <span>Confirm Rejection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuestionPanel = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <QuoteMessagingPanel quoteId={quote.id} role="customer" onClose={closeAll} />
      </div>
    </div>
  );

  return (
    <div>
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-start space-x-2">
          <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}
      {renderStatusBanner()}
      {renderActionButtons()}

      {actionMode === 'accept' && renderAcceptModal()}
      {actionMode === 'payment' && (
        <PaymentOptionsModal
          purpose="quote_advance"
          referenceId={quote.id}
          title="Quotation advance payment"
          description={`${advanceConfig.percent}% confirmation payment. The quotation is accepted only after this payment is verified.`}
          baseAmount={advanceAmount}
          onPaid={() => {
            setSuccess('Payment verified. The quotation is now accepted and the project is active.');
            setPaymentRefreshKey((key) => key + 1);
            closeAll();
            onRefresh();
          }}
          onSubmitted={() => {
            setSuccess('Payment proof submitted. The quotation stays unaccepted until the payment is confirmed.');
            setPaymentRefreshKey((key) => key + 1);
            closeAll();
            onRefresh();
          }}
          onClose={() => {
            setPaymentRefreshKey((key) => key + 1);
            closeAll();
          }}
        />
      )}
      {actionMode === 'changes' && renderChangesModal()}
      {actionMode === 'reject' && renderRejectModal()}
      {actionMode === 'question' && renderQuestionPanel()}
    </div>
  );
};

export default QuoteActionsPanel;
