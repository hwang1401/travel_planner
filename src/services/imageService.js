/*
 * ── Image / File Service ──
 * Handles image & PDF upload/delete via Supabase Storage.
 * Bucket: "images" (public)
 */

import { supabase } from '../lib/supabase';

const BUCKET = 'images';
const MAX_SIZE = 1200; // max dimension in pixels

/**
 * Resize an image file using canvas.
 * Returns a Blob (JPEG, quality 0.85).
 */
async function resizeImage(file, maxSize = MAX_SIZE) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload an image to Supabase Storage (with resize).
 */
export async function uploadImage(file, path) {
  const resized = await resizeImage(file);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, resized, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.error('[ImageService] Upload error:', error);
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Upload any file (image or PDF) to Supabase Storage.
 * Images are resized; PDFs are uploaded as-is.
 */
export async function uploadFile(file, path) {
  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    // Upload PDF as-is
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error('[ImageService] PDF upload error:', error);
      throw error;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  // Image — resize and upload
  return uploadImage(file, path);
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteImage(path) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error('[ImageService] Delete error:', error);
  }
}

/**
 * Generate a unique storage path.
 * @param {string} tripId
 * @param {string} folder - "cover" | "items" | "docs"
 * @param {string} ext - file extension (default "jpg")
 * @returns {string} path
 */
export function generateImagePath(tripId, folder = 'items', ext = 'jpg') {
  if (folder === 'cover') {
    return `trips/${tripId}/cover_${Date.now()}.${ext}`;
  }
  return `trips/${tripId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
}

/**
 * Check if a URL points to a PDF.
 */
export function isPdfUrl(url) {
  if (!url) return false;
  // Remove query params for check
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.pdf');
}
