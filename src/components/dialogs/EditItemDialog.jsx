import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Field from '../common/Field';
import Tab from '../common/Tab';
import AddressSearch from '../common/AddressSearch';
import { useScrollLock } from '../../hooks/useScrollLock';
import { MultiImagePicker } from '../common/ImagePicker';
import { uploadImage, generateImagePath } from '../../services/imageService';
import { TIMETABLE_DB, findBestTrain, matchTimetableRoute } from '../../data/timetable';
import TimetablePreview from '../common/TimetablePreview';
import { readFileAsText, detectConflicts } from '../../utils/scheduleParser';
import { analyzeScheduleWithAI, getAIRecommendation } from '../../services/geminiService';
import ImportPreviewDialog from './ImportPreviewDialog';
import { SPACING, RADIUS, COLOR } from '../../styles/tokens';
import TimetableSearchDialog from './TimetableSearchDialog';

/* ── Edit Item Dialog (일정 추가/수정) ── */
export default function EditItemDialog({ item, sectionIdx, itemIdx, dayIdx, onSave, onDelete, onClose, color, tripId, currentDay, onBulkImport, initialTab = 0, aiOnly = false, destinations }) {
  const isNew = !item;
  const [activeTab, setActiveTab] = useState(aiOnly ? 2 : (isNew ? initialTab : 0));
  const [time, setTime] = useState(item?.time || "");
  const [desc, setDesc] = useState(item?.desc || "");
  const [type, setType] = useState(item?.type || "spot");
  const [sub, setSub] = useState(item?.sub || "");
  const [address, setAddress] = useState(item?.detail?.address || "");
  const [detailLat, setDetailLat] = useState(item?.detail?.lat || null);
  const [detailLon, setDetailLon] = useState(item?.detail?.lon || null);
  const [detailTip, setDetailTip] = useState(item?.detail?.tip || "");
  const [detailPrice, setDetailPrice] = useState(item?.detail?.price || "");
  const [detailHours, setDetailHours] = useState(item?.detail?.hours || "");
  const [detailHighlights, setDetailHighlights] = useState(
    () => (item?.detail?.highlights && Array.isArray(item.detail.highlights)) ? item.detail.highlights.join("\n") : ""
  );
  // Multi-image support: migrate from single image to array
  const [detailImages, setDetailImages] = useState(() => {
    if (item?.detail?.images && Array.isArray(item.detail.images)) return [...item.detail.images];
    if (item?.detail?.image) return [item.detail.image];
    return [];
  });
  const [detailMainImage, setDetailMainImage] = useState(item?.detail?.image || '');
  const [imageUploading, setImageUploading] = useState(false);

  // Timetable state
  const currentRouteId = item?.detail?.timetable?._routeId || "";
  const [selectedRoute, setSelectedRoute] = useState(currentRouteId);
  // 시간표: trains가 있을 때만 유효한 로드로 간주 (빈 객체면 자동 매칭 대상)
  const [loadedTimetable, setLoadedTimetable] = useState(
    () => (item?.detail?.timetable?.trains?.length ? item.detail.timetable : null)
  );
  const [showTimetableSearch, setShowTimetableSearch] = useState(false);

  // 교통(move): desc/시간 바뀌면 맞는 노선 자동 매칭 → 시간표 리스트 표시 (검색은 필요할 때만)
  useEffect(() => {
    if (type !== 'move' || !desc.trim() || loadedTimetable?.trains?.length) return;
    const matched = matchTimetableRoute(desc.trim());
    if (matched) {
      const bestIdx = findBestTrain(matched.route.trains, time);
      setLoadedTimetable({
        _routeId: matched.routeId,
        station: matched.route.station,
        direction: matched.route.direction,
        trains: matched.route.trains.map((t, i) => ({ ...t, picked: i === bestIdx })),
      });
      setSelectedRoute(matched.routeId);
    }
  }, [type, desc, time, loadedTimetable]);

  /* ── Image handlers ── */
  const handleAddImage = useCallback(async (file) => {
    if (!tripId) return; // no trip context — skip upload
    setImageUploading(true);
    try {
      const path = generateImagePath(tripId, 'items');
      const url = await uploadImage(file, path);
      setDetailImages((prev) => {
        const next = [...prev, url];
        if (!detailMainImage) setDetailMainImage(url);
        return next;
      });
    } catch (err) {
      console.error('Image upload error:', err);
    } finally {
      setImageUploading(false);
    }
  }, [tripId, detailMainImage]);

  const handleRemoveImage = useCallback((index) => {
    setDetailImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // If we removed the main image, pick the first remaining
      if (prev[index] === detailMainImage) {
        setDetailMainImage(next[0] || '');
      }
      return next;
    });
  }, [detailMainImage]);

  const handleSetMainImage = useCallback((index) => {
    setDetailMainImage(detailImages[index] || '');
  }, [detailImages]);

  /* ── File import (bulk) state ── */
  const fileInputRef = useRef(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState(""); // real-time status from retry
  const [importPreview, setImportPreview] = useState(null);
  const [fileError, setFileError] = useState("");

  /* ── AI Recommendation (chat) state ── */
  const [chatMessages, setChatMessages] = useState([]); // {role: "user"|"ai", text: string, items?: Array}
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);

  /* 키보드 노출 시 모달을 visualViewport 전체에 맞춰 입력창·버튼이 가려지지 않게 (offset 포함) */
  const [viewportRect, setViewportRect] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setViewportRect({
        top: vv.offsetTop,
        left: vv.offsetLeft,
        width: vv.width,
        height: vv.height,
      });
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const handleSendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    const userMsg = { role: "user", text: msg };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    // Build history for API (only text, no items)
    const history = chatMessages.map((m) => ({
      role: m.role,
      text: m.role === "ai" ? (m.text || "") : m.text,
    }));

    const dayContext = currentDay?.label || "";
    const { message, items, error } = await getAIRecommendation(msg, history, dayContext, {
      onStatus: (s) => setAiStatusMsg(s),
      destinations: Array.isArray(destinations) ? destinations.map((d) => (typeof d === 'string' ? d : d?.name ?? '')).filter(Boolean) : undefined,
    });
    setChatLoading(false);
    setAiStatusMsg("");

    if (error) {
      setChatMessages((prev) => [...prev, { role: "ai", text: `오류가 발생했습니다: ${error}` }]);
      return;
    }

    setChatMessages((prev) => [...prev, { role: "ai", text: message, items }]);

    // Auto-scroll to bottom
    setTimeout(() => {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, [chatInput, chatLoading, chatMessages, currentDay, destinations]);

  const handleApplyRecommendation = useCallback((items) => {
    if (!items || items.length === 0) return;
    const conflicts = detectConflicts(items, currentDay);
    setImportPreview({ items, errors: [], conflicts });
  }, [currentDay]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setFileError("");

    try {
      const content = await readFileAsText(file);
      if (!content.trim()) {
        setFileError("파일 내용이 비어있습니다");
        return;
      }

      setAiLoading(true);
      setAiStatusMsg("AI가 문서를 분석 중입니다...");
      const { items, error } = await analyzeScheduleWithAI(content, currentDay?.label || "", {
        onStatus: (msg) => setAiStatusMsg(msg),
      });
      setAiLoading(false);
      setAiStatusMsg("");

      if (error) {
        setFileError(`AI 분석 실패: ${error}`);
        return;
      }

      if (items.length === 0) {
        setFileError("문서에서 일정을 추출할 수 없습니다. 다른 파일을 시도해주세요.");
        return;
      }

      const conflicts = detectConflicts(items, currentDay);
      setImportPreview({ items, errors: [], conflicts });
    } catch (err) {
      console.error("[FileImport] Error:", err);
      setAiLoading(false);
      setFileError("파일을 읽는 중 오류가 발생했습니다");
    }
  }, [currentDay]);

  const typeOptions = [
    { value: "food", label: "식사" },
    { value: "spot", label: "관광" },
    { value: "shop", label: "쇼핑" },
    { value: "move", label: "→ 이동" },
    { value: "flight", label: "항공" },
    { value: "stay", label: "숙소" },
    { value: "info", label: "정보" },
  ];

  const catMap = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", flight: "항공", stay: "숙소", info: "정보" };

  // Generate time options (00:00 to 23:30 in 30-min intervals)
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      timeOptions.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  const handleLoadTimetable = (routeId) => {
    if (!routeId) { setLoadedTimetable(null); return; }
    const route = TIMETABLE_DB.find((r) => r.id === routeId);
    if (!route) return;
    const bestIdx = findBestTrain(route.trains, time);
    const trains = route.trains.map((t, i) => ({ ...t, picked: i === bestIdx }));
    setLoadedTimetable({
      _routeId: routeId,
      station: route.station,
      direction: route.direction,
      trains,
    });
    setSelectedRoute(routeId);
  };

  useScrollLock();

  const handleSave = () => {
    if (!time.trim() || !desc.trim()) return;
    const hasImages = detailImages.length > 0;
    const hasDetailContent = address.trim() || detailTip.trim() || hasImages || detailPrice.trim() || detailHours.trim() || detailHighlights.trim();

    const newItem = {
      time: time.trim(),
      desc: desc.trim(),
      type,
      ...(sub.trim() ? { sub: sub.trim() } : {}),
      _custom: true,
    };

    // Build timetable + highlights
    let timetable = loadedTimetable;
    // Parse user-entered highlights (newline-separated)
    const parsedHighlights = detailHighlights.trim()
      ? detailHighlights.split("\n").map((l) => l.trim()).filter(Boolean)
      : null;
    // Route highlights override manual ones when a route is loaded
    let highlights = parsedHighlights;
    if (loadedTimetable?._routeId) {
      const route = TIMETABLE_DB.find((r) => r.id === loadedTimetable._routeId);
      if (route?.highlights) highlights = route.highlights;
    }

    // move는 시간표만 있어도 detail 생성 (저장 후 다시 열었을 때 지정 반영)
    if (hasDetailContent || timetable || (type === "move" && loadedTimetable?.trains?.length)) {
      // Determine representative image
      const mainImg = detailMainImage || detailImages[0] || '';
      newItem.detail = {
        name: desc.trim(),
        category: catMap[type] || "관광",
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(detailLat != null ? { lat: detailLat } : {}),
        ...(detailLon != null ? { lon: detailLon } : {}),
        ...(detailTip.trim() ? { tip: detailTip.trim() } : {}),
        ...(detailPrice.trim() ? { price: detailPrice.trim() } : {}),
        ...(detailHours.trim() ? { hours: detailHours.trim() } : {}),
        ...(mainImg ? { image: mainImg } : {}),
        ...(hasImages ? { images: detailImages } : {}),
        ...(timetable ? { timetable } : {}),
        ...(highlights ? { highlights } : {}),
      };
    }

    onSave(newItem, dayIdx, sectionIdx, itemIdx);
  };

  const title = aiOnly ? "AI와 대화하며 계획하기" : (isNew ? "일정 추가" : "일정 수정");

  const fullScreenModal = (
    <div style={{
      position: 'fixed',
      ...(viewportRect != null
        ? {
            top: viewportRect.top,
            left: viewportRect.left,
            width: viewportRect.width,
            height: viewportRect.height,
          }
        : { top: 0, left: 0, right: 0, bottom: 0 }),
      zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface-container-lowest)',
      overflow: 'hidden',
    }}>
      {/* 헤더 — 여백 확보, 닫기 버튼 */}
      <header style={{
        flexShrink: 0,
        paddingTop: `calc(${SPACING.lg} + env(safe-area-inset-top, 0px))`,
        paddingBottom: SPACING.xl,
        paddingLeft: SPACING.xl,
        paddingRight: SPACING.xxl,
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.lg,
        borderBottom: '1px solid var(--color-outline-variant)',
        background: 'var(--color-surface)',
      }}>
        <h2 style={{
          margin: 0,
          flex: 1,
          fontSize: 'var(--typo-body-1-n---bold-size)',
          fontWeight: 'var(--typo-body-1-n---bold-weight)',
          color: 'var(--color-on-surface)',
        }}>
          {title}
        </h2>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
      </header>

      {/* 스크롤 영역: 탭 + 본문 (PWA/iOS에서 세부 스크롤 확실히 동작) */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column',
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y',
      }}>
        {/* Tabs (only show for new items; 숨김 when aiOnly) */}
        {isNew && !aiOnly && (
          <div style={{ flexShrink: 0 }}>
            <Tab
              items={[
                { label: "직접 입력", value: 0 },
                { label: "파일 등록", value: 1 },
                { label: "AI 추천", value: 2 },
              ]}
              value={activeTab}
              onChange={setActiveTab}
              size="md"
              fullWidth
            />
          </div>
        )}

        {/* Tab content (aiOnly면 AI 패널만 표시) */}
        {(activeTab === 2 && isNew) || aiOnly ? (
          /* ── AI Recommendation chat tab ── */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Chat messages area */}
            <div ref={chatScrollRef} style={{
              flex: 1, overflowY: "auto", padding: `${SPACING.xl} ${SPACING.xxl}`,
              display: "flex", flexDirection: "column", gap: SPACING.lg,
            }}>
              {chatMessages.length === 0 && !chatLoading && (
                <div style={{ textAlign: "center", padding: `${SPACING.xxxl} ${SPACING.lg}` }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: "var(--color-primary-container)", display: "flex",
                    alignItems: "center", justifyContent: "center", margin: `0 auto ${SPACING.lg}`,
                  }}>
                    <Icon name="flash" size={24} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
                    AI 일정 추천
                  </p>
                  <p style={{ margin: `${SPACING.md} 0 ${SPACING.xl}`, fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant2)", lineHeight: 1.6 }}>
                    어디를 가고 싶은지, 뭘 먹고 싶은지<br/>자유롭게 말해주세요
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: SPACING.md }}>
                    {[
                      "오사카 도톤보리 근처에서 맛있는 거 먹고 싶어",
                      "후쿠오카에서 하루종일 놀고 싶어, 라멘은 꼭!",
                      "쿠마모토성 보고 말고기 먹을래",
                    ].map((example, i) => (
                      <button
                        key={i}
                        onClick={() => { setChatInput(example); setTimeout(() => chatInputRef.current?.focus(), 50); }}
                        style={{
                          background: "var(--color-surface-container-lowest)",
                          border: "1px solid var(--color-outline-variant)",
                          borderRadius: "var(--radius-md, 8px)",
                          padding: `${SPACING.ml} ${SPACING.lx}`, cursor: "pointer",
                          fontSize: "var(--typo-caption-1-regular-size)",
                          color: "var(--color-on-surface-variant)",
                          textAlign: "left", transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-primary-container)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "var(--color-surface-container-lowest)"}
                      >
                        "{example}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}>
                  <div style={{
                    maxWidth: "85%",
                    padding: `${SPACING.ml} ${SPACING.lx}`,
                    borderRadius: msg.role === "user"
                      ? "var(--radius-md, 8px) var(--radius-md, 8px) 2px var(--radius-md, 8px)"
                      : "var(--radius-md, 8px) var(--radius-md, 8px) var(--radius-md, 8px) 2px",
                    background: msg.role === "user"
                      ? "var(--color-primary)"
                      : "var(--color-surface-container-lowest)",
                    color: msg.role === "user"
                      ? "var(--color-on-primary)"
                      : "var(--color-on-surface)",
                    fontSize: "var(--typo-caption-1-regular-size)",
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}>
                    {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}

                    {/* AI recommendation items preview */}
                    {msg.role === "ai" && msg.items && msg.items.length > 0 && (
                      <div style={{ marginTop: msg.text ? SPACING.ml : 0 }}>
                        <div style={{
                          borderTop: msg.text ? "1px solid var(--color-outline-variant)" : "none",
                          paddingTop: msg.text ? SPACING.ml : 0,
                          display: "flex", flexDirection: "column", gap: SPACING.ms,
                        }}>
                          {msg.items.slice(0, 6).map((it, j) => (
                            <div key={j} style={{
                              display: "flex", alignItems: "center", gap: SPACING.md,
                              padding: `${SPACING.ms} ${SPACING.md}`,
                              background: "var(--color-surface-container-lowest)",
                              borderRadius: "6px",
                              fontSize: "var(--typo-caption-2-regular-size)",
                            }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-primary)", width: "36px", flexShrink: 0 }}>
                                {it.time || "--:--"}
                              </span>
                              <span style={{ flex: 1, color: "var(--color-on-surface)", fontWeight: 500 }}>
                                {it.desc}
                              </span>
                            </div>
                          ))}
                          {msg.items.length > 6 && (
                            <p style={{ margin: 0, fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)", textAlign: "center" }}>
                              외 {msg.items.length - 6}개 일정
                            </p>
                          )}
                        </div>
                        <Button
                          variant="primary" size="sm"
                          onClick={() => handleApplyRecommendation(msg.items)}
                          fullWidth
                          style={{ marginTop: SPACING.ml }}
                        >
                          이 일정 적용하기 ({msg.items.length}개)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{
                    padding: `${SPACING.lg} ${SPACING.xl}`,
                    borderRadius: "var(--radius-md, 8px) var(--radius-md, 8px) var(--radius-md, 8px) 2px",
                    background: "var(--color-surface-container-lowest)",
                    display: "flex", alignItems: "center", gap: SPACING.ms,
                  }}>
                    <div style={{ display: "flex", gap: SPACING.sm }}>
                      {[0, 1, 2].map((d) => (
                        <div key={d} style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: "var(--color-on-surface-variant2)",
                          animation: `bounce 1.2s infinite ${d * 0.2}s`,
                        }} />
                      ))}
                    </div>
                    <span style={{
                      fontSize: "var(--typo-caption-2-regular-size)",
                      color: aiStatusMsg.includes("재시도") ? COLOR.warning : "var(--color-on-surface-variant2)",
                      fontWeight: aiStatusMsg.includes("재시도") ? 600 : 400,
                    }}>
                      {aiStatusMsg || "추천 일정을 만들고 있어요..."}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input bar — 하단 세이프에리어 확보, 커서가 필드 내부에 보이도록 */}
            <div style={{
              padding: `${SPACING.lg} ${SPACING.xl}`,
              paddingBottom: `calc(${SPACING.lg} + env(safe-area-inset-bottom, 0px))`,
              flexShrink: 0,
              borderTop: "1px solid var(--color-outline-variant)",
              display: "flex", gap: SPACING.md, alignItems: "flex-end",
              background: "var(--color-surface-container-lowest)",
            }}>
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onFocus={() => {
                  /* 키보드 올라온 뒤 입력창이 보이도록 스크롤, 커서가 필드·세이프에리어 안에 보이게 */
                  setTimeout(() => {
                    chatInputRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
                  }, 400);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="어디를 가고 싶나요?"
                rows={1}
                style={{
                  flex: 1, minWidth: 0, resize: "none",
                  padding: `${SPACING.ml} ${SPACING.lx}`,
                  boxSizing: "border-box",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-outline-variant)",
                  background: "var(--color-surface-container-lowest)",
                  fontSize: "var(--typo-caption-1-regular-size)",
                  lineHeight: 1.4,
                  color: "var(--color-on-surface)",
                  outline: "none", fontFamily: "inherit",
                  maxHeight: "80px",
                }}
              />
              <Button
                variant="primary" size="md"
                iconOnly="navigation"
                onClick={handleSendChat}
                disabled={!chatInput.trim() || chatLoading}
                style={{ width: "40px", height: "40px", borderRadius: "var(--radius-md, 8px)", flexShrink: 0 }}
              />
            </div>

            {/* Bounce animation for loading dots */}
            <style>{`
              @keyframes bounce {
                0%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-6px); }
              }
            `}</style>
          </div>
        ) : activeTab === 1 && isNew ? (
          /* ── File import tab ── */
          <div style={{ flex: 1, overflowY: "auto", padding: SPACING.xxl, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: SPACING.xl }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text,text/plain,text/markdown"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />

            {aiLoading ? (
              <div style={{ textAlign: "center", padding: `40px ${SPACING.xxl}` }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "50%",
                  background: "var(--color-primary-container)", display: "flex",
                  alignItems: "center", justifyContent: "center", margin: `0 auto ${SPACING.xl}`,
                  animation: "pulse 1.5s infinite",
                }}>
                  <Icon name="flash" size={24} style={{ color: "var(--color-primary)" }} />
                </div>
                <p style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
                  {aiStatusMsg.includes("재시도") ? "잠시만 기다려주세요" : "AI가 문서를 분석 중입니다"}
                </p>
                <p style={{
                  margin: `${SPACING.md} 0 0`,
                  fontSize: "var(--typo-caption-1-regular-size)",
                  color: aiStatusMsg.includes("재시도") ? COLOR.warning : "var(--color-on-surface-variant2)",
                  fontWeight: aiStatusMsg.includes("재시도") ? 600 : 400,
                }}>
                  {aiStatusMsg || "일정 항목을 자동으로 추출하고 있습니다..."}
                </p>
                <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
              </div>
            ) : (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%", padding: `40px ${SPACING.xxl}`,
                    border: "2px dashed var(--color-outline-variant)",
                    borderRadius: "var(--radius-md, 8px)",
                    background: "var(--color-surface-container-lowest)",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.background = "var(--color-primary-container)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; e.currentTarget.style.background = "var(--color-surface-container-lowest)"; }}
                >
                  <Icon name="file" size={32} style={{ color: "var(--color-on-surface-variant2)", marginBottom: SPACING.lg }} />
                  <p style={{ margin: 0, fontSize: "var(--typo-label-2-bold-size)", fontWeight: "var(--typo-label-2-bold-weight)", color: "var(--color-on-surface)", textAlign: "center" }}>
                    텍스트 파일 선택
                  </p>
                  <p style={{ margin: `${SPACING.ms} 0 0`, fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)", textAlign: "center" }}>
                    .txt, .md 파일을 업로드하면<br/>AI가 자동으로 일정을 분석합니다
                  </p>
                </div>

                {/* Error message */}
                {fileError && (
                  <div style={{
                    width: "100%", padding: `${SPACING.ml} ${SPACING.lx}`,
                    background: "var(--color-error-container, #FEE2E2)",
                    borderRadius: "var(--radius-md, 8px)",
                    display: "flex", alignItems: "center", gap: SPACING.ml,
                  }}>
                    <Icon name="info" size={16} style={{ color: "var(--color-error)", flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-error)", lineHeight: 1.5 }}>
                      {fileError}
                    </p>
                  </div>
                )}

                <div style={{
                  width: "100%", padding: `${SPACING.ml} ${SPACING.lx}`,
                  background: "var(--color-surface-container-lowest)",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-outline-variant)",
                  display: "flex", alignItems: "center", gap: SPACING.ml,
                }}>
                  <Icon name="flash" size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: 1.5 }}>
                    여행 가이드, 일정표, 메모 등 어떤 형식이든 AI가 분석하여 일정을 자동 생성합니다
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
        /* ── Single item form tab ──
         * 순서: 일정명 → 유형·시간 → 주소 → 부가정보 → 메모 → 포인트 → (수정 시만 영업시간·가격) → 이미지 → 시간표
         * 하단 고정 버튼에 가리지 않도록 paddingBottom 여유
         */
        <div style={{ padding: `${SPACING.xl} ${SPACING.xxl} calc(${SPACING.xxxl} + 80px)`, display: "flex", flexDirection: "column", gap: SPACING.lg }}>
          {/* 일정명 */}
          <Field label="일정명" required size="lg" variant="outlined"
            value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="예: 캐널시티 라멘스타디움" />

          {/* 유형 + 시간 row */}
          <div style={{ display: "flex", gap: SPACING.ml, alignItems: "flex-end" }}>
            <Field as="select" label="유형" size="lg" variant="outlined"
              value={type} onChange={(e) => setType(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Field>
            <Field as="select" label="시간" required size="lg" variant="outlined"
              value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
              <option value="">시간 선택</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Field>
          </div>

          {/* 주소 — 선택 시 장소 사진이 있으면 이미지 목록에 추가(수정·삭제 가능) */}
          <AddressSearch
            label="주소"
            value={address}
            onChange={(addr, lat, lon, photoUrl) => {
              setAddress(addr);
              setDetailLat(lat ?? null);
              setDetailLon(lon ?? null);
              if (photoUrl) {
                setDetailImages((prev) => {
                  if (prev.includes(photoUrl)) return prev;
                  return [photoUrl, ...prev.filter(Boolean)].slice(0, 5);
                });
                setDetailMainImage(photoUrl);
              }
            }}
            placeholder="주소 또는 장소 검색"
            size="lg"
          />

          {/* 부가정보 */}
          <Field label="부가정보" size="lg" variant="outlined"
            value={sub} onChange={(e) => setSub(e.target.value)} placeholder="예: 도보 5분 · 1,000엔" />

          {/* 메모 */}
          <Field as="textarea" label="메모" size="lg" variant="outlined"
            value={detailTip} onChange={(e) => setDetailTip(e.target.value)} placeholder="참고사항 입력" rows={2} />

          {/* 포인트 */}
          <Field as="textarea" label="포인트 (줄바꿈으로 구분)" size="lg" variant="outlined"
            value={detailHighlights} onChange={(e) => setDetailHighlights(e.target.value)}
            placeholder={"추천 메뉴, 꿀팁 등 핵심 포인트\n예: 후쿠오카 돈코츠 라멘 추천\n예: 면세 카운터 있음 (여권 필수)"} rows={3} />

          {/* 영업시간·가격 — 수정 시에만 표시 (생성 시에는 없음) */}
          {!isNew && (
            <div style={{ display: "flex", gap: SPACING.ml, alignItems: "flex-end" }}>
              <Field label="영업시간" size="lg" variant="outlined"
                value={detailHours} onChange={(e) => setDetailHours(e.target.value)} placeholder="11:00~23:00" style={{ flex: 1, minWidth: 0 }} />
              <Field label="가격" size="lg" variant="outlined"
                value={detailPrice} onChange={(e) => setDetailPrice(e.target.value)} placeholder="~1,000엔" style={{ flex: 1, minWidth: 0 }} />
            </div>
          )}

          {/* Images: 라벨 높이 Field와 통일. 불러온 이미지도 수정/삭제 가능 */}
          {tripId ? (
            <div>
              <div style={{ paddingBottom: 'var(--spacing-sp40, 4px)', minHeight: 'var(--field-label-row-height, 20px)', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)' }}>
                  이미지 ({detailImages.length}/5)
                </span>
              </div>
              <MultiImagePicker
                images={detailImages}
                mainImage={detailMainImage}
                onAdd={handleAddImage}
                onRemove={handleRemoveImage}
                onSetMain={handleSetMainImage}
                uploading={imageUploading}
                maxImages={5}
              />
            </div>
          ) : (
            <Field label="이미지 경로" size="lg" variant="outlined"
              value={detailImages[0] || ''} onChange={(e) => { setDetailImages(e.target.value ? [e.target.value] : []); setDetailMainImage(e.target.value || ''); }}
              placeholder="/images/filename.jpg" />
          )}

          {/* Timetable: move 전용 — Field와 동일한 단일 필드 스타일, 탭 시 자동매칭 또는 검색 모달 */}
          {type === "move" && (
            <>
              <div style={{ paddingBottom: "var(--spacing-sp40, 4px)", minHeight: "var(--field-label-row-height, 20px)", display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)", color: "var(--color-on-surface-variant)" }}>시간표</span>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowTimetableSearch(true)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowTimetableSearch(true); } }}
                style={{
                  display: "flex", alignItems: "center", gap: SPACING.md,
                  width: "100%", height: "var(--height-lg, 36px)", padding: "0 var(--spacing-sp140, 14px)",
                  border: "1px solid var(--color-outline-variant)", borderRadius: "var(--radius-md, 8px)",
                  background: "var(--color-surface-container-lowest)", cursor: "pointer",
                  transition: "border-color var(--transition-fast)", boxSizing: "border-box",
                }}
              >
                <Icon name="navigation" size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
                <span style={{
                  flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontSize: "var(--typo-label-1-n---regular-size)", fontWeight: "var(--typo-label-1-n---regular-weight)",
                  color: loadedTimetable?.trains?.length ? "var(--color-on-surface)" : "var(--color-on-surface-variant2)",
                }}>
                  {loadedTimetable?.trains?.length
                    ? (TIMETABLE_DB.find((r) => r.id === loadedTimetable._routeId)?.label || "노선 선택됨")
                    : "노선·역명 검색 (예: 하카타, 오사카)"}
                </span>
                <Icon name="chevronRight" size={14} style={{ flexShrink: 0, opacity: 0.3 }} />
              </div>
              {loadedTimetable?.trains?.length > 0 && (
                <div style={{ marginTop: SPACING.md }}>
                  <TimetablePreview timetable={loadedTimetable} variant="compact" />
                </div>
              )}

              {showTimetableSearch && (
                <TimetableSearchDialog
                  onClose={() => setShowTimetableSearch(false)}
                  onSelect={(routeId) => { handleLoadTimetable(routeId); setShowTimetableSearch(false); }}
                />
              )}
            </>
          )}
        </div>
        )}
      </div>

      {/* 하단 고정: 삭제 + 저장 (직접입력 탭 또는 수정 모드) */}
      {(activeTab === 0 || !isNew) && (
        <div style={{
          flexShrink: 0,
          padding: `${SPACING.xl} ${SPACING.xxl} calc(${SPACING.xl} + env(safe-area-inset-bottom, 0px))`,
          display: "flex",
          gap: SPACING.md,
          borderTop: "1px solid var(--color-outline-variant)",
          background: "var(--color-surface)",
        }}>
          {!isNew && onDelete && (
            <Button variant="ghost-danger" size="lg" iconLeft="trash" onClick={() => onDelete(dayIdx, sectionIdx, itemIdx, item)}>
              삭제
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={handleSave} fullWidth
            disabled={!(time.trim() && desc.trim())}
            style={{ flex: 1 }}>
            {isNew ? "추가" : "저장"}
          </Button>
        </div>
      )}

      {/* Import Preview Dialog (from file tab) */}
      {importPreview && (
        <ImportPreviewDialog
          items={importPreview.items}
          errors={importPreview.errors}
          conflicts={importPreview.conflicts}
          dayLabel={currentDay?.label || `Day`}
          existingCount={currentDay?.sections?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0}
          onReplace={() => {
            onBulkImport?.(importPreview.items, "replace");
            setImportPreview(null);
            onClose();
          }}
          onAppend={() => {
            onBulkImport?.(importPreview.items, "append");
            setImportPreview(null);
            onClose();
          }}
          onCancel={() => setImportPreview(null)}
        />
      )}
    </div>
  );

  return createPortal(fullScreenModal, document.body);
}
