import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
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
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  const currentPlanId = currentSubscription?.plan_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Subscription Plans</h1>
        <p className="text-slate-300 mb-8">Choose the perfect plan for your needs</p>

        {error && <div className="bg-red-500 text-white p-4 rounded mb-6">{error}</div>}

        {currentSubscription && currentSubscription.status === 'active' && (
          <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-4 mb-8">
            <p className="text-green-300">
              Your current plan: <strong>{plans.find(p => p.id === currentSubscription.plan_id)?.name}</strong>
              <br />
              Active until: {new Date(currentSubscription.current_period_end).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-lg p-6 transition-all ${
                currentPlanId === plan.id
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 border-2 border-indigo-400'
                  : 'bg-slate-700 hover:bg-slate-600 border-2 border-slate-600'
              }`}
            >
              <h2 className="text-2xl font-bold text-white mb-2">{plan.name}</h2>
              <p className="text-slate-300 text-sm mb-4">{plan.base_price_note || ''}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-slate-300 ml-2">/{plan.currency}</span>
              </div>
              <div className="mb-6">
                <h3 className="text-white font-semibold mb-3">Features:</h3>
                <ul className="space-y-2">
                  {plan.features?.map((feature, idx) => (
                    <li key={idx} className="text-slate-300 flex items-start">
                      <span className="mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handlePurchase(plan.id)}
                disabled={currentPlanId === plan.id || isProcessing}
                className={`w-full py-2 rounded font-semibold transition-all ${
                  currentPlanId === plan.id
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-indigo-600 hover:bg-slate-100'
                }`}
              >
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
