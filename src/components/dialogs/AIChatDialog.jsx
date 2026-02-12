import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import { getAIRecommendation } from '../../services/geminiService';
import { detectConflicts } from '../../utils/scheduleParser';
import ImportPreviewDialog from './ImportPreviewDialog';
import { SPACING, COLOR } from '../../styles/tokens';

/* ── AI Chat Dialog ──
 * EditItemDialog에서 분리된 AI 대화 전용 풀스크린 다이얼로그.
 * "AI와 대화하며 계획하기" 버튼에서 진입.
 */

const PLACE_TYPES = ['food', 'spot', 'shop', 'stay'];

function buildTripScheduleSummary(allDays) {
  if (!Array.isArray(allDays) || allDays.length === 0) return '';
  const lines = [];
  for (const day of allDays) {
    const names = [];
    for (const sec of day.sections || []) {
      for (const it of sec.items || []) {
        if (it?.desc && PLACE_TYPES.includes(it.type)) names.push(it.desc.trim());
      }
    }
    if (names.length > 0) {
      const label = day.label || `Day ${day.day}`;
      lines.push(`${day.day}일차(${label}): ${names.join(', ')}`);
    }
  }
  return lines.join('\n');
}

export default function AIChatDialog({ onClose, onBulkImport, currentDay, destinations, allDays }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedRecommendIndex, setExpandedRecommendIndex] = useState(null);
  const [choicesSheet, setChoicesSheet] = useState(null);
  const [aiStatusMsg, setAiStatusMsg] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);

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

  const handleSendChat = useCallback(async () => {
    const raw = (chatInputRef.current?.value ?? chatInput).trim();
    if (!raw || chatLoading) return;
    const userMsg = { role: 'user', text: raw };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    if (chatInputRef.current) chatInputRef.current.value = '';
    requestAnimationFrame(() => { setChatInput(''); if (chatInputRef.current) chatInputRef.current.value = ''; });
    setChatLoading(true);
    setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }), 0);

    const history = chatMessages.map((m) => ({ role: m.role, text: m.role === 'ai' ? (m.text || '') : m.text }));
    const lastAi = [...chatMessages].reverse().find((m) => m.role === 'ai' && m.items?.length);
    const currentItems = lastAi?.items ?? undefined;
    const dayContext = currentDay?.label || '';
    const tripScheduleSummary = buildTripScheduleSummary(allDays || []);
    const { message, items, error, choices } = await getAIRecommendation(raw, history, dayContext, {
      onStatus: (s) => setAiStatusMsg(s),
      destinations: Array.isArray(destinations) ? destinations.map((d) => (typeof d === 'string' ? d : d?.name ?? '')).filter(Boolean) : undefined,
      currentItems,
      tripScheduleSummary,
    });
    setChatLoading(false);
    setAiStatusMsg('');
    if (error) {
      setChatMessages((prev) => [...prev, { role: 'ai', text: '일시적인 오류가 발생했어요. 네트워크나 서버 상태 때문일 수 있어요.', isError: true, lastUserText: raw }]);
      return;
    }
    const choicesArr = Array.isArray(choices) ? choices : [];
    setChatMessages((prev) => {
      const next = [...prev, { role: 'ai', text: message, items, choices: choicesArr }];
      if (items.length === 0 && choicesArr.length > 0) setTimeout(() => setChoicesSheet({ question: message, choices: choicesArr }), 0);
      return next;
    });
    setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  }, [chatInput, chatLoading, chatMessages, currentDay, destinations, allDays]);

  const handleChoiceSelect = useCallback((choiceText) => {
    setChoicesSheet(null);
    const history = chatMessages.map((m) => ({ role: m.role, text: m.role === 'ai' ? (m.text || '') : m.text }));
    setChatMessages((prev) => [...prev, { role: 'user', text: choiceText }]);
    setChatLoading(true);
    const lastAi = [...chatMessages].reverse().find((m) => m.role === 'ai' && m.items?.length);
    const currentItems = lastAi?.items ?? undefined;
    const dayContext = currentDay?.label || '';
    const tripScheduleSummary = buildTripScheduleSummary(allDays || []);
    getAIRecommendation(choiceText, history, dayContext, {
      onStatus: (s) => setAiStatusMsg(s),
      destinations: Array.isArray(destinations) ? destinations.map((d) => (typeof d === 'string' ? d : d?.name ?? '')).filter(Boolean) : undefined,
      currentItems,
      tripScheduleSummary,
    }).then(({ message, items, error, choices }) => {
      setChatLoading(false);
      setAiStatusMsg('');
      const choicesArr = Array.isArray(choices) ? choices : [];
      if (error) {
        setChatMessages((prev) => [...prev, { role: 'ai', text: '일시적인 오류가 발생했어요.', isError: true, lastUserText: choiceText }]);
        return;
      }
      setChatMessages((prev) => {
        const next = [...prev, { role: 'ai', text: message, items, choices: choicesArr }];
        if (items.length === 0 && choicesArr.length > 0) setTimeout(() => setChoicesSheet({ question: message, choices: choicesArr }), 0);
        return next;
      });
      setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }).catch(() => { setChatLoading(false); setAiStatusMsg(''); });
  }, [chatMessages, currentDay, destinations, allDays]);

  const handleRetryChat = useCallback((lastUserText) => {
    const dayContext = currentDay?.label || '';
    const tripScheduleSummary = buildTripScheduleSummary(allDays || []);
    setChatMessages((prev) => {
      const trimmed = prev.slice(0, -2);
      const historyForApi = trimmed.map((m) => ({ role: m.role, text: m.role === 'ai' ? (m.text || '') : m.text }));
      const lastAi = [...prev].reverse().find((m) => m.role === 'ai' && m.items?.length);
      const currentItems = lastAi?.items ?? undefined;
      setChatLoading(true);
      getAIRecommendation(lastUserText, historyForApi, dayContext, {
        onStatus: (s) => setAiStatusMsg(s),
        destinations: Array.isArray(destinations) ? destinations.map((d) => (typeof d === 'string' ? d : d?.name ?? '')).filter(Boolean) : undefined,
        currentItems,
        tripScheduleSummary,
      }).then(({ message, items, error, choices }) => {
        setChatLoading(false);
        setAiStatusMsg('');
        const choicesArr = Array.isArray(choices) ? choices : [];
        if (error) {
          setChatMessages((prev2) => [...prev2, { role: 'ai', text: '일시적인 오류가 발생했어요.', isError: true, lastUserText }]);
        } else {
          setChatMessages((prev2) => {
            const next = [...prev2, { role: 'ai', text: message, items, choices: choicesArr }];
            if (items.length === 0 && choicesArr.length > 0) setTimeout(() => setChoicesSheet({ question: message, choices: choicesArr }), 0);
            return next;
          });
        }
        setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
      }).catch(() => {
        setChatLoading(false);
        setAiStatusMsg('');
        setChatMessages((prev2) => [...prev2, { role: 'ai', text: '다시 시도해도 오류가 났어요.', isError: true, lastUserText }]);
      });
      return [...trimmed, { role: 'user', text: lastUserText }];
    });
  }, [currentDay, destinations, allDays]);

  const handleApplyRecommendation = useCallback((items) => {
    if (!items || items.length === 0) return;
    const conflicts = detectConflicts(items, currentDay);
    setImportPreview({ items, errors: [], conflicts });
  }, [currentDay]);

  const modal = (
    <div style={{
      position: 'fixed',
      ...(viewportRect != null
        ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height }
        : { inset: 0 }),
      zIndex: 9000,
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface)',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACING.md,
        padding: `${SPACING.md} ${SPACING.md} ${SPACING.md} ${SPACING.sm}`,
        borderBottom: '1px solid var(--color-outline-variant)',
        flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
        <span style={{ fontWeight: 600, fontSize: 'var(--typo-body-1-n---bold-size)', color: 'var(--color-on-surface)' }}>
          AI와 대화하며 계획하기
        </span>
      </div>

      {/* 채팅 영역 */}
      <div ref={chatScrollRef} style={{
        flex: 1, overflowY: 'auto', padding: `${SPACING.xl} ${SPACING.xxl}`,
        display: 'flex', flexDirection: 'column', gap: SPACING.lg,
      }}>
        {chatMessages.length === 0 && !chatLoading && (
          <div style={{ textAlign: 'center', padding: `${SPACING.xxxl} ${SPACING.lg}` }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--color-primary-container)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: `0 auto ${SPACING.lg}`,
            }}>
              <Icon name="flash" size={24} style={{ color: 'var(--color-primary)' }} />
            </div>
            <p style={{ margin: 0, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
              AI와 대화하기
            </p>
            <p style={{ margin: `${SPACING.md} 0 ${SPACING.xl}`, fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant2)', lineHeight: 1.6 }}>
              어디로 갈지, 뭘 먹을지 말해보세요.<br />일정이 필요하면 말해주시면 그때 맞춰 드릴게요.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
              {[
                '오사카 도톤보리 근처에서 맛있는 거 먹고 싶어',
                '후쿠오카에서 하루종일 놀고 싶어, 라멘은 꼭!',
                '쿠마모토성 보고 말고기 먹을래',
              ].map((example, i) => (
                <button key={i}
                  onClick={() => { setChatInput(example); setTimeout(() => chatInputRef.current?.focus(), 50); }}
                  style={{
                    background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-md, 8px)', padding: `${SPACING.ml} ${SPACING.lx}`, cursor: 'pointer',
                    fontSize: 'var(--typo-caption-1-regular-size)', color: 'var(--color-on-surface-variant)',
                    textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-primary-container)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-container-lowest)'}
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: `${SPACING.ml} ${SPACING.lx}`,
              borderRadius: msg.role === 'user'
                ? 'var(--radius-md, 8px) var(--radius-md, 8px) 2px var(--radius-md, 8px)'
                : 'var(--radius-md, 8px) var(--radius-md, 8px) var(--radius-md, 8px) 2px',
              background: msg.role === 'user'
                ? 'var(--color-primary)'
                : msg.isError ? 'var(--color-error-container, #FEE2E2)' : 'var(--color-surface-container-lowest)',
              color: msg.role === 'user'
                ? 'var(--color-on-primary)'
                : msg.isError ? 'var(--color-error)' : 'var(--color-on-surface)',
              fontSize: 'var(--typo-caption-1-regular-size)', lineHeight: 1.5, wordBreak: 'break-word',
            }}>
              {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
              {msg.role === 'ai' && msg.isError && msg.lastUserText && (
                <Button variant="neutral" size="sm" onClick={() => handleRetryChat(msg.lastUserText)} disabled={chatLoading} style={{ marginTop: SPACING.ml }}>다시 시도하기</Button>
              )}
              {msg.role === 'ai' && msg.items && msg.items.length > 0 && (() => {
                const VISIBLE_COUNT = 4;
                const isExpanded = expandedRecommendIndex === i;
                const showAll = isExpanded || msg.items.length <= VISIBLE_COUNT;
                const list = showAll ? msg.items : msg.items.slice(0, VISIBLE_COUNT);
                const hasMore = msg.items.length > VISIBLE_COUNT;
                return (
                  <div style={{ marginTop: msg.text ? SPACING.ml : 0 }}>
                    <div style={{
                      borderTop: msg.text ? '1px solid var(--color-outline-variant)' : 'none',
                      paddingTop: msg.text ? SPACING.ml : 0,
                      display: 'flex', flexDirection: 'column', gap: SPACING.ms,
                    }}>
                      {list.map((it, j) => (
                        <div key={j} style={{
                          display: 'flex', alignItems: 'center', gap: SPACING.md,
                          padding: `${SPACING.ms} ${SPACING.md}`,
                          background: 'var(--color-surface-container-lowest)', borderRadius: '6px',
                          fontSize: 'var(--typo-caption-2-regular-size)',
                        }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', width: '36px', flexShrink: 0 }}>{it.time || '--:--'}</span>
                          <span style={{ flex: 1, color: 'var(--color-on-surface)', fontWeight: 500 }}>{it.desc}</span>
                        </div>
                      ))}
                      {hasMore && !isExpanded && (
                        <button type="button" onClick={() => setExpandedRecommendIndex(i)}
                          style={{ margin: 0, padding: `${SPACING.sm} ${SPACING.md}`, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-primary)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}>
                          전체보기 ({msg.items.length}개)
                        </button>
                      )}
                      {hasMore && isExpanded && (
                        <button type="button" onClick={() => setExpandedRecommendIndex(null)}
                          style={{ margin: 0, padding: `${SPACING.sm} ${SPACING.md}`, fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}>
                          접기
                        </button>
                      )}
                    </div>
                    <Button variant="primary" size="sm" onClick={() => handleApplyRecommendation(msg.items)} fullWidth style={{ marginTop: SPACING.ml }}>
                      자세히보기 ({msg.items.length}개)
                    </Button>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}

        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: `${SPACING.lg} ${SPACING.xl}`,
              borderRadius: 'var(--radius-md, 8px) var(--radius-md, 8px) var(--radius-md, 8px) 2px',
              background: 'var(--color-surface-container-lowest)',
              display: 'flex', alignItems: 'center', gap: SPACING.ms,
            }}>
              <div style={{ display: 'flex', gap: SPACING.sm }}>
                {[0, 1, 2].map((d) => (
                  <div key={d} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--color-on-surface-variant2)',
                    animation: `aichat-bounce 1.2s infinite ${d * 0.2}s`,
                  }} />
                ))}
              </div>
              <span style={{
                fontSize: 'var(--typo-caption-2-regular-size)',
                color: aiStatusMsg.includes('재시도') ? COLOR.warning : 'var(--color-on-surface-variant2)',
                fontWeight: aiStatusMsg.includes('재시도') ? 600 : 400,
              }}>
                {aiStatusMsg || '답변을 준비하고 있어요...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 입력바 */}
      <div style={{
        padding: `${SPACING.lg} ${SPACING.xl}`,
        paddingBottom: `var(--safe-area-bottom, 0px)`,
        flexShrink: 0, borderTop: '1px solid var(--color-outline-variant)',
        display: 'flex', gap: SPACING.md, alignItems: 'flex-end',
        background: 'var(--color-surface-container-lowest)',
      }}>
        <textarea
          ref={chatInputRef}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onFocus={() => setTimeout(() => chatInputRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 400)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (e.nativeEvent.isComposing) return; handleSendChat(); } }}
          placeholder="어디를 가고 싶나요?"
          rows={1}
          style={{
            flex: 1, minWidth: 0, resize: 'none',
            padding: `${SPACING.ml} ${SPACING.lx}`, boxSizing: 'border-box',
            borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--color-outline-variant)',
            background: 'var(--color-surface-container-lowest)',
            fontSize: 'var(--typo-caption-1-regular-size)', lineHeight: 1.4,
            color: 'var(--color-on-surface)', outline: 'none', fontFamily: 'inherit', maxHeight: '80px',
          }}
        />
        <Button variant="primary" size="md" iconOnly="navigation" onClick={handleSendChat}
          disabled={!chatInput.trim() || chatLoading}
          style={{ width: 40, height: 40, borderRadius: 'var(--radius-md, 8px)', flexShrink: 0 }}
        />
      </div>

      <style>{`@keyframes aichat-bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }`}</style>
    </div>
  );

  return createPortal(
    <>
      {modal}
      {choicesSheet && (
        <BottomSheet onClose={() => setChoicesSheet(null)} title={choicesSheet.question} zIndex={9500}>
          <div style={{ padding: SPACING.xxl, display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
            {choicesSheet.choices.map((label) => (
              <Button key={label} variant="neutral" size="lg" fullWidth onClick={() => handleChoiceSelect(label)}>{label}</Button>
            ))}
          </div>
        </BottomSheet>
      )}
      {importPreview && (
        <ImportPreviewDialog
          items={importPreview.items}
          errors={importPreview.errors}
          conflicts={importPreview.conflicts}
          dayLabel={currentDay?.label || 'Day'}
          existingCount={currentDay?.sections?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0}
          onReplace={() => { onBulkImport?.(importPreview.items, 'replace'); setImportPreview(null); onClose(); }}
          onAppend={() => { onBulkImport?.(importPreview.items, 'append'); setImportPreview(null); onClose(); }}
          onCancel={() => setImportPreview(null)}
        />
      )}
    </>,
    document.body
  );
}
