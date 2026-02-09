import { useState, useCallback, useEffect } from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';
import PageTransition from '../common/PageTransition';
import { analyzeScheduleWithAI } from '../../services/geminiService';
import { readFileAsText } from '../../utils/scheduleParser';
import { readFileAsBase64 } from '../../utils/fileReader';
import { getTypeConfig, COLOR, SPACING, RADIUS } from '../../styles/tokens';

/* ── PasteInfoPage ──
 * Full-page for pasting booking info / uploading files → AI parsing.
 * P-type killer feature: "던지면 알아서 정리"
 *
 * Props:
 *   open       — visibility
 *   onClose    — close handler
 *   onImport   — (items: Array) => void — callback with parsed items
 *   context    — optional context string for AI (e.g. "Day 3 오사카")
 */
export default function PasteInfoPage({ open, onClose, onImport, context = '' }) {
  const [pasteText, setPasteText] = useState('');
  const [attachments, setAttachments] = useState([]); // [{ mimeType, data, name? }]
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [preview, setPreview] = useState(null); // { items: [...] }
  const [statusMsg, setStatusMsg] = useState('');

  const isTextFile = (file) => {
    const n = (file.name || '').toLowerCase();
    const t = (file.type || '').toLowerCase();
    return t.startsWith('text/') || n.endsWith('.txt') || n.endsWith('.md') || n.endsWith('.text');
  };
  const isImageOrPdf = (file) => {
    const t = (file.type || '').toLowerCase();
    return t.startsWith('image/') || t === 'application/pdf';
  };

  const handleFileSelect = useCallback(async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    e.target.value = '';
    for (const file of files) {
      try {
        if (isTextFile(file)) {
          const text = await readFileAsText(file);
          setPasteText((prev) => (prev ? prev + '\n\n' + text : text));
        } else if (isImageOrPdf(file)) {
          const { mimeType, data } = await readFileAsBase64(file);
          setAttachments((prev) => [...prev, { mimeType, data, name: file.name }]);
        } else {
          setGenError('지원 형식: .txt, .md, 이미지, PDF');
        }
      } catch (err) {
        setGenError(err.message || '파일을 읽을 수 없습니다');
        break;
      }
    }
  }, []);

  const removeAttachment = useCallback((index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canAnalyze = pasteText.trim() || attachments.length > 0;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setGenerating(true); setGenError(''); setPreview(null); setStatusMsg('');

    const content = pasteText.trim() || (attachments.length > 0 ? '' : '');
    const attachmentParts = attachments.map((a) => ({ mimeType: a.mimeType, data: a.data }));

    const { items, error } = await analyzeScheduleWithAI(content, context, {
      onStatus: (msg) => setStatusMsg(msg),
      attachments: attachmentParts.length > 0 ? attachmentParts : undefined,
    });
    setGenerating(false); setStatusMsg('');

    if (error) { setGenError(error); return; }
    if (!items || items.length === 0) { setGenError('분석 결과가 없습니다. 텍스트 또는 파일을 확인해주세요.'); return; }
    setPreview({ items });
  };

  const handleImport = () => {
    if (!preview?.items) return;
    onImport(preview.items);
    onClose();
  };

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

  return (
    <PageTransition open={open} onClose={onClose} viewportRect={viewportRect}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACING.md,
        padding: `${SPACING.lg} ${SPACING.xl}`, paddingTop: `calc(${SPACING.lg} + env(safe-area-inset-top, 0px))`,
        borderBottom: '1px solid var(--color-outline-variant)', flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
        <span style={{ flex: 1, fontSize: 'var(--typo-body-2-n---bold-size)', fontWeight: 'var(--typo-body-2-n---bold-weight)', color: 'var(--color-on-surface)' }}>
          예약 정보 추가
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: `${SPACING.xxxl} ${SPACING.xxl} ${SPACING.xxxxl}`, display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>

        <div>
          <h2 style={{ margin: `0 0 ${SPACING.sm}`, fontSize: 'var(--typo-heading-3-size, 22px)', fontWeight: 700, color: 'var(--color-on-surface)' }}>
            예약 정보 붙여넣기
          </h2>
          <p style={{ margin: 0, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)' }}>
            확인 메일, 바우처, 일정을 복사해서 붙여넣으세요
          </p>
        </div>

        {/* Text area */}
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="여기에 예약 확인 메일이나 일정 텍스트를 붙여넣으세요..."
          rows={8}
          style={{
            width: '100%', padding: SPACING.lx, borderRadius: '12px',
            border: '1px solid var(--color-outline-variant)',
            background: 'var(--color-surface-container-lowest)',
            fontSize: 'var(--typo-label-2-regular-size)',
            color: 'var(--color-on-surface)',
            resize: 'vertical', fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* File upload */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: SPACING.md,
          padding: `${SPACING.ml} ${SPACING.lx}`, borderRadius: RADIUS.md,
          border: '1px dashed var(--color-outline-variant)',
          cursor: 'pointer', color: 'var(--color-on-surface-variant)',
          fontSize: 'var(--typo-caption-1-regular-size)',
        }}>
          <Icon name="document" size={16} style={{ opacity: 0.6 }} />
          <span>또는 이미지/PDF 첨부 (바우처, 확인 메일 등)</span>
          <input type="file" accept=".txt,.md,.text,image/*,application/pdf" multiple onChange={handleFileSelect}
            style={{ display: 'none' }} />
        </label>
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.ms }}>
            {attachments.map((a, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: SPACING.ms,
                padding: `${SPACING.ms} ${SPACING.ml}`, borderRadius: RADIUS.md,
                background: 'var(--color-surface-container-high)', fontSize: 'var(--typo-caption-2-regular-size)',
                color: 'var(--color-on-surface-variant)',
              }}>
                {a.name || '첨부'}
                <button type="button" onClick={() => removeAttachment(i)} aria-label="제거"
                  style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.8 }}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Analyze button */}
        <Button variant="primary" size="lg" fullWidth iconLeft="flash"
          onClick={handleAnalyze} disabled={generating || !canAnalyze}>
          {generating ? (statusMsg || 'AI가 분석하고 있어요...') : 'AI로 분석하기'}
        </Button>

        {/* Loading */}
        {generating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, background: 'var(--color-primary-container)', borderRadius: RADIUS.md }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[0, 1, 2].map((d) => (
                <div key={d} style={{ width: '5px', height: '5px', borderRadius: RADIUS.full, background: 'var(--color-primary)', animation: `bounce 1.2s infinite ${d * 0.2}s` }} />
              ))}
            </div>
            <span style={{ fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-primary-container)' }}>
              {statusMsg || '분석 중...'}
            </span>
          </div>
        )}

        {/* Error */}
        {genError && (
          <p style={{ margin: 0, padding: `${SPACING.ml} ${SPACING.lg}`, background: 'var(--color-error-container)', borderRadius: RADIUS.md, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-error)' }}>
            {genError}
          </p>
        )}

        {/* Preview */}
        {preview && preview.items.length > 0 && (
          <div style={{ border: '1px solid var(--color-outline-variant)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: `${SPACING.ml} ${SPACING.lx}`, background: 'var(--color-primary-container)' }}>
              <span style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-primary-container)' }}>
                분석 결과 ({preview.items.length}개 일정)
              </span>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {preview.items.map((it, j) => (
                <div key={j} style={{
                  display: 'flex', alignItems: 'flex-start', gap: SPACING.md,
                  padding: `${SPACING.md} ${SPACING.lx}`,
                  borderBottom: j < preview.items.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                }}>
                  <span style={{ width: '36px', flexShrink: 0, textAlign: 'right', fontSize: '11px', fontWeight: 600, color: 'var(--color-on-surface-variant2)', fontVariantNumeric: 'tabular-nums', lineHeight: '18px' }}>
                    {it.time || ''}
                  </span>
                  <div style={{ width: '3px', flexShrink: 0, borderRadius: RADIUS.xs, background: getTypeConfig(it.type).text, alignSelf: 'stretch', minHeight: '16px' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: 'var(--color-on-surface)', lineHeight: '18px' }}>{it.desc}</p>
                    {it.sub && <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--color-on-surface-variant2)' }}>{it.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import button */}
        {preview && preview.items.length > 0 && (
          <Button variant="primary" size="xlg" fullWidth onClick={handleImport}>
            일정에 추가하기 ({preview.items.length}개)
          </Button>
        )}
      </div>

      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
    </PageTransition>
  );
}
