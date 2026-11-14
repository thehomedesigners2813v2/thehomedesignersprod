import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertTriangle, CheckCircle, XCircle, MessageSquare, Mail, Sparkles, Youtube } from 'lucide-react';

const AdminIntegrations: React.FC = () => {
  const [whatsappSettings, setWhatsappSettings] = useState<any>(null);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [youtubeLabel, setYoutubeLabel] = useState<string | null>(null);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wRes, aRes, youtubeRes] = await Promise.all([
        supabase.from('whatsapp_settings').select('*').maybeSingle(),
        supabase.from('ai_configuration').select('*').eq('id', true).maybeSingle(),
        supabase.functions.invoke('youtube-intro-upload', { body: { action: 'status' } }),
      ]);
      if (wRes.error) throw wRes.error;
      if (aRes.error) throw aRes.error;
      setWhatsappSettings(wRes.data);
      setAiConfig(aRes.data);
      setYoutubeConnected(Boolean(youtubeRes.data?.connected));
      setYoutubeLabel(youtubeRes.data?.channelLabel || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const connectYoutube = async () => {
    setConnecting(true);
    setError(null);
    const { data, error: connectError } = await supabase.functions.invoke('youtube-intro-upload', { body: { action: 'connect' } });
    setConnecting(false);
    if (connectError || !data?.url) {
      let message = 'The YouTube channel could not be connected.';
      try {
        const body = await connectError?.context?.json();
        if (body?.error) message = body.error;
      } catch { /* keep the fallback message */ }
      setError(message);
      return;
    }
    window.location.assign(data.url);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;
  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-700 font-medium">Failed to load integrations</p>
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={fetchAll} className="mt-4 text-sm text-sky-600 hover:underline">Retry</button>
    </div></div>
  );

  const integrations = [
    {
      name: 'WhatsApp Notifications',
      desc: 'Send automated WhatsApp messages to designers and homeowners',
      icon: MessageSquare,
      configured: !!whatsappSettings && !!whatsappSettings.waha_api_url,
      enabled: whatsappSettings?.is_enabled,
      details: whatsappSettings ? [
        ['Provider', whatsappSettings.provider || 'WAHA'],
        ['API URL', whatsappSettings.waha_api_url ? 'Configured' : 'Not set'],
        ['Session', whatsappSettings.waha_session || 'Not set'],
      ] : [['Status', 'Not configured']],
      configPath: '/admin/whatsapp',
    },
    {
      name: 'AI Quotation (OpenAI)',
      desc: 'GPT-4o vision model for floor plan analysis and quotation generation',
      icon: Sparkles,
      configured: !!aiConfig && !!aiConfig.vision_model,
      enabled: aiConfig?.is_enabled,
      details: aiConfig ? [
        ['Vision Model', aiConfig.vision_model || 'Not set'],
        ['Text Model', aiConfig.text_model || 'Not set'],
        ['Max File Size', aiConfig.max_file_size_bytes ? `${Math.round(aiConfig.max_file_size_bytes / 1048576)}MB` : 'Not set'],
      ] : [['Status', 'Not configured']],
      configPath: '/admin/ai-monitoring',
    },
    {
      name: 'Email Notifications',
      desc: 'Automated email receipts and notifications via Supabase Edge Functions',
      icon: Mail,
      configured: true,
      enabled: true,
      details: [
        ['Provider', 'Supabase Edge Functions'],
        ['Status', 'Active'],
      ],
      configPath: null,
    },
    {
      name: 'Designer introductions (YouTube)',
      desc: 'Publish each designer’s 1-minute introduction on thehomedesigners2813@gmail.com',
      icon: Youtube,
      configured: youtubeConnected,
      enabled: youtubeConnected,
      details: [
        ['Channel', youtubeLabel || 'Not connected'],
        ['Visibility', 'Public on YouTube'],
        ['Account', 'thehomedesigners2813@gmail.com'],
      ],
      configPath: null,
      connect: true,
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor and configure third-party service connections</p>
      </div>

      <div className="space-y-4">
        {integrations.map(int => {
          const Icon = int.icon;
          return (
            <div key={int.name} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  int.enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{int.name}</p>
                    {int.configured ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle className="w-3.5 h-3.5" /> Configured</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-400 font-medium"><XCircle className="w-3.5 h-3.5" /> Not configured</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{int.desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {int.details.map(([label, value]) => (
                      <div key={label as string} className="text-xs">
                        <span className="text-gray-400">{label}: </span>
                        <span className="text-gray-700 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {int.configPath && (
                  <a href={int.configPath} className="shrink-0 text-xs text-sky-600 hover:underline">Configure</a>
                )}
                {'connect' in int && int.connect && (
                  <button type="button" disabled={connecting} onClick={() => void connectYoutube()} className="shrink-0 text-xs text-sky-600 hover:underline disabled:opacity-60">
                    {connecting ? 'Opening Google…' : youtubeConnected ? 'Reconnect' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-amber-50 rounded-lg">
        <p className="text-xs text-amber-700">
          API keys and secrets are managed securely through project environment variables and are not exposed in this interface.
        </p>
      </div>
    </div>
  );
};

export default AdminIntegrations;
