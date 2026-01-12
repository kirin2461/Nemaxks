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
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { videosAPI, VideoWithAuthor, VideoChapter, VideoDetail } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

type ViewMode = 'grid' | 'player'

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
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const isPremium = user?.is_premium || false

  useEffect(() => {
    loadVideos()
  }, [])

  const loadVideos = async () => {
    try {
      setLoading(true)
      const data = await videosAPI.getVideos({ limit: 50 })
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

  const currentChapter = getCurrentChapter()

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    )
  }

  if (videos.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Видео пока нет</h2>
            <p className="text-muted-foreground">Будьте первым, кто загрузит видео!</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (viewMode === 'grid') {
    return (
      <Layout>
        <div className="min-h-screen p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Видео</h1>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <Upload className="w-5 h-5" />
                <span>Загрузить</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => selectVideo(video.id)}
                  className="group text-left rounded-xl overflow-hidden bg-card hover:bg-card/80 transition-all hover:shadow-lg hover:scale-[1.02]"
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
                          <span>{formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

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
                          {video?.created_at && ` • ${formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}`}
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
