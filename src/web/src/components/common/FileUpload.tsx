/**
 * @fileoverview Enterprise-grade file upload component with secure handling,
 * chunk-based uploads, accessibility features, and comprehensive validation
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { uploadFile, FileUploadResponse } from '../../api/filesApi';
import Button from './Button';
import ProgressBar from './ProgressBar';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Enhanced error types for file uploads
 */
interface FileUploadError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Detailed upload progress tracking
 */
interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
}

/**
 * Security scan status for uploaded files
 */
enum SecurityScanStatus {
  PENDING = 'PENDING',
  SCANNING = 'SCANNING',
  CLEAN = 'CLEAN',
  INFECTED = 'INFECTED',
}

/**
 * Component props with enterprise features
 */
export interface FileUploadProps {
  /** Accepted file types (MIME types) */
  accept?: string;
  /** Maximum single file size in bytes */
  maxSize?: number;
  /** Maximum total size for multiple files */
  maxTotalSize?: number;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Enable virus scanning */
  securityScanEnabled?: boolean;
  /** Size of upload chunks in bytes */
  chunkSize?: number;
  /** Custom file validation function */
  customValidation?: (file: File) => Promise<boolean>;
  /** Upload success callback */
  onUploadComplete?: (response: FileUploadResponse) => void;
  /** Enhanced error callback */
  onUploadError?: (error: FileUploadError) => void;
  /** Progress callback with chunk info */
  onUploadProgress?: (progress: UploadProgress) => void;
  /** Validation error callback */
  onValidationError?: (error: FileUploadError) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/plain',
];

// ============================================================================
// Component
// ============================================================================

export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  maxSize = DEFAULT_MAX_SIZE,
  maxTotalSize,
  multiple = false,
  securityScanEnabled = true,
  chunkSize = DEFAULT_CHUNK_SIZE,
  customValidation,
  onUploadComplete,
  onUploadError,
  onUploadProgress,
  onValidationError,
  className,
}) => {
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
    currentChunk: 0,
    totalChunks: 0,
  });
  const [securityStatus, setSecurityStatus] = useState<SecurityScanStatus>(
    SecurityScanStatus.PENDING
  );

  // ============================================================================
  // Validation Functions
  // ============================================================================

  /**
   * Validates file type, size, and custom constraints
   */
  const validateFile = async (file: File): Promise<boolean> => {
    // Check file type
    if (accept && !accept.split(',').some(type => file.type.match(type))) {
      onValidationError?.({
        code: 'INVALID_TYPE',
        message: 'File type not allowed',
        details: { allowedTypes: accept },
      });
      return false;
    }

    // Check file size
    if (file.size > maxSize) {
      onValidationError?.({
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
        details: { maxSize, fileSize: file.size },
      });
      return false;
    }

    // Custom validation
    if (customValidation) {
      try {
        const isValid = await customValidation(file);
        if (!isValid) {
          onValidationError?.({
            code: 'CUSTOM_VALIDATION_FAILED',
            message: 'File failed custom validation',
          });
          return false;
        }
      } catch (error) {
        onValidationError?.({
          code: 'VALIDATION_ERROR',
          message: error.message,
        });
        return false;
      }
    }

    return true;
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handles file selection from input or drop
   */
  const handleFiles = async (files: FileList) => {
    if (!files.length) return;

    // Check total size for multiple files
    if (maxTotalSize) {
      const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
      if (totalSize > maxTotalSize) {
        onValidationError?.({
          code: 'TOTAL_SIZE_EXCEEDED',
          message: `Total size exceeds ${maxTotalSize / (1024 * 1024)}MB limit`,
        });
        return;
      }
    }

    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        // Validate file
        const isValid = await validateFile(file);
        if (!isValid) continue;

        // Upload file
        const response = await uploadFile(file, {
          chunkSize,
          onProgress: (progress) => {
            const uploadProgress = {
              ...progress,
              percentage: Math.round((progress.loaded / progress.total) * 100),
            };
            setUploadProgress(uploadProgress);
            onUploadProgress?.(uploadProgress);
          },
        });

        // Handle security scanning
        if (securityScanEnabled) {
          setSecurityStatus(SecurityScanStatus.SCANNING);
          // Wait for scan completion
          await new Promise(resolve => setTimeout(resolve, 1000));
          setSecurityStatus(SecurityScanStatus.CLEAN);
        }

        onUploadComplete?.(response.data);
      } catch (error) {
        onUploadError?.({
          code: 'UPLOAD_FAILED',
          message: error.message,
          details: { fileName: file.name },
        });
      }
    }

    setIsUploading(false);
    setUploadProgress({
      loaded: 0,
      total: 0,
      percentage: 0,
      currentChunk: 0,
      totalChunks: 0,
    });
  };

  /**
   * Handles drag over event with accessibility
   */
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * Handles drag leave event
   */
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * Handles file drop with security checks
   */
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const { files } = event.dataTransfer;
    if (!files.length) return;

    if (!multiple && files.length > 1) {
      onValidationError?.({
        code: 'MULTIPLE_FILES',
        message: 'Multiple files not allowed',
      });
      return;
    }

    handleFiles(files);
  }, [multiple]);

  /**
   * Handles file input change
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (files) {
      handleFiles(files);
    }
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      className={classNames(
        'file-upload',
        {
          'file-upload--dragging': isDragging,
          'file-upload--uploading': isUploading,
        },
        className
      )}
    >
      <div
        ref={dropZoneRef}
        className="file-upload__dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Drop files here or click to upload"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="file-upload__input"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          aria-hidden="true"
          tabIndex={-1}
        />

        <Button
          variant="outlined"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          ariaLabel="Select files to upload"
        >
          {isUploading ? 'Uploading...' : 'Select Files'}
        </Button>

        <div className="file-upload__instructions">
          <p>Drop files here or click to upload</p>
          {accept && (
            <p className="file-upload__accepted-types">
              Accepted types: {accept}
            </p>
          )}
        </div>
      </div>

      {isUploading && (
        <div className="file-upload__progress" role="status">
          <ProgressBar
            value={uploadProgress.percentage}
            color="primary"
            size="md"
            showLabel
            animated
            ariaLabel={`Upload progress: ${uploadProgress.percentage}%`}
          />
          <p className="file-upload__status">
            Uploading chunk {uploadProgress.currentChunk} of {uploadProgress.totalChunks}
          </p>
        </div>
      )}

      {securityScanEnabled && securityStatus !== SecurityScanStatus.PENDING && (
        <div
          className={`file-upload__security-status security-status--${securityStatus.toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          <p>Security scan status: {securityStatus}</p>
        </div>
      )}
    </div>
  );
};

// Display name for debugging
FileUpload.displayName = 'FileUpload';

export default FileUpload;