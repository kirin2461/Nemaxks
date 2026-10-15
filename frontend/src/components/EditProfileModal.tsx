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
            <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-primary-foreground" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary shadow-lg-brand rounded-full flex items-center justify-center cursor-pointer  transition-all">
              <Camera className="w-4 h-4 text-primary-foreground" />
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
          <label className="block text-sm text-muted-foreground mb-1">Отображаемое имя</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={32}
            className="input-field"
            placeholder="Ваше имя"
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">О себе</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            className="input-field resize-none"
            placeholder="Расскажите о себе..."
          />
          <p className="text-xs text-muted-foreground mt-1">{bio.length}/200</p>
        </div>

        {error && (
          <div className="p-3 bg-danger-soft border border-destructive/30 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-accent border border-emerald-200 rounded-lg text-emerald-600 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            Профиль обновлён!
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-muted/60 hover:bg-muted border border-border/50 rounded-lg text-foreground transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary  shadow-lg-brand rounded-lg text-primary-foreground transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
