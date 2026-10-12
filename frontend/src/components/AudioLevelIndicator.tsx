import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface AudioLevelIndicatorProps {
  stream: MediaStream | null
  className?: string
  barCount?: number
  showLabel?: boolean
  label?: string
  isActive?: boolean
}

export const AudioLevelIndicator: React.FC<AudioLevelIndicatorProps> = ({
  stream,
  className,
  barCount = 5,
  showLabel = false,
  label = 'Audio',
  isActive = true
}) => {
  const [levels, setLevels] = useState<number[]>(new Array(barCount).fill(0))
  const [isTransmitting, setIsTransmitting] = useState(false)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  useEffect(() => {
    if (!stream || !isActive) {
      setLevels(new Array(barCount).fill(0))
      setIsTransmitting(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      console.log('[AudioIndicator] No audio tracks in stream')
      return
    }

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext()
      }
      
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      analyserRef.current.smoothingTimeConstant = 0.8

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream)
      sourceRef.current.connect(analyserRef.current)

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

      const updateLevels = () => {
        if (!analyserRef.current) return

        analyserRef.current.getByteFrequencyData(dataArray)

        const binSize = Math.floor(dataArray.length / barCount)
        const newLevels: number[] = []
        let totalLevel = 0

        for (let i = 0; i < barCount; i++) {
          let sum = 0
          for (let j = 0; j < binSize; j++) {
            sum += dataArray[i * binSize + j]
          }
          const avg = sum / binSize / 255
          newLevels.push(avg)
          totalLevel += avg
        }

        setLevels(newLevels)
        setIsTransmitting(totalLevel / barCount > 0.05)

        animationFrameRef.current = requestAnimationFrame(updateLevels)
      }

      updateLevels()
    } catch (error) {
      console.error('[AudioIndicator] Failed to initialize audio context:', error)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect()
        sourceRef.current = null
      }
    }
  }, [stream, barCount, isActive])

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {showLabel && (
        <span className={cn(
          'text-xs mr-2 transition-colors',
          isTransmitting ? 'text-green-400' : 'text-muted-foreground'
        )}>
          {label}
        </span>
      )}
      <div className="flex items-end gap-0.5 h-4">
        {levels.map((level, index) => (
          <div
            key={index}
            className={cn(
              'w-1 rounded-sm transition-all duration-75',
              isTransmitting ? 'bg-green-500' : 'bg-muted'
            )}
            style={{
              height: `${Math.max(4, level * 16)}px`,
              opacity: isActive ? 1 : 0.3
            }}
          />
        ))}
      </div>
      {isTransmitting && (
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
      )}
    </div>
  )
}

interface AudioLogEntry {
  id: string
  timestamp: Date
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
}

interface AudioLogsPanelProps {
  logs: AudioLogEntry[]
  className?: string
  maxLogs?: number
}

export const AudioLogsPanel: React.FC<AudioLogsPanelProps> = ({
  logs,
  className,
  maxLogs = 50
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const displayLogs = logs.slice(-maxLogs)

  const getTypeColor = (type: AudioLogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-400'
      case 'warning':
        return 'text-yellow-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-muted-foreground'
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className={cn(
      'bg-background/90 rounded-lg border border-border p-3',
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-white">Audio Logs</h4>
        <span className="text-xs text-muted-foreground">{displayLogs.length} events</span>
      </div>
      <div
        ref={scrollRef}
        className="h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
      >
        {displayLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No audio events yet...</p>
        ) : (
          <div className="space-y-1">
            {displayLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{formatTime(log.timestamp)}</span>
                <span className={cn('flex-1', getTypeColor(log.type))}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const useAudioLogger = () => {
  const [logs, setLogs] = useState<AudioLogEntry[]>([])

  const addLog = (type: AudioLogEntry['type'], message: string) => {
    const entry: AudioLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      message
    }
    setLogs(prev => [...prev.slice(-99), entry])
    console.log(`[AudioLog] ${type.toUpperCase()}: ${message}`)
  }

  const logInfo = (message: string) => addLog('info', message)
  const logWarning = (message: string) => addLog('warning', message)
  const logError = (message: string) => addLog('error', message)
  const logSuccess = (message: string) => addLog('success', message)

  const clearLogs = () => setLogs([])

  return {
    logs,
    addLog,
    logInfo,
    logWarning,
    logError,
    logSuccess,
    clearLogs
  }
}

export default AudioLevelIndicator
