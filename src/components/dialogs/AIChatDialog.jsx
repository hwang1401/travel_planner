import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useBackClose } from '../../hooks/useBackClose';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import { getAIRecommendation } from '../../services/geminiService';
import { detectConflicts } from '../../utils/scheduleParser';
import ImportPreviewDialog from './ImportPreviewDialog';
import PlaceInfoContent from '../place/PlaceInfoContent';
import { SPACING, COLOR, TYPE_CONFIG } from '../../styles/tokens';

/* ── AI Chat Dialog ──
 * EditItemDialog에서 분리된 AI 대화 전용 풀스크린 다이얼로그.
 * "AI와 대화하며 계획하기" 버튼에서 진입.
 */

const PLACE_TYPES = ['food', 'spot', 'shop', 'stay'];
const CAT_ICONS = { food: 'fire', spot: 'pin', shop: 'shopping' };

/** Build chat history for API, enriching AI messages with recommended places/items context */
function buildChatHistory(chatMessages) {
  return chatMessages.map((m) => {
    if (m.role === 'ai') {
      let text = m.text || '';
      if (m.places?.length) {
        text += `\n[추천한 장소: ${m.places.map(p => p.name).join(', ')}]`;
      }
      if (m.items?.length) {
        text += `\n[생성한 일정: ${m.items.slice(0, 8).map(it => `${it.time} ${it.desc}`).join(', ')}]`;
      }
      return { role: m.role, text };
    }
    return { role: m.role, text: m.text };
  });
}

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
  useBackClose(true, onClose);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedRecommendIndex, setExpandedRecommendIndex] = useState(null);
  const [choicesSheet, setChoicesSheet] = useState(null);
  const [aiStatusMsg, setAiStatusMsg] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [selectedAIPlace, setSelectedAIPlace] = useState(null);
  const [placeView, setPlaceView] = useState('info');
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);

  useScrollLock(true);

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

    const history = buildChatHistory(chatMessages);
    const lastAi = [...chatMessages].reverse().find((m) => m.role === 'ai' && m.items?.length);
    const currentItems = lastAi?.items ?? undefined;
    const dayContext = currentDay?.label || '';
    const tripScheduleSummary = buildTripScheduleSummary(allDays || []);
    const { type: respType, message, places, items, error, choices } = await getAIRecommendation(raw, history, dayContext, {
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
    const placesArr = Array.isArray(places) ? places : [];
    setChatMessages((prev) => {
      const next = [...prev, { role: 'ai', text: message, type: respType || 'chat', places: placesArr, items, choices: choicesArr }];
      if (items.length === 0 && placesArr.length === 0 && choicesArr.length > 0) setTimeout(() => setChoicesSheet({ question: message, choices: choicesArr }), 0);
      return next;
    });
    setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  }, [chatInput, chatLoading, chatMessages, currentDay, destinations, allDays]);

  const handleChoiceSelect = useCallback((choiceText) => {
    setChoicesSheet(null);
    const history = buildChatHistory(chatMessages);
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
    }).then(({ type: respType, message, places, items, error, choices }) => {
      setChatLoading(false);
      setAiStatusMsg('');
      const choicesArr = Array.isArray(choices) ? choices : [];
      const placesArr = Array.isArray(places) ? places : [];
      if (error) {
        setChatMessages((prev) => [...prev, { role: 'ai', text: '일시적인 오류가 발생했어요.', isError: true, lastUserText: choiceText }]);
        return;
      }
      setChatMessages((prev) => {
        const next = [...prev, { role: 'ai', text: message, type: respType || 'chat', places: placesArr, items, choices: choicesArr }];
        if (items.length === 0 && placesArr.length === 0 && choicesArr.length > 0) setTimeout(() => setChoicesSheet({ question: message, choices: choicesArr }), 0);
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
      const historyForApi = buildChatHistory(trimmed);
      const lastAi = [...prev].reverse().find((m) => m.role === 'ai' && m.items?.length);
      const currentItems = lastAi?.items ?? undefined;
      setChatLoading(true);
      getAIRecommendation(lastUserText, historyForApi, dayContext, {
        onStatus: (s) => setAiStatusMsg(s),
        destinations: Array.isArray(destinations) ? destinations.map((d) => (typeof d === 'string' ? d : d?.name ?? '')).filter(Boolean) : undefined,
        currentItems,
        tripScheduleSummary,
      }).then(({ type: respType, message, places, items, error, choices }) => {
        setChatLoading(false);
        setAiStatusMsg('');
        const choicesArr = Array.isArray(choices) ? choices : [];
        const placesArr = Array.isArray(places) ? places : [];
        if (error) {
          setChatMessages((prev2) => [...prev2, { role: 'ai', text: '일시적인 오류가 발생했어요.', isError: true, lastUserText }]);
        } else {
          setChatMessages((prev2) => {
            const next = [...prev2, { role: 'ai', text: message, type: respType || 'chat', places: placesArr, items, choices: choicesArr }];
            if (items.length === 0 && placesArr.length === 0 && choicesArr.length > 0) setTimeout(() => setChoicesSheet({ question: message, choices: choicesArr }), 0);
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
        padding: `calc(env(safe-area-inset-top, 0px) + ${SPACING.md}) ${SPACING.md} ${SPACING.md} ${SPACING.sm}`,
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
              ...(msg.role === 'user' ? {
                padding: `${SPACING.ml} ${SPACING.lx}`,
                borderRadius: 'var(--radius-md, 8px) var(--radius-md, 8px) 2px var(--radius-md, 8px)',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
              } : {
                padding: msg.isError ? `${SPACING.ml} ${SPACING.lx}` : 0,
                borderRadius: msg.isError ? 'var(--radius-md, 8px) var(--radius-md, 8px) var(--radius-md, 8px) 2px' : 0,
                background: msg.isError ? 'var(--color-error-container, #FEE2E2)' : 'transparent',
                color: msg.isError ? 'var(--color-error)' : 'var(--color-on-surface)',
              }),
              fontSize: 'var(--typo-caption-1-regular-size)', lineHeight: 1.5, wordBreak: 'break-word',
            }}>
              {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
              {msg.role === 'ai' && msg.isError && msg.lastUserText && (
                <Button variant="neutral" size="sm" onClick={() => handleRetryChat(msg.lastUserText)} disabled={chatLoading} style={{ marginTop: SPACING.ml }}>다시 시도하기</Button>
              )}

              {/* type: recommend → 가로 스크롤 추천 카드 */}
              {msg.role === 'ai' && msg.type === 'recommend' && msg.places && msg.places.length > 0 && (
                <div style={{
                  marginTop: msg.text ? SPACING.ml : 0,
                  overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                  scrollSnapType: 'x mandatory',
                  display: 'flex', gap: '8px',
                  msOverflowStyle: 'none', scrollbarWidth: 'none',
                }}>
                  {msg.places.map((place, j) => {
                    const catCfg = TYPE_CONFIG[place.category] || TYPE_CONFIG.spot;
                    return (
                      <div key={j}
                        onClick={(e) => { e.stopPropagation(); setPlaceView('info'); setSelectedAIPlace({ _isPlace: true, ...place }); }}
                        style={{ flex: '0 0 160px', scrollSnapAlign: 'start', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }}>
                        {place.image ? (
                          <img src={place.image} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', aspectRatio: '4/3', background: catCfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name={CAT_ICONS[place.category] || 'pin'} size={28} style={{ color: catCfg.text }} />
                          </div>
                        )}
                        <div style={{ padding: `${SPACING.ms} ${SPACING.md}` }}>
                          <p style={{ margin: 0, fontSize: 'var(--typo-caption-2-regular-size)', fontWeight: 600, color: 'var(--color-on-surface)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</p>
                          {place.rating != null && (
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-on-surface-variant2)' }}>
                              <span style={{ color: '#F59E0B' }}>&#9733;</span> {Number(place.rating).toFixed(1)}
                            </p>
                          )}
                          {place.description && place.rating == null && (
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-on-surface-variant2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* type: itinerary → 타임라인 리스트 (기존 items 렌더링) */}
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
                        <div key={j}
                          onClick={(e) => { e.stopPropagation(); setPlaceView('info'); setSelectedAIPlace(it); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: SPACING.md,
                            padding: `${SPACING.ms} ${SPACING.md}`,
                            background: 'var(--color-surface-container-lowest)', borderRadius: '6px',
                            fontSize: 'var(--typo-caption-2-regular-size)',
                            cursor: 'pointer',
                          }}>
                          {it.detail?.image && (
                            <img src={it.detail.image} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', width: '36px', flexShrink: 0 }}>{it.time || '--:--'}</span>
                          <span style={{ flex: 1, color: 'var(--color-on-surface)', fontWeight: 500 }}>{it.desc}</span>
                          <Icon name="chevronRight" size={12} style={{ opacity: 0.3, flexShrink: 0 }} />
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
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${SPACING.lg})`,
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
      {selectedAIPlace && (
        <BottomSheet maxHeight={placeView === 'form' ? '85vh' : '70vh'} zIndex={9600} onClose={() => { setSelectedAIPlace(null); setPlaceView('info'); }}>
          <PlaceInfoContent
            view={placeView}
            onGoToForm={() => setPlaceView('form')}
            onBack={placeView === 'form' ? () => setPlaceView('info') : undefined}
            place={selectedAIPlace._isPlace ? {
              name: selectedAIPlace.name,
              address: selectedAIPlace.address,
              lat: selectedAIPlace.lat,
              lon: selectedAIPlace.lon,
              image: selectedAIPlace.image,
              rating: selectedAIPlace.rating,
              reviewCount: selectedAIPlace.reviewCount,
              hours: selectedAIPlace.hours,
              placeId: selectedAIPlace.placeId,
              tip: selectedAIPlace.description,
              type: selectedAIPlace.category,
            } : {
              name: selectedAIPlace.desc,
              address: selectedAIPlace.detail?.address,
              lat: selectedAIPlace.detail?.lat,
              lon: selectedAIPlace.detail?.lon,
              image: selectedAIPlace.detail?.image,
              rating: selectedAIPlace.detail?.rating,
              reviewCount: selectedAIPlace.detail?.reviewCount,
              hours: selectedAIPlace.detail?.hours,
              priceLevel: selectedAIPlace.detail?.priceLevel,
              placeId: selectedAIPlace.detail?.placeId,
              tip: selectedAIPlace.detail?.tip,
              type: selectedAIPlace.type,
            }}
            onAdd={(item) => {
              onBulkImport?.([item], 'append');
              setSelectedAIPlace(null);
              setPlaceView('info');
            }}
            initialTime={selectedAIPlace._isPlace ? undefined : selectedAIPlace.time}
          />
        </BottomSheet>
      )}
      {importPreview && (
        <ImportPreviewDialog
          items={importPreview.items}
          errors={importPreview.errors}
          conflicts={importPreview.conflicts}
          dayLabel={currentDay?.label || 'Day'}
          existingCount={currentDay?.sections?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0}
          onAppend={(selectedItems) => { onBulkImport?.(selectedItems, 'append'); setImportPreview(null); onClose(); }}
          onCancel={() => setImportPreview(null)}
        />
      )}
    </>,
    document.body
  );
}
