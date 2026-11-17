import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface SubscriptionStatus {
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number;
  status: string;
  subscriptionId: string | null;
  planName: string | null;
}

export const useSubscription = () => {
  const { user } = useAuth();

  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    isActive: false,
    isTrial: false,
    isExpired: false,
    daysRemaining: 0,
    status: 'none',
    subscriptionId: null,
    planName: null
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, [user]);

  const checkSubscription = async () => {
    if (!user) {
      setSubscription({
        isActive: false,
        isTrial: false,
        isExpired: false,
        daysRemaining: 0,
        status: 'none',
        subscriptionId: null,
        planName: null
      });

      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Get designer record
      const { data: designerData, error: designerError } = await supabase
        .from('designers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (designerError) {
        throw designerError;
      }

      // Designer not found
      if (!designerData) {
        setSubscription({
          isActive: false,
          isTrial: false,
          isExpired: true,
          daysRemaining: 0,
          status: 'none',
          subscriptionId: null,
          planName: null
        });

        setLoading(false);
        return;
      }

      // Get designer subscription
      const { data: subData, error: subError } = await supabase
        .from('designer_subscriptions')
        .select(`
          id,
          status,
          trial_end_date,
          subscription_end_date,
          subscription_plan:subscription_plans(name)
        `)
        .eq('designer_id', designerData.id)
        .maybeSingle();

      if (subError) {
        throw subError;
      }

      // No subscription found
      if (!subData) {
        setSubscription({
          isActive: false,
          isTrial: false,
          isExpired: true,
          daysRemaining: 0,
          status: 'none',
          subscriptionId: null,
          planName: null
        });

        setLoading(false);
        return;
      }

      const now = new Date();

      let daysRemaining = 0;
      let isActive = false;
      let isTrial = false;
      let isExpired = false;

      // --------------------------------
      // TRIAL SUBSCRIPTION
      // --------------------------------
      if (subData.status === 'trial') {
        isTrial = false;
        isActive = false;
        isExpired = true;
        daysRemaining = 0;
      }

      // --------------------------------
      // ACTIVE SUBSCRIPTION
      // --------------------------------
      else if (subData.status === 'active') {
        if (subData.subscription_end_date) {
          const subscriptionEnd = new Date(
            subData.subscription_end_date
          );

          const diffTime =
            subscriptionEnd.getTime() - now.getTime();

          daysRemaining = Math.ceil(
            diffTime / (1000 * 60 * 60 * 24)
          );

          if (daysRemaining > 0) {
            isActive = true;
            isExpired = false;
          } else {
            isActive = false;
            isExpired = true;
          }
        } else {
          // Active subscription without an end date
          isActive = true;
          isExpired = false;
          daysRemaining = 0;
        }
      }

      // --------------------------------
      // EXPIRED / CANCELLED
      // --------------------------------
      else if (
        subData.status === 'expired' ||
        subData.status === 'cancelled'
      ) {
        isActive = false;
        isTrial = false;
        isExpired = true;
        daysRemaining = 0;
      }

      // --------------------------------
      // UNKNOWN STATUS
      // --------------------------------
      else {
        isActive = false;
        isTrial = false;
        isExpired = true;
        daysRemaining = 0;
      }

      setSubscription({
        isActive,
        isTrial,
        isExpired,
        daysRemaining: Math.max(0, daysRemaining),
        status: subData.status,
        subscriptionId: subData.id,
        planName: subData.subscription_plan?.name || null
      });
    } catch (error) {
      console.error('Error checking subscription:', error);

      setSubscription({
        isActive: false,
        isTrial: false,
        isExpired: true,
        daysRemaining: 0,
        status: 'error',
        subscriptionId: null,
        planName: null
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    subscription,
    loading,
    refresh: checkSubscription
  };
};