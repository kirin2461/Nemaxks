import React, { useState, useRef, useEffect } from 'react'
import { Modal } from './Modal'
import { Shield, Loader2 } from 'lucide-react'

interface TwoFactorModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (code: string) => Promise<void>
  error?: string
}

export function TwoFactorModal({ isOpen, onClose, onVerify, error }: TwoFactorModalProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (isOpen) {
      setCode(['', '', '', '', '', ''])
      setLocalError('')
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [isOpen])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    setLocalError('')

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (newCode.every(c => c) && newCode.join('').length === 6) {
      handleSubmit(newCode.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData.length === 6) {
      setCode(pastedData.split(''))
      handleSubmit(pastedData)
    }
  }

  const handleSubmit = async (codeStr: string) => {
    setLoading(true)
    try {
      await onVerify(codeStr)
    } catch (err: any) {
      setLocalError(err.message || 'Неверный код')
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-purple-400" />
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2">Двухфакторная аутентификация</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Введите 6-значный код из приложения-аутентификатора
        </p>

        <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              disabled={loading}
              className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/20 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 outline-none transition-all disabled:opacity-50"
            />
          ))}
        </div>

        {(error || localError) && (
          <p className="text-red-400 text-sm mb-4">{error || localError}</p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 text-purple-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Проверка...</span>
          </div>
        )}

        <p className="text-muted-foreground text-xs mt-4">
          Не получили код? Проверьте синхронизацию времени в приложении
        </p>
      </div>
    </Modal>
  )
}

export default TwoFactorModal
