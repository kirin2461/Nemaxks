'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, FileIcon, CheckCircle } from 'lucide-react';

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface FileUploadProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  maxSize?: number; // in MB
  allowedTypes?: string[];
  multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  maxSize = 50,
  allowedTypes = ['image/*', 'application/pdf', 'text/*'],
  multiple = true,
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (selectedFiles: File[]) => {
    const newFiles = selectedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    setFiles(prev => (multiple ? [...prev, ...newFiles] : newFiles));
    onFilesSelected(selectedFiles);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
          isDragging
            ? 'border-primary bg-accent'
            : 'border-graphite-300 bg-card hover:border-emerald-300 hover:bg-accent'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
          accept={allowedTypes.join(',')}
        />
        <div className="flex justify-center mb-3">
          <Upload size={32} className="text-primary" />
        </div>
        <p className="text-lg font-semibold font-display text-graphite-800">Drag files here or click to upload</p>
        <p className="text-sm text-muted-foreground mt-2">Maximum file size: {maxSize}MB</p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-graphite-800">Uploading Files</h3>
          {files.map((uploadFile, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border shadow-soft">
              <FileIcon size={20} className="text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-graphite-800 truncate">{uploadFile.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(uploadFile.file.size)}</p>
                {uploadFile.status === 'uploading' && (
                  <div className="mt-1 bg-graphite-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${uploadFile.progress}%` }}
                    ></div>
                  </div>
                )}
                {uploadFile.error && <p className="text-xs text-destructive mt-1">{uploadFile.error}</p>}
              </div>
              {uploadFile.status === 'complete' && <CheckCircle size={20} className="text-emerald-600" />}
              {uploadFile.status !== 'complete' && (
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-danger-soft rounded-md transition-colors duration-150"
                >
                  <X size={20} className="text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
