import { useState, useCallback, useRef } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Field from '../common/Field';
import Tab from '../common/Tab';
import AddressSearch from '../common/AddressSearch';
import BottomSheet from '../common/BottomSheet';
import { MultiImagePicker } from '../common/ImagePicker';
import { uploadImage, generateImagePath } from '../../services/imageService';
import { TIMETABLE_DB, findBestTrain } from '../../data/timetable';
import { readFileAsText, detectConflicts } from '../../utils/scheduleParser';
import { analyzeScheduleWithAI, getAIRecommendation } from '../../services/geminiService';
import ImportPreviewDialog from './ImportPreviewDialog';

/* ── Edit Item Dialog (일정 추가/수정) ── */
export default function EditItemDialog({ item, sectionIdx, itemIdx, dayIdx, onSave, onDelete, onClose, color, tripId, currentDay, onBulkImport, initialTab = 0 }) {
  const isNew = !item;
  const [activeTab, setActiveTab] = useState(isNew ? initialTab : 0);
  const [time, setTime] = useState(item?.time || "");
  const [desc, setDesc] = useState(item?.desc || "");
  const [type, setType] = useState(item?.type || "spot");
  const [sub, setSub] = useState(item?.sub || "");
  const [address, setAddress] = useState(item?.detail?.address || "");
  const [detailName, setDetailName] = useState(item?.detail?.name || "");
  const [detailTip, setDetailTip] = useState(item?.detail?.tip || "");
  const [detailPrice, setDetailPrice] = useState(item?.detail?.price || "");
  const [detailHours, setDetailHours] = useState(item?.detail?.hours || "");
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
  const [loadedTimetable, setLoadedTimetable] = useState(item?.detail?.timetable || null);

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
  const [importPreview, setImportPreview] = useState(null);

  /* ── AI Recommendation (chat) state ── */
  const [chatMessages, setChatMessages] = useState([]); // {role: "user"|"ai", text: string, items?: Array}
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);

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
    const { message, items, error } = await getAIRecommendation(msg, history, dayContext);
    setChatLoading(false);

    if (error) {
      setChatMessages((prev) => [...prev, { role: "ai", text: `오류가 발생했습니다: ${error}` }]);
      return;
    }

    setChatMessages((prev) => [...prev, { role: "ai", text: message, items }]);

    // Auto-scroll to bottom
    setTimeout(() => {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, [chatInput, chatLoading, chatMessages, currentDay]);

  const handleApplyRecommendation = useCallback((items) => {
    if (!items || items.length === 0) return;
    const conflicts = detectConflicts(items, currentDay);
    setImportPreview({ items, errors: [], conflicts });
  }, [currentDay]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const content = await readFileAsText(file);
      if (!content.trim()) return;

      setAiLoading(true);
      const { items, error } = await analyzeScheduleWithAI(content, currentDay?.label || "");
      setAiLoading(false);

      if (error || items.length === 0) return;

      const conflicts = detectConflicts(items, currentDay);
      setImportPreview({ items, errors: [], conflicts });
    } catch {
      setAiLoading(false);
    }
  }, [currentDay]);

  const typeOptions = [
    { value: "food", label: "식사" },
    { value: "spot", label: "관광" },
    { value: "shop", label: "쇼핑" },
    { value: "move", label: "→ 이동" },
    { value: "stay", label: "숙소" },
    { value: "info", label: "정보" },
  ];

  const catMap = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", stay: "숙소", info: "교통" };

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

  const handleSave = () => {
    if (!time.trim() || !desc.trim()) return;
    const hasImages = detailImages.length > 0;
    const hasDetailContent = detailName.trim() || address.trim() || detailTip.trim() || hasImages || detailPrice.trim() || detailHours.trim();

    const newItem = {
      time: time.trim(),
      desc: desc.trim(),
      type,
      ...(sub.trim() ? { sub: sub.trim() } : {}),
      _custom: true,
    };

    // Build timetable + highlights from loaded route
    let timetable = loadedTimetable;
    let highlights = item?.detail?.highlights || null;
    if (loadedTimetable?._routeId) {
      const route = TIMETABLE_DB.find((r) => r.id === loadedTimetable._routeId);
      if (route) highlights = route.highlights;
    }

    if (hasDetailContent || timetable) {
      // Determine representative image
      const mainImg = detailMainImage || detailImages[0] || '';
      newItem.detail = {
        name: detailName.trim() || desc.trim(),
        category: catMap[type] || "관광",
        ...(address.trim() ? { address: address.trim() } : {}),
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

  return (
    <BottomSheet
      onClose={onClose}
      maxHeight="85vh"
    >
        {/* Header */}
        <div style={{
          padding: "6px 16px 12px 20px", flexShrink: 0,
          borderBottom: "1px solid var(--color-outline-variant)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
            {isNew ? "일정 추가" : "일정 수정"}
          </h3>
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
        </div>

        {/* Tabs (only show for new items) */}
        {isNew && (
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

        {/* Tab content */}
        {activeTab === 2 && isNew ? (
          /* ── AI Recommendation chat tab ── */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Chat messages area */}
            <div ref={chatScrollRef} style={{
              flex: 1, overflowY: "auto", padding: "16px 20px",
              display: "flex", flexDirection: "column", gap: "12px",
            }}>
              {chatMessages.length === 0 && !chatLoading && (
                <div style={{ textAlign: "center", padding: "24px 12px" }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: "var(--color-primary-container)", display: "flex",
                    alignItems: "center", justifyContent: "center", margin: "0 auto 12px",
                  }}>
                    <Icon name="flash" size={24} style={{ color: "var(--color-primary)" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
                    AI 일정 추천
                  </p>
                  <p style={{ margin: "8px 0 16px", fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant2)", lineHeight: 1.6 }}>
                    어디를 가고 싶은지, 뭘 먹고 싶은지<br/>자유롭게 말해주세요
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      "오사카 도톤보리 근처에서 맛있는 거 먹고 싶어",
                      "후쿠오카에서 하루종일 놀고 싶어, 라멘은 꼭!",
                      "쿠마모토성 보고 말고기 먹을래",
                    ].map((example, i) => (
                      <button
                        key={i}
                        onClick={() => { setChatInput(example); setTimeout(() => chatInputRef.current?.focus(), 50); }}
                        style={{
                          background: "var(--color-surface-container-low)",
                          border: "1px solid var(--color-outline-variant)",
                          borderRadius: "var(--radius-md, 8px)",
                          padding: "10px 14px", cursor: "pointer",
                          fontSize: "var(--typo-caption-1-regular-size)",
                          color: "var(--color-on-surface-variant)",
                          textAlign: "left", transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-primary-container)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "var(--color-surface-container-low)"}
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
                    padding: "10px 14px",
                    borderRadius: msg.role === "user"
                      ? "var(--radius-md, 8px) var(--radius-md, 8px) 2px var(--radius-md, 8px)"
                      : "var(--radius-md, 8px) var(--radius-md, 8px) var(--radius-md, 8px) 2px",
                    background: msg.role === "user"
                      ? "var(--color-primary)"
                      : "var(--color-surface-container-low)",
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
                      <div style={{ marginTop: msg.text ? "10px" : 0 }}>
                        <div style={{
                          borderTop: msg.text ? "1px solid var(--color-outline-variant)" : "none",
                          paddingTop: msg.text ? "10px" : 0,
                          display: "flex", flexDirection: "column", gap: "6px",
                        }}>
                          {msg.items.slice(0, 6).map((it, j) => (
                            <div key={j} style={{
                              display: "flex", alignItems: "center", gap: "8px",
                              padding: "6px 8px",
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
                          style={{ marginTop: "10px" }}
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
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md, 8px) var(--radius-md, 8px) var(--radius-md, 8px) 2px",
                    background: "var(--color-surface-container-low)",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {[0, 1, 2].map((d) => (
                        <div key={d} style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: "var(--color-on-surface-variant2)",
                          animation: `bounce 1.2s infinite ${d * 0.2}s`,
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)" }}>
                      추천 일정을 만들고 있어요...
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input bar */}
            <div style={{
              padding: "12px 16px", flexShrink: 0,
              borderTop: "1px solid var(--color-outline-variant)",
              display: "flex", gap: "8px", alignItems: "flex-end",
              background: "var(--color-surface-container-lowest)",
            }}>
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="어디를 가고 싶나요?"
                rows={1}
                style={{
                  flex: 1, resize: "none",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-outline-variant)",
                  background: "var(--color-surface-container-low)",
                  fontSize: "var(--typo-caption-1-regular-size)",
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
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text,text/plain,text/markdown"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />

            {aiLoading ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "50%",
                  background: "var(--color-primary-container)", display: "flex",
                  alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
                  animation: "pulse 1.5s infinite",
                }}>
                  <Icon name="flash" size={24} style={{ color: "var(--color-primary)" }} />
                </div>
                <p style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
                  AI가 문서를 분석 중입니다
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant2)" }}>
                  일정 항목을 자동으로 추출하고 있습니다...
                </p>
              </div>
            ) : (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%", padding: "40px 20px",
                    border: "2px dashed var(--color-outline-variant)",
                    borderRadius: "var(--radius-md, 8px)",
                    background: "var(--color-surface-container-low)",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.background = "var(--color-primary-container)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-outline-variant)"; e.currentTarget.style.background = "var(--color-surface-container-low)"; }}
                >
                  <Icon name="file" size={32} style={{ color: "var(--color-on-surface-variant2)", marginBottom: "12px" }} />
                  <p style={{ margin: 0, fontSize: "var(--typo-label-2-bold-size)", fontWeight: "var(--typo-label-2-bold-weight)", color: "var(--color-on-surface)", textAlign: "center" }}>
                    텍스트 파일 선택
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)", textAlign: "center" }}>
                    .txt, .md 파일을 업로드하면<br/>AI가 자동으로 일정을 분석합니다
                  </p>
                </div>

                <div style={{
                  width: "100%", padding: "10px 14px",
                  background: "var(--color-surface-container-low)",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-outline-variant)",
                  display: "flex", alignItems: "center", gap: "10px",
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
        /* ── Single item form tab ── */
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Time + Type row */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Field as="select" label="시간" required size="lg" variant="outlined"
              value={time} onChange={(e) => setTime(e.target.value)} style={{ flex: 1 }}>
              <option value="">시간 선택</option>
              {timeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Field>
            <Field as="select" label="유형" size="lg" variant="outlined"
              value={type} onChange={(e) => setType(e.target.value)} style={{ flex: 1 }}>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Field>
          </div>

          {/* Desc */}
          <Field label="일정명" required size="lg" variant="outlined"
            value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="예: 캐널시티 라멘스타디움" />

          {/* Sub */}
          <Field label="부가 정보" size="lg" variant="outlined"
            value={sub} onChange={(e) => setSub(e.target.value)} placeholder="예: 도보 5분 · 1,000엔" />

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "10px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "var(--typo-caption-1-bold-size)", fontWeight: "var(--typo-caption-1-bold-weight)", color: "var(--color-on-surface-variant)" }}>상세 정보</p>
          </div>

          {/* Detail name */}
          <Field label="장소명 (상세)" size="lg" variant="outlined"
            value={detailName} onChange={(e) => setDetailName(e.target.value)} placeholder="미입력 시 일정명 사용" />

          {/* Address */}
          <AddressSearch
            label="주소"
            value={address}
            onChange={(addr) => setAddress(addr)}
            placeholder="주소 또는 장소 검색"
            size="lg"
          />

          {/* Hours + Price */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Field label="영업시간" size="lg" variant="outlined"
              value={detailHours} onChange={(e) => setDetailHours(e.target.value)} placeholder="11:00~23:00" style={{ flex: 1 }} />
            <Field label="가격" size="lg" variant="outlined"
              value={detailPrice} onChange={(e) => setDetailPrice(e.target.value)} placeholder="~1,000엔" style={{ flex: 1 }} />
          </div>

          {/* Tip */}
          <Field as="textarea" label="팁 / 메모" size="lg" variant="outlined"
            value={detailTip} onChange={(e) => setDetailTip(e.target.value)} placeholder="참고사항 입력" rows={2} />

          {/* Images */}
          {tripId ? (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)', color: 'var(--color-on-surface-variant)' }}>
                이미지 ({detailImages.length}/5)
              </p>
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

          {/* Timetable loader - only for move type */}
          {type === "move" && (
            <>
              <div style={{ borderTop: "1px solid var(--color-outline-variant)", paddingTop: "10px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "var(--typo-caption-1-bold-size)", fontWeight: "var(--typo-caption-1-bold-weight)", color: "var(--color-on-surface-variant)", display: "flex", alignItems: "center", gap: "4px" }}><Icon name="car" size={14} />시간표 불러오기</p>
              </div>
              <Field as="select" label="노선 선택" size="lg" variant="outlined"
                value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
                <option value="">시간표 없음</option>
                {TIMETABLE_DB.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </Field>
              <Button variant={selectedRoute ? "primary" : "neutral"} size="md" iconLeft="sync"
                onClick={() => handleLoadTimetable(selectedRoute)}
                disabled={!selectedRoute}
                fullWidth
                style={{ padding: "10px", height: "auto" }}>
                {loadedTimetable ? "시간표 다시 불러오기" : "시간표 불러오기"}
                {time.trim() ? ` (${time.trim()} 기준)` : ""}
              </Button>

              {/* Preview loaded timetable */}
              {loadedTimetable && loadedTimetable.trains && (
                <div style={{
                  background: "var(--color-surface-container-low)", borderRadius: "var(--radius-md, 8px)", border: "1px solid var(--color-outline-variant)",
                  padding: "10px 12px", fontSize: "var(--typo-caption-2-regular-size)",
                }}>
                  <p style={{ margin: "0 0 6px", fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)", color: "var(--color-on-surface-variant)" }}>
                    {loadedTimetable.station} → {loadedTimetable.direction}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {loadedTimetable.trains.map((t, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "4px 6px", borderRadius: "var(--radius-md, 8px)",
                        background: t.picked ? "var(--color-warning-container)" : "transparent",
                        fontWeight: t.picked ? 700 : 400,
                      }}>
                        <span style={{ width: "38px", flexShrink: 0, color: t.picked ? "var(--color-warning)" : "var(--color-on-surface-variant)" }}>{t.time}</span>
                        <span style={{ flex: 1, color: t.picked ? "var(--color-on-surface)" : "var(--color-on-surface-variant)" }}>{t.name}</span>
                        {t.picked && <span style={{
                          fontSize: "var(--typo-caption-3-bold-size)", background: "var(--color-warning-container)", color: "var(--color-on-warning-container)",
                          padding: "1px 5px", borderRadius: "4px", fontWeight: "var(--typo-caption-3-bold-weight)",
                        }}>탑승 예정</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        )}

        {/* Actions (only for single item tab or edit mode) */}
        {(activeTab === 0 || !isNew) && (
          <div style={{ padding: "0 20px 16px", display: "flex", gap: "8px", flexShrink: 0 }}>
            {!isNew && onDelete && (
              <Button variant="ghost-neutral" size="lg" onClick={() => onDelete(dayIdx, sectionIdx, itemIdx, item)}>
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
    </BottomSheet>
  );
}
