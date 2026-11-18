import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Loader2, AlertTriangle, Search, Sparkles, CheckCircle, XCircle,
  TrendingUp, Clock, Zap, Eye, X, Settings
} from 'lucide-react';

type Tab = 'overview' | 'jobs' | 'credits' | 'config';

const AdminAIMonitoring: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [jobs, setJobs] = useState<any[]>([]);
  const [creditPeriods, setCreditPeriods] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, periodsRes, ledgerRes, configRes] = await Promise.all([
        supabase.from('ai_quotation_jobs').select('*, designers(name, email)').order('created_at', { ascending: false }).limit(100),
        supabase.from('ai_credit_periods').select('*, designers(name, email)').order('created_at', { ascending: false }),
        supabase.from('ai_credit_ledger').select('*, designers(name, email)').order('created_at', { ascending: false }).limit(100),
        supabase.from('ai_configuration').select('*').eq('id', true).maybeSingle(),
      ]);
      if (jobsRes.error) throw jobsRes.error;
      if (periodsRes.error) throw periodsRes.error;
      if (ledgerRes.error) throw ledgerRes.error;
      if (configRes.error) throw configRes.error;

      // Enrich jobs with customer project names (project_id references customers)
      const jobCustomerIds = new Set((jobsRes.data || []).map((j: any) => j.project_id).filter(Boolean));
      const customerMap: Record<string, any> = {};
      if (jobCustomerIds.size > 0) {
        const { data: customerData } = await supabase.from('customers').select('id, project_name, name').in('id', Array.from(jobCustomerIds));
        (customerData || []).forEach((c: any) => { customerMap[c.id] = c; });
      }
      const enrichedJobs = (jobsRes.data || []).map((j: any) => ({ ...j, customers: customerMap[j.project_id] || null }));

      // Enrich credit periods with AI plan names (ai_subscription_id references designer_ai_subscriptions)
      const subIds = new Set((periodsRes.data || []).map((p: any) => p.ai_subscription_id).filter(Boolean));
      const planMap: Record<string, string> = {};
      if (subIds.size > 0) {
        const { data: aiSubs } = await supabase.from('designer_ai_subscriptions').select('id, ai_plan_id').in('id', Array.from(subIds));
        const planIds = new Set((aiSubs || []).map((s: any) => s.ai_plan_id).filter(Boolean));
        if (planIds.size > 0) {
          const { data: plans } = await supabase.from('ai_subscription_plans').select('id, name').in('id', Array.from(planIds));
          (plans || []).forEach((p: any) => { planMap[p.id] = p.name; });
        }
        (aiSubs || []).forEach((s: any) => { 
          const period = (periodsRes.data || []).find((p: any) => p.ai_subscription_id === s.id);
          if (period) period._plan_name = planMap[s.ai_plan_id] || '—';
        });
      }

      setJobs(enrichedJobs);
      setCreditPeriods(periodsRes.data || []);
      setLedger(ledgerRes.data || []);
      setConfig(configRes.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load AI data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const { error: err } = await supabase.from('ai_configuration').update({
        is_enabled: config.is_enabled,
        vision_model: config.vision_model,
        text_model: config.text_model,
        transcription_model: config.transcription_model,
        max_file_size_bytes: config.max_file_size_bytes,
      }).eq('id', true);
      if (err) throw err;
      await supabase.from('audit_logs').insert({ action: 'ai_config_updated', target_type: 'ai_configuration', details: { is_enabled: config.is_enabled, vision_model: config.vision_model } });
      fetchAll();
      alert('AI configuration saved');
    } catch (e: any) {
      alert('Failed: ' + e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load AI data</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchAll} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  const successfulJobs = jobs.filter(j => j.status === 'completed' || j.status === 'processed');
  const failedJobs = jobs.filter(j => j.status === 'failed');
  const totalCreditsConsumed = ledger.filter(l => l.event_type === 'settle' || l.event_type === 'consume').reduce((sum, l) => sum + Math.abs(l.amount || 0), 0);
  const totalCreditsReserved = ledger.filter(l => l.event_type === 'reserve').reduce((sum, l) => sum + Math.abs(l.amount || 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Quotation Monitoring</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor AI generation usage, credits, and configuration</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Generations', value: jobs.length, icon: Sparkles, color: 'violet' },
          { label: 'Successful', value: successfulJobs.length, icon: CheckCircle, color: 'green' },
          { label: 'Failed', value: failedJobs.length, icon: XCircle, color: 'red' },
          { label: 'Credits Consumed', value: totalCreditsConsumed, icon: Zap, color: 'amber' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${s.color}-50 text-${s.color}-600`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-gray-900">{s.value.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          ['overview', 'Overview'],
          ['jobs', 'Generation Jobs'],
          ['credits', 'Credit Balances'],
          ['config', 'Configuration'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{label}</button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Recent Jobs</h3>
            {jobs.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No AI generations yet</p> : (
              <div className="space-y-3">
                {jobs.slice(0, 8).map(j => (
                  <div key={j.id} className="flex items-center justify-between">
                    <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{j.designers?.name || '—'}</p><p className="text-xs text-gray-500">{j.customers?.project_name || '—'}</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      j.status === 'completed' || j.status === 'processed' ? 'bg-green-50 text-green-600' :
                      j.status === 'failed' ? 'bg-red-50 text-red-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>{j.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Failure Reasons</h3>
            {failedJobs.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No failures recorded</p> : (
              <div className="space-y-3">
                {failedJobs.slice(0, 8).map(j => (
                  <div key={j.id} className="p-3 bg-red-50/50 rounded-lg">
                    <p className="text-xs font-medium text-gray-900">{j.designers?.name || 'Unknown'}</p>
                    <p className="text-xs text-red-600 mt-1">{j.error_message || 'No error message recorded'}</p>
                    <p className="text-xs text-gray-400 mt-1">{j.created_at ? new Date(j.created_at).toLocaleString('en-IN') : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs tab */}
      {tab === 'jobs' && (
        <>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by designer or project…"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm">
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          {jobs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-400 text-sm">No AI generation jobs found.</p></div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Designer</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden md:table-cell">Project</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Created</th>
                  <th className="px-5 py-3"></th>
                </tr></thead>
                <tbody>
                  {jobs.filter(j => {
                    const ms = !search || j.designers?.name?.toLowerCase().includes(search.toLowerCase()) || j.customers?.project_name?.toLowerCase().includes(search.toLowerCase());
                    const mf = statusFilter === 'all' || j.status === statusFilter;
                    return ms && mf;
                  }).map(j => (
                    <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                      <td className="px-5 py-3"><p className="font-medium text-gray-900">{j.designers?.name || '—'}</p></td>
                      <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{j.customers?.project_name || '—'}</td>
                      <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        j.status === 'completed' || j.status === 'processed' ? 'bg-green-50 text-green-600' :
                        j.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                      }`}>{j.status}</span></td>
                      <td className="px-5 py-3 text-gray-500 hidden sm:table-cell text-xs">{j.created_at ? new Date(j.created_at).toLocaleString('en-IN') : '—'}</td>
                      <td className="px-5 py-3"><button onClick={() => setSelectedJob(j)} className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-md"><Eye className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedJob && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedJob(null)}>
              <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Job Details</h3>
                  <button onClick={() => setSelectedJob(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  {[['Designer', selectedJob.designers?.name], ['Project', selectedJob.customers?.project_name],
                    ['Status', selectedJob.status], ['Error', selectedJob.error_message],
                    ['Created', selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString('en-IN') : null],
                    ['Updated', selectedJob.updated_at ? new Date(selectedJob.updated_at).toLocaleString('en-IN') : null]
                  ].map(([l, v]) => <div key={l as string} className="flex justify-between gap-4"><span className="text-gray-500 shrink-0">{l}</span><span className="text-gray-900 text-right break-all">{v || '—'}</span></div>)}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Credits tab */}
      {tab === 'credits' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          {creditPeriods.length === 0 ? (
            <div className="p-12 text-center"><Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-400 text-sm">No credit periods found.</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Designer</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Plan</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Granted</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Consumed</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Remaining</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 hidden sm:table-cell">Period</th>
              </tr></thead>
              <tbody>
                {creditPeriods.map(p => {
                  const remaining = (p.credits_granted || 0) - (p.credits_consumed || 0);
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                      <td className="px-5 py-3"><p className="font-medium text-gray-900">{p.designers?.name || '—'}</p></td>
                      <td className="px-5 py-3 text-gray-600">{p._plan_name || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{p.credits_granted}</td>
                      <td className="px-5 py-3 text-gray-600">{p.credits_consumed}</td>
                      <td className="px-5 py-3"><span className={`font-medium ${remaining > 0 ? 'text-green-600' : 'text-gray-400'}`}>{remaining}</span></td>
                      <td className="px-5 py-3 text-gray-500 hidden sm:table-cell text-xs">
                        {p.period_start ? new Date(p.period_start).toLocaleDateString('en-IN') : '—'} → {p.period_end ? new Date(p.period_end).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Config tab */}
      {tab === 'config' && config && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">AI Provider Configuration</h3>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">AI Feature Enabled</span>
                <input type="checkbox" checked={config.is_enabled} onChange={e => setConfig({ ...config, is_enabled: e.target.checked })} className="rounded" />
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vision Model</label>
                <input value={config.vision_model || ''} onChange={e => setConfig({ ...config, vision_model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="e.g. gpt-4o" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text Model</label>
                <input value={config.text_model || ''} onChange={e => setConfig({ ...config, text_model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="e.g. gpt-4o" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transcription Model</label>
                <input value={config.transcription_model || ''} onChange={e => setConfig({ ...config, transcription_model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="e.g. whisper-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max File Size (bytes)</label>
                <input type="number" value={config.max_file_size_bytes || ''} onChange={e => setConfig({ ...config, max_file_size_bytes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="pt-3 border-t border-gray-100">
                <button onClick={saveConfig} disabled={savingConfig}
                  className="px-4 py-2 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50">
                  {savingConfig ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700">
              Note: Enabling AI here does not create provider access. The OpenAI API key must be configured separately in project secrets.
              AI quotation generation is only available to designers with active Standard and AI subscriptions and sufficient credits.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAIMonitoring;
