import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export const usePlanAccess = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        if (!cancelled) {
          setPlanName(null);
          setIsActive(false);
          setLoading(false);
        }
        return;
      }

      const { data: designer } = await supabase
        .from('designers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!designer) {
        if (!cancelled) {
          setPlanName(null);
          setIsActive(false);
          setLoading(false);
        }
        return;
      }

      const { data: subscription } = await supabase
        .from('designer_subscriptions')
        .select('status, subscription_plan:subscription_plans(name)')
        .eq('designer_id', designer.id)
        .maybeSingle();

      const plan = subscription?.subscription_plan as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(plan) ? plan[0]?.name : plan?.name;

      if (!cancelled) {
        setPlanName(name || null);
        setIsActive(subscription?.status === 'active');
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    loading,
    planName,
    isProfessional: isActive && planName === 'Professional',
  };
};
