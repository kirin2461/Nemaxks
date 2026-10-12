import React, { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Star, Gift, Coins, Gem, Sparkles } from 'lucide-react'

interface Reward {
  type: 'coins' | 'gems' | 'xp' | 'item'
  amount: number
  name?: string
}

interface LevelUpModalProps {
  isOpen: boolean
  onClose: () => void
  newLevel: number
  rewards?: Reward[]
}

export function LevelUpModal({ isOpen, onClose, newLevel, rewards = [] }: LevelUpModalProps) {
  const [showRewards, setShowRewards] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowRewards(false)
      const timer = setTimeout(() => setShowRewards(true), 800)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'coins': return <Coins className="w-5 h-5 text-accent" />
      case 'gems': return <Gem className="w-5 h-5 text-primary" />
      case 'xp': return <Star className="w-5 h-5 text-accent" />
      default: return <Gift className="w-5 h-5 text-accent" />
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="text-center py-4">
        <div className="relative w-32 h-32 mx-auto mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary rounded-full animate-pulse opacity-50 blur-xl" />
          <div className="relative w-32 h-32 bg-gradient-brand rounded-full flex items-center justify-center border-4 border-primary/40 shadow-2xl">
            <div className="text-center">
              <p className="text-accent/80 text-sm font-medium">УРОВЕНЬ</p>
              <p className="text-5xl font-black text-foreground drop-shadow-lg">{newLevel}</p>
            </div>
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-accent/80 animate-bounce" />
          <Sparkles className="absolute -bottom-1 -left-3 w-6 h-6 text-accent/80 animate-bounce delay-100" />
        </div>

        <h2 className="text-2xl font-black gradient-brand-text mb-2">
          УРОВЕНЬ ПОВЫШЕН!
        </h2>
        <p className="text-muted-foreground mb-6">
          Поздравляем! Вы достигли {newLevel} уровня
        </p>

        {rewards.length > 0 && (
          <div className={`transition-all duration-500 ${showRewards ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <p className="text-sm text-muted-foreground mb-3">Ваши награды:</p>
            <div className="space-y-2">
              {rewards.map((reward, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/60 rounded-lg border border-border"
                  style={{ 
                    animationDelay: `${index * 100}ms`,
                    animation: showRewards ? 'slideIn 0.3s ease forwards' : 'none'
                  }}
                >
                  <div className="flex items-center gap-3">
                    {getRewardIcon(reward.type)}
                    <span className="text-foreground">
                      {reward.name || (reward.type === 'coins' ? 'Монеты' : reward.type === 'gems' ? 'Кристаллы' : 'XP')}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-foreground">+{reward.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full px-6 py-3 bg-gradient-brand hover:brightness-110 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-glow"
        >
          Отлично!
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </Modal>
  )
}

export default LevelUpModal
