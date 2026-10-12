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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Gift className="w-8 h-8 text-pink-400" />
            <h1 className="text-3xl font-bold">Gifts</h1>
            {unopenedCount > 0 && (
              <span className="px-2 py-1 bg-pink-600 rounded-full text-sm font-medium">
                {unopenedCount} new
              </span>
            )}
          </div>
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 rounded-lg hover:bg-pink-700"
          >
            <Send className="w-4 h-4" />
            Send Gift
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {receivedGifts.map((gift: UserGift) => (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl p-6 ${
                gift.is_opened ? 'bg-card' : 'bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${gift.is_opened ? 'bg-secondary' : 'bg-pink-600/20'}`}>
                  {gift.is_opened ? (
                    <Package className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <Gift className="w-8 h-8 text-pink-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{gift.sender?.username || 'Someone'}</span>
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
                      className="mt-3 w-full py-2 bg-pink-600 rounded-lg font-medium hover:bg-pink-700 disabled:opacity-50"
                    >
                      Open Gift
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {receivedGifts.length === 0 && (
          <div className="bg-card rounded-xl p-12 text-center">
            <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No gifts yet</h3>
            <p className="text-muted-foreground">Gifts you receive will appear here</p>
          </div>
        )}

        {showSendModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-xl p-6 w-full max-w-md m-4"
            >
              <h3 className="text-xl font-bold mb-4">Send a Gift</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Recipient User ID</label>
                  <input
                    type="text"
                    value={receiverId}
                    onChange={e => setReceiverId(e.target.value)}
                    placeholder="Enter user ID"
                    className="w-full px-4 py-2 bg-secondary rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Select Item</label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {inventory.map((inv: { id: number; item?: { id: number; name: string } }) => (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedItem(inv.item?.id || inv.id)}
                        className={`p-2 rounded-lg text-xs ${
                          selectedItem === (inv.item?.id || inv.id)
                            ? 'bg-pink-600'
                            : 'bg-secondary hover:bg-muted'
                        }`}
                      >
                        {inv.item?.name || 'Item'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Message (optional)</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Add a message..."
                    className="w-full px-4 py-2 bg-secondary rounded-lg focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="flex-1 py-2 bg-secondary rounded-lg hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => sendMutation.mutate()}
                    disabled={!selectedItem || !receiverId || sendMutation.isPending}
                    className="flex-1 py-2 bg-pink-600 rounded-lg font-medium hover:bg-pink-700 disabled:opacity-50"
                  >
                    Send Gift
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
