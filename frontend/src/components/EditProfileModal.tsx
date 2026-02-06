import React, { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { User, Camera, Loader2, Check } from 'lucide-react'
import { userAPI } from '../lib/api'

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: number
    username: string
    display_name?: string
    bio?: string
    avatar?: string
  }
  onUpdate: (data: any) => void
}

export function EditProfileModal({ isOpen, onClose, user, onUpdate }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen && user) {
      setDisplayName(user.display_name || user.username)
      setBio(user.bio || '')
      setAvatarPreview(user.avatar || '')
      setError('')
      setSuccess(false)
    }
  }, [isOpen, user])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Максимальный размер файла: 5MB')
        return
      }
      setAvatar(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const updateData: any = {}
      
      if (displayName !== user.display_name) {
        updateData.display_name = displayName
      }
      if (bio !== user.bio) {
        updateData.bio = bio
      }

      if (Object.keys(updateData).length > 0) {
        await userAPI.updateProfile(updateData)
      }

      if (avatar) {
        const formData = new FormData()
        formData.append('avatar', avatar)
        await fetch('/api/upload/avatar', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        })
      }

      setSuccess(true)
      onUpdate({ ...user, display_name: displayName, bio, avatar: avatarPreview })
      setTimeout(() => onClose(), 1000)
    } catch (err: any) {
      setError(err.message || 'Не удалось обновить профиль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактировать профиль" size="md">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-white" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-600 transition-colors">
              <Camera className="w-4 h-4 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Отображаемое имя</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={32}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-colors"
            placeholder="Ваше имя"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">О себе</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none transition-colors resize-none"
            placeholder="Расскажите о себе..."
          />
          <p className="text-xs text-gray-500 mt-1">{bio.length}/200</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            Профиль обновлён!
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              'Сохранить'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default EditProfileModal
