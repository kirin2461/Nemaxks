import React, { useState } from 'react'
import { Modal } from './Modal'
import { 
  Settings, Bell, Lock, Palette, Globe, Volume2, VolumeX,
  Moon, Sun, Shield, Eye, EyeOff, Smartphone, LogOut, Trash2
} from 'lucide-react'
import { useStore } from '../lib/store'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabId = 'general' | 'notifications' | 'privacy' | 'appearance'

const TABS = [
  { id: 'general', label: 'Основные', icon: Settings },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'privacy', label: 'Приватность', icon: Lock },
  { id: 'appearance', label: 'Внешний вид', icon: Palette },
]

const THEMES = [
  { id: 'dark', name: 'Тёмная', preview: 'bg-background' },
  { id: 'light', name: 'Светлая', preview: 'bg-gray-100' },
  { id: 'cosmic', name: 'Космос', preview: 'bg-gradient-to-br from-purple-900 to-blue-900' },
  { id: 'midnight-ocean', name: 'Океан', preview: 'bg-gradient-to-br from-blue-900 to-cyan-900' },
  { id: 'neon-tokyo', name: 'Неон', preview: 'bg-gradient-to-br from-pink-900 to-purple-900' },
  { id: 'forest-night', name: 'Лес', preview: 'bg-gradient-to-br from-green-900 to-emerald-900' },
]

const LANGUAGES = [
  { id: 'ru', name: 'Русский', flag: '🇷🇺' },
  { id: 'en', name: 'English', flag: '🇺🇸' },
  { id: 'zh', name: '中文', flag: '🇨🇳' },
]

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const { theme, setTheme, soundEnabled, setSoundEnabled, logout } = useStore()
  
  const [settings, setSettings] = useState({
    language: 'ru',
    showOnlineStatus: true,
    showLastSeen: true,
    allowDMs: true,
    showReadReceipts: true,
    notifyMessages: true,
    notifyMentions: true,
    notifyFriends: true,
    notifyGuilds: true,
    desktopNotifications: true,
    twoFactorEnabled: false,
  })

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-purple-500' : 'bg-muted'
      }`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
        checked ? 'left-6' : 'left-1'
      }`} />
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Настройки" size="xl">
      <div className="flex gap-4 -mx-4">
        <div className="w-48 border-r border-white/10 pr-4 pl-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
          
          <div className="border-t border-white/10 mt-4 pt-4">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">Выйти</span>
            </button>
          </div>
        </div>

        <div className="flex-1 pr-4 max-h-96 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Основные настройки</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Язык</label>
                  <div className="flex gap-2">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => updateSetting('language', lang.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          settings.language === lang.id
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/5 text-foreground hover:bg-white/10'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    {soundEnabled ? <Volume2 className="w-5 h-5 text-muted-foreground" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
                    <div>
                      <p className="text-white">Звуки уведомлений</p>
                      <p className="text-muted-foreground text-sm">Воспроизводить звук при новых сообщениях</p>
                    </div>
                  </div>
                  <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Уведомления</h3>
              
              {[
                { key: 'notifyMessages', label: 'Личные сообщения', desc: 'Уведомлять о новых сообщениях' },
                { key: 'notifyMentions', label: 'Упоминания', desc: 'Уведомлять когда вас упоминают' },
                { key: 'notifyFriends', label: 'Друзья', desc: 'Запросы в друзья и активность' },
                { key: 'notifyGuilds', label: 'Гильдии', desc: 'Новости и события гильдий' },
                { key: 'desktopNotifications', label: 'Push-уведомления', desc: 'Показывать уведомления на рабочем столе' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white">{item.label}</p>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </div>
                  <Toggle 
                    checked={settings[item.key as keyof typeof settings] as boolean} 
                    onChange={v => updateSetting(item.key, v)} 
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Приватность</h3>
              
              {[
                { key: 'showOnlineStatus', label: 'Статус онлайн', desc: 'Показывать когда вы в сети', icon: Eye },
                { key: 'showLastSeen', label: 'Был в сети', desc: 'Показывать время последнего визита', icon: Eye },
                { key: 'allowDMs', label: 'Личные сообщения', desc: 'Разрешить сообщения от всех', icon: Lock },
                { key: 'showReadReceipts', label: 'Прочитано', desc: 'Показывать что сообщение прочитано', icon: Eye },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-white">{item.label}</p>
                      <p className="text-muted-foreground text-sm">{item.desc}</p>
                    </div>
                  </div>
                  <Toggle 
                    checked={settings[item.key as keyof typeof settings] as boolean} 
                    onChange={v => updateSetting(item.key, v)} 
                  />
                </div>
              ))}

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-white">Двухфакторная аутентификация</p>
                    <p className="text-muted-foreground text-sm">Дополнительная защита аккаунта</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-purple-500 hover:bg-purple-600 rounded text-white text-sm transition-colors">
                  Настроить
                </button>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Внешний вид</h3>
              
              <div>
                <label className="block text-sm text-muted-foreground mb-3">Тема оформления</label>
                <div className="grid grid-cols-3 gap-3">
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as any)}
                      className={`p-3 rounded-lg border transition-all ${
                        theme === t.id
                          ? 'border-purple-500 ring-2 ring-purple-500/30'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className={`w-full h-12 rounded-lg mb-2 ${t.preview}`} />
                      <p className="text-sm text-white">{t.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default SettingsModal
