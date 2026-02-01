import React, { useState, useEffect } from 'react'
import { Bell, ArrowLeft, Save, Loader2, Volume2, Monitor, Mail, Moon, TestTube } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationsAPI, NotificationPreferences, NOTIFICATION_TYPES } from '../lib/notificationsApi'
import { useToast } from '../components/Toast'

export function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    setLoading(true)
    try {
      const data = await notificationsAPI.getPreferences()
      setPrefs(data)
    } catch (err) {
      console.error('Failed to load preferences:', err)
      toast.error('Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!prefs) return
    setSaving(true)
    try {
      await notificationsAPI.updatePreferences(prefs)
      toast.success('Настройки сохранены')
    } catch (err) {
      console.error('Failed to save preferences:', err)
      toast.error('Не удалось сохранить настройки')
    } finally {
      setSaving(false)
    }
  }

  const handleTestNotification = async () => {
    try {
      await notificationsAPI.sendTest()
      toast.notification('Тестовое уведомление отправлено!')
    } catch (err) {
      console.error('Failed to send test:', err)
      toast.error('Не удалось отправить тестовое уведомление')
    }
  }

  const updatePref = (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return
    setPrefs({ ...prefs, [key]: value })
  }

  const Toggle = ({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${checked ? 'bg-purple-500' : 'bg-gray-600'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
        checked ? 'left-6' : 'left-1'
      }`} />
    </button>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!prefs) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <p className="text-gray-400">Не удалось загрузить настройки</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e] p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-purple-400" />
            <h1 className="text-2xl font-bold text-white">Настройки уведомлений</h1>
          </div>
        </div>

        <div className="space-y-6">
          <section className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-purple-400" />
              Основные настройки
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Звуки уведомлений</p>
                  <p className="text-gray-400 text-sm">Воспроизводить звук при новых уведомлениях</p>
                </div>
                <Toggle
                  checked={prefs.sound_enabled}
                  onChange={v => updatePref('sound_enabled', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-white">Push-уведомления</p>
                    <p className="text-gray-400 text-sm">Показывать уведомления на рабочем столе</p>
                  </div>
                </div>
                <Toggle
                  checked={prefs.desktop_notifications}
                  onChange={v => updatePref('desktop_notifications', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-white">Email-уведомления</p>
                    <p className="text-gray-400 text-sm">Отправлять уведомления на email</p>
                  </div>
                </div>
                <Toggle
                  checked={prefs.email_notifications}
                  onChange={v => updatePref('email_notifications', v)}
                />
              </div>
            </div>
          </section>

          <section className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Типы уведомлений</h2>

            <div className="space-y-3">
              {[
                { key: 'messages', label: 'Личные сообщения', desc: 'Новые сообщения в личных чатах' },
                { key: 'mentions', label: 'Упоминания', desc: 'Когда вас упоминают в сообщениях' },
                { key: 'friend_requests', label: 'Запросы в друзья', desc: 'Новые запросы и принятия' },
                { key: 'guild_invites', label: 'Приглашения в гильдии', desc: 'Приглашения в гильдии' },
                { key: 'achievements', label: 'Достижения', desc: 'Новые достижения и награды' },
                { key: 'daily_rewards', label: 'Ежедневные награды', desc: 'Напоминания о наградах' },
                { key: 'gifts', label: 'Подарки', desc: 'Полученные подарки' },
                { key: 'likes', label: 'Лайки', desc: 'Лайки на ваших публикациях' },
                { key: 'comments', label: 'Комментарии', desc: 'Комментарии к публикациям' },
                { key: 'follows', label: 'Подписки', desc: 'Новые подписчики' },
                { key: 'system', label: 'Системные', desc: 'Важные системные уведомления' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-white">{item.label}</p>
                    <p className="text-gray-400 text-sm">{item.desc}</p>
                  </div>
                  <Toggle
                    checked={prefs[item.key as keyof NotificationPreferences] as boolean}
                    onChange={v => updatePref(item.key as keyof NotificationPreferences, v)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Moon className="w-5 h-5 text-purple-400" />
              Тихие часы
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Включить тихие часы</p>
                  <p className="text-gray-400 text-sm">Отключить уведомления в определённое время</p>
                </div>
                <Toggle
                  checked={prefs.quiet_hours_enabled}
                  onChange={v => updatePref('quiet_hours_enabled', v)}
                />
              </div>

              {prefs.quiet_hours_enabled && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-400 mb-1">Начало</label>
                    <input
                      type="time"
                      value={prefs.quiet_hours_start || '22:00'}
                      onChange={e => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-gray-400 mb-1">Конец</label>
                    <input
                      type="time"
                      value={prefs.quiet_hours_end || '08:00'}
                      onChange={e => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-purple-500 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="flex gap-3">
            <button
              onClick={handleTestNotification}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors flex items-center justify-center gap-2"
            >
              <TestTube className="w-5 h-5" />
              Тестовое уведомление
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Сохранить
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationSettingsPage
