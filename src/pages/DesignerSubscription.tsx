import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import PaymentOptionsModal from '../components/payments/PaymentOptionsModal';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billing_period: string;
  features: string[];
  max_projects: number;
  max_quotes: number;
  priority_support: boolean;
  sort_order: number;
}

interface DesignerSubscriptionRow {
  id: string;
  status: string;
  trial_start_date: string;
  trial_end_date: string;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  auto_renew: boolean;
  subscription_plan: SubscriptionPlan;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const DesignerSubscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<DesignerSubscriptionRow | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const loadSubscriptionData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: designerData, error: designerError } = await supabase
        .from('designers').select('id').eq('user_id', user.id).maybeSingle();
      if (designerError) throw designerError;
      if (!designerData) { navigate('/designer-registration'); return; }

      const { data: subData, error: subError } = await supabase
        .from('designer_subscriptions')
        .select(`*, subscription_plan:subscription_plans(*)`)
        .eq('designer_id', designerData.id)
        .maybeSingle();
      if (subError) throw subError;
      setSubscription(subData ? (subData as DesignerSubscriptionRow) : null);

      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (plansError) throw plansError;
      setPlans((plansData || []) as SubscriptionPlan[]);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  useEffect(() => { void loadSubscriptionData(); }, [loadSubscriptionData]);

  const getRemainingSubscriptionDays = () => {
    if (!subscription || !subscription.subscription_end_date) return 0;
    const endDate = new Date(subscription.subscription_end_date);
    const diffDays = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handleUpgrade = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      trial: { text: 'Payment required', color: 'bg-amber-100 text-amber-800' },
      active: { text: 'Active', color: 'bg-emerald-100 text-emerald-800' },
      expired: { text: 'Expired', color: 'bg-red-100 text-red-800' },
      cancelled: { text: 'Cancelled', color: 'bg-slate-100 text-slate-800' },
    };
    const badge = badges[status] || badges.expired;
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>{badge.text}</span>;
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={() => navigate('/designer-dashboard')} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-700"><ArrowLeft className="h-4 w-4" /> Back to dashboard</button>

        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Subscription Management</h1>
          <p className="mt-2 text-slate-600">Choose the plan that fits your business needs</p>
        </div>

        {subscription && (
          <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Current Plan</h2>
                <p className="mt-1 text-slate-600">{subscription.subscription_plan?.name || 'Standard'}</p>
              </div>
              <div className="flex items-center gap-4">
                {getStatusBadge(subscription.status)}
                {subscription.status !== 'active' && (
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Monthly plan</p>
                    <p className="text-sm font-semibold text-amber-700">Payment required</p>
                  </div>
                )}
                {subscription.status === 'active' && (
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Renews in</p>
                    <p className="text-2xl font-bold text-emerald-600">{getRemainingSubscriptionDays()} days</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.subscription_plan?.id === plan.id;
            const Icon = plan.priority_support ? Zap : Sparkles;
            return (
              <div key={plan.id} className={`rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${isCurrentPlan ? 'border-primary-600 ring-2 ring-primary-100' : 'border-slate-200'}`}>
                <div className="mb-4 flex items-center justify-between">
                  <Icon className="h-8 w-8 text-primary-600" />
                  {isCurrentPlan && <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">Current</span>}
                </div>
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <div className="mt-4 mb-5">
                  <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(plan.price)}</span>
                  <span className="text-sm text-slate-500"> / {plan.billing_period}</span>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-700">
                  {(plan.features || []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleUpgrade(plan)}
                  disabled={isCurrentPlan}
                  className={`mt-6 w-full rounded-xl py-3 font-semibold transition-colors ${isCurrentPlan ? 'cursor-default bg-slate-100 text-slate-400' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                >
                  {isCurrentPlan ? 'Current Plan' : 'Start Subscription'}
                </button>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No subscription plans are available yet. Please check back later.
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-primary-200 bg-primary-50 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div>
              <h3 className="font-bold text-primary-900">Need AI-powered quotations?</h3>
              <p className="mt-1 text-sm text-primary-800">AI quotation generation is a separate add-on on top of your Standard subscription. Once your Standard subscription is active, visit the AI Subscription page to choose an AI plan.</p>
              <button type="button" onClick={() => navigate('/designer-ai-subscription')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                <Sparkles className="h-4 w-4" /> View AI Plans
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && selectedPlan && (
        <PaymentOptionsModal
          purpose="designer_subscription"
          referenceId={selectedPlan.id}
          title="Complete Payment"
          description={`${selectedPlan.name} plan (${selectedPlan.billing_period})`}
          baseAmount={Number(selectedPlan.price)}
          onClose={() => setShowPaymentModal(false)}
          onPaid={() => { setShowPaymentModal(false); void loadSubscriptionData(); }}
          onSubmitted={() => void loadSubscriptionData()}
        />
      )}
    </div>
  );
};

export default DesignerSubscription;
