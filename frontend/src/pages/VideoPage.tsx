import { useState, useRef, useEffect, useCallback } from 'react'
import { Layout } from '@/components/Layout'
import { useStore } from '@/lib/store'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Clock,
  BookOpen,
  List,
  Upload,
  Film,
  ThumbsUp,
  Share2,
  Bookmark,
  MoreVertical,
  Loader2,
  ArrowLeft,
  Eye,
  Crown,
  Lock,
  Check,
  X,
  Search,
  Home,
  Flame,
  Music,
  Gamepad2,
  Newspaper,
  GraduationCap,
  Briefcase,
  Heart,
  History,
  PlaySquare,
  Clock3,
  ThumbsUpIcon,
  ListVideo,
  FileVideo,
  ImageIcon,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { videosAPI, authAPI, VideoWithAuthor, VideoChapter, VideoDetail, uploadAPI } from '@/lib/api'
import { showToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

type ViewMode = 'grid' | 'player'

interface Category {
  id: string
  name: string
  icon: React.ReactNode
}

const categories: Category[] = [
  { id: 'all', name: 'Главная', icon: <Home className="w-5 h-5" /> },
  { id: 'trending', name: 'В тренде', icon: <Flame className="w-5 h-5" /> },
  { id: 'music', name: 'Музыка', icon: <Music className="w-5 h-5" /> },
  { id: 'gaming', name: 'Игры', icon: <Gamepad2 className="w-5 h-5" /> },
  { id: 'news', name: 'Новости', icon: <Newspaper className="w-5 h-5" /> },
  { id: 'education', name: 'Образование', icon: <GraduationCap className="w-5 h-5" /> },
  { id: 'business', name: 'Бизнес', icon: <Briefcase className="w-5 h-5" /> },
  { id: 'technology', name: 'Технологии', icon: <Settings className="w-5 h-5" /> },
]

const userMenuItems = [
  { id: 'history', name: 'История', icon: <History className="w-5 h-5" /> },
  { id: 'playlists', name: 'Плейлисты', icon: <ListVideo className="w-5 h-5" /> },
  { id: 'watch-later', name: 'Смотреть позже', icon: <Clock3 className="w-5 h-5" /> },
  { id: 'liked', name: 'Понравившиеся', icon: <ThumbsUpIcon className="w-5 h-5" /> },
]

export default function VideoPage() {
  const { user } = useStore()
  const [videos, setVideos] = useState<VideoWithAuthor[]>([])
  const [selectedVideo, setSelectedVideo] = useState<VideoDetail | null>(null)
  const [chapters, setChapters] = useState<VideoChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [showChapters, setShowChapters] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedQuality, setSelectedQuality] = useState<'720p' | '1080p'>('720p')
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'popular' | 'recent'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Текущий пользователь (для проверки прав на удаление видео)
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: authAPI.getMe,
    staleTime: 60000
  })
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const isPremium = user?.is_premium || false

  useEffect(() => {
    loadVideos()
  }, [selectedCategory])

  // Диплинк: /video?watch=<id> (такие ссылки копируются кнопкой «Поделиться»)
  useEffect(() => {
    const watchId = new URLSearchParams(window.location.search).get('watch')
    if (watchId && !isNaN(Number(watchId))) {
      selectVideo(Number(watchId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadVideos = async () => {
    try {
      setLoading(true)
      const params: { category?: string; limit?: number } = { limit: 50 }
      if (selectedCategory !== 'all' && selectedCategory !== 'trending') {
        params.category = selectedCategory
      }
      let data = await videosAPI.getVideos(params)
      if (selectedCategory === 'trending' && data) {
        data = [...data].sort((a, b) => b.views - a.views)
      }
      setVideos(data || [])
    } catch (error) {
      console.error('Failed to load videos:', error)
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  const selectVideo = async (videoId: number) => {
    try {
      const detail = await videosAPI.getVideo(videoId)
      setSelectedVideo(detail)
      setChapters(detail.chapters || [])
      setDuration(detail.video.duration || 0)
      setCurrentTime(0)
      setIsPlaying(false)
      // Бэкенд не отдаёт статус лайка/закладки — сбрасываем, чтобы не
      // переносить состояние с предыдущего видео
      setIsLiked(false)
      setIsBookmarked(false)
      setViewMode('player')
      videosAPI.incrementView(videoId).catch(() => {})
    } catch (error) {
      console.error('Failed to load video:', error)
      showToast({ type: 'error', title: 'Не удалось загрузить видео' })
    }
  }

  const backToGrid = () => {
    setViewMode('grid')
    setSelectedVideo(null)
    setIsPlaying(false)
  }

  // Удаление видео владельцем/админом: после успеха возвращаемся к списку
  const handleDeleteVideo = async () => {
    if (!selectedVideo) return
    setIsDeleting(true)
    try {
      await videosAPI.deleteVideo(selectedVideo.video.id)
      showToast({ type: 'success', title: 'Видео удалено' })
      setShowDeleteDialog(false)
      backToGrid()
      loadVideos()
    } catch (error) {
      console.error('Failed to delete video:', error)
      showToast({ type: 'error', title: 'Не удалось удалить видео' })
    } finally {
      setIsDeleting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
    return views.toString()
  }

  const getCurrentChapter = useCallback(() => {
    return chapters.find((chapter, index) => {
      const nextChapter = chapters[index + 1]
      return currentTime >= chapter.timestamp && (!nextChapter || currentTime < nextChapter.timestamp)
    })
  }, [chapters, currentTime])

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newTime = Math.floor(percent * duration)
    setCurrentTime(newTime)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
  }

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return
    if (!isFullscreen) {
      videoContainerRef.current.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    setIsFullscreen(!isFullscreen)
  }

  const skipTime = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    setCurrentTime(newTime)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
  }

  const handleLike = async () => {
    if (!selectedVideo) return
    try {
      if (isLiked) {
        await videosAPI.unlikeVideo(selectedVideo.video.id)
      } else {
        await videosAPI.likeVideo(selectedVideo.video.id)
      }
      setIsLiked(!isLiked)
    } catch (error) {
      console.error('Failed to toggle like:', error)
    }
  }

  const handleBookmark = async () => {
    if (!selectedVideo) return
    try {
      if (isBookmarked) {
        await videosAPI.unbookmarkVideo(selectedVideo.video.id)
      } else {
        await videosAPI.bookmarkVideo(selectedVideo.video.id)
      }
      setIsBookmarked(!isBookmarked)
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
    }
  }

  // «Поделиться»: копируем прямую ссылку на видео в буфер обмена
  const handleShare = async () => {
    if (!selectedVideo) return
    const url = `${window.location.origin}/video?watch=${selectedVideo.video.id}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        showToast({ type: 'success', title: 'Ссылка на видео скопирована' })
      } else {
        // clipboard API недоступен вне secure context (HTTP)
        showToast({ type: 'warning', title: 'Копирование требует HTTPS', message: url })
      }
    } catch {
      showToast({ type: 'error', title: 'Не удалось скопировать ссылку' })
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(Math.floor(videoRef.current.currentTime))
    }
  }

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying && !videoRef.current?.src) {
      interval = setInterval(() => {
        setCurrentTime(prev => (prev >= duration ? 0 : prev + 1))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isPlaying, duration])

  const filteredVideos = videos
    .filter(video =>
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.author?.username?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (activeFilter === 'popular') return b.views - a.views
      if (activeFilter === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return 0
    })

  const currentChapter = getCurrentChapter()

  if (viewMode === 'player') {
    const video = selectedVideo?.video
    const author = selectedVideo?.author

    return (
      <Layout>
        <div className="min-h-screen bg-background p-6 animate-rise-in">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={backToGrid}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors duration-150"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Назад к видео</span>
            </button>

            <div className="flex gap-6">
              <div className="flex-1">
                <div
                  ref={videoContainerRef}
                  className="relative rounded-xl overflow-hidden bg-graphite-950 aspect-video group shadow-elev"
                >
                  {video?.video_url ? (
                    <video
                      ref={videoRef}
                      src={video.video_url}
                      className="w-full h-full object-contain"
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setIsPlaying(false)}
                      muted={isMuted}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Film className="w-24 h-24 text-white/20 mx-auto mb-4" strokeWidth={1.5} />
                        <p className="text-white/60 text-sm">{video?.title || 'Select a video'}</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handlePlay}
                      className="h-16 w-16 rounded-full bg-white/95 text-graphite-900 flex items-center justify-center shadow-pop transition-all duration-150 hover:scale-105 animate-scale-in"
                    >
                      {isPlaying ? (
                        <Pause className="w-8 h-8" />
                      ) : (
                        <Play className="w-8 h-8 ml-1" />
                      )}
                    </button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-graphite-950/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div
                      ref={progressRef}
                      className="h-1 bg-white/25 rounded-full cursor-pointer mb-3 relative"
                      onClick={handleProgressClick}
                    >
                      <div
                        className="absolute h-full bg-emerald-400 rounded-full"
                        style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                      />
                      {chapters.map((chapter) => (
                        <div
                          key={chapter.id}
                          className="absolute top-0 w-0.5 h-full bg-white/60"
                          style={{ left: duration ? `${(chapter.timestamp / duration) * 100}%` : '0%' }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button onClick={handlePlay} className="text-white/90 hover:text-white transition-colors duration-150">
                          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                        </button>
                        <button onClick={() => skipTime(-10)} className="text-white/90 hover:text-white transition-colors duration-150">
                          <SkipBack className="w-5 h-5" />
                        </button>
                        <button onClick={() => skipTime(10)} className="text-white/90 hover:text-white transition-colors duration-150">
                          <SkipForward className="w-5 h-5" />
                        </button>
                        <span className="text-white text-sm">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="text-white/90 hover:text-white transition-colors duration-150"
                          >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => {
                              setVolume(Number(e.target.value))
                              setIsMuted(Number(e.target.value) === 0)
                              if (videoRef.current) {
                                videoRef.current.volume = Number(e.target.value) / 100
                              }
                            }}
                            className="w-20 h-1 accent-primary"
                          />
                        </div>
                        
                        <div className="relative">
                          <button 
                            onClick={() => setShowQualityMenu(!showQualityMenu)}
                            className="text-white/90 hover:text-white transition-colors duration-150 flex items-center gap-1"
                          >
                            <Settings className="w-5 h-5" />
                            <span className="text-xs">{selectedQuality}</span>
                          </button>
                          {showQualityMenu && (
                            <div className="absolute bottom-full right-0 mb-2 bg-graphite-950/95 border border-white/10 rounded-xl overflow-hidden min-w-[120px] shadow-pop animate-pop-menu">
                              <button
                                onClick={() => { setSelectedQuality('720p'); setShowQualityMenu(false) }}
                                className="w-full px-4 py-2 text-sm text-white/90 hover:bg-white/10 flex items-center justify-between transition-colors"
                              >
                                <span>720p</span>
                                {selectedQuality === '720p' && <Check className="w-4 h-4 text-emerald-400" />}
                              </button>
                              <button
                                onClick={() => {
                                  if (isPremium) {
                                    setSelectedQuality('1080p')
                                    setShowQualityMenu(false)
                                  }
                                }}
                                disabled={!isPremium}
                                className={cn(
                                  "w-full px-4 py-2 text-sm flex items-center justify-between transition-colors",
                                  isPremium
                                    ? "text-white/90 hover:bg-white/10"
                                    : "text-white/40 cursor-not-allowed"
                                )}
                              >
                                <span className="flex items-center gap-2">
                                  1080p
                                  {!isPremium && <Lock className="w-3 h-3" />}
                                </span>
                                {selectedQuality === '1080p' && <Check className="w-4 h-4 text-emerald-400" />}
                              </button>
                              {!isPremium && (
                                <div className="px-4 py-2 text-xs text-amber-300 border-t border-white/10 flex items-center gap-1">
                                  <Crown className="w-3 h-3" />
                                  <span>Premium для 1080p</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={toggleFullscreen}
                          className="text-white/90 hover:text-white transition-colors duration-150"
                        >
                          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {currentChapter && (
                    <div className="absolute top-4 left-4 bg-graphite-950/70 border border-white/10 rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2 text-white text-sm">
                        <BookOpen className="w-4 h-4" />
                        <span>{currentChapter.title}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <h1 className="text-xl font-semibold font-display tracking-tight text-graphite-900">{video?.title}</h1>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-700 ring-1 ring-border flex items-center justify-center text-white font-semibold">
                          {author?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium">{author?.display_name || author?.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {video && formatViews(video.views)} просмотров
                            {video?.created_at && ` • ${formatDistanceToNow(new Date(video.created_at), { addSuffix: true, locale: ru })}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleLike}
                        className={cn(
                          "flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-all duration-150 ease-standard active:scale-[0.97]",
                          isLiked ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground hover:bg-graphite-200"
                        )}
                      >
                        <ThumbsUp className={cn("w-4 h-4", isLiked && "fill-current animate-scale-in")} />
                        <span>{video ? formatViews(video.likes + (isLiked ? 1 : 0)) : '0'}</span>
                      </button>
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 h-9 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-graphite-200 transition-all duration-150 ease-standard active:scale-[0.97]"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Поделиться</span>
                      </button>
                      <button
                        onClick={handleBookmark}
                        className={cn(
                          "flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-all duration-150 ease-standard active:scale-[0.97]",
                          isBookmarked ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground hover:bg-graphite-200"
                        )}
                      >
                        <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-current animate-scale-in")} />
                        <span>Сохранить</span>
                      </button>
                      {me && video && (Number(me.id) === video.author_id || me.role === 'admin' || me.role === 'super_admin') && (
                        <button
                          onClick={() => setShowDeleteDialog(true)}
                          className="flex items-center gap-2 px-4 h-9 rounded-full bg-danger-soft hover:bg-destructive/15 text-destructive text-sm font-medium transition-all duration-150 active:scale-[0.97]"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Удалить</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {video?.description && (
                    <div className="mt-4 p-4 bg-secondary rounded-xl text-sm">
                      <p className="text-sm whitespace-pre-wrap">{video.description}</p>
                      {video.tags && video.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {video.tags.map((tag, i) => (
                            <span key={i} className="text-xs text-primary hover:underline cursor-pointer">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {chapters.length > 0 && (
                  <div className="mt-6">
                    <button
                      onClick={() => setShowChapters(!showChapters)}
                      className="flex items-center gap-2 text-lg font-semibold mb-3"
                    >
                      <List className="w-5 h-5" />
                      <span>Главы ({chapters.length})</span>
                    </button>
                    {showChapters && (
                      <div className="grid gap-2">
                        {chapters.map((chapter) => (
                          <button
                            key={chapter.id}
                            onClick={() => {
                              setCurrentTime(chapter.timestamp)
                              if (videoRef.current) {
                                videoRef.current.currentTime = chapter.timestamp
                              }
                            }}
                            className={cn(
                              "flex items-center gap-4 p-3 rounded-xl transition-colors duration-150 text-left border",
                              currentChapter?.id === chapter.id
                                ? "bg-accent border-emerald-200"
                                : "bg-secondary/60 hover:bg-secondary border-transparent"
                            )}
                          >
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-accent">
                              <Clock className="w-5 h-5 text-emerald-700" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{chapter.title}</p>
                              {chapter.summary && (
                                <p className="text-sm text-muted-foreground">{chapter.summary}</p>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatTime(chapter.timestamp)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-[360px] shrink-0 hidden lg:block">
                <h2 className="text-lg font-semibold font-display mb-4">Похожие видео</h2>
                <div className="space-y-1">
                  {videos.filter(v => v.id !== video?.id).slice(0, 10).map((v, vi) => (
                    <button
                      key={v.id}
                      onClick={() => selectVideo(v.id)}
                      className="w-full flex gap-3 p-2 rounded-xl transition-colors duration-150 text-left hover:bg-accent/60 animate-rise-in"
                      style={{ animationDelay: `${Math.min(vi, 8) * 40}ms` }}
                    >
                      <div className="w-40 aspect-video rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {v.thumbnail ? (
                          <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-8 h-8 text-graphite-400" />
                        )}
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-graphite-950/70 rounded-md text-[11px] text-white">
                          {formatTime(v.duration)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-2 text-sm">{v.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{v.author?.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatViews(v.views)} просмотров
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteVideo}
          title="Удалить видео"
          message="Удалить видео? Это действие нельзя отменить."
          confirmText="Удалить"
          variant="danger"
          loading={isDeleting}
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background flex animate-rise-in">
        <aside className={cn(
          "hidden md:flex flex-col bg-card border-r border-border transition-all duration-300",
          sidebarCollapsed ? "w-20" : "w-60"
        )}>
          <div className="p-4">
            <div className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "relative w-full flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-all duration-150 ease-standard text-left",
                    selectedCategory === cat.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {selectedCategory === cat.id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                  )}
                  {cat.icon}
                  {!sidebarCollapsed && <span>{cat.name}</span>}
                </button>
              ))}
            </div>

            <div className="my-4 border-t border-border" />

            {user && (
              <div className="space-y-1">
                {userMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      showToast({
                        type: 'info',
                        title: item.name,
                        message: 'Этот раздел появится в одном из ближайших обновлений'
                      })
                    }
                    className="w-full flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-all duration-150 ease-standard text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {item.icon}
                    {!sidebarCollapsed && <span>{item.name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="flex-1 relative w-full sm:max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Поиск видео..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10 pr-4 py-2.5 rounded-full"
                />
              </div>
              
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand active:scale-[0.97] transition-all duration-150 ease-standard"
              >
                <Upload className="w-5 h-5" strokeWidth={1.75} />
                <span>Загрузить</span>
              </button>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {([
                { id: 'all', label: 'Все' },
                { id: 'popular', label: 'Популярные' },
                { id: 'recent', label: 'Недавние' },
              ] as const).map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={cn(
                    "h-8 px-3 rounded-md whitespace-nowrap text-sm transition-all duration-150 ease-standard",
                    activeFilter === filter.id
                      ? "bg-card text-foreground font-medium shadow-soft border border-border"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-graphite-200"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
                    <div className="skeleton aspect-video rounded-none" />
                    <div className="p-3 space-y-2">
                      <div className="skeleton h-4 w-full" />
                      <div className="skeleton h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="text-center py-16 px-6 animate-rise-in">
                <div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mx-auto mb-4">
                  <Film className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                </div>
                <h2 className="text-lg font-semibold mb-1">
                  {searchQuery ? 'Ничего не найдено' : 'Видео пока нет'}
                </h2>
                <p className="text-sm text-muted-foreground max-w-[320px] mx-auto">
                  {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Будьте первым, кто загрузит видео!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredVideos.map((video, videoIndex) => (
                  <button
                    key={video.id}
                    onClick={() => selectVideo(video.id)}
                    className="group text-left rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:-translate-y-0.5 hover:shadow-elev hover:border-graphite-300 transition-all duration-150 animate-rise-in"
                    style={{ animationDelay: `${Math.min(videoIndex, 8) * 30}ms` }}
                  >
                    <div className="relative aspect-video bg-secondary overflow-hidden">
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-graphite-100">
                          <Film className="w-12 h-12 text-graphite-300" strokeWidth={1.5} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-graphite-950/0 group-hover:bg-graphite-950/20 transition-colors flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-white/95 text-graphite-900 shadow-pop flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100">
                          <Play className="w-6 h-6 ml-1" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-graphite-950/70 rounded-md text-[11px] text-white font-medium">
                        {formatTime(video.duration)}
                      </div>
                      {video.quality === '1080p' && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-warning rounded-md text-[11px] text-white font-semibold flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          HD
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-700 ring-1 ring-border flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold">
                          {video.author?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-2 text-sm leading-tight mb-1">
                            {video.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {video.author?.display_name || video.author?.username}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <Eye className="w-3 h-3" />
                            <span>{formatViews(video.views)} просмотров</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(video.created_at), { addSuffix: true, locale: ru })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false)
          loadVideos()
        }}
      />
    </Layout>
  )
}

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('technology')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const videoInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 500 * 1024 * 1024
  const MAX_DURATION_MINUTES = 120
  const MAX_DURATION_SECONDS = MAX_DURATION_MINUTES * 60

  const categoryOptions = [
    { value: 'technology', label: 'Технологии' },
    { value: 'education', label: 'Образование' },
    { value: 'music', label: 'Музыка' },
    { value: 'gaming', label: 'Игры' },
    { value: 'news', label: 'Новости' },
    { value: 'business', label: 'Бизнес' },
    { value: 'entertainment', label: 'Развлечения' },
    { value: 'sports', label: 'Спорт' },
  ]

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Пожалуйста, выберите видео файл')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError('Размер файла не должен превышать 500 МБ')
        return
      }
      
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        const durationSeconds = Math.floor(video.duration)
        if (durationSeconds > MAX_DURATION_SECONDS) {
          setError(`Длительность видео не должна превышать ${MAX_DURATION_MINUTES} минут`)
          return
        }
        setVideoDuration(durationSeconds)
        setVideoFile(file)
        setError('')
      }
      video.onerror = () => {
        setError('Не удалось прочитать видео файл')
      }
      video.src = URL.createObjectURL(file)
    }
  }

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Пожалуйста, выберите изображение')
        return
      }
      setThumbnailFile(file)
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Введите название видео')
      return
    }
    if (!videoFile) {
      setError('Выберите видео файл')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError('')

    try {
      let videoUrl = ''
      let thumbnailUrl = ''

      setUploadProgress(10)
      const videoResult = await uploadAPI.uploadFile(videoFile, 'video')
      videoUrl = videoResult.url
      setUploadProgress(60)

      if (thumbnailFile) {
        const thumbResult = await uploadAPI.uploadFile(thumbnailFile, 'image')
        thumbnailUrl = thumbResult.url
      }
      setUploadProgress(80)

      await videosAPI.createVideo({
        title: title.trim(),
        description: description.trim(),
        video_url: videoUrl,
        thumbnail: thumbnailUrl,
        duration: videoDuration,
        category,
        is_public: true,
      })

      setUploadProgress(100)
      setTitle('')
      setDescription('')
      setCategory('technology')
      setVideoFile(null)
      setThumbnailFile(null)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setCategory('technology')
    setVideoFile(null)
    setVideoDuration(0)
    setThumbnailFile(null)
    setError('')
    setUploadProgress(0)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-graphite-950/40 backdrop-blur-[3px] animate-fade-in-soft" onClick={() => { if (!uploading) { resetForm(); onClose(); } }} />

      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-pop overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
            <Upload className="w-6 h-6 text-primary" />
            Загрузить видео
          </h2>
          <button
            onClick={() => { if (!uploading) { resetForm(); onClose(); } }}
            disabled={uploading}
            className="p-2 rounded-full hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div
            onClick={() => !uploading && videoInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-150",
              videoFile
                ? "border-emerald-300 bg-accent/40"
                : "border-input hover:border-emerald-300 hover:bg-accent/40"
            )}
          >
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoSelect}
              disabled={uploading}
              className="hidden"
            />
            {videoFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileVideo className="w-10 h-10 text-emerald-700" />
                <div className="text-left">
                  <p className="font-medium">{videoFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(videoFile.size / (1024 * 1024)).toFixed(2)} МБ • {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-graphite-300 mx-auto mb-3" strokeWidth={1.5} />
                <p className="font-medium">Нажмите для выбора видео</p>
                <p className="text-sm text-muted-foreground mt-1">
                  MP4, WebM, MOV до 500 МБ, макс. 120 мин
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Название *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите название"
                disabled={uploading}
                className="input-field disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Категория</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={uploading}
                className="input-field disabled:opacity-50"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Расскажите о видео..."
              rows={3}
              disabled={uploading}
              className="input-field resize-none disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Обложка</label>
            <div
              onClick={() => !uploading && thumbnailInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors duration-150",
                thumbnailFile
                  ? "border-emerald-300 bg-accent/40"
                  : "border-input hover:border-emerald-300 hover:bg-accent/40"
              )}
            >
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailSelect}
                disabled={uploading}
                className="hidden"
              />
              {thumbnailFile ? (
                <div className="flex items-center justify-center gap-3">
                  <ImageIcon className="w-8 h-8 text-emerald-700" />
                  <span className="font-medium">{thumbnailFile.name}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-5 h-5" />
                  <span>Выбрать обложку (опционально)</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-danger-soft border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Загрузка...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              disabled={uploading}
              className="flex-1 h-10 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-graphite-200 transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={uploading || !videoFile || !title.trim()}
              className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-soft hover:bg-emerald-800 hover:shadow-lg-brand transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Загрузить
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
