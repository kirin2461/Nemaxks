import React, { useState, useEffect } from 'react'
import { Bell, ArrowLeft, Save, Loader2, Volume2, Monitor, Mail, Moon, TestTube } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationsAPI, NotificationPreferences } from '../lib/notificationsApi'
import { useToast } from '../components/Toast'
import { getSoundsEnabled, setSoundsEnabled, playNotificationSound } from '../lib/notificationSounds'
import { cn } from '@/lib/utils'

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:pointer-events-none',
        checked ? 'bg-primary' : 'bg-graphite-300'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow-soft',
          'transition-transform duration-150 ease-out-expo',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

function SettingRow({
  icon: Icon,
  label,
  hint,
  control,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  hint?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="w-5 h-5 text-graphite-400 shrink-0" strokeWidth={1.75} />}
        <div className="min-w-0">
          <p className="text-sm text-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  // Локальный переключатель звуков (на этом устройстве), localStorage, по умолчанию включён
  const [localSounds, setLocalSounds] = useState<boolean>(() => getSoundsEnabled())

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="skeleton h-8 w-64" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!prefs) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Не удалось загрузить настройки</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 animate-rise-in">
      <div className="max-w-2xl mx-auto pb-24">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 grid place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-150"
            title="Назад"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" strokeWidth={1.75} />
            <h1 className="text-2xl font-display font-bold text-graphite-900 tracking-[-0.015em]">
              Настройки уведомлений
            </h1>
          </div>
        </div>

        <div className="space-y-6">
          <section
            className="rounded-xl border border-border bg-card shadow-none overflow-hidden animate-rise-in"
            style={{ animationDelay: '60ms' }}
          >
            <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
              <Volume2 className="w-5 h-5 text-primary" strokeWidth={1.75} />
              <h2 className="text-sm font-semibold text-foreground">Основные настройки</h2>
            </div>

            <SettingRow
              label="Звуки уведомлений"
              hint="Воспроизводить звук при новых уведомлениях"
              control={
                <Toggle
                  checked={prefs.sound_enabled}
                  onChange={v => updatePref('sound_enabled', v)}
                />
              }
            />
            <SettingRow
              icon={Volume2}
              label="Звуковые уведомления (на этом устройстве)"
              hint="Короткий звук, когда вкладка скрыта или чат не открыт"
              control={
                <Toggle
                  checked={localSounds}
                  onChange={v => {
                    setLocalSounds(v)
                    setSoundsEnabled(v)
                    if (v) {
                      // Даём услышать звук сразу после включения
                      setTimeout(() => playNotificationSound('message'), 50)
                    }
                  }}
                />
              }
            />
            <SettingRow
              icon={Monitor}
              label="Push-уведомления"
              hint="Показывать уведомления на рабочем столе"
              control={
                <Toggle
                  checked={prefs.desktop_notifications}
                  onChange={v => updatePref('desktop_notifications', v)}
                />
              }
            />
            <SettingRow
              icon={Mail}
              label="Email-уведомления"
              hint="Отправлять уведомления на email"
              control={
                <Toggle
                  checked={prefs.email_notifications}
                  onChange={v => updatePref('email_notifications', v)}
                />
              }
            />
          </section>

          <section
            className="rounded-xl border border-border bg-card shadow-none overflow-hidden animate-rise-in"
            style={{ animationDelay: '120ms' }}
          >
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Типы уведомлений</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Выберите, о чём вас уведомлять</p>
            </div>

            <div>
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
                <SettingRow
                  key={item.key}
                  label={item.label}
                  hint={item.desc}
                  control={
                    <Toggle
                      checked={prefs[item.key as keyof NotificationPreferences] as boolean}
                      onChange={v => updatePref(item.key as keyof NotificationPreferences, v)}
                    />
                  }
                />
              ))}
            </div>
          </section>

          <section
            className="rounded-xl border border-border bg-card shadow-none overflow-hidden animate-rise-in"
            style={{ animationDelay: '180ms' }}
          >
            <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
              <Moon className="w-5 h-5 text-primary" strokeWidth={1.75} />
              <h2 className="text-sm font-semibold text-foreground">Тихие часы</h2>
            </div>

            <SettingRow
              label="Включить тихие часы"
              hint="Отключить уведомления в определённое время"
              control={
                <Toggle
                  checked={prefs.quiet_hours_enabled}
                  onChange={v => updatePref('quiet_hours_enabled', v)}
                />
              }
            />

            {prefs.quiet_hours_enabled && (
              <div className="px-5 py-4 flex items-end gap-3 animate-rise-in">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Начало</label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_start || '22:00'}
                    onChange={e => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                    className="input-field w-24 font-mono"
                  />
                </div>
                <span className="text-graphite-400 pb-2.5">—</span>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Конец</label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_end || '08:00'}
                    onChange={e => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                    className="input-field w-24 font-mono"
                  />
                </div>
              </div>
            )}
          </section>

        </div>

        {/* Save bar */}
        <div className="sticky bottom-4 mt-6 animate-drawer-up">
          <div className="bg-card border border-border rounded-xl shadow-pop p-4 flex items-center justify-end gap-2">
            <button
              onClick={handleTestNotification}
              className={cn(
                'h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium',
                'border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground hover:border-emerald-200',
                'transition-all duration-150 active:scale-[0.97]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              )}
            >
              <TestTube className="w-4 h-4" strokeWidth={1.75} />
              Тестовое уведомление
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium',
                'bg-primary text-primary-foreground shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand',
                'transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              )}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" strokeWidth={1.75} />
              )}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationSettingsPage
