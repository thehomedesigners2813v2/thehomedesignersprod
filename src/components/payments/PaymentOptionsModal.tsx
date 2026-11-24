import { useState } from 'react';
import { CreditCard, Copy, Check, Loader2, Upload, X, Smartphone, Clock, Landmark } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  callPaymentCheckout,
  loadRazorpayCheckout,
  uploadPaymentProof,
  PROCESSING_FEE_RATE,
  type CreatedPayment,
  type PaymentMethod,
  type PaymentPurpose,
} from '../../lib/payments';

interface PaymentOptionsModalProps {
  purpose: PaymentPurpose;
  referenceId: string;
  title: string;
  description: string;
  baseAmount: number;
  onPaid: () => void;
  onSubmitted: () => void;
  onClose: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export default function PaymentOptionsModal({
  purpose,
  referenceId,
  title,
  description,
  baseAmount,
  onPaid,
  onSubmitted,
  onClose,
}: PaymentOptionsModalProps) {
  const { user } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>('razorpay');
  const [step, setStep] = useState<'choose' | 'upi' | 'bank' | 'submitted'>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upiPayment, setUpiPayment] = useState<CreatedPayment | null>(null);
  const [bankPayment, setBankPayment] = useState<CreatedPayment | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fee = method === 'razorpay' ? Math.round(baseAmount * PROCESSING_FEE_RATE * 100) / 100 : 0;
  const total = baseAmount + fee;
  const bankAvailable = purpose === 'quote_advance' || purpose === 'project_payment';

  const payWithRazorpay = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await callPaymentCheckout<CreatedPayment>({ action: 'create', purpose, referenceId, method: 'razorpay' });
      if (!created.razorpay) throw new Error('Razorpay could not start this payment.');
      await loadRazorpayCheckout();

      const rzp = new (window as any).Razorpay({
        key: created.razorpay.keyId,
        amount: created.razorpay.amount,
        currency: created.razorpay.currency,
        name: 'The Home Designers',
        description: title,
        order_id: created.razorpay.orderId,
        prefill: { email: user?.email || '' },
        theme: { color: '#0ea5e9' },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await callPaymentCheckout({
              action: 'verify_razorpay',
              paymentOrderId: created.paymentOrderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            onPaid();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment could not be verified.');
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
          },
        },
      });
      rzp.on('payment.failed', () => {
        setError('The payment did not go through. You can try again.');
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment.');
      setBusy(false);
    }
  };

