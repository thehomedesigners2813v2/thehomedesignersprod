import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Users as UsersIcon, UserCheck, Briefcase, Home as HomeIcon,
  FolderKanban, FileText, CreditCard, Sparkles,
  TrendingUp, TrendingDown, AlertTriangle,
  Clock, CheckCircle, XCircle, DollarSign,
  Loader2, ArrowRight, Activity
} from 'lucide-react';

interface OverviewData {
  totalDesigners: number;
  pendingVerifications: number;
  totalHomeowners: number;
  activeProjects: number;
  completedProjects: number;
  totalProjects: number;
  pendingQuotes: number;
  acceptedQuotes: number;
  totalQuotes: number;
  activeSubscriptions: number;
  activeAISubscriptions: number;
  subscriptionRevenue: number;
  failedPayments: number;
  aiGenerations: number;
  aiFailures: number;
  aiCreditsConsumed: number;
  loading: boolean;
  error: string | null;
}

const initialData: OverviewData = {
  totalDesigners: 0, pendingVerifications: 0, totalHomeowners: 0,
  activeProjects: 0, completedProjects: 0, totalProjects: 0,
  pendingQuotes: 0, acceptedQuotes: 0, totalQuotes: 0,
  activeSubscriptions: 0, activeAISubscriptions: 0,
  subscriptionRevenue: 0, failedPayments: 0,
  aiGenerations: 0, aiFailures: 0, aiCreditsConsumed: 0,
  loading: true, error: null,
};

type Period = '7d' | '30d' | '90d' | 'all';

