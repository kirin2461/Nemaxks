import { useState, useRef, useCallback } from 'react';
import { X, Upload, Image, Video, Loader2 } from 'lucide-react';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  compressed?: File;
}

interface MediaUploadProps {
  onMediaSelect: (file: File, preview: string, type: 'image' | 'video') => void;
  onClear: () => void;
  selectedMedia: MediaFile | null;
  maxSizeMB?: number;
  compressionQuality?: number;
}

const compressImage = async (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not compress image'));
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
};

const compressVideo = async (file: File, maxSizeMB: number): Promise<File> => {
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`Video file too large. Maximum size is ${maxSizeMB}MB. Please compress the video before uploading.`);
  }
  return file;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export function MediaUpload({
  onMediaSelect,
  onClear,
  selectedMedia,
  maxSizeMB = 10,
  compressionQuality = 0.8,
}: MediaUploadProps) {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{
    original: number;
    compressed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        alert('Please select an image or video file');
        return;
      }
      
      setIsCompressing(true);
      setCompressionStats(null);

      try {
        let processedFile = file;
        const originalSize = file.size;

        if (isImage && file.size > 500 * 1024) {
          processedFile = await compressImage(file, 1920, 1080, compressionQuality);
        } else if (isVideo) {
          processedFile = await compressVideo(file, maxSizeMB);
        }

        if (processedFile.size !== originalSize) {
          setCompressionStats({
            original: originalSize,
            compressed: processedFile.size,
          });
        }

        const preview = URL.createObjectURL(processedFile);
        onMediaSelect(processedFile, preview, isImage ? 'image' : 'video');
      } catch (error) {
        console.error('Error processing file:', error);
        if (error instanceof Error) {
          alert(error.message);
        }
        setIsCompressing(false);
        return;
      } finally {
        setIsCompressing(false);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [maxSizeMB, compressionQuality, onMediaSelect]
  );

  const handleClear = useCallback(() => {
    setCompressionStats(null);
    onClear();
  }, [onClear]);

  return (
    <div className="media-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
        id="media-upload-input"
      />

      {!selectedMedia && !isCompressing && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          title="Attach image or video"
        >
          <Upload className="w-5 h-5" />
        </button>
      )}

      {isCompressing && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Compressing...</span>
        </div>
      )}

      {selectedMedia && !isCompressing && (
        <div className="relative inline-block">
          <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/20">
            {selectedMedia.type === 'image' ? (
              <img
                src={selectedMedia.preview}
                alt="Preview"
                className="max-w-[200px] max-h-[150px] object-cover"
              />
            ) : (
              <video
                src={selectedMedia.preview}
                className="max-w-[200px] max-h-[150px] object-cover"
                controls
              />
            )}

            <button
              type="button"
              onClick={handleClear}
              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="absolute bottom-1 left-1 flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 text-xs text-white">
              {selectedMedia.type === 'image' ? (
                <Image className="w-3 h-3" />
              ) : (
                <Video className="w-3 h-3" />
              )}
              {compressionStats && (
                <span className="text-green-400">
                  {formatFileSize(compressionStats.compressed)}
                  <span className="text-gray-400 line-through ml-1">
                    {formatFileSize(compressionStats.original)}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaUpload;
