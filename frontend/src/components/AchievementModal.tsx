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
    gradient: 'from-gray-400 to-gray-600',
    glow: 'shadow-gray-500/30',
    text: 'text-foreground',
    label: 'Обычное'
  },
  rare: {
    gradient: 'from-blue-400 to-blue-600',
    glow: 'shadow-blue-500/30',
    text: 'text-blue-300',
    label: 'Редкое'
  },
  epic: {
    gradient: 'from-purple-400 to-purple-600',
    glow: 'shadow-purple-500/30',
    text: 'text-purple-300',
    label: 'Эпическое'
  },
  legendary: {
    gradient: 'from-yellow-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/50',
    text: 'text-yellow-300',
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
          <div className={`w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${rarity.gradient} flex items-center justify-center shadow-2xl ${rarity.glow} animate-bounce`}>
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
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-lg">
                  <Star className="w-5 h-5 text-blue-400" />
                  <span className="text-blue-300 font-bold">+{achievement.xp_reward} XP</span>
                </div>
              )}
              {achievement.coins_reward && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-lg">
                  <span className="text-xl">🪙</span>
                  <span className="text-yellow-300 font-bold">+{achievement.coins_reward}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className={`w-full px-6 py-3 bg-gradient-to-r ${rarity.gradient} rounded-lg text-white font-bold transition-all hover:opacity-90 shadow-lg ${rarity.glow}`}
        >
          Забрать награду
        </button>
      </div>
    </Modal>
  )
}

export default AchievementModal
