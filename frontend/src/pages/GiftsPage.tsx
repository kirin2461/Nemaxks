import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Package, Send, User, MessageSquare, X } from 'lucide-react';
import { giftsAPI, UserGift, inventoryAPI } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function GiftsPage() {
  const queryClient = useQueryClient();
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [receiverId, setReceiverId] = useState('');
  const [message, setMessage] = useState('');

  const { data: receivedGifts = [], isLoading } = useQuery({
    queryKey: ['received-gifts'],
    queryFn: () => giftsAPI.getReceived(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryAPI.get(),
  });

  const openMutation = useMutation({
    mutationFn: (id: number) => giftsAPI.open(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['received-gifts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => giftsAPI.send(parseInt(receiverId), selectedItem!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setShowSendModal(false);
      setSelectedItem(null);
      setReceiverId('');
      setMessage('');
    },
  });

  const unopenedCount = receivedGifts.filter((g: UserGift) => !g.is_opened).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-soft">
          <div className="skeleton h-9 w-48 rounded-lg" />
          <div className="grid md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-4xl mx-auto animate-rise-in">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Gift className="w-6 h-6 text-emerald-600" strokeWidth={1.75} />
            <div>
              <h1 className="text-2xl font-display font-bold text-graphite-900">Подарки</h1>
              <p className="text-sm text-muted-foreground">Полученные и отправленные</p>
            </div>
            {unopenedCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold grid place-items-center animate-pop-menu">
                {unopenedCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowSendModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97]"
          >
            <Send className="w-4 h-4" strokeWidth={1.75} />
            Отправить подарок
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {receivedGifts.map((gift: UserGift, index: number) => (
            <div
              key={gift.id}
              className={`rounded-xl border bg-card p-6 shadow-soft transition-all duration-150 animate-rise-in ${
                gift.is_opened
                  ? 'border-border'
                  : 'border-emerald-300 shadow-lg-brand'
              }`}
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className={`h-24 w-24 shrink-0 rounded-xl grid place-items-center ${
                  gift.is_opened ? 'bg-secondary' : 'bg-accent'
                }`}>
                  {gift.is_opened ? (
                    <Package className="w-8 h-8 text-graphite-500" strokeWidth={1.5} />
                  ) : (
                    <Gift className="w-8 h-8 text-emerald-600" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                    <span className="font-medium text-graphite-900 truncate">{gift.sender?.username || 'Кто-то'}</span>
                  </div>
                  {gift.message && (
                    <p className="text-muted-foreground text-sm italic mb-2 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                      {gift.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(gift.created_at), { addSuffix: true, locale: ru })}
                  </p>

                  {gift.is_opened && gift.item && (
                    <div className="mt-3 p-2 bg-secondary rounded-lg animate-scale-in">
                      <p className="text-sm font-medium text-graphite-900">{gift.item.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{gift.item.type}</p>
                    </div>
                  )}

                  {!gift.is_opened && (
                    <button
                      onClick={() => openMutation.mutate(gift.id)}
                      disabled={openMutation.isPending}
                      className="mt-3 w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Открыть подарок
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {receivedGifts.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-soft py-16 px-6 text-center animate-rise-in">
            <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto">
              <Gift className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold mt-4 text-graphite-900">Вам пока не дарили подарков</h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">Полученные подарки появятся здесь</p>
          </div>
        )}

        {showSendModal && (
          <div className="fixed inset-0 z-50 bg-graphite-950/40 backdrop-blur-[3px] flex items-center justify-center animate-fade-in-soft">
            <div className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-6 shadow-pop animate-scale-in m-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-graphite-900">Отправить подарок</h3>
                <button
                  onClick={() => setShowSendModal(false)}
                  className="h-8 w-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">ID получателя</label>
                  <input
                    type="text"
                    value={receiverId}
                    onChange={e => setReceiverId(e.target.value)}
                    placeholder="Введите ID пользователя"
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Выберите предмет</label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {inventory.map((inv: { id: number; item?: { id: number; name: string } }) => (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedItem(inv.item?.id || inv.id)}
                        className={`p-2 rounded-lg border text-xs transition-all duration-150 ${
                          selectedItem === (inv.item?.id || inv.id)
                            ? 'border-primary bg-accent text-accent-foreground font-medium'
                            : 'border-border bg-card hover:border-emerald-300'
                        }`}
                      >
                        {inv.item?.name || 'Предмет'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Сообщение (необязательно)</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Добавьте сообщение..."
                    className="input-field w-full resize-none h-auto py-2"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="h-10 px-4 rounded-lg border border-input bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground hover:border-emerald-200 transition-all duration-150 active:scale-[0.97]"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => sendMutation.mutate()}
                    disabled={!selectedItem || !receiverId || sendMutation.isPending}
                    className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Отправить
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
