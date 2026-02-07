/*
 * ── Document Service ──
 * CRUD for trip_documents via Supabase.
 */

import { supabase } from '../lib/supabase';

/**
 * Load all documents for a trip.
 */
export async function loadDocuments(tripId) {
  const { data, error } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[DocumentService] loadDocuments error:', error);
    return [];
  }

  return (data || []).map(formatDocument);
}

/**
 * Create a new document.
 */
export async function createDocument(tripId, { title, caption = '', imageUrl = '' }) {
  const { data, error } = await supabase
    .from('trip_documents')
    .insert({
      trip_id: tripId,
      title,
      caption,
      image_url: imageUrl,
    })
    .select()
    .single();

  if (error) {
    console.error('[DocumentService] createDocument error:', error);
    throw error;
  }

  return formatDocument(data);
}

/**
 * Update a document.
 */
export async function updateDocument(docId, updates) {
  const payload = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.caption !== undefined) payload.caption = updates.caption;
  if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;

  const { data, error } = await supabase
    .from('trip_documents')
    .update(payload)
    .eq('id', docId)
    .select()
    .single();

  if (error) {
    console.error('[DocumentService] updateDocument error:', error);
    throw error;
  }

  return formatDocument(data);
}

/**
 * Delete a document.
 */
export async function deleteDocument(docId) {
  const { error } = await supabase
    .from('trip_documents')
    .delete()
    .eq('id', docId);

  if (error) {
    console.error('[DocumentService] deleteDocument error:', error);
    throw error;
  }
}

/* ── Helper ── */
function formatDocument(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    tripId: raw.trip_id,
    title: raw.title,
    caption: raw.caption || '',
    imageUrl: raw.image_url || '',
    createdAt: raw.created_at,
  };
}
