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
  ImageIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { videosAPI, VideoWithAuthor, VideoChapter, VideoDetail, uploadAPI } from '@/lib/api'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const isPremium = user?.is_premium || false

  useEffect(() => {
    loadVideos()
  }, [selectedCategory])

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
      setViewMode('player')
      videosAPI.incrementView(videoId).catch(() => {})
    } catch (error) {
      console.error('Failed to load video:', error)
    }
  }

  const backToGrid = () => {
    setViewMode('grid')
    setSelectedVideo(null)
    setIsPlaying(false)
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

  const filteredVideos = videos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.author?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const currentChapter = getCurrentChapter()

  if (viewMode === 'player') {
    const video = selectedVideo?.video
    const author = selectedVideo?.author

    return (
      <Layout>
        <div className="min-h-screen p-6">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={backToGrid}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Назад к видео</span>
            </button>

            <div className="flex gap-6">
              <div className="flex-1">
                <div
                  ref={videoContainerRef}
                  className="relative rounded-2xl overflow-hidden bg-black aspect-video group"
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
                        <Film className="w-24 h-24 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground">{video?.title || 'Select a video'}</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handlePlay}
                      className="w-20 h-20 rounded-full bg-primary/80 flex items-center justify-center hover:bg-primary transition-colors hover:scale-110"
                    >
                      {isPlaying ? (
                        <Pause className="w-10 h-10 text-white" />
                      ) : (
                        <Play className="w-10 h-10 text-white ml-1" />
                      )}
                    </button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div
                      ref={progressRef}
                      className="h-1 bg-white/30 rounded-full cursor-pointer mb-4 relative"
                      onClick={handleProgressClick}
                    >
                      <div
                        className="absolute h-full bg-primary rounded-full"
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
                        <button onClick={handlePlay} className="text-white hover:text-primary transition-colors">
                          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                        </button>
                        <button onClick={() => skipTime(-10)} className="text-white hover:text-primary transition-colors">
                          <SkipBack className="w-5 h-5" />
                        </button>
                        <button onClick={() => skipTime(10)} className="text-white hover:text-primary transition-colors">
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
                            className="text-white hover:text-primary transition-colors"
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
                            className="text-white hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <Settings className="w-5 h-5" />
                            <span className="text-xs">{selectedQuality}</span>
                          </button>
                          {showQualityMenu && (
                            <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-lg overflow-hidden min-w-[120px]">
                              <button
                                onClick={() => { setSelectedQuality('720p'); setShowQualityMenu(false) }}
                                className="w-full px-4 py-2 text-sm text-white hover:bg-white/10 flex items-center justify-between"
                              >
                                <span>720p</span>
                                {selectedQuality === '720p' && <Check className="w-4 h-4 text-primary" />}
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
                                  "w-full px-4 py-2 text-sm flex items-center justify-between",
                                  isPremium 
                                    ? "text-white hover:bg-white/10" 
                                    : "text-white/50 cursor-not-allowed"
                                )}
                              >
                                <span className="flex items-center gap-2">
                                  1080p
                                  {!isPremium && <Lock className="w-3 h-3" />}
                                </span>
                                {selectedQuality === '1080p' && <Check className="w-4 h-4 text-primary" />}
                              </button>
                              {!isPremium && (
                                <div className="px-4 py-2 text-xs text-amber-400 border-t border-white/10 flex items-center gap-1">
                                  <Crown className="w-3 h-3" />
                                  <span>Premium для 1080p</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={toggleFullscreen}
                          className="text-white hover:text-primary transition-colors"
                        >
                          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {currentChapter && (
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2 text-white text-sm">
                        <BookOpen className="w-4 h-4" />
                        <span>{currentChapter.title}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <h1 className="text-2xl font-bold">{video?.title}</h1>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
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
                          "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
                          isLiked ? "bg-primary text-white" : "bg-secondary hover:bg-secondary/80"
                        )}
                      >
                        <ThumbsUp className="w-5 h-5" />
                        <span>{video ? formatViews(video.likes + (isLiked ? 1 : 0)) : '0'}</span>
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
                        <Share2 className="w-5 h-5" />
                        <span>Поделиться</span>
                      </button>
                      <button
                        onClick={handleBookmark}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
                          isBookmarked ? "bg-primary text-white" : "bg-secondary hover:bg-secondary/80"
                        )}
                      >
                        <Bookmark className="w-5 h-5" />
                        <span>Сохранить</span>
                      </button>
                      <button className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {video?.description && (
                    <div className="mt-4 p-4 bg-secondary/50 rounded-xl">
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
                              "flex items-center gap-4 p-3 rounded-xl transition-colors text-left",
                              currentChapter?.id === chapter.id
                                ? "bg-primary/20 border border-primary"
                                : "bg-secondary/50 hover:bg-secondary"
                            )}
                          >
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                              <Clock className="w-5 h-5 text-primary" />
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

              <div className="w-80 hidden lg:block">
                <h2 className="text-lg font-semibold mb-4">Похожие видео</h2>
                <div className="space-y-3">
                  {videos.filter(v => v.id !== video?.id).slice(0, 10).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => selectVideo(v.id)}
                      className="w-full flex gap-3 p-2 rounded-xl transition-colors text-left hover:bg-secondary"
                    >
                      <div className="w-32 h-20 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {v.thumbnail ? (
                          <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-8 h-8 text-muted-foreground" />
                        )}
                        <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[10px] text-white">
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
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="min-h-screen flex">
        <aside className={cn(
          "hidden md:flex flex-col bg-card/50 border-r border-border transition-all duration-300",
          sidebarCollapsed ? "w-20" : "w-60"
        )}>
          <div className="p-4">
            <div className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    selectedCategory === cat.id
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {cat.icon}
                  {!sidebarCollapsed && <span className="text-sm font-medium">{cat.name}</span>}
                </button>
              ))}
            </div>

            <div className="my-4 border-t border-border" />

            {user && (
              <div className="space-y-1">
                {userMenuItems.map((item) => (
                  <button
                    key={item.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {item.icon}
                    {!sidebarCollapsed && <span className="text-sm font-medium">{item.name}</span>}
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
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary rounded-full border border-transparent focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors font-medium"
              >
                <Upload className="w-5 h-5" />
                <span>Загрузить</span>
              </button>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {['Все', 'Популярные', 'Недавние', 'По подписке'].map((filter) => (
                <button
                  key={filter}
                  className={cn(
                    "px-4 py-1.5 rounded-lg whitespace-nowrap text-sm font-medium transition-colors",
                    filter === 'Все'
                      ? "bg-foreground text-background"
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="text-center py-20">
                <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">
                  {searchQuery ? 'Ничего не найдено' : 'Видео пока нет'}
                </h2>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Будьте первым, кто загрузит видео!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredVideos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => selectVideo(video.id)}
                    className="group text-left rounded-xl overflow-hidden bg-card hover:bg-card/80 transition-all hover:shadow-lg"
                  >
                    <div className="relative aspect-video bg-secondary overflow-hidden">
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-secondary/50">
                          <Film className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100">
                          <Play className="w-7 h-7 text-white ml-1" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-xs text-white font-medium">
                        {formatTime(video.duration)}
                      </div>
                      {video.quality === '1080p' && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded text-xs text-white font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          HD
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!uploading) { resetForm(); onClose(); } }} />
      
      <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold flex items-center gap-2">
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
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              videoFile
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-secondary/50"
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
                <FileVideo className="w-10 h-10 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{videoFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(videoFile.size / (1024 * 1024)).toFixed(2)} МБ • {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
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
                className="w-full px-4 py-2.5 bg-secondary rounded-lg border border-transparent focus:border-primary focus:outline-none transition-colors disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Категория</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={uploading}
                className="w-full px-4 py-2.5 bg-secondary rounded-lg border border-transparent focus:border-primary focus:outline-none transition-colors disabled:opacity-50"
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
              className="w-full px-4 py-2.5 bg-secondary rounded-lg border border-transparent focus:border-primary focus:outline-none transition-colors resize-none disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Обложка</label>
            <div
              onClick={() => !uploading && thumbnailInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
                thumbnailFile
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
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
                  <ImageIcon className="w-8 h-8 text-primary" />
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
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
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
              className="flex-1 px-4 py-2.5 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50 font-medium"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={uploading || !videoFile || !title.trim()}
              className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
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
