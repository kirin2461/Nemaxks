import { useState, useEffect, useCallback } from 'react'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { guildsAPI, moderationAPI, dmAccessAPI, type GuildMemberEntry, type GuildBanEntry, type GuildMuteEntry, type GuildShadowbanEntry, type DMAccessRequest } from '@/lib/api'
import {
  Shield,
  Ban,
  MicOff,
  EyeOff,
  KeyRound,
  Plus,
  Server,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SubTab = 'bans' | 'mutes' | 'shadowbans' | 'dm'

interface GuildOption {
  id: number | string
  name: string
}

function isForbidden(error: unknown): boolean {
  return (error as { status?: number })?.status === 403
}

function errorMessage(error: unknown, fallback: string): string {
  if (isForbidden(error)) return 'Недостаточно прав для выполнения этого действия'
  return fallback
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU')
}

const subTabs: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'bans', label: 'Баны', icon: Ban },
  { id: 'mutes', label: 'Муты', icon: MicOff },
  { id: 'shadowbans', label: 'Шэдоубаны', icon: EyeOff },
  { id: 'dm', label: 'DM-доступ', icon: KeyRound },
]

export function ModerationPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const toast = useToast()
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [guilds, setGuilds] = useState<GuildOption[]>([])
  const [guildId, setGuildId] = useState<string>('')
  const [subTab, setSubTab] = useState<SubTab>('bans')

  const [members, setMembers] = useState<GuildMemberEntry[]>([])
  const [bans, setBans] = useState<GuildBanEntry[]>([])
  const [mutes, setMutes] = useState<GuildMuteEntry[]>([])
  const [shadowbans, setShadowbans] = useState<GuildShadowbanEntry[]>([])

  const [dmRequests, setDmRequests] = useState<DMAccessRequest[]>([])
  const [dmStatusFilter, setDmStatusFilter] = useState<string>('')
  const [dmTargetId, setDmTargetId] = useState('')
  const [dmReason, setDmReason] = useState('')

  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('60')

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Загрузка списка серверов
  useEffect(() => {
    guildsAPI
      .getGuilds()
      .then((data) => {
        const list = (data || []).map((g: any) => ({ id: g.id, name: g.name }))
        setGuilds(list)
        if (list.length > 0) setGuildId((prev) => prev || String(list[0].id))
      })
      .catch((err) => {
        console.error('Failed to load guilds:', err)
        setError(errorMessage(err, 'Не удалось загрузить список серверов'))
      })
  }, [])

  const loadSanctions = useCallback(async () => {
    if (!guildId || subTab === 'dm') return
    setLoading(true)
    setError('')
    try {
      const membersData = await moderationAPI.getGuildMembers(guildId)
      setMembers(membersData.members ?? [])
      if (subTab === 'bans') {
        const data = await moderationAPI.getBans(guildId)
        setBans(data.bans ?? [])
      } else if (subTab === 'mutes') {
        const data = await moderationAPI.getMutes(guildId)
        setMutes(data.mutes ?? [])
      } else {
        const data = await moderationAPI.getShadowbans(guildId)
        setShadowbans(data.shadowbans ?? [])
      }
    } catch (err) {
      console.error('Failed to load moderation data:', err)
      setError(errorMessage(err, 'Не удалось загрузить данные модерации'))
    } finally {
      setLoading(false)
    }
  }, [guildId, subTab])

  const loadDmRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await dmAccessAPI.getRequests(dmStatusFilter || undefined)
      setDmRequests(data.requests ?? [])
    } catch (err) {
      console.error('Failed to load DM access requests:', err)
      setError(errorMessage(err, 'Не удалось загрузить запросы DM-доступа'))
    } finally {
      setLoading(false)
    }
  }, [dmStatusFilter])

  useEffect(() => {
    if (subTab === 'dm') {
      loadDmRequests()
    } else {
      loadSanctions()
    }
  }, [subTab, loadSanctions, loadDmRequests])

  // Сброс формы при смене подвкладки/сервера
  useEffect(() => {
    setTargetId('')
    setReason('')
    setDuration('60')
  }, [subTab, guildId])

  const handleIssue = async () => {
    const target = parseInt(targetId)
    if (!target || !reason.trim()) return
    setSubmitting(true)
    setError('')
    try {
      if (subTab === 'bans') {
        await moderationAPI.banUser(guildId, target, reason.trim())
      } else if (subTab === 'mutes') {
        const minutes = parseInt(duration)
        await moderationAPI.muteUser(guildId, target, reason.trim(), minutes)
      } else if (subTab === 'shadowbans') {
        await moderationAPI.shadowbanUser(guildId, target, reason.trim())
      }
      setTargetId('')
      setReason('')
      await loadSanctions()
    } catch (err) {
      console.error('Failed to issue sanction:', err)
      setError(errorMessage(err, 'Не удалось выдать санкцию'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevokeSanction = (entry: { user_id: number; username: string }) => {
    const labels: Record<string, string> = {
      bans: 'Разбанить',
      mutes: 'Снять мут',
      shadowbans: 'Снять шэдоубан',
    }
    setConfirmAction({
      title: 'Снятие санкции',
      message: `${labels[subTab]} пользователю ${entry.username}?`,
      onConfirm: async () => {
        setError('')
        try {
          if (subTab === 'bans') {
            await moderationAPI.unbanUser(guildId, entry.user_id)
          } else if (subTab === 'mutes') {
            await moderationAPI.unmuteUser(guildId, entry.user_id)
          } else {
            await moderationAPI.unshadowbanUser(guildId, entry.user_id)
          }
          await loadSanctions()
          toast.success('Санкция снята')
        } catch (err) {
          console.error('Failed to revoke sanction:', err)
          setError(errorMessage(err, 'Не удалось снять санкцию'))
        }
      }
    })
  }

  const handleRequestDmAccess = async () => {
    const target = parseInt(dmTargetId)
    if (!target || !dmReason.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await dmAccessAPI.requestAccess(target, dmReason.trim())
      setDmTargetId('')
      setDmReason('')
      await loadDmRequests()
    } catch (err) {
      console.error('Failed to request DM access:', err)
      setError(errorMessage(err, 'Не удалось отправить запрос'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = (id: number) => {
    setConfirmAction({
      title: 'Одобрение DM-доступа',
      message: 'Одобрить запрос DM-доступа? Доступ будет выдан на 24 часа.',
      onConfirm: async () => {
        setError('')
        try {
          await dmAccessAPI.approve(id)
          await loadDmRequests()
          toast.success('Запрос одобрен')
        } catch (err) {
          console.error('Failed to approve DM access:', err)
          setError(errorMessage(err, 'Не удалось одобрить запрос'))
        }
      }
    })
  }

  const handleRevoke = (id: number) => {
    setConfirmAction({
      title: 'Отзыв DM-доступа',
      message: 'Отозвать DM-доступ?',
      onConfirm: async () => {
        setError('')
        try {
          await dmAccessAPI.revoke(id)
          await loadDmRequests()
          toast.success('DM-доступ отозван')
        } catch (err) {
          console.error('Failed to revoke DM access:', err)
          setError(errorMessage(err, 'Не удалось отозвать доступ'))
        }
      }
    })
  }

  const issueConfig: Record<string, { label: string; button: string; icon: React.ComponentType<{ className?: string }> }> = {
    bans: { label: 'Выдать бан', button: 'Забанить', icon: Ban },
    mutes: { label: 'Выдать мут', button: 'Замутить', icon: MicOff },
    shadowbans: { label: 'Выдать шэдоубан', button: 'Шэдоубан', icon: EyeOff },
  }

  const currentIssue = issueConfig[subTab]

  const renderSanctionRow = (
    entry: GuildBanEntry | GuildMuteEntry | GuildShadowbanEntry,
    issuedBy: string,
    revokeLabel: string,
    expiresAt?: string,
  ) => (
    <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar src={entry.avatar} alt={entry.username} size="md" />
        <div className="min-w-0">
          <p className="font-medium truncate">{entry.username}</p>
          <p className="text-sm text-muted-foreground truncate">
            {entry.reason || 'Без причины'}
          </p>
          <p className="text-xs text-muted-foreground">
            Выдал: {issuedBy} · {formatDate(entry.created_at)}
            {expiresAt && <> · до {formatDate(expiresAt)}</>}
          </p>
        </div>
      </div>
      <button
        onClick={() => handleRevokeSanction(entry)}
        className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 text-sm transition-colors flex-shrink-0"
      >
        {revokeLabel}
      </button>
    </div>
  )

  const dmStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25',
      approved: 'bg-accent/15 text-accent border border-accent/25',
      revoked: 'bg-red-500/15 text-red-400 border border-red-500/25',
      rejected: 'bg-red-500/15 text-red-400 border border-red-500/25',
      expired: 'bg-muted text-muted-foreground border border-border',
    }
    const labels: Record<string, string> = {
      pending: 'Ожидает',
      approved: 'Одобрен',
      revoked: 'Отозван',
      rejected: 'Отклонён',
      expired: 'Истёк',
    }
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-xs', styles[status] || 'bg-muted text-muted-foreground border border-border')}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Селектор сервера + подвкладки */}
      <div className="glass rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Server className="w-4 h-4" />
            <span className="text-sm">Сервер:</span>
          </div>
          <select
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            className="input-field !w-auto px-3 py-2"
          >
            {guilds.length === 0 && <option value="">Нет серверов</option>}
            {guilds.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 ml-auto">
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-200',
                  subTab === tab.id
                    ? 'gradient-brand text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner" />
        </div>
      ) : subTab !== 'dm' ? (
        <>
          {/* Форма выдачи санкции */}
          {currentIssue && (
            <div className="glass rounded-xl p-4">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <currentIssue.icon className="w-4 h-4 text-muted-foreground" />
                {currentIssue.label}
              </h3>
              <div className="flex flex-wrap gap-3">
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="input-field !w-auto px-3 py-2 min-w-[200px]"
                >
                  <option value="">Выберите участника...</option>
                  {members.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.username}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Причина..."
                  className="input-field flex-1 min-w-[200px]"
                />
                {subTab === 'mutes' && (
                  <input
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Длительность (мин)"
                    className="input-field !w-40 px-3 py-2"
                    title="Длительность в минутах"
                  />
                )}
                <button
                  onClick={handleIssue}
                  disabled={submitting || !targetId || !reason.trim() || !guildId}
                  className="px-4 py-2 rounded-lg gradient-brand text-primary-foreground shadow-soft hover:brightness-110 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {currentIssue.button}
                </button>
              </div>
            </div>
          )}

          {/* Список санкций */}
          <div className="glass rounded-xl">
            <div className="divide-y divide-border">
              {subTab === 'bans' &&
                (bans.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Нет активных банов</div>
                ) : (
                  bans.map((ban) => renderSanctionRow(ban, ban.banned_by_username, 'Разбанить'))
                ))}
              {subTab === 'mutes' &&
                (mutes.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Нет активных мутов</div>
                ) : (
                  mutes.map((mute) =>
                    renderSanctionRow(mute, mute.muted_by_username, 'Снять мут', mute.expires_at),
                  )
                ))}
              {subTab === 'shadowbans' &&
                (shadowbans.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">Нет активных шэдоубанов</div>
                ) : (
                  shadowbans.map((sb) =>
                    renderSanctionRow(sb, sb.shadowbanned_by_username, 'Снять шэдоубан'),
                  )
                ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* DM-доступ: форма запроса */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              Запросить доступ к личным сообщениям
            </h3>
            <div className="flex flex-wrap gap-3">
              <input
                type="number"
                min={1}
                value={dmTargetId}
                onChange={(e) => setDmTargetId(e.target.value)}
                placeholder="ID пользователя"
                className="input-field !w-48 px-3 py-2"
              />
              <input
                type="text"
                value={dmReason}
                onChange={(e) => setDmReason(e.target.value)}
                placeholder="Причина запроса..."
                className="input-field flex-1 min-w-[200px]"
              />
              <button
                onClick={handleRequestDmAccess}
                disabled={submitting || !dmTargetId || !dmReason.trim()}
                className="px-4 py-2 rounded-lg gradient-brand text-primary-foreground shadow-soft hover:brightness-110 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Запросить доступ
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Запрос требует одобрения супер-администратора. Доступ выдаётся на 24 часа.
            </p>
          </div>

          {/* DM-доступ: список запросов */}
          <div className="glass rounded-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Запросы DM-доступа</h3>
              <select
                value={dmStatusFilter}
                onChange={(e) => setDmStatusFilter(e.target.value)}
                className="input-field !w-auto px-3 py-1.5 text-sm"
              >
                <option value="">Все статусы</option>
                <option value="pending">Ожидают</option>
                <option value="approved">Одобрены</option>
                <option value="revoked">Отозваны</option>
              </select>
            </div>
            <div className="divide-y divide-border">
              {dmRequests.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Нет запросов DM-доступа</div>
              ) : (
                dmRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">
                          Пользователь #{req.target_user_id}
                        </p>
                        {dmStatusBadge(req.status)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{req.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        Запросил: #{req.requested_by} · {formatDate(req.created_at)}
                        {req.expires_at && <> · до {formatDate(req.expires_at)}</>}
                      </p>
                    </div>
                    {isSuperAdmin && (req.status === 'pending' || req.status === 'approved') && (
                      <div className="flex gap-2 flex-shrink-0">
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(req.id)}
                            className="p-2 rounded-lg hover:bg-green-500/10 text-green-500 transition-colors"
                            title="Одобрить"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRevoke(req.id)}
                          className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors"
                          title="Отозвать"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          confirmAction?.onConfirm()
          setConfirmAction(null)
        }}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        variant="danger"
      />
    </div>
  )
}
