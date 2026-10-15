import React, { useState } from 'react'
import { Modal } from './Modal'
import { Gift, Coins, Gem, Star, Calendar, Loader2, CheckCircle } from 'lucide-react'

interface DailyReward {
  day: number
  coins?: number
  gems?: number
  xp?: number
  special?: string
  claimed: boolean
  isToday: boolean
}

interface DailyRewardModalProps {
  isOpen: boolean
  onClose: () => void
  rewards: DailyReward[]
  currentStreak: number
  onClaim: () => Promise<{ coins?: number; gems?: number; xp?: number }>
}

export function DailyRewardModal({
  isOpen,
  onClose,
  rewards,
  currentStreak,
  onClaim
}: DailyRewardModalProps) {
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimedReward, setClaimedReward] = useState<any>(null)

  const handleClaim = async () => {
    setLoading(true)
    try {
      const reward = await onClaim()
      setClaimedReward(reward)
      setClaimed(true)
    } catch (err) {
      console.error('Claim failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const todayReward = rewards.find(r => r.isToday)
  const canClaim = todayReward && !todayReward.claimed && !claimed

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ежедневные награды" size="lg">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-accent rounded-lg border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-soft">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-foreground font-bold">Серия: {currentStreak} дней</p>
              <p className="text-emerald-700 text-sm">Заходите каждый день для бонусов!</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-emerald-700">x{Math.min(currentStreak, 7)}</p>
            <p className="text-xs text-muted-foreground">множитель</p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {rewards.slice(0, 7).map((reward) => (
            <div
              key={reward.day}
              className={`relative p-3 rounded-lg border text-center transition-all ${
                reward.isToday
                  ? 'border-primary/40 bg-primary/15 ring-2 ring-primary/50'
                  : reward.claimed
                  ? 'border-emerald-300 bg-accent'
                  : 'border-border bg-muted/60'
              }`}
            >
              {reward.claimed && (
                <CheckCircle className="absolute -top-1 -right-1 w-5 h-5 text-emerald-600" />
              )}
              
              <p className={`text-xs font-medium mb-2 ${
                reward.isToday ? 'text-primary/80' : 'text-muted-foreground'
              }`}>
                День {reward.day}
              </p>
              
              <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-muted flex items-center justify-center">
                {reward.special ? (
                  <span className="text-xl">{reward.special}</span>
                ) : reward.gems ? (
                  <Gem className="w-5 h-5 text-primary" />
                ) : (
                  <Coins className="w-5 h-5 text-emerald-700" />
                )}
              </div>
              
              <p className={`text-sm font-bold ${
                reward.claimed ? 'text-muted-foreground' : 'text-foreground'
              }`}>
                {reward.special || (reward.gems ? `${reward.gems}💎` : `${reward.coins}🪙`)}
              </p>
            </div>
          ))}
        </div>

        {claimed && claimedReward && (
          <div className="p-4 bg-accent border border-emerald-200 rounded-lg text-center">
            <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-emerald-600 font-bold mb-2">Награда получена!</p>
            <div className="flex justify-center gap-4">
              {claimedReward.coins && (
                <span className="text-emerald-700">+{claimedReward.coins} 🪙</span>
              )}
              {claimedReward.gems && (
                <span className="text-primary">+{claimedReward.gems} 💎</span>
              )}
              {claimedReward.xp && (
                <span className="text-emerald-700">+{claimedReward.xp} XP</span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-muted/60 hover:bg-muted rounded-lg text-foreground transition-colors"
          >
            Закрыть
          </button>
          <button
            onClick={handleClaim}
            disabled={!canClaim || loading}
            className="flex-1 px-4 py-3 bg-primary hover:bg-emerald-800 rounded-lg text-white font-bold transition-all shadow-soft hover:shadow-lg-brand disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Получение...
              </>
            ) : claimed ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Получено!
              </>
            ) : (
              <>
                <Gift className="w-5 h-5" />
                Забрать награду
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default DailyRewardModal
