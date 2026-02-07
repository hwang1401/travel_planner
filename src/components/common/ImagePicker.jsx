import { useState, useRef } from 'react';
import Icon from './Icon';
import Button from './Button';

/*
 * ── ImagePicker ──
 * A reusable image picker component that shows a preview and handles file selection.
 * Supports single image selection with preview.
 *
 * Props:
 *   value      — current image URL (string)
 *   onChange    — (file: File) => void  (parent handles upload)
 *   onRemove   — () => void  (parent handles removal)
 *   placeholder — text to show when no image selected
 *   aspect     — "cover" (16:9) | "square" (1:1) | "doc" (A4-ish)
 *   uploading  — boolean, shows spinner when true
 *   disabled   — boolean
 */
export default function ImagePicker({
  value,
  onChange,
  onRemove,
  placeholder = '이미지 추가',
  aspect = 'cover',
  uploading = false,
  disabled = false,
  borderRadius,
}) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const aspectRatio = aspect === 'square' ? '1 / 1' : aspect === 'doc' ? '3 / 4' : '16 / 9';
  const maxHeight = aspect === 'doc' ? '300px' : aspect === 'square' ? '200px' : '180px';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onChange) onChange(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/') && onChange) onChange(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {value ? (
        /* ── Preview ── */
        <div style={{
          position: 'relative',
          borderRadius: borderRadius !== undefined ? borderRadius : 'var(--radius-md, 8px)',
          overflow: 'hidden',
          border: borderRadius === '0' ? 'none' : '1px solid var(--color-outline-variant)',
        }}>
          <img
            src={value}
            alt=""
            style={{
              width: '100%',
              aspectRatio,
              maxHeight,
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {/* Overlay actions */}
          <div style={{
            position: 'absolute', bottom: '8px', right: '8px',
            display: 'flex', gap: '6px',
          }}>
            <Button
              variant="ghost-neutral" size="sm" iconOnly="edit"
              onClick={() => !disabled && !uploading && fileRef.current?.click()}
              style={{
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                width: '30px', height: '30px',
              }}
            />
            {onRemove && (
              <Button
                variant="ghost-neutral" size="sm" iconOnly="trash"
                onClick={() => !disabled && !uploading && onRemove()}
                style={{
                  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                  width: '30px', height: '30px',
                }}
              />
            )}
          </div>
          {/* Upload spinner */}
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: '28px', height: '28px', border: '3px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      ) : (
        /* ── Empty state ── */
        <div
          onClick={() => !disabled && !uploading && fileRef.current?.click()}
          style={{
            borderRadius: borderRadius !== undefined ? borderRadius : 'var(--radius-md, 8px)',
            border: borderRadius === '0' ? 'none' : `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
            background: dragOver ? 'var(--color-primary-container)' : 'var(--color-surface-container-low)',
            aspectRatio,
            maxHeight,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '8px',
            cursor: disabled || uploading ? 'default' : 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {uploading ? (
            <>
              <div style={{
                width: '24px', height: '24px', border: '3px solid var(--color-outline-variant)',
                borderTopColor: 'var(--color-primary)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{
                fontSize: 'var(--typo-caption-2-medium-size)',
                color: 'var(--color-on-surface-variant2)',
              }}>
                업로드 중...
              </span>
            </>
          ) : (
            <>
              <Icon name="plus" size={24} style={{ opacity: 0.4 }} />
              <span style={{
                fontSize: 'var(--typo-caption-2-medium-size)',
                fontWeight: 'var(--typo-caption-2-medium-weight)',
                color: 'var(--color-on-surface-variant2)',
              }}>
                {placeholder}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/*
 * ── MultiImagePicker ──
 * Grid of images with add button. Supports selecting a "representative" image.
 *
 * Props:
 *   images      — string[] of URLs
 *   mainImage   — string, the representative image URL
 *   onAdd       — (file: File) => void
 *   onRemove    — (index: number) => void
 *   onSetMain   — (index: number) => void
 *   uploading   — boolean
 *   maxImages   — number (default 5)
 */
export function MultiImagePicker({
  images = [],
  mainImage,
  onAdd,
  onRemove,
  onSetMain,
  uploading = false,
  maxImages = 5,
}) {
  const fileRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onAdd) onAdd(file);
    e.target.value = '';
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
      }}>
        {images.map((url, i) => (
          <div key={i} style={{
            position: 'relative',
            borderRadius: 'var(--radius-md, 8px)',
            overflow: 'hidden',
            border: url === mainImage
              ? '2px solid var(--color-primary)'
              : '1px solid var(--color-outline-variant)',
          }}>
            <img
              src={url}
              alt=""
              style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }}
            />
            {/* Star badge for main image */}
            <button
              onClick={() => onSetMain?.(i)}
              style={{
                position: 'absolute', top: '4px', left: '4px',
                width: '22px', height: '22px', borderRadius: '50%',
                background: url === mainImage ? 'var(--color-primary)' : 'rgba(0,0,0,0.4)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="star" size={12} style={{ filter: 'brightness(0) invert(1)' }} />
            </button>
            {/* Remove button */}
            <button
              onClick={() => onRemove?.(i)}
              style={{
                position: 'absolute', top: '4px', right: '4px',
                width: '22px', height: '22px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.4)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="close" size={12} style={{ filter: 'brightness(0) invert(1)' }} />
            </button>
          </div>
        ))}

        {/* Add button */}
        {images.length < maxImages && (
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            style={{
              borderRadius: 'var(--radius-md, 8px)',
              border: '2px dashed var(--color-outline-variant)',
              background: 'var(--color-surface-container-low)',
              aspectRatio: '1/1',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '4px', cursor: uploading ? 'default' : 'pointer',
            }}
          >
            {uploading ? (
              <>
                <div style={{
                  width: '20px', height: '20px',
                  border: '2px solid var(--color-outline-variant)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            ) : (
              <>
                <Icon name="plus" size={20} style={{ opacity: 0.4 }} />
                <span style={{
                  fontSize: 'var(--typo-caption-3-regular-size)',
                  color: 'var(--color-on-surface-variant2)',
                }}>
                  {images.length}/{maxImages}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
