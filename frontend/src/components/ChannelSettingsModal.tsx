import { useState } from 'react'
import {
  X,
  Hash,
  Volume2,
  Lock,
  Globe,
  Shield,
  Trash2,
  Copy,
  Link,
  Settings,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChannelSettingsModalProps {
  channel: {
    id: string
    name: string
    type: 'text' | 'voice'
    description?: string
    isPrivate?: boolean
  }
  onClose: () => void
  onSave: (data: any) => void
  onDelete: () => void
}

interface Role {
  id: string
  name: string
  color: string
  permissions: string[]
}

const DEMO_ROLES: Role[] = [
  { id: '1', name: 'Admin', color: '#ef4444', permissions: ['all'] },
  { id: '2', name: 'Moderator', color: '#f59e0b', permissions: ['manage_messages', 'kick_members'] },
  { id: '3', name: 'Member', color: '#6b7280', permissions: ['send_messages', 'read_messages'] },
  { id: '4', name: 'Guest', color: '#9ca3af', permissions: ['read_messages'] },
]

const PERMISSIONS = [
  { id: 'view_channel', name: 'View Channel', description: 'Members can see this channel' },
  { id: 'send_messages', name: 'Send Messages', description: 'Members can send messages' },
  { id: 'manage_messages', name: 'Manage Messages', description: 'Delete or pin messages' },
  { id: 'manage_channel', name: 'Manage Channel', description: 'Edit channel settings' },
  { id: 'invite_members', name: 'Create Invite', description: 'Create invite links' },
  { id: 'mention_everyone', name: 'Mention Everyone', description: 'Use @everyone and @here' },
  { id: 'attach_files', name: 'Attach Files', description: 'Upload files and images' },
  { id: 'embed_links', name: 'Embed Links', description: 'Show link previews' },
]

export function ChannelSettingsModal({ channel, onClose, onSave, onDelete }: ChannelSettingsModalProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description || '')
  const [isPrivate, setIsPrivate] = useState(channel.isPrivate || false)
  const [slowMode, setSlowMode] = useState(0)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>({})
  const [inviteLink, setInviteLink] = useState('')
  const [showInviteGenerated, setShowInviteGenerated] = useState(false)

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Settings },
    { id: 'permissions', name: 'Permissions', icon: Shield },
    { id: 'invites', name: 'Invites', icon: Link },
  ]

  const handleSave = () => {
    onSave({
      name,
      description,
      isPrivate,
      slowMode,
      permissions: rolePermissions,
    })
    onClose()
  }

  const generateInvite = () => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    setInviteLink(`https://nemaks.app/invite/${code}`)
    setShowInviteGenerated(true)
  }

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink)
  }

  const togglePermission = (roleId: string, permId: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permId]: !prev[roleId]?.[permId]
      }
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex animate-fade-in">
        <div className="w-56 bg-muted/50 p-4 border-r border-border">
          <div className="flex items-center gap-2 mb-6 px-2">
            {channel.type === 'text' ? (
              <Hash className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Volume2 className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="font-semibold truncate">{channel.name}</span>
          </div>

          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent/20 hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-border mt-6">
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Channel
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">
              {tabs.find(t => t.id === activeTab)?.name}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Channel Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this channel about?"
                    rows={3}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {isPrivate ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                    <div>
                      <p className="font-medium">Private Channel</p>
                      <p className="text-sm text-muted-foreground">
                        Only selected members can view this channel
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={cn(
                      'w-12 h-6 rounded-full transition-colors relative',
                      isPrivate ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all',
                        isPrivate ? 'left-6' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Slow Mode</label>
                  <select
                    value={slowMode}
                    onChange={(e) => setSlowMode(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value={0}>Off</option>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'permissions' && (
              <div className="space-y-6">
                <div className="flex gap-6">
                  <div className="w-48 space-y-1">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Roles</p>
                    {DEMO_ROLES.map(role => (
                      <button
                        key={role.id}
                        onClick={() => setSelectedRole(role)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                          selectedRole?.id === role.id
                            ? 'bg-accent/30'
                            : 'hover:bg-accent/20'
                        )}
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      </button>
                    ))}
                  </div>

                  <div className="flex-1">
                    {selectedRole ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: selectedRole.color }}
                          />
                          <span className="font-medium">{selectedRole.name}</span>
                        </div>
                        {PERMISSIONS.map(perm => (
                          <div
                            key={perm.id}
                            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-sm">{perm.name}</p>
                              <p className="text-xs text-muted-foreground">{perm.description}</p>
                            </div>
                            <button
                              onClick={() => togglePermission(selectedRole.id, perm.id)}
                              className={cn(
                                'w-10 h-5 rounded-full transition-colors relative',
                                rolePermissions[selectedRole.id]?.[perm.id] ? 'bg-green-500' : 'bg-muted'
                              )}
                            >
                              <div
                                className={cn(
                                  'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
                                  rolePermissions[selectedRole.id]?.[perm.id] ? 'left-5' : 'left-0.5'
                                )}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        Select a role to edit permissions
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'invites' && (
              <div className="space-y-6">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="font-medium mb-2">Create Invite Link</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Share this link to invite people to this channel
                  </p>
                  {showInviteGenerated ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        className="flex-1 px-4 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                      <button
                        onClick={copyInvite}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={generateInvite}
                      className="btn-cosmic"
                    >
                      Generate Invite Link
                    </button>
                  )}
                </div>

                <div>
                  <p className="font-medium mb-3">Active Invites</p>
                  <div className="text-sm text-muted-foreground text-center py-8 bg-muted/20 rounded-lg">
                    No active invites
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg hover:bg-accent/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
