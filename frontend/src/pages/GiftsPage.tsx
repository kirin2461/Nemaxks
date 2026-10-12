import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Gift, Package, Send, User, MessageSquare, Check } from 'lucide-react';
import { giftsAPI, UserGift, inventoryAPI } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

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
      <div className="min-h-screen bg-nebula flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary/40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nebula text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold gradient-brand-text">Подарки</h1>
            {unopenedCount > 0 && (
              <span className="px-2 py-1 bg-gradient-brand text-white rounded-full text-sm font-medium shadow-soft">
                {unopenedCount} новых
              </span>
            )}
          </div>
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-brand text-white rounded-lg shadow-soft hover:brightness-110 hover:shadow-glow transition-all"
          >
            <Send className="w-4 h-4" />
            Отправить подарок
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {receivedGifts.map((gift: UserGift) => (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl p-6 backdrop-blur-xl border ${
                gift.is_opened
                  ? 'bg-card/50 border-border/50'
                  : 'bg-card/55 border-accent/40 shadow-soft glow'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${gift.is_opened ? 'bg-secondary' : 'bg-accent/20'}`}>
                  {gift.is_opened ? (
                    <Package className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <Gift className="w-8 h-8 text-accent" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{gift.sender?.username || 'Кто-то'}</span>
                  </div>
                  {gift.message && (
                    <p className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {gift.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(gift.created_at), { addSuffix: true })}
                  </p>

                  {gift.is_opened && gift.item && (
                    <div className="mt-3 p-2 bg-secondary/50 rounded-lg">
                      <p className="text-sm font-medium">{gift.item.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{gift.item.type}</p>
                    </div>
                  )}

                  {!gift.is_opened && (
                    <button
                      onClick={() => openMutation.mutate(gift.id)}
                      disabled={openMutation.isPending}
                      className="mt-3 w-full py-2 bg-gradient-brand text-white rounded-lg font-medium shadow-soft hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                      Открыть подарок
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {receivedGifts.length === 0 && (
          <div className="glass rounded-xl p-12 text-center">
            <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Подарков пока нет</h3>
            <p className="text-muted-foreground">Полученные подарки появятся здесь</p>
          </div>
        )}

        {showSendModal && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-strong rounded-xl p-6 w-full max-w-md m-4"
            >
              <h3 className="text-xl font-bold mb-4">Отправить подарок</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">ID получателя</label>
                  <input
                    type="text"
                    value={receiverId}
                    onChange={e => setReceiverId(e.target.value)}
                    placeholder="Введите ID пользователя"
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Выберите предмет</label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {inventory.map((inv: { id: number; item?: { id: number; name: string } }) => (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedItem(inv.item?.id || inv.id)}
                        className={`p-2 rounded-lg text-xs ${
                          selectedItem === (inv.item?.id || inv.id)
                            ? 'bg-gradient-brand text-white shadow-soft'
                            : 'bg-secondary hover:bg-muted'
                        }`}
                      >
                        {inv.item?.name || 'Предмет'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Сообщение (необязательно)</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Добавьте сообщение..."
                    className="input-field w-full resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="flex-1 py-2 bg-secondary rounded-lg hover:bg-muted"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => sendMutation.mutate()}
                    disabled={!selectedItem || !receiverId || sendMutation.isPending}
                    className="flex-1 py-2 bg-gradient-brand text-white rounded-lg font-medium shadow-soft hover:brightness-110 disabled:opacity-50 transition-all"
                  >
                    Отправить
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
