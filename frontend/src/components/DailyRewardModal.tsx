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
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-accent/20 to-accent/20 rounded-lg border border-accent/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold">Серия: {currentStreak} дней</p>
              <p className="text-accent/80 text-sm">Заходите каждый день для бонусов!</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-accent">x{Math.min(currentStreak, 7)}</p>
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
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-border bg-muted/60'
              }`}
            >
              {reward.claimed && (
                <CheckCircle className="absolute -top-1 -right-1 w-5 h-5 text-green-400" />
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
                  <Coins className="w-5 h-5 text-accent" />
                )}
              </div>
              
              <p className={`text-sm font-bold ${
                reward.claimed ? 'text-muted-foreground' : 'text-white'
              }`}>
                {reward.special || (reward.gems ? `${reward.gems}💎` : `${reward.coins}🪙`)}
              </p>
            </div>
          ))}
        </div>

        {claimed && claimedReward && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-green-400 font-bold mb-2">Награда получена!</p>
            <div className="flex justify-center gap-4">
              {claimedReward.coins && (
                <span className="text-accent">+{claimedReward.coins} 🪙</span>
              )}
              {claimedReward.gems && (
                <span className="text-primary">+{claimedReward.gems} 💎</span>
              )}
              {claimedReward.xp && (
                <span className="text-accent">+{claimedReward.xp} XP</span>
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
            className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary hover:to-accent rounded-lg text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
