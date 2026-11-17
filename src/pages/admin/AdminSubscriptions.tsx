import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, AlertTriangle, Search, CreditCard, Sparkles,
  CheckCircle, XCircle, DollarSign, Edit3, Save, X
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: string;
  billing_period: string;
  features: any[];
  max_projects?: number;
  max_quotes?: number;
  monthly_credits?: number;
  is_active: boolean;
  sort_order: number;
}

type Tab = 'subscriptions' | 'ai_plans' | 'plans' | 'payments';

const AdminSubscriptions: React.FC = () => {
  const [tab, setTab] = useState<Tab>('subscriptions');
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [aiSubscriptions, setAiSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [aiPlans, setAiPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editingAIPlan, setEditingAIPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // designer_subscriptions has FK to designers and subscription_plans
      const subsRes = await supabase
        .from('designer_subscriptions')
        .select('*, designers(name, email), subscription_plans(name, price, billing_period)')
        .order('created_at', { ascending: false });

      // designer_ai_subscriptions has FK to designers and ai_subscription_plans (via ai_plan_id)
      const aiSubsRes = await supabase
        .from('designer_ai_subscriptions')
        .select('*, designers(name, email), ai_subscription_plans(name, price, monthly_credits)')
        .order('created_at', { ascending: false });

      // subscription_payments links to designer_subscriptions, not designers directly
      const paymentsRes = await supabase
        .from('subscription_payments')
        .select('*, designer_subscriptions(designer_id)')
        .order('payment_date', { ascending: false });

      const plansRes = await supabase.from('subscription_plans').select('*').order('sort_order');
      const aiPlansRes = await supabase.from('ai_subscription_plans').select('*').order('sort_order');

      if (subsRes.error) throw subsRes.error;
      if (aiSubsRes.error) throw aiSubsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (plansRes.error) throw plansRes.error;
      if (aiPlansRes.error) throw aiPlansRes.error;

      // Enrich payments with designer info via the subscription's designer_id
      const designerIds = new Set((paymentsRes.data || []).map((p: any) => p.designer_subscriptions?.designer_id).filter(Boolean));
      const designerMap: Record<string, any> = {};
      if (designerIds.size > 0) {
        const { data: designerData } = await supabase
          .from('designers')
          .select('id, name, email')
          .in('id', Array.from(designerIds));
        (designerData || []).forEach((d: any) => { designerMap[d.id] = d; });
      }
      const enrichedPayments = (paymentsRes.data || []).map((p: any) => ({
        ...p,
        designers: designerMap[p.designer_subscriptions?.designer_id] || null,
      }));

      setSubscriptions(subsRes.data || []);
      setAiSubscriptions(aiSubsRes.data || []);
      setPayments(enrichedPayments);
      setPlans(plansRes.data || []);
      setAiPlans(aiPlansRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const savePlan = async (plan: Plan, table: 'subscription_plans' | 'ai_subscription_plans') => {
    setSaving(true);
    try {
      const { error: err } = await supabase.from(table).update({
        name: plan.name, description: plan.description, price: plan.price,
        is_active: plan.is_active, features: plan.features,
        ...(table === 'subscription_plans' ? { max_projects: plan.max_projects, max_quotes: plan.max_quotes } : { monthly_credits: plan.monthly_credits }),
      }).eq('id', plan.id);
      if (err) throw err;
      await supabase.from('audit_logs').insert({ action: 'plan_updated', target_type: 'plan', target_id: plan.id, details: { table, name: plan.name } });
      setEditingPlan(null);
      setEditingAIPlan(null);
      fetchAll();
    } catch (e: any) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredSubs = subscriptions.filter((s: any) => {
    const matchesSearch = !search ||
      s.designers?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.designers?.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load data</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchAll} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  const activeSubs = subscriptions.filter((s: any) => s.status === 'active').length;
  const activeAISubs = aiSubscriptions.filter((s: any) => s.status === 'active').length;
  const totalRevenue = payments.filter((p: any) => p.payment_status === 'success' || p.payment_status === 'paid' || p.payment_status === 'completed').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const failedPayments = payments.filter((p: any) => p.payment_status === 'failed' || p.payment_status === 'cancelled').length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions & Billing</h1>
        <p className="text-gray-500 text-sm mt-1">Configure plans, monitor subscriptions, and track payments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Standard', value: activeSubs, icon: CreditCard, color: 'sky' },
          { label: 'Active AI Add-on', value: activeAISubs, icon: Sparkles, color: 'violet' },
          { label: 'Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: DollarSign, color: 'emerald' },
          { label: 'Failed Payments', value: failedPayments, icon: XCircle, color: 'red' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${s.color}-50 text-${s.color}-600`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {([
          ['subscriptions', 'Standard Subscriptions'],
          ['ai_plans', 'AI Add-on Subscriptions'],
          ['plans', 'Plan Configuration'],
          ['payments', 'Payment History'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Subscriptions tab */}
      {tab === 'subscriptions' && (
        <>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by designer…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="trial">Trial</option>
            </select>
          </div>
          {filteredSubs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><p className="text-gray-400 text-sm">No subscriptions found.</p></div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Designer</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Plan</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">End Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Amount</th>
                </tr></thead>
                <tbody>
                  {filteredSubs.map((s: any) => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                      <td className="px-5 py-3"><p className="font-medium text-gray-900">{s.designers?.name || '—'}</p><p className="text-xs text-gray-500">{s.designers?.email}</p></td>
                      <td className="px-5 py-3">{s.subscription_plans?.name || '—'}<p className="text-xs text-gray-500">{s.subscription_plans?.billing_period}</p></td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          s.status === 'active' ? 'bg-green-50 text-green-600' :
                          s.status === 'expired' ? 'bg-amber-50 text-amber-600' :
                          s.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 hidden sm:table-cell text-xs">{s.subscription_end_date ? new Date(s.subscription_end_date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{s.subscription_plans?.price ? `₹${Number(s.subscription_plans.price).toLocaleString('en-IN')}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* AI subscriptions tab */}
      {tab === 'ai_plans' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          {aiSubscriptions.length === 0 ? (
            <div className="p-12 text-center"><p className="text-gray-400 text-sm">No AI add-on subscriptions found.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Designer</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">AI Plan</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Credits</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">End Date</th>
              </tr></thead>
              <tbody>
                {aiSubscriptions.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="px-5 py-3"><p className="font-medium text-gray-900">{s.designers?.name || '—'}</p><p className="text-xs text-gray-500">{s.designers?.email}</p></td>
                    <td className="px-5 py-3">{s.ai_subscription_plans?.name || '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{s.ai_subscription_plans?.monthly_credits || '—'}/mo</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell text-xs">{s.subscription_end_date ? new Date(s.subscription_end_date).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Plan configuration tab */}
      {tab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-sky-600" /> Standard Plans</h3>
            <div className="space-y-4">
              {plans.filter(p => p.name !== 'Premium').map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  {editingPlan?.id === p.id ? (
                    <PlanEditor plan={editingPlan} onChange={setEditingPlan} onSave={() => savePlan(editingPlan, 'subscription_plans')} onCancel={() => setEditingPlan(null)} saving={saving} showCredits={false} />
                  ) : (
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div><p className="font-semibold text-gray-900">{p.name}</p><p className="text-xs text-gray-500">{p.description}</p></div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-sm"><span className="font-bold text-gray-900">₹{Number(p.price).toLocaleString('en-IN')}</span><span className="text-gray-500">/{p.billing_period}</span></div>
                        <button onClick={() => setEditingPlan(p)} className="flex items-center gap-1 text-xs text-sky-600 hover:underline"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        {p.max_projects != null && <span>{p.max_projects} projects</span>}
                        {p.max_quotes != null && <span>{p.max_quotes} quotes/quarter</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600" /> AI Add-on Plans</h3>
            <div className="space-y-4">
              {aiPlans.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  {editingAIPlan?.id === p.id ? (
                    <PlanEditor plan={editingAIPlan} onChange={setEditingAIPlan} onSave={() => savePlan(editingAIPlan, 'ai_subscription_plans')} onCancel={() => setEditingAIPlan(null)} saving={saving} showCredits={true} />
                  ) : (
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div><p className="font-semibold text-gray-900">{p.name}</p><p className="text-xs text-gray-500">{p.description}</p></div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-sm"><span className="font-bold text-gray-900">₹{Number(p.price).toLocaleString('en-IN')}</span><span className="text-gray-500">/{p.billing_period}</span></div>
                        <button onClick={() => setEditingAIPlan(p)} className="flex items-center gap-1 text-xs text-sky-600 hover:underline"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                      </div>
                      {p.monthly_credits != null && <p className="text-xs text-violet-600 mt-2">{p.monthly_credits} AI credits/month</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payments tab */}
      {tab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          {payments.length === 0 ? (
            <div className="p-12 text-center"><p className="text-gray-400 text-sm">No payment records found.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Designer</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Method</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Date</th>
              </tr></thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td className="px-5 py-3"><p className="font-medium text-gray-900">{p.designers?.name || '—'}</p><p className="text-xs text-gray-500">{p.designers?.email}</p></td>
                    <td className="px-5 py-3 font-medium text-gray-900">₹{Number(p.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.payment_status === 'success' || p.payment_status === 'paid' || p.payment_status === 'completed' ? 'bg-green-50 text-green-600' :
                        p.payment_status === 'failed' || p.payment_status === 'cancelled' ? 'bg-red-50 text-red-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{p.payment_status}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">{p.payment_method || '—'}</td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell text-xs">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

const PlanEditor: React.FC<{
  plan: Plan;
  onChange: (p: Plan) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  showCredits: boolean;
}> = ({ plan, onChange, onSave, onCancel, saving, showCredits }) => (
  <div className="space-y-3">
    <input value={plan.name} onChange={e => onChange({ ...plan, name: e.target.value })}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Plan name" />
    <textarea value={plan.description} onChange={e => onChange({ ...plan, description: e.target.value })}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" rows={2} placeholder="Description" />
    <div className="flex gap-2">
      <input value={plan.price} onChange={e => onChange({ ...plan, price: e.target.value })}
        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Price" type="number" />
      {showCredits ? (
        <input value={plan.monthly_credits ?? ''} onChange={e => onChange({ ...plan, monthly_credits: parseInt(e.target.value) || 0 })}
          className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Credits" type="number" />
      ) : (
        <>
          <input value={plan.max_projects ?? ''} onChange={e => onChange({ ...plan, max_projects: parseInt(e.target.value) || 0 })}
            className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Projects" type="number" />
          <input value={plan.max_quotes ?? ''} onChange={e => onChange({ ...plan, max_quotes: parseInt(e.target.value) || 0 })}
            className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Quotes" type="number" />
        </>
      )}
    </div>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={plan.is_active} onChange={e => onChange({ ...plan, is_active: e.target.checked })} className="rounded" />
      <span className="text-gray-700">Active</span>
    </label>
    <div className="flex gap-2">
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50">
        <Save className="w-3.5 h-3.5" /> Save
      </button>
      <button onClick={onCancel}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200">
        <X className="w-3.5 h-3.5" /> Cancel
      </button>
    </div>
  </div>
);

export default AdminSubscriptions;
