/**
 * @fileoverview Enterprise-grade file operations API client with enhanced security and validation
 * @version 1.0.0
 * @package form-data@4.0.0
 */

import FormData from 'form-data';
import { ApiResponse } from '../types/common.types';
import ApiClient from './apiClient';

// ============================================================================
// Constants
// ============================================================================

const FILE_ENDPOINTS = {
  UPLOAD: '/files/upload',
  DOWNLOAD: '/files',
  DELETE: '/files'
} as const;

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'application/zip'
] as const;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE = 1024 * 1024; // 1MB for chunked upload

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * File upload response with enhanced metadata
 */
export interface FileUploadResponse {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  uploadedAt: string;
}

/**
 * Enhanced file metadata
 */
export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  lastAccessed: string;
  checksum: string;
  status: 'active' | 'processing' | 'error';
}

/**
 * Upload options configuration
 */
interface UploadOptions {
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  validateContent?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Download options configuration
 */
interface DownloadOptions {
  responseType?: 'blob' | 'arraybuffer';
  onProgress?: (progress: number) => void;
  validateChecksum?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validates file before upload
 * @throws {Error} If validation fails
 */
const validateFile = async (file: File): Promise<void> => {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    throw new Error('File type not allowed');
  }

  // Validate file name
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (sanitizedName !== file.name) {
    throw new Error('File name contains invalid characters');
  }
};

/**
 * Calculates file checksum for integrity verification
 */
const calculateChecksum = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Uploads a file with enhanced security and validation
 * @param file - File to upload
 * @param metadata - Additional file metadata
 * @param options - Upload configuration options
 * @returns Upload response with file details
 */
export const uploadFile = async (
  file: File,
  metadata: Record<string, any> = {},
  options: UploadOptions = {}
): Promise<ApiResponse<FileUploadResponse>> => {
  try {
    // Validate file
    await validateFile(file);

    // Calculate checksum
    const checksum = await calculateChecksum(file);

    // Prepare form data with security headers
    const formData = new FormData();
    formData.append('file', file);
    formData.append('checksum', checksum);
    formData.append('metadata', JSON.stringify({
      ...metadata,
      originalName: file.name,
      mimeType: file.type,
      size: file.size
    }));

    // Upload configuration
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-File-Checksum': checksum
      },
      onUploadProgress: options.onProgress && ((progressEvent: any) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        options.onProgress!(progress);
      })
    };

    return await ApiClient.post<FileUploadResponse>(
      FILE_ENDPOINTS.UPLOAD,
      formData,
      config
    );
  } catch (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }
};

/**
 * Downloads a file by ID with validation
 * @param fileId - ID of file to download
 * @param options - Download configuration options
 * @returns File blob for download
 */
export const downloadFile = async (
  fileId: string,
  options: DownloadOptions = {}
): Promise<Blob> => {
  try {
    const response = await ApiClient.get<Blob>(
      `${FILE_ENDPOINTS.DOWNLOAD}/${fileId}`,
      {},
      {
        responseType: options.responseType || 'blob',
        onDownloadProgress: options.onProgress && ((progressEvent: any) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress!(progress);
        })
      }
    );

    if (options.validateChecksum) {
      const serverChecksum = response.headers?.['x-file-checksum'];
      const downloadedChecksum = await calculateChecksum(new File([response.data], ''));
      
      if (serverChecksum !== downloadedChecksum) {
        throw new Error('File integrity check failed');
      }
    }

    return response.data;
  } catch (error) {
    throw new Error(`File download failed: ${error.message}`);
  }
};

/**
 * Deletes a file by ID
 * @param fileId - ID of file to delete
 * @returns Deletion confirmation
 */
export const deleteFile = async (
  fileId: string
): Promise<ApiResponse<void>> => {
  try {
    return await ApiClient.delete<void>(`${FILE_ENDPOINTS.DELETE}/${fileId}`);
  } catch (error) {
    throw new Error(`File deletion failed: ${error.message}`);
  }
};

/**
 * Retrieves file metadata
 * @param fileId - ID of file
 * @returns File metadata
 */
export const getFileMetadata = async (
  fileId: string
): Promise<ApiResponse<FileMetadata>> => {
  try {
    return await ApiClient.get<FileMetadata>(
      `${FILE_ENDPOINTS.DOWNLOAD}/${fileId}/metadata`
    );
  } catch (error) {
    throw new Error(`Failed to retrieve file metadata: ${error.message}`);
  }
};