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
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
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
          <Upload size={32} className="text-blue-500" />
        </div>
        <p className="text-lg font-semibold text-gray-700">Drag files here or click to upload</p>
        <p className="text-sm text-gray-500 mt-2">Maximum file size: {maxSize}MB</p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-800">Uploading Files</h3>
          {files.map((uploadFile, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
              <FileIcon size={20} className="text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{uploadFile.file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(uploadFile.file.size)}</p>
                {uploadFile.status === 'uploading' && (
                  <div className="mt-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${uploadFile.progress}%` }}
                    ></div>
                  </div>
                )}
                {uploadFile.error && <p className="text-xs text-red-500 mt-1">{uploadFile.error}</p>}
              </div>
              {uploadFile.status === 'complete' && <CheckCircle size={20} className="text-green-500" />}
              {uploadFile.status !== 'complete' && (
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-red-50 rounded transition"
                >
                  <X size={20} className="text-red-500" />
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
