import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, Crown, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubscriptionPlan {
  id: number;
  slug: string;
  name: string;
  price: number;
  currency: string;
  base_price_note?: string;
  features: string[];
}

interface UserSubscription {
  id: number;
  user_id: number;
  plan_id: number;
  status: 'active' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

const SubscriptionPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get('/api/subscription/plans');
      setPlans(response.data.plans);
    } catch (err) {
      setError('Failed to load subscription plans');
      console.error(err);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const response = await axios.get('/api/subscription/current');
      setCurrentSubscription(response.data);
    } catch (err) {
      setCurrentSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId: number) => {
    setIsProcessing(true);
    try {
      const response = await axios.post('/api/subscription/purchase', {
        plan_id: planId
      });
      if (response.data.payment_url) {
        window.location.href = response.data.payment_url;
      } else {
        setCurrentSubscription(response.data);
      }
    } catch (err) {
      setError('Failed to process purchase');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="skeleton h-10 w-72" />
          <div className="skeleton h-4 w-96" />
          <div className="grid md:grid-cols-3 gap-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentPlanId = currentSubscription?.plan_id;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 animate-rise-in">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-display font-extrabold text-graphite-900 tracking-[-0.02em] mb-2">Subscription Plans</h1>
        <p className="text-muted-foreground mb-8">Choose the perfect plan for your needs</p>

        {error && (
          <div className="bg-danger-soft border border-destructive/30 text-destructive text-sm p-4 rounded-xl mb-6 animate-rise-in">
            {error}
          </div>
        )}

        {currentSubscription && currentSubscription.status === 'active' && (
          <div className="rounded-xl border border-emerald-200 bg-accent/30 p-4 mb-8 animate-rise-in">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-primary-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="text-foreground text-sm">
                  Your current plan: <strong className="font-display">{plans.find(p => p.id === currentSubscription.plan_id)?.name}</strong>
                </p>
                <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Active until: {new Date(currentSubscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                Active
              </span>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, i) => (
            <div
              key={plan.id}
              className={cn(
                'rounded-xl border bg-card p-6 transition-all duration-150 animate-rise-in',
                currentPlanId === plan.id
                  ? 'border-2 border-emerald-600 shadow-lg-brand'
                  : 'border-border shadow-soft hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300'
              )}
              style={{ animationDelay: `${Math.min(i, 8) * 120}ms` }}
            >
              <h2 className="text-xl font-display font-bold text-graphite-900 mb-1">{plan.name}</h2>
              <p className="text-muted-foreground text-sm mb-4">{plan.base_price_note || ''}</p>
              <div className="mb-6 flex items-baseline">
                <span className="text-4xl font-display font-extrabold text-graphite-900 tracking-[-0.02em]">{plan.price}</span>
                <span className="text-sm text-muted-foreground ml-2">/{plan.currency}</span>
              </div>
              <div className="mb-6">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">Features:</h3>
                <ul className="space-y-2">
                  {plan.features?.map((feature, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handlePurchase(plan.id)}
                disabled={currentPlanId === plan.id || isProcessing}
                className={cn(
                  'w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  currentPlanId === plan.id
                    ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand disabled:opacity-50 disabled:pointer-events-none'
                )}
              >
                {isProcessing && currentPlanId !== plan.id && <Loader2 className="w-4 h-4 animate-spin" />}
                {currentPlanId === plan.id ? 'Current Plan' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
