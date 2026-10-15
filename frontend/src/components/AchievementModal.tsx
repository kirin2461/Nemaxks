import React from 'react'
import { Modal } from './Modal'
import { Trophy, Star, Sparkles } from 'lucide-react'

interface Achievement {
  id: string
  name: string
  description: string
  icon?: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  xp_reward?: number
  coins_reward?: number
}

interface AchievementModalProps {
  isOpen: boolean
  onClose: () => void
  achievement: Achievement | null
}

const RARITY_STYLES = {
  common: {
    solid: 'bg-graphite-200',
    glow: 'shadow-soft',
    text: 'text-foreground',
    label: 'Обычное'
  },
  rare: {
    solid: 'bg-emerald-100',
    glow: 'shadow-lg-brand',
    text: 'text-emerald-700',
    label: 'Редкое'
  },
  epic: {
    solid: 'bg-emerald-600',
    glow: 'shadow-lg-brand',
    text: 'text-emerald-700',
    label: 'Эпическое'
  },
  legendary: {
    solid: 'bg-primary',
    glow: 'shadow-lg-brand',
    text: 'text-emerald-700',
    label: 'Легендарное'
  }
}

export function AchievementModal({ isOpen, onClose, achievement }: AchievementModalProps) {
  if (!achievement) return null

  const rarity = RARITY_STYLES[achievement.rarity] || RARITY_STYLES.common

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="text-center py-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <Sparkles
              key={i}
              className={`absolute w-4 h-4 ${rarity.text} animate-pulse`}
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        <div className="relative">
          <div className={`w-24 h-24 mx-auto mb-4 rounded-2xl ${rarity.solid} flex items-center justify-center shadow-pop animate-scale-in`}>
            {achievement.icon ? (
              <span className="text-4xl">{achievement.icon}</span>
            ) : (
              <Trophy className="w-12 h-12 text-white" />
            )}
          </div>

          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${rarity.text} bg-muted mb-3`}>
            {rarity.label}
          </div>

          <h2 className="text-2xl font-black text-foreground mb-2">
            {achievement.name}
          </h2>
          <p className="text-muted-foreground mb-6">
            {achievement.description}
          </p>

          {(achievement.xp_reward || achievement.coins_reward) && (
            <div className="flex justify-center gap-4 mb-6">
              {achievement.xp_reward && (
                <div className="flex items-center gap-2 px-4 py-2 bg-accent rounded-lg">
                  <Star className="w-5 h-5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">+{achievement.xp_reward} XP</span>
                </div>
              )}
              {achievement.coins_reward && (
                <div className="flex items-center gap-2 px-4 py-2 bg-accent rounded-lg">
                  <span className="text-xl">🪙</span>
                  <span className="text-emerald-700 font-bold">+{achievement.coins_reward}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full px-6 h-12 bg-primary rounded-lg text-primary-foreground font-bold transition-all duration-150 hover:bg-emerald-800 active:scale-[0.97] shadow-soft hover:shadow-lg-brand"
        >
          Забрать награду
        </button>
      </div>
    </Modal>
  )
}

export default AchievementModal
