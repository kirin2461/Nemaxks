import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from './Avatar'
import { storiesAPI, uploadAPI, type Story } from '@/lib/api'
import { useStore } from '@/lib/store'
import { Plus, X, Clock, ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, Image, Video, Trash2, Eye, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StoriesProps {
  className?: string
  viewUserId?: string | null
  onCloseViewer?: () => void
}

const DEMO_STORIES: Story[] = [
  {
    id: 'demo-story-1',
    user_id: 'demo-user-2',
    content: 'Just launched a new feature! Check it out 🚀',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 23).toISOString(),
    view_count: 42,
  },
  {
    id: 'demo-story-2',
    user_id: 'demo-user-3',
    content: 'Working on some cool animations today ✨',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
    view_count: 89,
  },
  {
    id: 'demo-story-3',
    user_id: 'demo-user-4',
    content: 'Late night coding session 🌙 Coffee is my best friend',
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
    view_count: 156,
  },
]

const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100MB total limit

interface MediaItem {
  file: File
  preview: string
  type: 'image' | 'video'
}

export function Stories({ className, viewUserId, onCloseViewer }: StoriesProps) {
  const { user, isDemoMode } = useStore()
  const [stories, setStories] = useState<Story[]>([])
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
  const [showViewer, setShowViewer] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newStoryContent, setNewStoryContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [storyMedia, setStoryMedia] = useState<MediaItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const STORY_DURATION = 5000
  const hasAdvancedRef = useRef(false)

  const userStories = stories.filter(s => s.user_id === user?.id)
  const otherStories = stories.filter(s => s.user_id !== user?.id)
  const currentStory = stories[currentStoryIndex]

  useEffect(() => {
    loadStories()
  }, [isDemoMode])

  useEffect(() => {
    if (viewUserId && stories.length > 0) {
      const userStoryIndex = stories.findIndex(s => s.user_id === viewUserId)
      if (userStoryIndex >= 0) {
        setCurrentStoryIndex(userStoryIndex)
        setShowViewer(true)
      }
    }
  }, [viewUserId, stories])

  const loadStories = async () => {
    if (isDemoMode) {
      setStories(DEMO_STORIES)
      setLoading(false)
      return
    }
    try {
      const data = await storiesAPI.getStories()
      if (data && data.length > 0) {
        setStories(data)
      } else {
        setStories(DEMO_STORIES)
      }
    } catch (error) {
      console.error('Failed to load stories:', error)
      setStories(DEMO_STORIES)
    } finally {
      setLoading(false)
    }
  }

  const getTotalMediaSize = () => {
    return storyMedia.reduce((total, item) => total + item.file.size, 0)
  }

  const handleCreateStory = async () => {
    if (!newStoryContent.trim() && storyMedia.length === 0) return
    
    setIsUploading(true)
    setUploadError(null)
    try {
      let mediaUrl: string | undefined
      let mediaType: 'image' | 'video' | undefined
      
      if (storyMedia.length > 0) {
        try {
          const firstMedia = storyMedia[0]
          const uploadResult = await uploadAPI.uploadFile(firstMedia.file, firstMedia.type)
          mediaUrl = uploadResult.url
          mediaType = firstMedia.type
        } catch (uploadErr) {
          console.error('Failed to upload media:', uploadErr)
          setUploadError('Не удалось загрузить файл. Попробуйте ещё раз.')
          setIsUploading(false)
          return
        }
      }
      
      await storiesAPI.createStory(newStoryContent, mediaUrl, mediaType)
      setNewStoryContent('')
      setStoryMedia([])
      setShowCreateModal(false)
      loadStories()
    } catch (error) {
      console.error('Failed to create story:', error)
      setUploadError('Не удалось опубликовать историю.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setUploadError(null)
    
    const newMedia: MediaItem[] = []
    let totalNewSize = getTotalMediaSize()
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      
      if (!isVideo && !isImage) continue
      
      totalNewSize += file.size
      if (totalNewSize > MAX_TOTAL_SIZE) {
        setUploadError(`Превышен лимит: максимум 100 МБ. Текущий размер: ${(totalNewSize / (1024 * 1024)).toFixed(1)} МБ`)
        break
      }
      
      const preview = URL.createObjectURL(file)
      newMedia.push({ 
        file, 
        preview, 
        type: isVideo ? 'video' : 'image' 
      })
    }
    
    if (newMedia.length > 0) {
      setStoryMedia(prev => [...prev, ...newMedia])
    }
    
    if (e.target) e.target.value = ''
  }

  const removeMedia = (index: number) => {
    setStoryMedia(prev => {
      const item = prev[index]
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((_, i) => i !== index)
    })
    setUploadError(null)
  }

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('Удалить эту историю?')) return
    try {
      await storiesAPI.deleteStory(storyId)
      loadStories()
      if (showViewer) {
        closeViewer()
      }
    } catch (error) {
      console.error('Failed to delete story:', error)
    }
  }

  const closeViewer = () => {
    setShowViewer(false)
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    hasAdvancedRef.current = false
    setProgress(0)
    onCloseViewer?.()
  }

  const goToNextStory = () => {
    hasAdvancedRef.current = false
    if (currentStoryIndex < stories.length - 1) {
      const nextIndex = currentStoryIndex + 1
      setCurrentStoryIndex(nextIndex)
      setProgress(0)
      const nextStory = stories[nextIndex]
      if (nextStory) {
        storiesAPI.viewStory(nextStory.id).catch(() => {})
      }
    } else {
      closeViewer()
    }
  }

  const goToPrevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1)
      setProgress(0)
    }
  }

  useEffect(() => {
    hasAdvancedRef.current = false
    
    if (!showViewer || isPaused) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      return
    }
    
    progressTimerRef.current = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (50 / STORY_DURATION) * 100
        if (newProgress >= 100 && !hasAdvancedRef.current) {
          hasAdvancedRef.current = true
          goToNextStory()
          return 100
        }
        if (newProgress >= 100) return 100
        return newProgress
      })
    }, 50)
    
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
    }
  }, [showViewer, currentStoryIndex, isPaused])

  const openStoryViewer = async (index: number) => {
    setCurrentStoryIndex(index)
    setProgress(0)
    setShowViewer(true)
    setIsPaused(false)
    
    try {
      const storyToView = stories[index]
      if (storyToView) {
        await storiesAPI.viewStory(storyToView.id)
      }
    } catch (error) {
      console.error('Failed to mark story as viewed:', error)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setIsPaused(true)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    const deltaX = touchEnd.x - touchStartRef.current.x
    const deltaY = touchEnd.y - touchStartRef.current.y
    
    if (Math.abs(deltaY) > 100 && Math.abs(deltaY) > Math.abs(deltaX)) {
      closeViewer()
    } else if (Math.abs(deltaX) < 30) {
      const screenWidth = window.innerWidth
      if (touchEnd.x < screenWidth / 3) {
        goToPrevStory()
      } else if (touchEnd.x > screenWidth * 2 / 3) {
        goToNextStory()
      }
    }
    
    touchStartRef.current = null
    setIsPaused(false)
  }

  const handleMouseDown = () => setIsPaused(true)
  const handleMouseUp = () => setIsPaused(false)

  const getTimeAgo = (createdAt: string) => {
    const now = new Date()
    const created = new Date(createdAt)
    const diff = now.getTime() - created.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) return `${hours} ч назад`
    return `${minutes} мин назад`
  }

  const resetModal = () => {
    setShowCreateModal(false)
    storyMedia.forEach(item => URL.revokeObjectURL(item.preview))
    setStoryMedia([])
    setNewStoryContent('')
    setUploadError(null)
  }

  const canPublish = newStoryContent.trim().length > 0 || storyMedia.length > 0

  return (
    <>
      <div className={cn('relative', className)}>
        <div className="flex gap-3 overflow-x-auto p-4 scrollbar-hide">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-shrink-0 flex flex-col items-center gap-2 group"
          >
            <div className="relative w-[72px] h-[72px]">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border-2 border-dashed border-primary/50 flex items-center justify-center group-hover:border-primary group-hover:scale-105 transition-all duration-300">
                <div className="w-14 h-14 rounded-full bg-card flex items-center justify-center">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Добавить</span>
          </button>

          {userStories.length > 0 && (
            <button
              onClick={() => {
                const firstUserStoryIndex = stories.findIndex(s => s.user_id === user?.id)
                if (firstUserStoryIndex >= 0) openStoryViewer(firstUserStoryIndex)
              }}
              className="flex-shrink-0 flex flex-col items-center gap-2 group animate-fade-in"
            >
              <div className="relative w-[72px] h-[72px]">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-accent to-primary animate-spin-slow" style={{ padding: '2px' }}>
                  <div className="w-full h-full rounded-full bg-card p-0.5">
                    <Avatar size="lg" alt={user?.username || ''} userId={String(user?.id || '')} className="w-full h-full" />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold border-2 border-card">
                  {userStories.length}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-medium text-foreground">Ваша история</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Eye className="w-2.5 h-2.5" />
                  {userStories.reduce((acc, s) => acc + (s.view_count || 0), 0)}
                </span>
              </div>
            </button>
          )}

          {otherStories.map((story, idx) => {
            const storyIndex = stories.findIndex(s => s.id === story.id)
            return (
              <button
                key={story.id}
                onClick={() => openStoryViewer(storyIndex >= 0 ? storyIndex : idx)}
                className="flex-shrink-0 flex flex-col items-center gap-2 group animate-fade-in"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="relative w-[72px] h-[72px]">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent via-pink-500 to-accent" style={{ padding: '2px' }}>
                    <div className="w-full h-full rounded-full bg-card p-0.5">
                      <Avatar size="lg" alt={`User ${story.user_id}`} userId={String(story.user_id)} className="w-full h-full group-hover:scale-105 transition-transform" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium text-foreground truncate max-w-[72px]">User {story.user_id}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {getTimeAgo(story.created_at)}
                  </span>
                </div>
              </button>
            )
          })}

          {loading && (
            <>
              <div className="flex-shrink-0 w-[72px] h-[72px] rounded-full bg-muted animate-pulse" />
              <div className="flex-shrink-0 w-[72px] h-[72px] rounded-full bg-muted animate-pulse" />
            </>
          )}
        </div>
      </div>

      {showViewer && currentStory && createPortal(
        <div 
          ref={viewerRef}
          className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[9999] flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          <div className="absolute top-0 left-0 right-0 z-20 px-2 pt-2">
            <div className="flex gap-1 mb-2">
              {stories.map((_, idx) => (
                <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-100"
                    style={{ 
                      width: idx < currentStoryIndex ? '100%' : idx === currentStoryIndex ? `${progress}%` : '0%' 
                    }}
                  />
                </div>
              ))}
            </div>
            
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <Avatar 
                  size="sm" 
                  alt={currentStory.user_id === user?.id ? user.username : `User ${currentStory.user_id}`}
                  userId={String(currentStory.user_id)}
                />
                <div>
                  <p className="text-white text-sm font-medium">
                    {currentStory.user_id === user?.id ? 'Ваша история' : `User ${currentStory.user_id}`}
                  </p>
                  <p className="text-white/60 text-xs flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(currentStory.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {currentStory.view_count || 0}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused) }}
                  className="p-2 text-white/80 hover:text-white"
                >
                  {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted) }}
                  className="p-2 text-white/80 hover:text-white"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                {currentStory.user_id === user?.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteStory(currentStory.id) }}
                    className="p-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); closeViewer() }}
                  className="p-2 text-white/80 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative">
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevStory() }}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-all z-10",
                currentStoryIndex === 0 && "opacity-30 pointer-events-none"
              )}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            <div className="w-full h-full flex items-center justify-center p-4">
              {currentStory.media_url ? (
                currentStory.media_type === 'video' ? (
                  <video 
                    src={currentStory.media_url} 
                    className="max-w-full max-h-full object-contain rounded-2xl"
                    autoPlay
                    muted={isMuted}
                    loop
                  />
                ) : (
                  <img 
                    src={currentStory.media_url} 
                    alt="Story"
                    className="max-w-full max-h-full object-contain rounded-2xl"
                  />
                )
              ) : (
                <div className="max-w-lg w-full bg-gradient-to-br from-primary/20 via-accent/20 to-pink-500/20 rounded-2xl p-8 text-center">
                  <p className="text-white text-xl font-medium leading-relaxed">
                    {currentStory.content}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); goToNextStory() }}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-all z-10",
                currentStoryIndex === stories.length - 1 && "opacity-30 pointer-events-none"
              )}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>

          {currentStory.content && currentStory.media_url && (
            <div className="absolute bottom-20 left-0 right-0 px-4">
              <div className="max-w-lg mx-auto bg-black/60 backdrop-blur-sm rounded-xl p-4">
                <p className="text-white text-center">{currentStory.content}</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-lg mx-auto">
              <input
                type="text"
                placeholder="Отправить ответ..."
                className="w-full px-4 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:border-white/40"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[9999] animate-fade-in flex items-center justify-center">
          <div className="bg-card/95 backdrop-blur-sm rounded-2xl w-full max-w-lg mx-4 shadow-2xl border border-white/10 animate-slide-in overflow-hidden">
            <div className="bg-gradient-to-r from-primary/20 via-accent/10 to-pink-500/20 p-5 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Новая история</h3>
                    <p className="text-sm text-muted-foreground">Исчезнет через 24 часа</p>
                  </div>
                </div>
                <button 
                  onClick={resetModal}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              {uploadError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 animate-shake">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{uploadError}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground font-medium">Вложения</p>
                  <span className="text-xs text-muted-foreground">
                    {(getTotalMediaSize() / (1024 * 1024)).toFixed(1)} / 100 МБ
                  </span>
                </div>
                
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                {storyMedia.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-1">
                      {storyMedia.map((item, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-black/20 group">
                          {item.type === 'image' ? (
                            <img src={item.preview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <video src={item.preview} className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => removeMedia(index)}
                              className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] flex items-center gap-1">
                            {item.type === 'image' ? <Image className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => mediaInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center hover:border-primary/60 hover:bg-primary/5 transition-all"
                      >
                        <Plus className="w-6 h-6 text-primary/60" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    className="w-full py-8 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/60 hover:from-primary/20 hover:to-accent/20 transition-all duration-300 group"
                  >
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-primary">Добавить фото или видео</p>
                      <p className="text-xs text-muted-foreground">Максимум 100 МБ</p>
                    </div>
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground font-medium">Текст истории</label>
                  <span className={cn(
                    "text-xs font-medium transition-colors",
                    newStoryContent.length > 180 ? "text-amber-400" : "text-muted-foreground",
                    newStoryContent.length >= 200 && "text-red-400"
                  )}>
                    {newStoryContent.length}/200
                  </span>
                </div>
                <div className="relative group">
                  <textarea
                    value={newStoryContent}
                    onChange={(e) => { setNewStoryContent(e.target.value); setUploadError(null) }}
                    placeholder="Напишите что-нибудь интересное..."
                    className="w-full h-28 p-4 rounded-xl bg-background border-2 border-border resize-none focus:outline-none focus:ring-0 focus:border-primary text-sm transition-all duration-300 group-hover:border-primary/50"
                    maxLength={200}
                  />
                  <div className="absolute bottom-3 right-3">
                    <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-primary/30"
                        style={{
                          background: `conic-gradient(var(--primary) ${(newStoryContent.length / 200) * 100}%, transparent ${(newStoryContent.length / 200) * 100}%)`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-border flex items-center justify-between bg-muted/20">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateStory}
                disabled={!canPublish || isUploading}
                className={cn(
                  "px-8 py-2.5 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2",
                  canPublish && !isUploading
                    ? "bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 hover:scale-105 shadow-lg shadow-primary/25"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Публикация...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Опубликовать
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
