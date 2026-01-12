import { useState, useEffect, useCallback } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2, Save, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import type { ChannelTool } from '@/lib/api'

interface NotebookProps {
  tool: ChannelTool
  onSave?: (content: string) => void
  readOnly?: boolean
}

interface NotebookContent {
  blocks: Block[]
}

interface Block {
  id: string
  type: 'paragraph' | 'heading1' | 'heading2' | 'list' | 'ordered-list'
  content: string
  styles?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    align?: 'left' | 'center' | 'right'
  }
}

export function Notebook({ tool, onSave, readOnly = false }: NotebookProps) {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: crypto.randomUUID(), type: 'paragraph', content: '', styles: {} }
  ])
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [savedStatus, setSavedStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')

  useEffect(() => {
    if (tool.content && tool.content !== '{}') {
      try {
        const parsed: NotebookContent = JSON.parse(tool.content)
        if (parsed.blocks && parsed.blocks.length > 0) {
          setBlocks(parsed.blocks)
        }
      } catch {
      }
    }
  }, [tool.content])

  const handleBlockChange = (id: string, content: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b))
    setSavedStatus('unsaved')
  }

  const handleBlockKeyDown = (e: React.KeyboardEvent, blockId: string, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const newBlock: Block = {
        id: crypto.randomUUID(),
        type: 'paragraph',
        content: '',
        styles: {}
      }
      setBlocks(prev => [
        ...prev.slice(0, index + 1),
        newBlock,
        ...prev.slice(index + 1)
      ])
      setTimeout(() => {
        const newEl = document.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLElement
        newEl?.focus()
      }, 0)
    } else if (e.key === 'Backspace' && blocks[index].content === '' && blocks.length > 1) {
      e.preventDefault()
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      if (index > 0) {
        setTimeout(() => {
          const prevEl = document.querySelector(`[data-block-id="${blocks[index - 1].id}"]`) as HTMLElement
          prevEl?.focus()
        }, 0)
      }
    }
  }

  const setBlockType = (type: Block['type']) => {
    if (!activeBlockId) return
    setBlocks(prev => prev.map(b => b.id === activeBlockId ? { ...b, type } : b))
    setSavedStatus('unsaved')
  }

  const toggleStyle = (style: keyof NonNullable<Block['styles']>) => {
    if (!activeBlockId) return
    setBlocks(prev => prev.map(b => {
      if (b.id === activeBlockId) {
        return {
          ...b,
          styles: {
            ...b.styles,
            [style]: !b.styles?.[style]
          }
        }
      }
      return b
    }))
    setSavedStatus('unsaved')
  }

  const setAlignment = (align: 'left' | 'center' | 'right') => {
    if (!activeBlockId) return
    setBlocks(prev => prev.map(b => {
      if (b.id === activeBlockId) {
        return {
          ...b,
          styles: { ...b.styles, align }
        }
      }
      return b
    }))
    setSavedStatus('unsaved')
  }

  const handleSave = useCallback(() => {
    setSavedStatus('saving')
    const content = JSON.stringify({ blocks })
    onSave?.(content)
    setSavedStatus('saved')
  }, [blocks, onSave])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (savedStatus === 'unsaved' && onSave) {
        handleSave()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [blocks, savedStatus, handleSave, onSave])

  const getBlockStyles = (block: Block): React.CSSProperties => {
    const styles: React.CSSProperties = {}
    if (block.styles?.bold) styles.fontWeight = 'bold'
    if (block.styles?.italic) styles.fontStyle = 'italic'
    if (block.styles?.underline) styles.textDecoration = 'underline'
    if (block.styles?.align) styles.textAlign = block.styles.align
    return styles
  }

  const getBlockClassName = (block: Block): string => {
    switch (block.type) {
      case 'heading1': return 'text-2xl font-bold'
      case 'heading2': return 'text-xl font-semibold'
      case 'list': return 'list-disc list-inside'
      case 'ordered-list': return 'list-decimal list-inside'
      default: return ''
    }
  }

  const activeBlock = blocks.find(b => b.id === activeBlockId)

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border">
      <div className="flex items-center gap-2 p-2 border-b flex-wrap">
        <div className="flex items-center gap-1 border-r pr-2">
          <button
            onClick={() => setBlockType('heading1')}
            className={`p-2 rounded ${activeBlock?.type === 'heading1' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Heading 1"
            disabled={readOnly}
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setBlockType('heading2')}
            className={`p-2 rounded ${activeBlock?.type === 'heading2' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Heading 2"
            disabled={readOnly}
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setBlockType('list')}
            className={`p-2 rounded ${activeBlock?.type === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Bullet List"
            disabled={readOnly}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setBlockType('ordered-list')}
            className={`p-2 rounded ${activeBlock?.type === 'ordered-list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Numbered List"
            disabled={readOnly}
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          <button
            onClick={() => toggleStyle('bold')}
            className={`p-2 rounded ${activeBlock?.styles?.bold ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Bold"
            disabled={readOnly}
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleStyle('italic')}
            className={`p-2 rounded ${activeBlock?.styles?.italic ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Italic"
            disabled={readOnly}
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleStyle('underline')}
            className={`p-2 rounded ${activeBlock?.styles?.underline ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Underline"
            disabled={readOnly}
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-r pr-2">
          <button
            onClick={() => setAlignment('left')}
            className={`p-2 rounded ${activeBlock?.styles?.align === 'left' || !activeBlock?.styles?.align ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Align Left"
            disabled={readOnly}
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAlignment('center')}
            className={`p-2 rounded ${activeBlock?.styles?.align === 'center' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Center"
            disabled={readOnly}
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAlignment('right')}
            className={`p-2 rounded ${activeBlock?.styles?.align === 'right' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            title="Align Right"
            disabled={readOnly}
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">
            {savedStatus === 'saved' && 'Saved'}
            {savedStatus === 'unsaved' && 'Unsaved changes'}
            {savedStatus === 'saving' && 'Saving...'}
          </span>
          {onSave && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
              disabled={readOnly}
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-background">
        <div className="max-w-3xl mx-auto space-y-2">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              contentEditable={!readOnly}
              data-block-id={block.id}
              className={`min-h-[1.5em] outline-none p-2 rounded hover:bg-muted/30 focus:bg-muted/50 ${getBlockClassName(block)}`}
              style={getBlockStyles(block)}
              onFocus={() => setActiveBlockId(block.id)}
              onInput={(e) => handleBlockChange(block.id, (e.target as HTMLElement).innerText)}
              onKeyDown={(e) => handleBlockKeyDown(e, block.id, index)}
              suppressContentEditableWarning
            >
              {block.content || (index === 0 && !readOnly ? 'Start typing...' : '')}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
