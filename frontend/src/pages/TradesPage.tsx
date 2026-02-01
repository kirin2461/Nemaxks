import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Check, X, Clock, User, Package } from 'lucide-react';
import { tradesAPI, Trade } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { useStore } from '../lib/store';

export default function TradesPage() {
  const queryClient = useQueryClient();
  const user = useStore(state => state.user);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades', statusFilter],
    queryFn: () => tradesAPI.getAll(statusFilter || undefined),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accept' | 'reject' }) =>
      tradesAPI.respond(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['currency'] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' };
      case 'accepted':
        return { text: 'Accepted', color: 'bg-green-500/20 text-green-400' };
      case 'rejected':
        return { text: 'Rejected', color: 'bg-red-500/20 text-red-400' };
      case 'cancelled':
        return { text: 'Cancelled', color: 'bg-gray-500/20 text-gray-400' };
      default:
        return { text: status, color: 'bg-gray-500/20 text-gray-400' };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ArrowLeftRight className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Trades</h1>
        </div>

        <div className="flex gap-2 mb-6">
          {['pending', 'accepted', 'rejected', ''].map(status => (
            <button
              key={status || 'all'}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {trades.map((trade: Trade) => {
            const status = getStatusBadge(trade.status);
            const isReceiver = trade.receiver_id === Number(user?.id);
            const canRespond = isReceiver && trade.status === 'pending';

            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">
                        {trade.initiator?.username || 'User'}
                      </span>
                    </div>
                    <ArrowLeftRight className="w-4 h-4 text-gray-500" />
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">
                        {trade.receiver?.username || 'User'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                    {status.text}
                  </span>
                </div>

                {trade.initiator_note && (
                  <p className="text-gray-400 text-sm mb-4">
                    "{trade.initiator_note}"
                  </p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                  </div>
                  
                  {canRespond && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondMutation.mutate({ id: trade.id, action: 'reject' })}
                        disabled={respondMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => respondMutation.mutate({ id: trade.id, action: 'accept' })}
                        disabled={respondMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30"
                      >
                        <Check className="w-4 h-4" />
                        Accept
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {trades.length === 0 && (
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <ArrowLeftRight className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No trades</h3>
            <p className="text-gray-400">Your trade history will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
