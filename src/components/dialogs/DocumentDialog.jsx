import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBackClose } from '../../hooks/useBackClose';
import Icon from '../common/Icon';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import Field from '../common/Field';
import BottomSheet from '../common/BottomSheet';
import ImageViewer from '../common/ImageViewer';
import ConfirmDialog from '../common/ConfirmDialog';
import Skeleton from '../common/Skeleton';
import { loadDocuments, createDocument, updateDocument, deleteDocument } from '../../services/documentService';
import { uploadFile, generateImagePath, isPdfUrl } from '../../services/imageService';
import { SPACING } from '../../styles/tokens';

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

/* 문서 이미지 — 로드 전 스켈레톤 */
function DocumentImageWithSkeleton({ src, alt, onClick }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div onClick={onClick} style={{
      borderRadius: "var(--radius-md, 8px)", overflow: "hidden",
      border: "1px solid var(--color-outline-variant)",
      background: "var(--color-surface-container-lowest)",
      width: "100%", cursor: "zoom-in",
      maxHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      {!loaded && <Skeleton style={{ position: 'absolute', inset: 0 }} />}
      <img src={src} alt={alt} onLoad={() => setLoaded(true)}
        style={{ width: "100%", maxHeight: '50vh', display: "block", objectFit: "contain", opacity: loaded ? 1 : 0, transition: 'opacity 0.2s ease' }} />
    </div>
  );
}

function DocumentFormImageWithSkeleton({ src }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%', maxHeight: 200, overflow: 'hidden' }}>
      {!loaded && <Skeleton style={{ position: 'absolute', inset: 0 }} />}
      <img src={src} alt="" onLoad={() => setLoaded(true)}
        style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', display: 'block', background: 'var(--color-surface-container-lowest)', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s ease' }} />
    </div>
  );
}

