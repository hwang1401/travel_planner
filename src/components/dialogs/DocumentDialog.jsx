import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Field from '../common/Field';
import BottomSheet from '../common/BottomSheet';
import ImageViewer from '../common/ImageViewer';
import ConfirmDialog from '../common/ConfirmDialog';
import { loadDocuments, createDocument, updateDocument, deleteDocument } from '../../services/documentService';
import { uploadFile, generateImagePath, isPdfUrl } from '../../services/imageService';

/* ── Category presets ── */
const DOC_CATEGORIES = [
  { value: '항공권', icon: 'navigation' },
  { value: '숙소', icon: 'home' },
  { value: '교통패스', icon: 'car' },
  { value: '보험', icon: 'lock' },
  { value: '비자/여권', icon: 'globe' },
  { value: '기타', icon: 'file' },
];

function getCategoryIcon(cat) {
  return DOC_CATEGORIES.find((c) => c.value === cat)?.icon || 'file';
}

/* ── Legacy hardcoded tabs (for legacy trip) ── */
const LEGACY_TABS = [
  { label: "항공권", icon: "navigation", image: "/images/ticket_departure.jpg", caption: "KE8795 인천→후쿠오카 / KE788 후쿠오카→인천" },
  { label: "JR패스", icon: "car", image: "/images/jrpass.jpg", caption: "JR 북큐슈 5일권 · 예약번호: FGY393247 (성인 2매)" },
];

/* ── Document Dialog ── */
export default function DocumentDialog({ onClose, tripId, isLegacy }) {
  if (isLegacy) return <LegacyDocumentDialog onClose={onClose} />;
  return <DynamicDocumentDialog onClose={onClose} tripId={tripId} />;
}

