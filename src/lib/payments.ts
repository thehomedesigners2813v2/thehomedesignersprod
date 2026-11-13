import { supabase } from './supabase';

export type PaymentPurpose = 'designer_subscription' | 'ai_subscription' | 'wallpaper_order' | 'quote_advance' | 'project_payment';
export type PaymentMethod = 'razorpay' | 'upi';

export interface CreatedPayment {
  paymentOrderId: string;
  method: PaymentMethod;
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
  razorpay: { orderId: string; keyId: string; amount: number; currency: string } | null;
  upi: { upiId: string; payeeName: string } | null;
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.';

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
    } catch {
      return FALLBACK_ERROR;
    }
  }
  return FALLBACK_ERROR;
}

export async function callPaymentCheckout<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('payment-checkout', { body });
  if (error) throw new Error(await readFunctionError(error));
  return data as T;
}

export function loadRazorpayCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment window. Check your internet connection.'));
    document.body.appendChild(script);
  });
}

export async function uploadPaymentProof(userId: string, paymentOrderId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${paymentOrderId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type });
  if (error) throw new Error('Could not upload the screenshot. Please try again.');
  return path;
}

export const PROCESSING_FEE_RATE = 0.02;
