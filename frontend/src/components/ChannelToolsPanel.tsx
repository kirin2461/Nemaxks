import { useState, useEffect } from 'react'
import { PenTool, BookOpen, Plus, Lock, Unlock, Trash2, X, Crown } from 'lucide-react'
import { channelToolsAPI, type ChannelTool } from '@/lib/api'
import { Whiteboard } from './Whiteboard'
import { Notebook } from './Notebook'
import { useStore } from '@/lib/store'

interface ChannelToolsPanelProps {
  channelId: number
  userPlan?: 'start' | 'pro' | 'premium'
}

export function ChannelToolsPanel({ channelId, userPlan = 'start' }: ChannelToolsPanelProps) {
  const { user } = useStore()
  const [tools, setTools] = useState<ChannelTool[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTool, setSelectedTool] = useState<ChannelTool | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState<'board' | 'notebook'>('board')
  const [createTitle, setCreateTitle] = useState('')
  const [createError, setCreateError] = useState('')

  const canCreateBoard = userPlan === 'pro' || userPlan === 'premium'
  const canCreateNotebook = userPlan === 'premium'

  useEffect(() => {
    loadTools()
  }, [channelId])

  const loadTools = async () => {
    try {
      setLoading(true)
      const data = await channelToolsAPI.getTools(channelId)
      setTools(data)
    } catch (err) {
      console.error('Failed to load tools:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      setCreateError('Enter a title')
      return
    }

    try {
      const newTool = await channelToolsAPI.createTool(channelId, {
        type: createType,
        title: createTitle.trim()
      })
      setTools(prev => [newTool, ...prev])
      setShowCreateModal(false)
      setCreateTitle('')
      setCreateError('')
      setSelectedTool(newTool)
    } catch (err: any) {
      if (err?.data?.required_plan) {
        setCreateError(`Requires ${err.data.required_plan} plan`)
      } else {
        setCreateError('Failed to create')
      }
    }
  }

  const handleSave = async (content: string) => {
    if (!selectedTool) return
    try {
      await channelToolsAPI.updateTool(selectedTool.id, { content })
      setTools(prev => prev.map(t => 
        t.id === selectedTool.id ? { ...t, content, updated_at: Date.now() } : t
      ))
    } catch (err) {
      console.error('Failed to save:', err)
    }
  }

  const handleDelete = async (toolId: number) => {
    if (!confirm('Delete this tool?')) return
    try {
      await channelToolsAPI.deleteTool(toolId)
      setTools(prev => prev.filter(t => t.id !== toolId))
      if (selectedTool?.id === toolId) {
        setSelectedTool(null)
      }
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  if (selectedTool) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-2 border-b bg-card">
          <button
            onClick={() => setSelectedTool(null)}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="font-medium">{selectedTool.title}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
            {selectedTool.tool_type === 'board' ? 'Whiteboard' : 'Notebook'}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          {selectedTool.tool_type === 'board' ? (
            <Whiteboard
              tool={selectedTool}
              onSave={handleSave}
              readOnly={selectedTool.visible_to === 'owner' && selectedTool.owner_id !== Number(user?.id)}
            />
          ) : (
            <Notebook
              tool={selectedTool}
              onSave={handleSave}
              readOnly={selectedTool.visible_to === 'owner' && selectedTool.owner_id !== Number(user?.id)}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-medium">Channel Tools</h3>
        {(canCreateBoard || canCreateNotebook) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-2 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : tools.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">No tools yet</div>
            {!canCreateBoard && (
              <div className="flex items-center justify-center gap-2 text-sm text-amber-500">
                <Crown className="w-4 h-4" />
                <span>Upgrade to Pro for whiteboards</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tools.map(tool => (
              <div
                key={tool.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setSelectedTool(tool)}
              >
                {tool.tool_type === 'board' ? (
                  <PenTool className="w-5 h-5 text-blue-500" />
                ) : (
                  <BookOpen className="w-5 h-5 text-green-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{tool.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {tool.tool_type === 'board' ? 'Whiteboard' : 'Notebook'}
                    {tool.visible_to !== 'all' && (
                      <span className="ml-2">
                        {tool.visible_to === 'owner' ? '(Private)' : '(Moderators)'}
                      </span>
                    )}
                  </div>
                </div>
                {tool.owner_id === Number(user?.id) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(tool.id)
                    }}
                    className="p-1 hover:bg-destructive/20 rounded text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-card p-6 rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Create New Tool</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCreateType('board')}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      createType === 'board' ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                    } ${!canCreateBoard ? 'opacity-50' : ''}`}
                    disabled={!canCreateBoard}
                  >
                    <PenTool className="w-5 h-5 text-blue-500" />
                    <div className="text-left">
                      <div className="font-medium">Whiteboard</div>
                      <div className="text-xs text-muted-foreground">Pro+</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setCreateType('notebook')}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      createType === 'notebook' ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                    } ${!canCreateNotebook ? 'opacity-50' : ''}`}
                    disabled={!canCreateNotebook}
                  >
                    <BookOpen className="w-5 h-5 text-green-500" />
                    <div className="text-left">
                      <div className="font-medium">Notebook</div>
                      <div className="text-xs text-muted-foreground">Premium</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Enter title..."
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                />
              </div>

              {createError && (
                <div className="text-sm text-destructive">{createError}</div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm hover:bg-muted rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
