import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { supabase } from '../lib/supabase';

const SubscriptionBanner: React.FC = () => {
  const navigate = useNavigate();
  const { subscription, loading } = useSubscription();
  const [subscriptionManagementEnabled, setSubscriptionManagementEnabled] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptionManagementSetting();
  }, []);

  const fetchSubscriptionManagementSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('is_active')
        .eq('setting_key', 'subscription_management_enabled')
        .maybeSingle();

      if (error) throw error;

      setSubscriptionManagementEnabled(data?.is_active || false);
    } catch (error) {
      console.error('Error fetching subscription management setting:', error);
      setSubscriptionManagementEnabled(false);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Don't show anything while checking settings
  if (settingsLoading) return null;

  // If subscription management is disabled, don't show any subscription messages
  if (!subscriptionManagementEnabled) return null;

  // Don't show anything while loading subscription data
  if (loading) return null;

  if (subscription.isExpired) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Monthly subscription required</h3>
              <p className="text-red-700">
                Designer tools stay closed until a monthly plan is paid.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/designer-subscription')}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
          >
            Choose a plan
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner;