/* ── Legacy (read-only) version ── */
function LegacyDocumentDialog({ onClose }) {
  const [tab, setTab] = useState(0);
  const [viewImage, setViewImage] = useState(null);
  const current = LEGACY_TABS[tab];

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
      <div style={{ padding: "6px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
          여행 서류
        </h3>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
      </div>
      <div style={{ display: "flex", gap: "6px", padding: "14px 20px 0" }}>
        {LEGACY_TABS.map((t, i) => (
          <Button key={i} variant={tab === i ? "primary" : "neutral"} size="md"
            iconLeft={t.icon} onClick={() => setTab(i)} style={{ flex: 1 }}>
            {t.label}
          </Button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>
        <p style={{ margin: "0 0 12px", fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "var(--typo-caption-2-regular-line-height)", textAlign: "center" }}>
          {current.caption}
        </p>
        {current.image && (
          <div onClick={() => setViewImage(current.image)} style={{ borderRadius: "var(--radius-md, 8px)", overflow: "hidden", border: "1px solid var(--color-outline-variant)", background: "var(--color-surface-container-low)", aspectRatio: "595 / 842", width: "100%", cursor: "zoom-in" }}>
            <img src={current.image} alt={current.label} style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }} />
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

  const fetchDocs = useCallback(async () => {
    if (!tripId) return;
    try {
      const data = await loadDocuments(tripId);
      setDocs(data);
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
      <div style={{ padding: "6px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
          <div style={{ width: '28px', height: '28px', border: '3px solid var(--color-outline-variant)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!loading && docs.length === 0 && (
        <div style={{ padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-surface-container-low)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="file" size={28} style={{ opacity: 0.3 }} />
          </div>
          <p style={{ margin: 0, fontSize: 'var(--typo-label-2-bold-size)', fontWeight: 'var(--typo-label-2-bold-weight)', color: 'var(--color-on-surface-variant2)' }}>
            아직 등록된 문서가 없습니다
          </p>
          <p style={{ margin: 0, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)', lineHeight: 1.5 }}>
            항공권, 호텔 바우처 등<br />여행 서류를 추가해보세요
          </p>
          <Button variant="primary" size="md" iconLeft="plus" onClick={() => setShowForm('add')} style={{ marginTop: '4px' }}>
            문서 추가
          </Button>
        </div>
      )}

      {/* Document tabs */}
      {!loading && docs.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "6px", padding: "14px 20px 0", overflowX: 'auto', flexShrink: 0 }}>
            {docs.map((doc) => (
              <Button key={doc.id}
                variant={selectedDoc?.id === doc.id ? "primary" : "neutral"}
                size="md" iconLeft={getCategoryIcon(doc.category)}
                onClick={() => setSelectedDoc(doc)}
                style={{ flexShrink: 0 }}
              >
                {doc.title}
              </Button>
            ))}
          </div>

          {selectedDoc && (
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>
              {/* Category badge + caption */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '10px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '100px',
                  background: 'var(--color-primary-container)',
                  fontSize: 'var(--typo-caption-3-bold-size)',
                  fontWeight: 'var(--typo-caption-3-bold-weight)',
                  color: 'var(--color-on-primary-container)',
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}>
                  <Icon name={getCategoryIcon(selectedDoc.category)} size={12} />
                  {selectedDoc.category}
                </span>
              </div>

              {selectedDoc.caption && (
                <p style={{ margin: "0 0 12px", fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "var(--typo-caption-2-regular-line-height)", textAlign: "center" }}>
                  {selectedDoc.caption}
                </p>
              )}

              {/* File preview (image or PDF) */}
              {selectedDoc.imageUrl ? (
                isPdfUrl(selectedDoc.imageUrl) ? (
                  /* PDF viewer */
                  <div style={{
                    borderRadius: "var(--radius-md, 8px)", overflow: "hidden",
                    border: "1px solid var(--color-outline-variant)",
                    background: "var(--color-surface-container-low)",
                    width: "100%",
                  }}>
                    <iframe
                      src={`${selectedDoc.imageUrl.split('?')[0]}#toolbar=0&navpanes=0`}
                      title={selectedDoc.title}
                      style={{ width: '100%', height: '50vh', border: 'none', display: 'block' }}
                    />
                    <a
                      href={selectedDoc.imageUrl.split('?')[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px', borderTop: '1px solid var(--color-outline-variant)',
                        fontSize: 'var(--typo-caption-1-bold-size)',
                        fontWeight: 'var(--typo-caption-1-bold-weight)',
                        color: 'var(--color-primary)',
                        textDecoration: 'none',
                      }}
                    >
                      <Icon name="externalLink" size={14} />
                      새 탭에서 열기
                    </a>
                  </div>
                ) : (
                  /* Image viewer */
                  <div onClick={() => setViewImage(selectedDoc.imageUrl)} style={{
                    borderRadius: "var(--radius-md, 8px)", overflow: "hidden",
                    border: "1px solid var(--color-outline-variant)",
                    background: "var(--color-surface-container-low)",
                    width: "100%", cursor: "zoom-in",
                    maxHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img src={selectedDoc.imageUrl} alt={selectedDoc.title}
                      style={{ width: "100%", maxHeight: '50vh', display: "block", objectFit: "contain" }} />
                  </div>
                )
              ) : (
                <div style={{ borderRadius: "var(--radius-md, 8px)", border: "2px dashed var(--color-outline-variant)", padding: "40px 20px", textAlign: "center", background: "var(--color-surface-container-low)" }}>
                  <Icon name="file" size={32} style={{ opacity: 0.3 }} />
                  <p style={{ margin: "10px 0 0", fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)" }}>
                    파일이 없습니다
                  </p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <Button variant="neutral" size="md" iconLeft="edit" fullWidth onClick={() => setShowForm(selectedDoc)}>수정</Button>
                <Button variant="ghost-neutral" size="md" iconLeft="trash" onClick={() => handleDelete(selectedDoc)} style={{ color: 'var(--color-error)', flexShrink: 0 }}>삭제</Button>
              </div>
            </div>
          )}
        </>
      )}

      <ImageViewer src={viewImage} alt={selectedDoc?.title} onClose={() => setViewImage(null)} />

      {/* Add/Edit Form — rendered via Portal */}
      {showForm && (
        <DocumentFormPopup
          tripId={tripId}
          doc={showForm === 'add' ? null : showForm}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await fetchDocs(); }}
        />
      )}

      {confirmDel && (
        <ConfirmDialog title={confirmDel.title} message={confirmDel.message}
          confirmLabel={confirmDel.confirmLabel} onConfirm={confirmDel.onConfirm} onCancel={() => setConfirmDel(null)} />
      )}
    </BottomSheet>
  );
}

/* ── Document Add/Edit Popup (Portal-based, full-screen overlay) ── */
function DocumentFormPopup({ tripId, doc, onClose, onSaved }) {
  const isEdit = !!doc;
  const [title, setTitle] = useState(doc?.title || '');
  const [category, setCategory] = useState(doc?.category || '기타');
  const [caption, setCaption] = useState(doc?.caption || '');
  const [imageUrl, setImageUrl] = useState(doc?.imageUrl || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim() && !uploading && !saving;

  const fileRef = useRef(null);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      const ext = isPdf ? 'pdf' : 'jpg';
      const path = generateImagePath(tripId, 'docs', ext);
      const url = await uploadFile(file, path);
      setImageUrl(url);
    } catch (err) {
      console.error('Doc file upload error:', err);
    } finally {
      setUploading(false);
    }
  }, [tripId]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateDocument(doc.id, { title: title.trim(), category, caption: caption.trim(), imageUrl });
      } else {
        await createDocument(tripId, { title: title.trim(), category, caption: caption.trim(), imageUrl });
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save document:', err);
      setSaving(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '400px', maxHeight: '85vh',
          background: 'var(--color-surface-container-lowest)',
          borderRadius: 'var(--radius-md, 8px)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          animation: 'popIn 0.2s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 16px 12px 20px', flexShrink: 0,
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
            {isEdit ? '문서 수정' : '문서 추가'}
          </h3>
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Title */}
          <Field label="문서명" required size="lg" variant="outlined"
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 항공권, JR패스" />

          {/* Category chips */}
          <div>
            <p style={{
              margin: '0 0 8px', fontSize: 'var(--typo-caption-2-bold-size)',
              fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)',
            }}>
              카테고리
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DOC_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '100px',
                    border: category === cat.value ? '1.5px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                    background: category === cat.value ? 'var(--color-primary-container)' : 'var(--color-surface-container-lowest)',
                    color: category === cat.value ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                    fontSize: 'var(--typo-caption-1-bold-size)',
                    fontWeight: category === cat.value ? 'var(--typo-caption-1-bold-weight)' : 'var(--typo-caption-1-regular-weight)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon name={cat.icon} size={14} />
                  {cat.value}
                </button>
              ))}
            </div>
          </div>

          {/* Caption */}
          <Field as="textarea" label="설명" size="lg" variant="outlined"
            value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder="예: KE8795 인천→후쿠오카" rows={2} />

          {/* File (image or PDF) */}
          <div>
            <p style={{
              margin: '0 0 8px', fontSize: 'var(--typo-caption-2-bold-size)',
              fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)',
            }}>
              파일 (이미지 또는 PDF)
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => { handleFileSelect(e.target.files?.[0]); e.target.value = ''; }}
            />

            {imageUrl ? (
              <div style={{ position: 'relative', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden', border: '1px solid var(--color-outline-variant)' }}>
                {isPdfUrl(imageUrl) ? (
                  /* PDF preview */
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '14px 16px',
                    background: 'var(--color-surface-container-low)',
                  }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: 'var(--radius-md, 8px)',
                      background: 'var(--color-error-container, #FEE2E2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-error)' }}>PDF</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 'var(--typo-caption-1-bold-weight)', color: 'var(--color-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title.trim() || 'PDF 문서'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--typo-caption-3-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
                        PDF 파일 업로드 완료
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Image preview */
                  <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', display: 'block', background: 'var(--color-surface-container-low)' }} />
                )}
                {/* Actions overlay */}
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', gap: '6px',
                  padding: '8px', borderTop: '1px solid var(--color-outline-variant)',
                  background: 'var(--color-surface-container-lowest)',
                }}>
                  <Button variant="ghost-neutral" size="xsm" iconLeft="edit" onClick={() => fileRef.current?.click()}>변경</Button>
                  <Button variant="ghost-neutral" size="xsm" iconLeft="trash" onClick={() => setImageUrl('')} style={{ color: 'var(--color-error)' }}>삭제</Button>
                </div>
                {uploading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '24px', height: '24px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
              </div>
            ) : (
              /* Empty state */
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                style={{
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '2px dashed var(--color-outline-variant)',
                  background: 'var(--color-surface-container-low)',
                  padding: '24px 16px', textAlign: 'center',
                  cursor: uploading ? 'default' : 'pointer',
                }}
              >
                {uploading ? (
                  <>
                    <div style={{ width: '24px', height: '24px', border: '3px solid var(--color-outline-variant)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ margin: 0, fontSize: 'var(--typo-caption-2-medium-size)', color: 'var(--color-on-surface-variant2)' }}>업로드 중...</p>
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={24} style={{ opacity: 0.4, margin: '0 auto 6px', display: 'block' }} />
                    <p style={{ margin: 0, fontSize: 'var(--typo-caption-2-medium-size)', color: 'var(--color-on-surface-variant2)' }}>이미지 또는 PDF를 선택하세요</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0 20px 16px', flexShrink: 0, display: 'flex', gap: '8px' }}>
          <Button variant="neutral" size="lg" onClick={onClose} style={{ flex: 0 }}>
            취소
          </Button>
          <Button variant="primary" size="lg" fullWidth onClick={handleSave} disabled={!canSave} style={{ flex: 1 }}>
            {saving ? '저장 중...' : (isEdit ? '저장' : '추가')}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
