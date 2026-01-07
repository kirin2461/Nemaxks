import { useState, useRef, useEffect, useCallback } from 'react'
import { Layout } from '@/components/Layout'
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
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { videosAPI, VideoWithAuthor, VideoChapter, VideoDetail } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function VideoPage() {
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
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadVideos()
  }, [])

  const loadVideos = async () => {
    try {
      setLoading(true)
      const data = await videosAPI.getVideos({ limit: 20 })
      setVideos(data || [])
      if (data && data.length > 0) {
        await selectVideo(data[0].id)
      }
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
      videosAPI.incrementView(videoId).catch(() => {})
    } catch (error) {
      console.error('Failed to load video:', error)
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

  if (!selectedVideo && videos.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Videos Yet</h2>
            <p className="text-muted-foreground">Be the first to upload a video!</p>
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
                      <button className="text-white hover:text-primary transition-colors">
                        <Settings className="w-5 h-5" />
                      </button>
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
                          {video && formatViews(video.views)} views
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
                      <span>Share</span>
                    </button>
                    <button
                      onClick={handleBookmark}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
                        isBookmarked ? "bg-primary text-white" : "bg-secondary hover:bg-secondary/80"
                      )}
                    >
                      <Bookmark className="w-5 h-5" />
                      <span>Save</span>
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
                    <span>Chapters ({chapters.length})</span>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Related Videos</h2>
                <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <Upload className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                {videos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => selectVideo(v.id)}
                    className={cn(
                      "w-full flex gap-3 p-2 rounded-xl transition-colors text-left",
                      video?.id === v.id ? "bg-primary/20" : "hover:bg-secondary"
                    )}
                  >
                    <div className="w-32 h-20 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {v.thumbnail ? (
                        <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover" />
                      ) : (
                        <Film className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-2">{v.title}</p>
                      <p className="text-sm text-muted-foreground">{v.author?.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatViews(v.views)} views • {formatTime(v.duration)}
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
