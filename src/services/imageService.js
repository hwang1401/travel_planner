/*
 * ── Image Service ──
 * Handles image upload/delete via Supabase Storage.
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

      // Only resize if larger than max
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
    img.onerror = () => resolve(file); // fallback to original
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload an image to Supabase Storage.
 * @param {File} file - The image file to upload
 * @param {string} path - Storage path (e.g. "trips/{tripId}/cover.jpg")
 * @returns {string} Public URL of the uploaded image
 */
export async function uploadImage(file, path) {
  // Resize before upload
  const resized = await resizeImage(file);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, resized, {
      contentType: 'image/jpeg',
      upsert: true, // overwrite if exists
    });

  if (error) {
    console.error('[ImageService] Upload error:', error);
    throw error;
  }

  // Get public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Append cache-buster to avoid stale images
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Delete an image from Supabase Storage.
 * @param {string} path - Storage path to delete
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
 * Generate a unique storage path for a trip image.
 * @param {string} tripId
 * @param {string} folder - "cover" | "items" | "docs"
 * @returns {string} path
 */
export function generateImagePath(tripId, folder = 'items') {
  if (folder === 'cover') {
    return `trips/${tripId}/cover_${Date.now()}.jpg`;
  }
  return `trips/${tripId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
}
