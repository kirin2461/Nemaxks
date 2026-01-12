import { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Eraser, Square, Circle, Type, Trash2, Download, Palette, Minus, Plus } from 'lucide-react'
import type { ChannelTool } from '@/lib/api'

interface Point {
  x: number
  y: number
}

interface DrawingElement {
  id: string
  type: 'path' | 'rect' | 'circle' | 'text'
  points?: Point[]
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  color: string
  strokeWidth: number
}

interface WhiteboardProps {
  tool: ChannelTool
  onSave?: (content: string) => void
  readOnly?: boolean
}

const COLORS = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF']

export function Whiteboard({ tool, onSave, readOnly = false }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [elements, setElements] = useState<DrawingElement[]>([])
  const [currentTool, setCurrentTool] = useState<'pencil' | 'eraser' | 'rect' | 'circle' | 'text'>('pencil')
  const [color, setColor] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<Point[]>([])
  const [startPoint, setStartPoint] = useState<Point | null>(null)

  useEffect(() => {
    if (tool.content && tool.content !== '{}') {
      try {
        const parsed = JSON.parse(tool.content)
        if (parsed.elements) {
          setElements(parsed.elements)
        }
      } catch {
      }
    }
  }, [tool.content])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    elements.forEach(el => {
      ctx.strokeStyle = el.color
      ctx.lineWidth = el.strokeWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (el.type === 'path' && el.points) {
        ctx.beginPath()
        el.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        })
        ctx.stroke()
      } else if (el.type === 'rect' && el.x !== undefined && el.y !== undefined) {
        ctx.strokeRect(el.x, el.y, el.width || 0, el.height || 0)
      } else if (el.type === 'circle' && el.x !== undefined && el.y !== undefined) {
        ctx.beginPath()
        const radius = Math.sqrt(Math.pow(el.width || 0, 2) + Math.pow(el.height || 0, 2))
        ctx.arc(el.x, el.y, radius, 0, Math.PI * 2)
        ctx.stroke()
      } else if (el.type === 'text' && el.text && el.x !== undefined && el.y !== undefined) {
        ctx.fillStyle = el.color
        ctx.font = `${el.strokeWidth * 8}px sans-serif`
        ctx.fillText(el.text, el.x, el.y)
      }
    })
  }, [elements])

  useEffect(() => {
    redraw()
  }, [redraw])

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    const point = getCanvasPoint(e)
    setIsDrawing(true)

    if (currentTool === 'pencil' || currentTool === 'eraser') {
      setCurrentPath([point])
    } else if (currentTool === 'rect' || currentTool === 'circle') {
      setStartPoint(point)
    } else if (currentTool === 'text') {
      const text = prompt('Enter text:')
      if (text) {
        const newEl: DrawingElement = {
          id: crypto.randomUUID(),
          type: 'text',
          x: point.x,
          y: point.y,
          text,
          color,
          strokeWidth
        }
        setElements(prev => [...prev, newEl])
      }
      setIsDrawing(false)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return
    const point = getCanvasPoint(e)

    if (currentTool === 'pencil' || currentTool === 'eraser') {
      setCurrentPath(prev => [...prev, point])
      
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (ctx && currentPath.length > 0) {
        ctx.strokeStyle = currentTool === 'eraser' ? '#FFFFFF' : color
        ctx.lineWidth = currentTool === 'eraser' ? strokeWidth * 5 : strokeWidth
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      }
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing || readOnly) return
    setIsDrawing(false)

    if ((currentTool === 'pencil' || currentTool === 'eraser') && currentPath.length > 1) {
      const newEl: DrawingElement = {
        id: crypto.randomUUID(),
        type: 'path',
        points: currentPath,
        color: currentTool === 'eraser' ? '#FFFFFF' : color,
        strokeWidth: currentTool === 'eraser' ? strokeWidth * 5 : strokeWidth
      }
      setElements(prev => [...prev, newEl])
    }

    setCurrentPath([])
    setStartPoint(null)
  }

  const handleClear = () => {
    setElements([])
    redraw()
  }

  const handleSave = () => {
    const content = JSON.stringify({ elements })
    onSave?.(content)
  }

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${tool.title || 'whiteboard'}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border">
      <div className="flex items-center gap-2 p-2 border-b flex-wrap">
        <div className="flex items-center gap-1 border-r pr-2">
          <button
            onClick={() => setCurrentTool('pencil')}
            className={`p-2 rounded ${currentTool === 'pencil' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Pencil"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentTool('eraser')}
            className={`p-2 rounded ${currentTool === 'eraser' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentTool('rect')}
            className={`p-2 rounded ${currentTool === 'rect' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentTool('circle')}
            className={`p-2 rounded ${currentTool === 'circle' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Circle"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentTool('text')}
            className={`p-2 rounded ${currentTool === 'text' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Text"
          >
            <Type className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded border-2 ${color === c ? 'border-primary' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          <button onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))} className="p-1 hover:bg-muted rounded">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs w-6 text-center">{strokeWidth}</span>
          <button onClick={() => setStrokeWidth(Math.min(20, strokeWidth + 1))} className="p-1 hover:bg-muted rounded">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={handleClear} className="p-2 hover:bg-muted rounded text-destructive" title="Clear">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={handleDownload} className="p-2 hover:bg-muted rounded" title="Download">
            <Download className="w-4 h-4" />
          </button>
          {onSave && (
            <button onClick={handleSave} className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">
              Save
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="border rounded bg-white cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  )
}
