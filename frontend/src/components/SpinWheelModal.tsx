import React, { useState, useRef } from 'react'
import { Modal } from './Modal'
import { Loader2, Gift } from 'lucide-react'

interface SpinWheelModalProps {
  isOpen: boolean
  onClose: () => void
  onSpin: () => Promise<{ prize: string; amount: number; type: string }>
  canSpin: boolean
  nextSpinTime?: string
}

const WHEEL_SEGMENTS = [
  { label: '100 🪙', color: '#f59e0b', value: 100 },
  { label: '5 💎', color: '#8b5cf6', value: 5 },
  { label: '50 🪙', color: '#eab308', value: 50 },
  { label: '🎁', color: '#ec4899', value: 0 },
  { label: '200 🪙', color: '#f97316', value: 200 },
  { label: '10 💎', color: '#a855f7', value: 10 },
  { label: '25 🪙', color: '#fbbf24', value: 25 },
  { label: '500 XP', color: '#3b82f6', value: 500 },
]

export function SpinWheelModal({
  isOpen,
  onClose,
  onSpin,
  canSpin,
  nextSpinTime
}: SpinWheelModalProps) {
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<{ prize: string; amount: number; type: string } | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)

  const handleSpin = async () => {
    if (!canSpin || spinning) return

    setSpinning(true)
    setResult(null)

    try {
      const prize = await onSpin()
      
      const spins = 5 + Math.random() * 3
      const segmentAngle = 360 / WHEEL_SEGMENTS.length
      const targetRotation = rotation + (spins * 360) + (Math.random() * 360)
      
      setRotation(targetRotation)
      
      setTimeout(() => {
        setResult(prize)
        setSpinning(false)
      }, 4000)
    } catch (err) {
      setSpinning(false)
      console.error('Spin failed:', err)
    }
  }

  const segmentAngle = 360 / WHEEL_SEGMENTS.length

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Колесо фортуны" size="md">
      <div className="text-center">
        <div className="relative w-64 h-64 mx-auto mb-6">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg" />
          </div>
          
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full border-4 border-white/20 shadow-2xl overflow-hidden"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)' : 'none'
            }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {WHEEL_SEGMENTS.map((segment, index) => {
                const startAngle = index * segmentAngle - 90
                const endAngle = (index + 1) * segmentAngle - 90
                const startRad = (startAngle * Math.PI) / 180
                const endRad = (endAngle * Math.PI) / 180
                
                const x1 = 50 + 50 * Math.cos(startRad)
                const y1 = 50 + 50 * Math.sin(startRad)
                const x2 = 50 + 50 * Math.cos(endRad)
                const y2 = 50 + 50 * Math.sin(endRad)
                
                const largeArc = segmentAngle > 180 ? 1 : 0
                
                const textAngle = startAngle + segmentAngle / 2
                const textRad = (textAngle * Math.PI) / 180
                const textX = 50 + 30 * Math.cos(textRad)
                const textY = 50 + 30 * Math.sin(textRad)
                
                return (
                  <g key={index}>
                    <path
                      d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={segment.color}
                      stroke="#fff"
                      strokeWidth="0.5"
                    />
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="6"
                      fontWeight="bold"
                      transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
                    >
                      {segment.label}
                    </text>
                  </g>
                )
              })}
              <circle cx="50" cy="50" r="8" fill="#1a1a2e" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {result && !spinning && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30 animate-in fade-in zoom-in">
            <Gift className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-white font-bold text-lg mb-1">Поздравляем!</p>
            <p className="text-purple-300">Вы выиграли: {result.prize}</p>
          </div>
        )}

        {!canSpin && nextSpinTime && !spinning && (
          <p className="text-gray-400 text-sm mb-4">
            Следующее вращение доступно: {nextSpinTime}
          </p>
        )}

        <button
          onClick={handleSpin}
          disabled={!canSpin || spinning}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {spinning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Крутится...
            </>
          ) : (
            'Крутить колесо!'
          )}
        </button>
      </div>
    </Modal>
  )
}

export default SpinWheelModal
