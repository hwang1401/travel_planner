import { useState, useCallback } from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';
import PageTransition from '../common/PageTransition';
import { analyzeScheduleWithAI } from '../../services/geminiService';
import { readFileAsText } from '../../utils/scheduleParser';
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
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [preview, setPreview] = useState(null); // { items: [...] }
  const [statusMsg, setStatusMsg] = useState('');

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      setPasteText(text);
    } catch (err) {
      setGenError('파일을 읽을 수 없습니다: ' + err.message);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!pasteText.trim()) return;
    setGenerating(true); setGenError(''); setPreview(null); setStatusMsg('');

    const { items, error } = await analyzeScheduleWithAI(pasteText.trim(), context, {
      onStatus: (msg) => setStatusMsg(msg),
    });
    setGenerating(false); setStatusMsg('');

    if (error) { setGenError(error); return; }
    if (!items || items.length === 0) { setGenError('분석 결과가 없습니다. 텍스트를 확인해주세요.'); return; }
    setPreview({ items });
  };

  const handleImport = () => {
    if (!preview?.items) return;
    onImport(preview.items);
    onClose();
  };

  /* type → color from shared tokens */

  return (
    <PageTransition open={open} onClose={onClose}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        borderBottom: '1px solid var(--color-outline-variant)', flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
        <span style={{ flex: 1, fontSize: 'var(--typo-body-2-n---bold-size)', fontWeight: 'var(--typo-body-2-n---bold-weight)', color: 'var(--color-on-surface)' }}>
          예약 정보 추가
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '24px 20px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 'var(--typo-heading-3-size, 22px)', fontWeight: 700, color: 'var(--color-on-surface)' }}>
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
            width: '100%', padding: '14px', borderRadius: '12px',
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
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px', borderRadius: '8px',
          border: '1px dashed var(--color-outline-variant)',
          cursor: 'pointer', color: 'var(--color-on-surface-variant)',
          fontSize: 'var(--typo-caption-1-regular-size)',
        }}>
          <Icon name="document" size={16} style={{ opacity: 0.6 }} />
          <span>또는 파일 첨부 (.txt, .md)</span>
          <input type="file" accept=".txt,.md,.text" onChange={handleFileSelect}
            style={{ display: 'none' }} />
        </label>

        {/* Analyze button */}
        <Button variant="primary" size="lg" fullWidth iconLeft="flash"
          onClick={handleAnalyze} disabled={generating || !pasteText.trim()}>
          {generating ? (statusMsg || 'AI가 분석하고 있어요...') : 'AI로 분석하기'}
        </Button>

        {/* Loading */}
        {generating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--color-primary-container)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[0, 1, 2].map((d) => (
                <div key={d} style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-primary)', animation: `bounce 1.2s infinite ${d * 0.2}s` }} />
              ))}
            </div>
            <span style={{ fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-primary-container)' }}>
              {statusMsg || '텍스트를 분석하고 있습니다...'}
            </span>
          </div>
        )}

        {/* Error */}
        {genError && (
          <p style={{ margin: 0, padding: '10px 12px', background: 'var(--color-error-container)', borderRadius: '8px', fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-error)' }}>
            {genError}
          </p>
        )}

        {/* Preview */}
        {preview && preview.items.length > 0 && (
          <div style={{ border: '1px solid var(--color-outline-variant)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--color-primary-container)' }}>
              <span style={{ fontSize: 'var(--typo-caption-1-bold-size)', fontWeight: 600, color: 'var(--color-on-primary-container)' }}>
                분석 결과 ({preview.items.length}개 일정)
              </span>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {preview.items.map((it, j) => (
                <div key={j} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '8px 14px',
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
