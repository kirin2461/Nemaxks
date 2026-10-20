import React from 'react'

/**
 * MarkdownText — лёгкий рендерер markdown-подмножества для сообщений.
 *
 * Поддерживает: **bold**, *italic*, `inline code`, ```code blocks```,
 * маркированные (-, *) и нумерованные (1.) списки.
 *
 * Безопасность: HTML НЕ интерполируется — весь текст рендерится как
 * React-узлы (dangerouslySetInnerHTML не используется), поэтому
 * инъекция разметки/скриптов невозможна by construction.
 */

// Инлайн-токены: `code`, **bold**, *italic*. Порядок важен: code первым,
// чтобы внутри кода не парсилось форматирование.
const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  INLINE_RE.lastIndex = 0

  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    const key = `${keyPrefix}-${i++}`
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="px-1 py-0.5 rounded bg-secondary border border-border font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

type Block =
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'paragraph'; lines: string[] }

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  // Сначала вырезаем fenced code blocks, чтобы их содержимое не парсилось.
  const segments = text.split(/```([^\n`]*)\n?/)
  // split с группой: [текст, lang, код, текст, lang, код, ...]
  for (let s = 0; s < segments.length; s++) {
    if (s % 2 === 1) {
      const lang = segments[s]
      const code = segments[s + 1] ?? ''
      blocks.push({ kind: 'code', lang, text: code.replace(/\n$/, '') })
      s++ // пропускаем сегмент кода
      continue
    }

    const lines = segments[s].split('\n')
    let paragraph: string[] = []
    const flushParagraph = () => {
      if (paragraph.length > 0) {
        blocks.push({ kind: 'paragraph', lines: paragraph })
        paragraph = []
      }
    }

    for (const line of lines) {
      const ulMatch = line.match(/^\s*[-*]\s+(.+)$/)
      const olMatch = line.match(/^\s*\d+[.)]\s+(.+)$/)
      if (ulMatch) {
        flushParagraph()
        const last = blocks[blocks.length - 1]
        if (last && last.kind === 'ul') {
          last.items.push(ulMatch[1])
        } else {
          blocks.push({ kind: 'ul', items: [ulMatch[1]] })
        }
      } else if (olMatch) {
        flushParagraph()
        const last = blocks[blocks.length - 1]
        if (last && last.kind === 'ol') {
          last.items.push(olMatch[1])
        } else {
          blocks.push({ kind: 'ol', items: [olMatch[1]] })
        }
      } else {
        paragraph.push(line)
      }
    }
    flushParagraph()
  }
  return blocks
}

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text])

  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        switch (block.kind) {
          case 'code':
            return (
              <pre
                key={bi}
                className="my-1 p-2 rounded-lg bg-secondary border border-border overflow-x-auto"
              >
                <code className="font-mono text-[0.85em] whitespace-pre">{block.text}</code>
              </pre>
            )
          case 'ul':
            return (
              <ul key={bi} className="list-disc pl-5 my-0.5">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item, `ul-${bi}-${ii}`)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={bi} className="list-decimal pl-5 my-0.5">
                {block.items.map((item, ii) => (
                  <li key={ii}>{renderInline(item, `ol-${bi}-${ii}`)}</li>
                ))}
              </ol>
            )
          case 'paragraph':
            return (
              <p key={bi} className="whitespace-pre-wrap break-words">
                {block.lines.map((line, li) => (
                  <React.Fragment key={li}>
                    {li > 0 && '\n'}
                    {renderInline(line, `p-${bi}-${li}`)}
                  </React.Fragment>
                ))}
              </p>
            )
        }
      })}
    </div>
  )
}

export default MarkdownText
