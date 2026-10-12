import React from 'react'
import { Modal } from './Modal'
import { Copy, Check, Share2 } from 'lucide-react'

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  value: string
  description?: string
}

export function QRCodeModal({
  isOpen,
  onClose,
  title,
  value,
  description
}: QRCodeModalProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: value
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err)
        }
      }
    }
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="text-center space-y-4">
        <div className="bg-white p-4 rounded-xl inline-block shadow-glow">
          <img
            src={qrCodeUrl}
            alt="QR Code"
            className="w-48 h-48"
          />
        </div>

        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}

        <div className="p-3 bg-muted/40 border border-border rounded-lg">
          <p className="text-foreground text-sm font-mono break-all">{value}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 px-4 py-2 bg-muted/60 hover:bg-muted rounded-lg text-foreground transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-accent" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Копировать
              </>
            )}
          </button>
          {typeof navigator.share === 'function' && (
            <button
              onClick={handleShare}
              className="flex-1 px-4 py-2 gradient-brand rounded-lg text-primary-foreground font-medium shadow-soft hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Поделиться
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default QRCodeModal
