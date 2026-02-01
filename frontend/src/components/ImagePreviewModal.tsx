import React, { useState } from 'react'
import { Modal } from './Modal'
import { Download, ZoomIn, ZoomOut, RotateCw, X } from 'lucide-react'

interface ImagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  alt?: string
}

export function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  alt = 'Image'
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = alt || 'image'
    link.click()
  }

  const handleClose = () => {
    setZoom(1)
    setRotation(0)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="full" showCloseButton={false}>
      <div className="relative -m-4">
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={handleZoomOut}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
            title="Уменьшить"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
            title="Увеличить"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
            title="Повернуть"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
            title="Скачать"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={handleClose}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-center min-h-[60vh] overflow-auto p-8">
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-full max-h-[70vh] object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
          />
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-lg text-white text-sm">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </Modal>
  )
}

export default ImagePreviewModal
