import { useState, useEffect, useCallback } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Field from '../common/Field';
import BottomSheet from '../common/BottomSheet';
import ImageViewer from '../common/ImageViewer';
import ImagePicker from '../common/ImagePicker';
import ConfirmDialog from '../common/ConfirmDialog';
import { loadDocuments, createDocument, updateDocument, deleteDocument } from '../../services/documentService';
import { uploadImage, generateImagePath } from '../../services/imageService';

/* ── Legacy hardcoded tabs (for legacy trip) ── */
const LEGACY_TABS = [
  { label: "항공권", icon: "navigation", image: "/images/ticket_departure.jpg", caption: "KE8795 인천→후쿠오카 / KE788 후쿠오카→인천" },
  { label: "JR패스", icon: "car", image: "/images/jrpass.jpg", caption: "JR 북큐슈 5일권 · 예약번호: FGY393247 (성인 2매)" },
];

/* ── Document Dialog ── */
export default function DocumentDialog({ onClose, tripId, isLegacy }) {
  // For legacy trip — show read-only hardcoded data
  if (isLegacy) return <LegacyDocumentDialog onClose={onClose} />;

  // For Supabase trips — dynamic CRUD
  return <DynamicDocumentDialog onClose={onClose} tripId={tripId} />;
}

/* ── Legacy (read-only) version ── */
function LegacyDocumentDialog({ onClose }) {
  const [tab, setTab] = useState(0);
  const [viewImage, setViewImage] = useState(null);
  const current = LEGACY_TABS[tab];

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
      {/* Header */}
      <div style={{
        padding: "6px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h3 style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
          여행 서류
        </h3>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", padding: "14px 20px 0" }}>
        {LEGACY_TABS.map((t, i) => (
          <Button key={i} variant={tab === i ? "primary" : "neutral"} size="md"
            iconLeft={t.icon} onClick={() => setTab(i)} style={{ flex: 1 }}>
            {t.label}
          </Button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>
        <p style={{
          margin: "0 0 12px", fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant)",
          lineHeight: "var(--typo-caption-2-regular-line-height)", textAlign: "center",
        }}>
          {current.caption}
        </p>

        {current.image && (
          <div
            onClick={() => setViewImage(current.image)}
            style={{
              borderRadius: "var(--radius-md, 8px)", overflow: "hidden",
              border: "1px solid var(--color-outline-variant)",
              background: "var(--color-surface-container-low)",
              aspectRatio: "595 / 842", width: "100%", cursor: "zoom-in",
            }}
          >
            <img src={current.image} alt={current.label}
              style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }} />
          </div>
        )}
      </div>

      <ImageViewer src={viewImage} alt={current.label} onClose={() => setViewImage(null)} />
    </BottomSheet>
  );
}

/* ── Dynamic (Supabase) version ── */
function DynamicDocumentDialog({ onClose, tripId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [showForm, setShowForm] = useState(false); // 'add' | doc object (edit) | false
  const [confirmDel, setConfirmDel] = useState(null);

  /* ── Load documents ── */
  const fetchDocs = useCallback(async () => {
    if (!tripId) return;
    try {
      const data = await loadDocuments(tripId);
      setDocs(data);
      // Auto-select first doc if we had one selected
      if (selectedDoc) {
        const found = data.find((d) => d.id === selectedDoc.id);
        setSelectedDoc(found || data[0] || null);
      } else if (data.length > 0) {
        setSelectedDoc(data[0]);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  /* ── Delete handler ── */
  const handleDelete = useCallback((doc) => {
    setConfirmDel({
      title: '문서 삭제',
      message: `"${doc.title}" 문서를 삭제하시겠습니까?`,
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await deleteDocument(doc.id);
          setConfirmDel(null);
          setSelectedDoc(null);
          await fetchDocs();
        } catch (err) {
          console.error('Failed to delete document:', err);
          setConfirmDel(null);
        }
      },
    });
  }, [fetchDocs]);

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
      {/* Header */}
      <div style={{
        padding: "6px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h3 style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
          여행 서류
        </h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button variant="ghost-primary" size="sm" iconOnly="plus" onClick={() => setShowForm('add')} />
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '28px', height: '28px', border: '3px solid var(--color-outline-variant)',
            borderTopColor: 'var(--color-primary)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!loading && docs.length === 0 && (
        <div style={{
          padding: '48px 20px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'var(--color-surface-container-low)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="file" size={28} style={{ opacity: 0.3 }} />
          </div>
          <p style={{
            margin: 0, fontSize: 'var(--typo-label-2-bold-size)',
            fontWeight: 'var(--typo-label-2-bold-weight)',
            color: 'var(--color-on-surface-variant2)',
          }}>
            아직 등록된 문서가 없습니다
          </p>
          <p style={{
            margin: 0, fontSize: 'var(--typo-caption-2-regular-size)',
            color: 'var(--color-on-surface-variant2)', lineHeight: 1.5,
          }}>
            항공권, 호텔 바우처 등<br />여행 서류를 추가해보세요
          </p>
          <Button variant="primary" size="md" iconLeft="plus" onClick={() => setShowForm('add')}
            style={{ marginTop: '4px' }}>
            문서 추가
          </Button>
        </div>
      )}

      {/* Document tabs (when docs exist) */}
      {!loading && docs.length > 0 && (
        <>
          <div style={{
            display: "flex", gap: "6px", padding: "14px 20px 0",
            overflowX: 'auto', flexShrink: 0,
          }}>
            {docs.map((doc) => (
              <Button
                key={doc.id}
                variant={selectedDoc?.id === doc.id ? "primary" : "neutral"}
                size="md" iconLeft="file"
                onClick={() => setSelectedDoc(doc)}
                style={{ flexShrink: 0 }}
              >
                {doc.title}
              </Button>
            ))}
          </div>

          {/* Selected doc content */}
          {selectedDoc && (
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>
              {/* Caption */}
              {selectedDoc.caption && (
                <p style={{
                  margin: "0 0 12px", fontSize: "var(--typo-caption-2-regular-size)",
                  color: "var(--color-on-surface-variant)",
                  lineHeight: "var(--typo-caption-2-regular-line-height)", textAlign: "center",
                }}>
                  {selectedDoc.caption}
                </p>
              )}

              {/* Image */}
              {selectedDoc.imageUrl ? (
                <div
                  onClick={() => setViewImage(selectedDoc.imageUrl)}
                  style={{
                    borderRadius: "var(--radius-md, 8px)", overflow: "hidden",
                    border: "1px solid var(--color-outline-variant)",
                    background: "var(--color-surface-container-low)",
                    width: "100%", cursor: "zoom-in",
                  }}
                >
                  <img src={selectedDoc.imageUrl} alt={selectedDoc.title}
                    style={{ width: "100%", display: "block", objectFit: "contain" }} />
                </div>
              ) : (
                <div style={{
                  borderRadius: "var(--radius-md, 8px)", border: "2px dashed var(--color-outline-variant)",
                  padding: "40px 20px", textAlign: "center",
                  background: "var(--color-surface-container-low)",
                }}>
                  <Icon name="file" size={32} style={{ opacity: 0.3 }} />
                  <p style={{
                    margin: "10px 0 0", fontSize: "var(--typo-caption-2-regular-size)",
                    color: "var(--color-on-surface-variant2)",
                  }}>
                    이미지가 없습니다
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <Button variant="neutral" size="md" iconLeft="edit" fullWidth
                  onClick={() => setShowForm(selectedDoc)}>
                  수정
                </Button>
                <Button variant="ghost-neutral" size="md" iconLeft="trash"
                  onClick={() => handleDelete(selectedDoc)}
                  style={{ color: 'var(--color-error)', flexShrink: 0 }}>
                  삭제
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Image Viewer */}
      <ImageViewer src={viewImage} alt={selectedDoc?.title} onClose={() => setViewImage(null)} />

      {/* Add/Edit Form */}
      {showForm && (
        <DocumentFormSheet
          tripId={tripId}
          doc={showForm === 'add' ? null : showForm}
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await fetchDocs();
          }}
        />
      )}

      {/* Confirm Dialog */}
      {confirmDel && (
        <ConfirmDialog
          title={confirmDel.title} message={confirmDel.message}
          confirmLabel={confirmDel.confirmLabel}
          onConfirm={confirmDel.onConfirm}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </BottomSheet>
  );
}

/* ── Document Add/Edit Form (BottomSheet) ── */
function DocumentFormSheet({ tripId, doc, onClose, onSaved }) {
  const isEdit = !!doc;
  const [title, setTitle] = useState(doc?.title || '');
  const [caption, setCaption] = useState(doc?.caption || '');
  const [imageUrl, setImageUrl] = useState(doc?.imageUrl || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim() && !uploading && !saving;

  const handleImageFile = useCallback(async (file) => {
    setUploading(true);
    try {
      const path = generateImagePath(tripId, 'docs');
      const url = await uploadImage(file, path);
      setImageUrl(url);
    } catch (err) {
      console.error('Doc image upload error:', err);
    } finally {
      setUploading(false);
    }
  }, [tripId]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateDocument(doc.id, {
          title: title.trim(),
          caption: caption.trim(),
          imageUrl,
        });
      } else {
        await createDocument(tripId, {
          title: title.trim(),
          caption: caption.trim(),
          imageUrl,
        });
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save document:', err);
      setSaving(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh" zIndex={4000}>
      {/* Header */}
      <div style={{
        padding: "6px 16px 12px 20px", flexShrink: 0,
        borderBottom: "1px solid var(--color-outline-variant)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h3 style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
          {isEdit ? '문서 수정' : '문서 추가'}
        </h3>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="제목" required size="lg" variant="outlined"
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 항공권, 호텔 바우처" />

        <Field as="textarea" label="설명" size="lg" variant="outlined"
          value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="예: KE8795 인천→후쿠오카" rows={2} />

        <div>
          <p style={{
            margin: '0 0 8px', fontSize: 'var(--typo-caption-2-bold-size)',
            fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)',
          }}>
            문서 이미지
          </p>
          <ImagePicker
            value={imageUrl}
            onChange={handleImageFile}
            onRemove={() => setImageUrl('')}
            placeholder="이미지를 추가하세요"
            aspect="doc"
            uploading={uploading}
          />
        </div>
      </div>

      {/* Save button */}
      <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
        <Button variant="primary" size="lg" fullWidth onClick={handleSave} disabled={!canSave}>
          {saving ? '저장 중...' : (isEdit ? '저장' : '추가')}
        </Button>
      </div>
    </BottomSheet>
  );
}
