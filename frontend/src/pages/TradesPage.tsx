import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Check, X, Clock, User } from 'lucide-react';
import { tradesAPI, Trade } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
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
        return { text: 'Ожидает', color: 'bg-secondary text-secondary-foreground' };
      case 'accepted':
        return { text: 'Принят', color: 'bg-emerald-100 text-emerald-800' };
      case 'rejected':
        return { text: 'Отклонён', color: 'bg-danger-soft text-destructive' };
      case 'cancelled':
        return { text: 'Отменён', color: 'bg-secondary text-secondary-foreground' };
      default:
        return { text: status, color: 'bg-secondary text-secondary-foreground' };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-48 rounded-lg" />
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-4xl mx-auto animate-rise-in">
        <div className="flex items-center gap-3 mb-8">
          <ArrowLeftRight className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
          <div>
            <h1 className="text-2xl font-display font-bold text-graphite-900">Обмены</h1>
            <p className="text-sm text-muted-foreground">Входящие и исходящие предложения</p>
          </div>
        </div>

        <div className="inline-flex p-1 rounded-lg bg-secondary gap-1 mb-6">
          {['pending', 'accepted', 'rejected', ''].map(status => (
            <button
              key={status || 'all'}
              onClick={() => setStatusFilter(status)}
              className={`h-8 px-3 rounded-md text-sm whitespace-nowrap transition-all duration-150 ${
                statusFilter === status
                  ? 'bg-card text-foreground shadow-soft font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {status === 'pending' ? 'Ожидающие' : status === 'accepted' ? 'Принятые' : status === 'rejected' ? 'Отклонённые' : 'Все'}
            </button>
          ))}
        </div>

        <div className="space-y-4" key={statusFilter || 'all'}>
          {trades.map((trade: Trade, index: number) => {
            const status = getStatusBadge(trade.status);
            const isReceiver = trade.receiver_id === Number(user?.id);
            const canRespond = isReceiver && trade.status === 'pending';

            return (
              <div
                key={trade.id}
                className="rounded-xl border border-border bg-card shadow-soft p-6 transition-all duration-150 animate-rise-in hover:shadow-elev"
                style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-emerald-700 text-white grid place-items-center ring-1 ring-border">
                        <User className="w-4 h-4" strokeWidth={1.75} />
                      </span>
                      <span className="font-medium text-graphite-900">
                        {trade.initiator?.username || 'Пользователь'}
                      </span>
                    </div>
                    <ArrowLeftRight className="w-4 h-4 text-graphite-400" strokeWidth={1.75} />
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-graphite-700 text-white grid place-items-center ring-1 ring-border">
                        <User className="w-4 h-4" strokeWidth={1.75} />
                      </span>
                      <span className="font-medium text-graphite-900">
                        {trade.receiver?.username || 'Пользователь'}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.text}
                  </span>
                </div>

                {trade.initiator_note && (
                  <p className="text-muted-foreground text-sm italic mb-4">
                    "{trade.initiator_note}"
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="w-4 h-4" strokeWidth={1.75} />
                    {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true, locale: ru })}
                  </div>

                  {canRespond && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondMutation.mutate({ id: trade.id, action: 'reject' })}
                        disabled={respondMutation.isPending}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-sm bg-danger-soft text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
                      >
                        <X className="w-4 h-4" strokeWidth={2} />
                        Отклонить
                      </button>
                      <button
                        onClick={() => respondMutation.mutate({ id: trade.id, action: 'accept' })}
                        disabled={respondMutation.isPending}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-sm bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" strokeWidth={2} />
                        Принять
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {trades.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
            <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
              <ArrowLeftRight className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mt-4 text-graphite-900">Обменов нет</h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Здесь появится история ваших обменов</p>
          </div>
        )}
      </div>
    </div>
  );
}
