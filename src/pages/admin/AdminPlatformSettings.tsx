import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, Settings, ToggleLeft, ToggleRight } from 'lucide-react';

const AdminPlatformSettings: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('site_settings')
        .select('*')
        .eq('setting_key', 'subscription_management_enabled')
        .maybeSingle();
      if (err) throw err;
      setSettings(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const toggleSetting = async (field: string, value: boolean) => {
    setSaving(true);
    try {
      const { error: err } = await supabase.from('site_settings').update({ is_active: value, updated_at: new Date().toISOString() }).eq('setting_key', field);
      if (err) throw err;
      await supabase.from('audit_logs').insert({ action: 'setting_toggled', target_type: 'site_settings', details: { field, value } });
      setSettings((prev: any) => prev ? { ...prev, is_active: value } : prev);
    } catch (e: any) {
      alert('Failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load settings</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchSettings} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure platform-wide feature toggles and behavior</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {/* Subscription management toggle */}
        <div className="p-5 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-600" />
              <p className="font-semibold text-gray-900 text-sm">Subscription Management</p>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-6">When enabled, designers must have an active subscription to use platform features. Disabling this allows designers to use features without subscription checks.</p>
          </div>
          <button onClick={() => toggleSetting('subscription_management_enabled', !settings?.is_active)} disabled={saving}
            className="shrink-0 ml-4">
            {settings?.is_active ? (
              <ToggleRight className="w-12 h-12 text-sky-600" />
            ) : (
              <ToggleLeft className="w-12 h-12 text-gray-300" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">
          All configuration changes are recorded in the audit log. Only platform administrators can modify these settings.
        </p>
      </div>
    </div>
  );
};

export default AdminPlatformSettings;
