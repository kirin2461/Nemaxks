import React, { useState } from 'react'
import { Modal } from './Modal'
import { Gift, Coins, Gem, Loader2, Check, User } from 'lucide-react'

interface GiftItem {
  id: string
  name: string
  icon: string
  price: number
  currency: 'coins' | 'gems'
  description?: string
}

interface GiftSendModalProps {
  isOpen: boolean
  onClose: () => void
  recipientId: number
  recipientName: string
  recipientAvatar?: string
  gifts: GiftItem[]
  userBalance: { coins: number; gems: number }
  onSend: (giftId: string, message?: string) => Promise<void>
}

export function GiftSendModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  recipientAvatar,
  gifts,
  userBalance,
  onSend
}: GiftSendModalProps) {
  const [selectedGift, setSelectedGift] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const selectedGiftData = gifts.find(g => g.id === selectedGift)
  const canAfford = selectedGiftData
    ? selectedGiftData.currency === 'coins'
      ? userBalance.coins >= selectedGiftData.price
      : userBalance.gems >= selectedGiftData.price
    : false

  const handleSend = async () => {
    if (!selectedGift || !canAfford) return

    setLoading(true)
    try {
      await onSend(selectedGift, message.trim() || undefined)
      setSent(true)
    } catch (err) {
      console.error('Gift send failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedGift(null)
    setMessage('')
    setSent(false)
    onClose()
  }

  if (sent) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="sm">
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Подарок отправлен!</h2>
          <p className="text-muted-foreground">
            {recipientName} получит ваш подарок
          </p>
          <button
            onClick={handleClose}
            className="mt-6 w-full px-4 py-2 bg-primary hover:bg-emerald-800 rounded-lg text-white shadow-soft transition-all"
          >
            Закрыть
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Отправить подарок" size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-muted/60 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center overflow-hidden">
            {recipientAvatar ? (
              <img src={recipientAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <p className="text-foreground font-medium">{recipientName}</p>
            <p className="text-muted-foreground text-sm">Получатель подарка</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/60 rounded-lg">
          <span className="text-muted-foreground">Ваш баланс:</span>
          <div className="flex gap-4">
            <span className="text-emerald-700 font-bold">{userBalance.coins} 🪙</span>
            <span className="text-primary font-bold">{userBalance.gems} 💎</span>
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-2">Выберите подарок</label>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {gifts.map(gift => {
              const affordable = gift.currency === 'coins'
                ? userBalance.coins >= gift.price
                : userBalance.gems >= gift.price

              return (
                <button
                  key={gift.id}
                  onClick={() => setSelectedGift(gift.id)}
                  disabled={!affordable}
                  className={`relative p-3 rounded-lg border transition-all ${
                    selectedGift === gift.id
                      ? 'border-primary/40 bg-primary/15 ring-2 ring-primary/30'
                      : affordable
                      ? 'border-border bg-muted/60 hover:bg-muted'
                      : 'border-border/50 bg-muted/60 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="text-3xl mb-1">{gift.icon}</div>
                  <p className="text-xs text-foreground truncate">{gift.name}</p>
                  <p className={`text-xs ${gift.currency === 'coins' ? 'text-emerald-700' : 'text-primary'}`}>
                    {gift.price} {gift.currency === 'coins' ? '🪙' : '💎'}
                  </p>
                  {selectedGift === gift.id && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-2">Добавить сообщение (необязательно)</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={200}
            rows={2}
            className="w-full px-4 py-2 bg-muted/60 border border-border rounded-lg text-foreground focus:border-primary/40 outline-none transition-colors resize-none"
            placeholder="Напишите что-нибудь приятное..."
          />
        </div>

        {selectedGiftData && !canAfford && (
          <div className="p-3 bg-danger-soft border border-destructive/30 rounded-lg text-destructive text-sm">
            Недостаточно {selectedGiftData.currency === 'coins' ? 'монет' : 'кристаллов'}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-muted/60 hover:bg-muted rounded-lg text-foreground transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !selectedGift || !canAfford}
            className="flex-1 px-4 py-2 bg-primary hover:bg-emerald-800 rounded-lg text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-soft hover:shadow-lg-brand"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4" />
                Отправить
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default GiftSendModal