  const startUpi = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await callPaymentCheckout<CreatedPayment>({ action: 'create', purpose, referenceId, method: 'upi' });
      setUpiPayment(created);
      setStep('upi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment.');
    } finally {
      setBusy(false);
    }
  };

  const submitUpi = async () => {
    if (!upiPayment || !user) return;
    if (proofFile && proofFile.size > MAX_PROOF_BYTES) {
      setError('The screenshot must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const screenshotPath = proofFile ? await uploadPaymentProof(user.id, upiPayment.paymentOrderId, proofFile) : null;
      await callPaymentCheckout({
        action: 'submit_upi',
        paymentOrderId: upiPayment.paymentOrderId,
        transactionId: transactionId.trim(),
        screenshotPath,
      });
      setStep('submitted');
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the payment details.');
    } finally {
      setBusy(false);
    }
  };

  const startBank = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await callPaymentCheckout<CreatedPayment>({ action: 'create', purpose, referenceId, method: 'bank' });
      if (!created.bank) throw new Error('This designer has not added bank details yet. Please pay by Razorpay or UPI.');
      setBankPayment(created);
      setStep('bank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment.');
    } finally {
      setBusy(false);
    }
  };

  const submitBank = async () => {
    if (!bankPayment || !user) return;
    if (!proofFile) {
      setError('Upload the payment screenshot.');
      return;
    }
    if (proofFile.size > MAX_PROOF_BYTES) {
      setError('The screenshot must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const screenshotPath = await uploadPaymentProof(user.id, bankPayment.paymentOrderId, proofFile);
      await callPaymentCheckout({
        action: 'submit_bank',
        paymentOrderId: bankPayment.paymentOrderId,
        transactionId: transactionId.trim(),
        screenshotPath,
      });
      setStep('submitted');
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the payment details.');
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000);
    } catch {
      setError('Could not copy automatically. Please copy the details manually.');
    }
  };

  const renderChoose = () => (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMethod('razorpay')}
          className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${method === 'razorpay' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}
        >
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <span className="flex-1">
            <span className="block font-semibold text-slate-900">Pay online with Razorpay</span>
            <span className="mt-0.5 block text-sm text-slate-600">Card, UPI, wallet or net banking. Confirmed automatically. Settlement takes about 2 days.</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMethod('upi')}
          className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${method === 'upi' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}
        >
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <span className="flex-1">
            <span className="block font-semibold text-slate-900">Pay by UPI transfer</span>
            <span className="mt-0.5 block text-sm text-slate-600">Send to our UPI ID, then share the transaction ID. Approved by our team.</span>
          </span>
        </button>
        {bankAvailable && (
          <button
            type="button"
            onClick={() => setMethod('bank')}
            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${method === 'bank' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <span className="flex-1">
              <span className="block font-semibold text-slate-900">Pay by NEFT or RTGS</span>
              <span className="mt-0.5 block text-sm text-slate-600">Transfer from your bank to the designer. No payment limit. Upload the receipt and UTR for the designer to confirm.</span>
            </span>
          </button>
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between text-slate-700">
          <span>{description}</span>
          <span className="font-medium text-slate-900">{formatCurrency(baseAmount)}</span>
        </div>
        {method === 'razorpay' && (
          <div className="flex justify-between text-slate-700">
            <span>Processing fee (2%)</span>
            <span className="font-medium text-slate-900">{formatCurrency(fee)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={method === 'razorpay' ? payWithRazorpay : method === 'bank' ? startBank : startUpi}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-400"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        <span>{method === 'razorpay' ? `Pay ${formatCurrency(total)}` : method === 'bank' ? 'Continue with NEFT or RTGS' : 'Continue with UPI'}</span>
      </button>
    </>
  );

  const renderUpi = () => (
    <>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">Pay exactly {formatCurrency(baseAmount)} to this UPI ID</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-lg font-semibold text-slate-900">{upiPayment?.upi?.upiId}</span>
          <button
            type="button"
            onClick={() => upiPayment?.upi && copyText('upi', upiPayment.upi.upiId)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {copiedField === 'upi' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copiedField === 'upi' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Payee: {upiPayment?.upi?.payeeName}</p>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="upi-txn" className="mb-1.5 block text-sm font-medium text-slate-700">UPI transaction ID</label>
          <input
            id="upi-txn"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="e.g. 412345678901"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label htmlFor="upi-proof" className="mb-1.5 block text-sm font-medium text-slate-700">Payment screenshot (optional)</label>
          <label
            htmlFor="upi-proof"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{proofFile ? proofFile.name : 'Choose an image or PDF (max 5 MB)'}</span>
          </label>
          <input
            id="upi-proof"
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={submitUpi}
        disabled={busy || transactionId.trim().length < 6}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-400"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        <span>Submit for approval</span>
      </button>
    </>
  );

  const renderBankField = (field: string, label: string, value: string) => (
    <div className="mt-3">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="font-mono text-base font-semibold text-slate-900">{value}</span>
        <button
          type="button"
          onClick={() => copyText(field, value)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {copiedField === field ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copiedField === field ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );

  const renderBank = () => (
    <>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">Transfer exactly {formatCurrency(baseAmount)} by NEFT or RTGS</p>
        {renderBankField('holder', 'Account holder', bankPayment?.bank?.accountHolder || '')}
        {renderBankField('account', 'Account number', bankPayment?.bank?.accountNumber || '')}
        {renderBankField('ifsc', 'IFSC code', bankPayment?.bank?.ifsc || '')}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="bank-utr" className="mb-1.5 block text-sm font-medium text-slate-700">UTR number</label>
          <input
            id="bank-utr"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="e.g. HDFC000123456789"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label htmlFor="bank-proof" className="mb-1.5 block text-sm font-medium text-slate-700">Payment screenshot</label>
          <label
            htmlFor="bank-proof"
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{proofFile ? proofFile.name : 'Choose an image or PDF (max 5 MB)'}</span>
          </label>
          <input
            id="bank-proof"
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={submitBank}
        disabled={busy || transactionId.trim().length < 6 || !proofFile}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-400"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        <span>Submit for designer confirmation</span>
      </button>
    </>
  );

  const renderSubmitted = () => (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
        <Clock className="h-7 w-7 text-amber-600" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {bankPayment ? 'Waiting for designer confirmation' : 'Waiting for admin confirmation'}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        {bankPayment
          ? 'Your receipt and UTR were submitted. The designer will confirm the credit in their bank account. You do not need to pay again.'
          : 'Your UPI payment and screenshot were submitted. Please wait until an admin confirms the payment. You do not need to pay again.'}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 rounded-xl bg-primary-600 px-6 py-2.5 font-semibold text-white hover:bg-primary-700"
      >
        Done
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {step === 'choose' && renderChoose()}
        {step === 'upi' && renderUpi()}
        {step === 'bank' && renderBank()}
        {step === 'submitted' && renderSubmitted()}
      </div>
    </div>
  );
}