const AdminOverview: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewData>(initialData);
  const [recentDesigners, setRecentDesigners] = useState<any[]>([]);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('30d');

  const periodDays: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 9999 };

  const fetchOverview = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true, error: null }));
    try {
      const since = new Date(Date.now() - periodDays[period] * 86400000).toISOString();

      const [
        designersRes, customersRes, projectsRes, quotesRes,
        subsRes, aiSubsRes, paymentsRes,
        aiJobsRes, aiLedgerRes
      ] = await Promise.all([
        supabase.from('designers').select('id, verification_status, created_at'),
        supabase.from('customers').select('id, status, created_at'),
        supabase.from('customers').select('id, status, created_at, project_name, name, email'),
        supabase.from('designer_quotes').select('id, status, created_at'),
        supabase.from('designer_subscriptions').select('id, status, subscription_end_date'),
        supabase.from('designer_ai_subscriptions').select('id, status, subscription_end_date'),
        supabase.from('subscription_payments').select('id, amount, payment_status, created_at'),
        supabase.from('ai_quotation_jobs').select('id, status, created_at, error_message'),
        supabase.from('ai_credit_ledger').select('amount, event_type, created_at'),
      ]);

      const designers = designersRes.data || [];
      const customers = customersRes.data || [];
      const projects = projectsRes.data || [];
      const quotes = quotesRes.data || [];
      const subs = subsRes.data || [];
      const aiSubs = aiSubsRes.data || [];
      const payments = paymentsRes.data || [];
      const aiJobs = aiJobsRes.data || [];
      const ledger = aiLedgerRes.data || [];

      const activeSubs = subs.filter(s => s.status === 'active');
      const activeAISubs = aiSubs.filter(s => s.status === 'active');
      const successfulPayments = payments.filter(p => p.payment_status === 'completed');
      const failedPayments = payments.filter(p => p.payment_status === 'failed');
      const recentJobs = aiJobs.filter(j => new Date(j.created_at) >= new Date(since));
      const recentLedger = ledger.filter(l => new Date(l.created_at) >= new Date(since));

      setData({
        totalDesigners: designers.length,
        pendingVerifications: designers.filter(d => d.verification_status === 'pending').length,
        totalHomeowners: customers.length,
        activeProjects: projects.filter(p => p.status === 'in_progress' || p.status === 'assigned').length,
        completedProjects: projects.filter(p => p.status === 'completed').length,
        totalProjects: projects.length,
        pendingQuotes: quotes.filter(q => q.status === 'draft' || q.status === 'sent').length,
        acceptedQuotes: quotes.filter(q => q.status === 'accepted').length,
        totalQuotes: quotes.length,
        activeSubscriptions: activeSubs.length,
        activeAISubscriptions: activeAISubs.length,
        subscriptionRevenue: successfulPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        failedPayments: failedPayments.length,
        aiGenerations: recentJobs.length,
        aiFailures: recentJobs.filter(j => j.status === 'failed').length,
        aiCreditsConsumed: recentLedger
          .filter(l => l.event_type === 'settle' || l.event_type === 'consume')
          .reduce((sum, l) => sum + Math.abs(l.amount || 0), 0),
        loading: false,
        error: null,
      });

      setRecentDesigners(designers.slice(0, 5));
      setRecentProjects(projects.slice(0, 5).map((p: any) => ({ ...p, designers: { name: p.name } })));
    } catch (err: any) {
      setData(prev => ({ ...prev, loading: false, error: err.message || 'Failed to load overview data' }));
    }
  }, [period]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium mb-1">Failed to load overview data</p>
          <p className="text-red-500 text-sm">{data.error}</p>
          <button onClick={fetchOverview} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Designers', value: data.totalDesigners, icon: Briefcase, color: 'sky', nav: '/admin/designers' },
    { label: 'Pending Verifications', value: data.pendingVerifications, icon: Clock, color: 'amber', nav: '/admin/users' },
    { label: 'Total Homeowners', value: data.totalHomeowners, icon: HomeIcon, color: 'emerald', nav: '/admin/homeowners' },
    { label: 'Active Projects', value: data.activeProjects, icon: FolderKanban, color: 'blue', nav: '/admin/projects' },
    { label: 'Total Quotes', value: data.totalQuotes, icon: FileText, color: 'indigo', nav: '/admin/quotations' },
    { label: 'Accepted Quotes', value: data.acceptedQuotes, icon: CheckCircle, color: 'green', nav: '/admin/quotations' },
    { label: 'Active Subscriptions', value: data.activeSubscriptions, icon: CreditCard, color: 'sky', nav: '/admin/subscriptions' },
    { label: 'Active AI Add-ons', value: data.activeAISubscriptions, icon: Sparkles, color: 'violet', nav: '/admin/ai-monitoring' },
  ];

  const colorClasses: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
    red: 'bg-red-50 text-red-600',
  };

  const alerts: { type: 'warning' | 'error' | 'info'; message: string; nav: string }[] = [];
  if (data.pendingVerifications > 0) alerts.push({ type: 'warning', message: `${data.pendingVerifications} designer(s) awaiting verification`, nav: '/admin/users' });
  if (data.failedPayments > 0) alerts.push({ type: 'error', message: `${data.failedPayments} failed payment(s) need attention`, nav: '/admin/subscriptions' });
  if (data.aiFailures > 0) alerts.push({ type: 'error', message: `${data.aiFailures} AI generation failure(s) in the selected period`, nav: '/admin/ai-monitoring' });
  if (data.totalDesigners === 0) alerts.push({ type: 'info', message: 'No designers registered yet', nav: '/admin/designers' });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Platform metrics and activity at a glance</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
          {(['7d', '30d', '90d', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p ? 'bg-sky-600 text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'all' ? 'All time' : `Last ${p.replace('d', ' days')}`}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert, i) => (
            <button
              key={i}
              onClick={() => navigate(alert.nav)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left ${
                alert.type === 'error' ? 'bg-red-50 text-red-700 hover:bg-red-100' :
                alert.type === 'warning' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                'bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{alert.message}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              onClick={() => navigate(kpi.nav)}
              className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClasses[kpi.color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 group-hover:text-gray-700">
                {kpi.label}
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </button>
          );
        })}
      </div>

      {/* Revenue & AI metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-400">Subscription Revenue</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">₹{data.subscriptionRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-1">From successful payments</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-400">AI Generations</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.aiGenerations.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-1">{data.aiCreditsConsumed} credits consumed</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-400">Failed Payments</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.failedPayments.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-1">{data.aiFailures} AI failures in period</p>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Recent Designers</h3>
            <button onClick={() => navigate('/admin/designers')} className="text-xs text-sky-600 hover:underline">View all</button>
          </div>
          <div className="p-5">
            {recentDesigners.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No designers registered yet</p>
            ) : (
              <div className="space-y-3">
                {recentDesigners.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{d.name || 'Unnamed'}</p>
                      <p className="text-xs text-gray-500 truncate">{d.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      d.verification_status === 'verified' ? 'bg-green-50 text-green-600' :
                      d.verification_status === 'pending' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {d.verification_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Recent Projects</h3>
            <button onClick={() => navigate('/admin/projects')} className="text-xs text-sky-600 hover:underline">View all</button>
          </div>
          <div className="p-5">
            {recentProjects.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No projects created yet</p>
            ) : (
              <div className="space-y-3">
                {recentProjects.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.project_name || 'Untitled'}</p>
                      <p className="text-xs text-gray-500 truncate">{p.designers?.name || 'Unassigned'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      p.status === 'completed' ? 'bg-green-50 text-green-600' :
                      p.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {p.status || 'unknown'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