/* ── Document Dialog ── */
export default function DocumentDialog({ onClose, tripId }) {
  useBackClose(true, onClose);
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

  const [viewportRect, setViewportRect] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportRect({ top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  const sheetWrapperStyle = {
    position: 'fixed',
    ...(viewportRect != null ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height } : { inset: 0 }),
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  };

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
    <div style={sheetWrapperStyle}>
      <BottomSheet onClose={onClose} maxHeight={viewportRect != null && viewportRect.height < window.innerHeight - 80 ? `${Math.max(280, viewportRect.height * 0.9)}px` : '85vh'} title="여행 서류">

      {/* Loading */}
      {loading && (
        <div style={{ padding: `40px ${SPACING.xxl}`, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '28px', height: '28px', border: '3px solid var(--color-outline-variant)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {!loading && docs.length === 0 && (
        <EmptyState
          icon="file"
          title="아직 등록된 문서가 없습니다"
          description={"항공권, 호텔 바우처 등\n여행 서류를 추가해보세요"}
          actions={{ label: "문서 추가", variant: "primary", iconLeft: "plus", onClick: () => setShowForm('add') }}
        />
      )}

      {/* Document tabs */}
      {!loading && docs.length > 0 && (
        <>
          <div style={{ display: "flex", gap: SPACING.ms, padding: `${SPACING.lx} ${SPACING.xxl} 0`, overflowX: 'auto', flexShrink: 0, alignItems: 'center', minWidth: 0, WebkitOverflowScrolling: 'touch' }}>
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
            <Button variant="ghost-primary" size="md" iconOnly="plus"
              onClick={() => setShowForm('add')}
              style={{ flexShrink: 0 }}
            />
          </div>

          {selectedDoc && (
            <div style={{ flex: 1, overflowY: "auto", padding: `${SPACING.lx} ${SPACING.xxl} ${SPACING.xxl}` }}>
              {/* Category badge + caption */}
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.ms }}>
                <span style={{
                  padding: `3px ${SPACING.ml}`, borderRadius: '100px',
                  background: 'var(--color-primary-container)',
                  fontSize: 'var(--typo-caption-3-bold-size)',
                  fontWeight: 'var(--typo-caption-3-bold-weight)',
                  color: 'var(--color-on-primary-container)',
                  display: 'inline-flex', alignItems: 'center', gap: SPACING.sm,
                }}>
                  <Icon name={getCategoryIcon(selectedDoc.category)} size={12} />
                  {selectedDoc.category}
                </span>
              </div>

              {selectedDoc.caption && (
                <p style={{ margin: `0 0 ${SPACING.lg}`, fontSize: "var(--typo-label-2-medium-size)", fontWeight: "var(--typo-label-2-medium-weight)", color: "var(--color-on-surface-variant)", lineHeight: 1.5 }}>
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
                    background: "var(--color-surface-container-lowest)",
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
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SPACING.ms,
                        padding: SPACING.ml, borderTop: '1px solid var(--color-outline-variant)',
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
                  /* Image viewer — 로드 전 스켈레톤 */
                  <DocumentImageWithSkeleton src={selectedDoc.imageUrl} alt={selectedDoc.title} onClick={() => setViewImage(selectedDoc.imageUrl)} />
                )
              ) : (
                <div style={{ borderRadius: "var(--radius-md, 8px)", border: "2px dashed var(--color-outline-variant)", padding: `40px ${SPACING.xxl}`, textAlign: "center", background: "var(--color-surface-container-lowest)" }}>
                  <Icon name="file" size={32} style={{ opacity: 0.3 }} />
                  <p style={{ margin: `${SPACING.ml} 0 0`, fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)" }}>
                    파일이 없습니다
                  </p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: SPACING.md, marginTop: SPACING.lx, overflow: 'hidden' }}>
                <Button variant="neutral" size="md" iconLeft="edit" onClick={() => setShowForm(selectedDoc)} style={{ flex: 1, minWidth: 0, borderColor: "var(--color-outline-variant)" }}>수정</Button>
                <Button variant="ghost-danger" size="md" iconLeft="trash" onClick={() => handleDelete(selectedDoc)} style={{ flexShrink: 0 }}>삭제</Button>
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
    </div>
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

  const [viewportRect, setViewportRect] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportRect({ top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

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
        position: 'fixed',
        ...(viewportRect != null ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height } : { inset: 0 }),
        zIndex: 5000,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: SPACING.xxl,
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
          padding: `${SPACING.xl} ${SPACING.xl} ${SPACING.lg} ${SPACING.xxl}`, flexShrink: 0,
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ margin: 0, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
            {isEdit ? '문서 수정' : '문서 추가'}
          </h3>
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: `${SPACING.xl} ${SPACING.xxl} ${SPACING.xxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.lx }}>
          {/* Title */}
          <Field label="문서명" required size="lg" variant="outlined"
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 항공권, JR패스" />

          {/* Category chips */}
          <div>
            <p style={{
              margin: `0 0 ${SPACING.md}`, fontSize: 'var(--typo-caption-2-bold-size)',
              fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)',
            }}>
              카테고리
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.ms }}>
              {DOC_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: `5px ${SPACING.lg}`, borderRadius: '100px',
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
              margin: `0 0 ${SPACING.md}`, fontSize: 'var(--typo-caption-2-bold-size)',
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
                    display: 'flex', alignItems: 'center', gap: SPACING.ml,
                    padding: `${SPACING.lx} ${SPACING.xl}`,
                    background: 'var(--color-surface-container-lowest)',
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
                  /* Image preview — 로드 전 스켈레톤 */
                  <DocumentFormImageWithSkeleton src={imageUrl} />
                )}
                {/* Actions overlay */}
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', gap: SPACING.ms,
                  padding: SPACING.md, borderTop: '1px solid var(--color-outline-variant)',
                  background: 'var(--color-surface-container-lowest)',
                }}>
                  <Button variant="ghost-neutral" size="xsm" iconLeft="edit" onClick={() => fileRef.current?.click()}>변경</Button>
                  <Button variant="ghost-danger" size="xsm" iconLeft="trash" onClick={() => setImageUrl('')}>삭제</Button>
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
                  background: 'var(--color-surface-container-lowest)',
                  padding: `${SPACING.xxxl} ${SPACING.xl}`, textAlign: 'center',
                  cursor: uploading ? 'default' : 'pointer',
                }}
              >
                {uploading ? (
                  <>
                    <div style={{ width: '24px', height: '24px', border: '3px solid var(--color-outline-variant)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: `0 auto ${SPACING.md}` }} />
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
        <div style={{ padding: `0 ${SPACING.xxl} ${SPACING.xl}`, flexShrink: 0, display: 'flex', gap: SPACING.md }}>
          <Button variant="neutral" size="lg" onClick={onClose} style={{ flex: 1, borderColor: "var(--color-outline-variant)" }}>
            취소
          </Button>
          <Button variant="primary" size="lg" onClick={handleSave} disabled={!canSave} style={{ flex: 1 }}>
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
