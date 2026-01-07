import { useState, useEffect } from 'react'
import { Layout } from '@/components/Layout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { settingsAPI, type Settings as SettingsType } from '@/lib/api'
import { getLanguage, setLanguage } from '@/lib/i18n'
import {
  Bell,
  Shield,
  Globe,
  Link,
  Mic,
  Bot,
  Save,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await settingsAPI.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    try {
      setLoading(true)
      await settingsAPI.updateSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSetting = (key: keyof SettingsType) => {
    if (!settings) return
    setSettings({
      ...settings,
      [key]: !settings[key],
    })
  }

  const SettingToggle = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string
    description: string
    checked: boolean
    onChange: () => void
  }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  )

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Language */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <CardTitle>Language / Язык</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <p className="font-medium mb-3">Display Language</p>
                <select 
                  className="input-field"
                  value={getLanguage()}
                  onChange={(e) => {
                    setLanguage(e.target.value as 'ru' | 'en')
                    window.location.reload()
                  }}
                >
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {settings && (
                <>
                  <SettingToggle
                    label="Enable Notifications"
                    description="Receive notifications for new messages and mentions"
                    checked={settings.notifications_enabled}
                    onChange={() => toggleSetting('notifications_enabled')}
                  />
                  <SettingToggle
                    label="Sound Notifications"
                    description="Play a sound when you receive notifications"
                    checked={settings.sound_enabled}
                    onChange={() => toggleSetting('sound_enabled')}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Voice & Audio */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                <CardTitle>Voice & Audio</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {settings && (
                <SettingToggle
                  label="Voice Messages"
                  description="Enable voice message recording and playback"
                  checked={settings.voice_enabled}
                  onChange={() => toggleSetting('voice_enabled')}
                />
              )}
            </CardContent>
          </Card>

          {/* Jarvis AI */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <CardTitle>Jarvis AI Assistant</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Configure your AI assistant preferences
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">Personality Mode</p>
                  <select className="input-field">
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Wake Word</p>
                  <Input
                    placeholder="e.g., Jarvis, Hey Assistant"
                    defaultValue="Jarvis"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-4 pt-6 border-t border-border">
                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">API Keys (Custom AI)</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Hugging Face API Key</p>
                    <Input
                      type="password"
                      placeholder="hf_..."
                      value={settings?.huggingface_key || ''}
                      onChange={(e) => settings && setSettings({ ...settings, huggingface_key: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used for Jarvis by default (Free)</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">OpenAI API Key</p>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={settings?.openai_key || ''}
                      onChange={(e) => settings && setSettings({ ...settings, openai_key: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">DeepSeek API Key</p>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={settings?.deepseek_key || ''}
                      onChange={(e) => settings && setSettings({ ...settings, deepseek_key: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-amber-500/80 italic">
                  * Jarvis will prioritize your personal keys if provided.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link className="w-5 h-5 text-primary" />
                <CardTitle>Integrations</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">GitHub</p>
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm">Connect</Button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c.18.717.283 1.487.283 2.269 0 .203-.01.404-.028.602-.5 5.42-3.15 8.5-8.823 8.5-1.75 0-3.381-.51-4.75-1.385.244.029.491.043.742.043 1.453 0 2.79-.495 3.856-1.325-1.358-.025-2.503-.922-2.897-2.155.19.036.385.056.586.056.284 0 .56-.038.82-.11-1.419-.285-2.488-1.538-2.488-3.042v-.04c.418.233.897.373 1.406.39-.832-.556-1.379-1.505-1.379-2.58 0-.569.153-1.102.42-1.561 1.53 1.876 3.817 3.109 6.395 3.238-.053-.227-.08-.463-.08-.707 0-1.713 1.388-3.102 3.102-3.102.893 0 1.699.377 2.265.981.707-.139 1.372-.398 1.972-.754-.232.726-.725 1.335-1.367 1.72.628-.075 1.226-.242 1.782-.489-.415.623-.94 1.17-1.545 1.608z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Telegram</p>
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm">Connect</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Privacy & Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">Profile Visibility</p>
                  <select className="input-field">
                    <option value="public">Public</option>
                    <option value="friends">Friends Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Who can message you</p>
                  <select className="input-field">
                    <option value="everyone">Everyone</option>
                    <option value="friends">Friends Only</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <div className="flex items-center gap-2 text-green-500">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">Settings saved!</span>
              </div>
            )}
            <Button onClick={handleSave} loading={loading}>
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
