import React, { useState } from 'react'
import { Modal } from './Modal'
import { Users, Camera, Loader2, Sparkles, Lock, Globe } from 'lucide-react'
import { guildsAPI } from '../lib/api'

interface CreateGuildModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (guild: any) => void
}

const GUILD_TEMPLATES = [
  { id: 'gaming', name: 'Игровое сообщество', icon: '🎮', channels: ['общий', 'геймплей', 'поиск-команды'] },
  { id: 'study', name: 'Учебная группа', icon: '📚', channels: ['общий', 'вопросы', 'материалы'] },
  { id: 'work', name: 'Рабочее пространство', icon: '💼', channels: ['общий', 'задачи', 'обсуждения'] },
  { id: 'community', name: 'Сообщество по интересам', icon: '🌟', channels: ['общий', 'новости', 'творчество'] },
  { id: 'custom', name: 'Создать с нуля', icon: '✨', channels: ['общий'] },
]

export function CreateGuildModal({ isOpen, onClose, onCreate }: CreateGuildModalProps) {
  const [step, setStep] = useState(1)
  const [template, setTemplate] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [icon, setIcon] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Максимальный размер: 5MB')
        return
      }
      setIcon(file)
      setIconPreview(URL.createObjectURL(file))
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Введите название гильдии')
      return
    }

    setLoading(true)
    setError('')

    try {
      const guild = await guildsAPI.createGuild(name.trim(), description.trim())

      onCreate(guild)
      handleClose()
    } catch (err: any) {
      setError(err.message || 'Не удалось создать гильдию')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setTemplate(null)
    setName('')
    setDescription('')
    setIsPrivate(false)
    setIcon(null)
    setIconPreview('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={step === 1 ? 'Создать гильдию' : 'Настройка гильдии'} size="md">
      {step === 1 ? (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm mb-4">Выберите шаблон для быстрого старта</p>
          
          {GUILD_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setTemplate(t.id)
                setStep(2)
              }}
              className={`w-full p-4 rounded-lg border transition-all flex items-center gap-4 ${
                template === t.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-2xl">
                {t.icon}
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-medium">{t.name}</p>
                <p className="text-gray-400 text-sm">Каналы: {t.channels.join(', ')}</p>
              </div>
              <Sparkles className="w-5 h-5 text-purple-400" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                {iconPreview ? (
                  <img src={iconPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-10 h-10 text-white" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors">
                <Camera className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIconChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Название гильдии *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-colors"
              placeholder="Моя крутая гильдия"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-colors resize-none"
              placeholder="Расскажите о своей гильдии..."
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3">
              {isPrivate ? (
                <Lock className="w-5 h-5 text-yellow-400" />
              ) : (
                <Globe className="w-5 h-5 text-green-400" />
              )}
              <div>
                <p className="text-white font-medium">
                  {isPrivate ? 'Приватная гильдия' : 'Публичная гильдия'}
                </p>
                <p className="text-gray-400 text-sm">
                  {isPrivate ? 'Только по приглашению' : 'Любой может присоединиться'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isPrivate ? 'bg-purple-500' : 'bg-gray-600'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                isPrivate ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
            >
              Назад
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Создание...
                </>
              ) : (
                'Создать гильдию'
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default CreateGuildModal
