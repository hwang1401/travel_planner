import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePresence } from "../hooks/usePresence";

/* Data imports */
import { BASE_DAYS } from "../data/days";
import { loadCustomData, mergeData, generateDaySummary } from "../data/storage";
import { TYPE_CONFIG } from "../data/guides";

/* Service imports */
import { getTrip, getShareCode, formatDateRange, getTripDuration } from "../services/tripService";
import { loadSchedule, subscribeToSchedule, createDebouncedSave } from "../services/scheduleService";
import { getMyRole, getShareLink } from "../services/memberService";

/* Common component imports */
import Icon from "./common/Icon";
import Button from "./common/Button";
import BottomSheet from "./common/BottomSheet";
import Field from "./common/Field";
import Tab from "./common/Tab";
import ConfirmDialog from "./common/ConfirmDialog";
import Toast from "./common/Toast";

/* Dialog imports */
import DetailDialog from "./dialogs/DetailDialog";
import DocumentDialog from "./dialogs/DocumentDialog";
import ShoppingGuideDialog from "./dialogs/ShoppingGuideDialog";
import DayInfoDialog from "./dialogs/DayInfoDialog";
import EditItemDialog from "./dialogs/EditItemDialog";
import AddDayDialog from "./dialogs/AddDayDialog";

/* Map imports */
import FullMapDialog from "./map/FullMapDialog";
import MapButton from "./map/MapButton";

export default function TravelPlanner() {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const { user } = useAuth();

  /* ── Mode detection ── */
  const isLegacy = !tripId || tripId === "legacy";

  /* ── Trip metadata (Supabase trips only) ── */
  const [tripMeta, setTripMeta] = useState(null);
  const [myRole, setMyRole] = useState(isLegacy ? "owner" : null);
  const [tripLoading, setTripLoading] = useState(!isLegacy);

  /* ── Schedule data ── */
  const [customData, setCustomData] = useState(() => isLegacy ? loadCustomData() : {});
  const [scheduleLoading, setScheduleLoading] = useState(!isLegacy);

  /* ── UI state ── */
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeDetail, setActiveDetail] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dayInfoTab, setDayInfoTab] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [editingDayIdx, setEditingDayIdx] = useState(null);
  const [editDayLabel, setEditDayLabel] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [toast, setToast] = useState(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareCode, setShareCode] = useState(null);
  const [showReorder, setShowReorder] = useState(false);
  const [reorderList, setReorderList] = useState([]);

  /* ── Debounced save ref ── */
  const debouncedSaveRef = useRef(null);
  const skipNextRealtimeRef = useRef(false);

  /* ── Presence: who is online ── */
  const presenceUser = useMemo(() => {
    if (isLegacy || !user) return null;
    return {
      id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    };
  }, [isLegacy, user]);
  const { onlineUsers } = usePresence(isLegacy ? null : tripId, presenceUser);

  /* ── Permissions ── */
  const canEdit = myRole === "owner" || myRole === "editor";

  /* ── Load trip metadata + schedule from Supabase ── */
  useEffect(() => {
    if (isLegacy) return;

    let cancelled = false;

    async function load() {
      try {
        const [trip, role, schedule, code] = await Promise.all([
          getTrip(tripId),
          getMyRole(tripId),
          loadSchedule(tripId),
          getShareCode(tripId),
        ]);

        if (cancelled) return;

        setTripMeta(trip);
        setMyRole(role);
        setShareCode(code);
        setCustomData(schedule.data || {});
        setTripLoading(false);
        setScheduleLoading(false);
      } catch (err) {
        console.error("[TravelPlanner] Load error:", err);
        if (!cancelled) {
          setTripLoading(false);
          setScheduleLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tripId, isLegacy]);

  /* ── Setup debounced save for Supabase trips ── */
  useEffect(() => {
    if (isLegacy || !tripId) return;
    const ds = createDebouncedSave(tripId, 800);
    debouncedSaveRef.current = ds;
    return () => { ds.cancel(); };
  }, [tripId, isLegacy]);

  /* ── Realtime subscription for Supabase trips ── */
  useEffect(() => {
    if (isLegacy || !tripId) return;

    const unsubscribe = subscribeToSchedule(tripId, (payload) => {
      // Skip if this was our own save
      if (skipNextRealtimeRef.current) {
        skipNextRealtimeRef.current = false;
        return;
      }
      // Only update if someone else changed it
      if (payload.updatedBy !== user?.id) {
        setCustomData(payload.data || {});
      }
    });

    return unsubscribe;
  }, [tripId, isLegacy, user?.id]);

  /* ── Persist schedule data ── */
  const persistSchedule = useCallback((newData) => {
    if (isLegacy) {
      localStorage.setItem("travel_custom_data", JSON.stringify(newData));
    } else if (debouncedSaveRef.current) {
      skipNextRealtimeRef.current = true;
      debouncedSaveRef.current.save(newData);
    }
  }, [isLegacy]);

  /* ── Save-aware setCustomData ── */
  const updateCustomData = useCallback((updater) => {
    setCustomData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistSchedule(next);
      return next;
    });
  }, [persistSchedule]);

  /* ── Legacy: persist on change (backward compat) ── */
  useEffect(() => {
    if (isLegacy) {
      localStorage.setItem("travel_custom_data", JSON.stringify(customData));
    }
  }, [customData, isLegacy]);

  /* ── Merge data ── */
  const DAYS = useMemo(() => {
    if (isLegacy) {
      return mergeData(BASE_DAYS, customData);
    }
    // Supabase trips: customData IS the full schedule
    // For now, still use BASE_DAYS for legacy and empty for new trips
    if (customData._extraDays || Object.keys(customData).some((k) => !k.startsWith("_"))) {
      return mergeData(BASE_DAYS, customData);
    }
    return mergeData(BASE_DAYS, customData);
  }, [customData, isLegacy]);

  const current = DAYS[selectedDay];

  /* Map display index → original (pre-reorder) index for customData access */
  const dayIndexMap = useMemo(() => {
    const totalDays = [...BASE_DAYS, ...(customData._extraDays || [])].length;
    if (customData._dayOrder && customData._dayOrder.length === totalDays) {
      return customData._dayOrder;
    }
    return Array.from({ length: totalDays }, (_, i) => i);
  }, [customData._dayOrder, customData._extraDays]);

  const toOrigIdx = useCallback((displayIdx) => {
    return dayIndexMap[displayIdx] !== undefined ? dayIndexMap[displayIdx] : displayIdx;
  }, [dayIndexMap]);

  /* ── Trip display info ── */
  const tripName = useMemo(() => {
    if (isLegacy) return "후쿠오카 · 구마모토 · 유후인";
    return tripMeta?.name || "여행 일정";
  }, [isLegacy, tripMeta]);

  const tripSubtitle = useMemo(() => {
    if (isLegacy) return "2026.02.19 — 02.24 · 5박 6일";
    if (!tripMeta) return "";
    return formatDateRange(tripMeta);
  }, [isLegacy, tripMeta]);

  /* ── Handlers ── */
  const handleAddDay = useCallback((label, icon, dayNum, overwrite = false) => {
    updateCustomData((prev) => {
      const next = { ...prev };
      const existingExtra = next._extraDays || [];
      const newDay = {
        day: dayNum,
        date: `Day ${dayNum}`,
        label: label,
        color: "var(--color-primary)",
        icon: icon || "pin",
        stay: "",
        booked: false,
        sections: [{ title: "종일", items: [] }],
        notes: "",
        _custom: true,
      };
      if (overwrite) {
        const idx = existingExtra.findIndex((d) => d.day === dayNum);
        if (idx >= 0) {
          next._extraDays = [...existingExtra];
          next._extraDays[idx] = newDay;
        } else {
          next._extraDays = [...existingExtra, newDay];
        }
      } else {
        next._extraDays = [...existingExtra, newDay];
      }
      // Clear day order — indices are now stale
      delete next._dayOrder;
      return { ...next };
    });
    setShowAddDay(false);
    setToast({ message: overwrite ? `Day ${dayNum} 덮어쓰기 완료` : `Day ${dayNum} 추가 완료`, icon: "check" });
    setTimeout(() => {
      const extraDays = customData._extraDays || [];
      if (overwrite) {
        const idx = extraDays.findIndex((d) => d.day === dayNum);
        if (idx >= 0) setSelectedDay(BASE_DAYS.length + idx);
      } else {
        setSelectedDay(BASE_DAYS.length + extraDays.length);
      }
    }, 50);
  }, [customData, updateCustomData]);

  const handleEditDayLabel = useCallback((dayIdx, newLabel) => {
    updateCustomData((prev) => {
      const next = { ...prev };
      if (dayIdx < BASE_DAYS.length) {
        if (!next._dayOverrides) next._dayOverrides = {};
        next._dayOverrides[dayIdx] = { ...(next._dayOverrides[dayIdx] || {}), label: newLabel };
      } else {
        const extraIdx = dayIdx - BASE_DAYS.length;
        if (next._extraDays && next._extraDays[extraIdx]) {
          next._extraDays = [...next._extraDays];
          next._extraDays[extraIdx] = { ...next._extraDays[extraIdx], label: newLabel };
        }
      }
      return { ...next };
    });
    setEditingDayIdx(null);
    setToast({ message: "날짜 이름이 변경되었습니다", icon: "edit" });
  }, [updateCustomData]);

  const handleDeleteDay = useCallback((dayIdx) => {
    if (dayIdx < BASE_DAYS.length) return;
    setConfirmDialog({
      title: "날짜 삭제",
      message: "이 날짜와 포함된 모든 일정이 삭제됩니다.\n정말 삭제하시겠습니까?",
      confirmLabel: "삭제",
      onConfirm: () => {
        updateCustomData((prev) => {
          const next = { ...prev };
          const extraIdx = dayIdx - BASE_DAYS.length;
          if (next._extraDays) {
            next._extraDays = next._extraDays.filter((_, i) => i !== extraIdx);
            next._extraDays = next._extraDays.map((d, i) => ({
              ...d, day: BASE_DAYS.length + i + 1,
            }));
          }
          // Clear day order — indices are now stale
          delete next._dayOrder;
          return { ...next };
        });
        setSelectedDay((prev) => Math.max(0, prev - 1));
        setConfirmDialog(null);
        setToast({ message: "날짜가 삭제되었습니다", icon: "trash" });
      },
    });
  }, [updateCustomData]);

  /* ── Day Reorder ── */
  const handleOpenReorder = useCallback(() => {
    // Each item tracks its original pre-reorder index in the merged array
    const currentOrder = customData._dayOrder || DAYS.map((_, i) => i);
    setReorderList(DAYS.map((d, i) => ({
      origIdx: currentOrder[i] !== undefined ? currentOrder[i] : i,
      label: d.label || `Day ${d.day}`,
      day: d.day,
    })));
    setShowReorder(true);
  }, [DAYS, customData]);

  const handleReorderMove = useCallback((fromIdx, direction) => {
    setReorderList((prev) => {
      const list = [...prev];
      const toIdx = fromIdx + direction;
      if (toIdx < 0 || toIdx >= list.length) return prev;
      [list[fromIdx], list[toIdx]] = [list[toIdx], list[fromIdx]];
      return list;
    });
  }, []);

  const handleReorderConfirm = useCallback(() => {
    const newOrder = reorderList.map((item) => item.origIdx);
    updateCustomData((prev) => ({
      ...prev,
      _dayOrder: newOrder,
    }));
    setShowReorder(false);
    setSelectedDay(0);
    setToast({ message: "Day 순서가 변경되었습니다", icon: "swap" });
  }, [reorderList, updateCustomData]);

  const handleSaveItem = useCallback((newItem, dayIdx, sectionIdx, itemIdx, opts = {}) => {
    // Check for duplicate timestamp
    if (!opts.skipDuplicateCheck && sectionIdx === -1 && itemIdx === null) {
      // New item — check all sections for same time
      const day = DAYS[dayIndexMap.indexOf ? dayIndexMap.indexOf(dayIdx) : Object.keys(dayIndexMap).find((k) => dayIndexMap[k] === dayIdx) || 0];
      const actualDay = DAYS.find((_, i) => toOrigIdx(i) === dayIdx) || current;
      if (actualDay) {
        const duplicate = actualDay.sections.some((sec) =>
          sec.items.some((it) => it.time === newItem.time)
        );
        if (duplicate) {
          setConfirmDialog({
            title: "중복 시간",
            message: `${newItem.time}에 이미 일정이 있습니다.\n그래도 추가하시겠습니까?`,
            confirmLabel: "추가",
            onConfirm: () => {
              setConfirmDialog(null);
              handleSaveItem(newItem, dayIdx, sectionIdx, itemIdx, { skipDuplicateCheck: true });
            },
          });
          return;
        }
      }
    }

    updateCustomData((prev) => {
      const next = { ...prev };
      if (sectionIdx === -1) {
        if (!next[dayIdx]) next[dayIdx] = {};
        if (!next[dayIdx].extraItems) next[dayIdx].extraItems = [];
        if (itemIdx !== undefined && itemIdx !== null) {
          // Editing existing extra item — find by old item reference
          const oldItem = editTarget?.item;
          if (oldItem) {
            const idx = next[dayIdx].extraItems.findIndex((it) =>
              it.time === oldItem.time && it.desc === oldItem.desc
            );
            if (idx >= 0) {
              next[dayIdx].extraItems = [...next[dayIdx].extraItems];
              next[dayIdx].extraItems[idx] = newItem;
            }
          }
        } else {
          next[dayIdx].extraItems.push(newItem);
        }
      } else {
        if (!next[dayIdx]) next[dayIdx] = {};
        if (!next[dayIdx].sections) next[dayIdx].sections = {};
        if (!next[dayIdx].sections[sectionIdx]) {
          next[dayIdx].sections[sectionIdx] = { items: [...BASE_DAYS[dayIdx]?.sections?.[sectionIdx]?.items || []] };
        }
        if (itemIdx !== undefined && itemIdx !== null) {
          next[dayIdx].sections[sectionIdx].items[itemIdx] = newItem;
        }
      }
      return { ...next };
    });
    setEditTarget(null);
    const isEdit = itemIdx !== undefined && itemIdx !== null;
    setToast({ message: isEdit ? "일정이 수정되었습니다" : "일정이 추가되었습니다", icon: isEdit ? "edit" : "check" });
  }, [updateCustomData, DAYS, dayIndexMap, toOrigIdx, current, editTarget]);

  const handleDeleteItem = useCallback((dayIdx, sectionIdx, itemIdx, itemRef) => {
    setConfirmDialog({
      title: "일정 삭제",
      message: "이 일정을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      onConfirm: () => {
        updateCustomData((prev) => {
          const next = { ...prev };
          if (sectionIdx === -1) {
            // Extra item — find by time+desc match
            if (next[dayIdx]?.extraItems) {
              next[dayIdx] = { ...next[dayIdx] };
              const target = itemRef || editTarget?.item;
              if (target) {
                const idx = next[dayIdx].extraItems.findIndex((it) =>
                  it.time === target.time && it.desc === target.desc
                );
                if (idx >= 0) {
                  next[dayIdx].extraItems = [...next[dayIdx].extraItems];
                  next[dayIdx].extraItems.splice(idx, 1);
                }
              } else {
                next[dayIdx].extraItems = [...next[dayIdx].extraItems];
                next[dayIdx].extraItems.splice(itemIdx, 1);
              }
              // Clean up empty extraItems array
              if (next[dayIdx].extraItems.length === 0) {
                delete next[dayIdx].extraItems;
              }
            }
          } else {
            if (!next[dayIdx]) next[dayIdx] = {};
            if (!next[dayIdx].sections) next[dayIdx].sections = {};
            if (!next[dayIdx].sections[sectionIdx]) {
              next[dayIdx].sections[sectionIdx] = { items: [...(BASE_DAYS[dayIdx]?.sections?.[sectionIdx]?.items || [])] };
            } else {
              next[dayIdx].sections[sectionIdx] = { ...next[dayIdx].sections[sectionIdx], items: [...next[dayIdx].sections[sectionIdx].items] };
            }
            next[dayIdx].sections[sectionIdx].items.splice(itemIdx, 1);
          }
          return { ...next };
        });
        setEditTarget(null);
        setConfirmDialog(null);
        setToast({ message: "일정이 삭제되었습니다", icon: "trash" });
      },
    });
  }, [updateCustomData, editTarget]);

  /* ── Share link copy ── */
  const handleCopyShareLink = useCallback(async () => {
    if (!shareCode) return;
    const link = getShareLink(shareCode);
    try {
      await navigator.clipboard.writeText(link);
      setToast({ message: "공유 링크가 복사되었습니다", icon: "check" });
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setToast({ message: "공유 링크가 복사되었습니다", icon: "check" });
    }
    setShowShareSheet(false);
  }, [shareCode]);

  /* ── Loading state ── */
  if (!isLegacy && (tripLoading || scheduleLoading)) {
    return (
      <div style={{
        width: "100%", height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--color-surface)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}>
        <div style={{
          width: "32px", height: "32px",
          border: "3px solid var(--color-surface-container)",
          borderTopColor: "var(--color-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{
          marginTop: "16px", fontSize: "var(--typo-caption-1-regular-size)",
          color: "var(--color-on-surface-variant2)",
        }}>
          일정을 불러오는 중...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── No access ── */
  if (!isLegacy && !myRole) {
    return (
      <div style={{
        width: "100%", height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--color-surface)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        padding: "20px",
      }}>
        <Icon name="lock" size={48} style={{ opacity: 0.3, marginBottom: "16px" }} />
        <p style={{
          fontSize: "var(--typo-body-1-n---bold-size)",
          fontWeight: "var(--typo-body-1-n---bold-weight)",
          color: "var(--color-on-surface)", marginBottom: "8px",
        }}>
          접근 권한이 없습니다
        </p>
        <p style={{
          fontSize: "var(--typo-caption-1-regular-size)",
          color: "var(--color-on-surface-variant2)", textAlign: "center", marginBottom: "24px",
        }}>
          이 여행의 멤버가 아닙니다.<br />초대 링크를 통해 참여해주세요.
        </p>
        <Button variant="primary" size="lg" onClick={() => navigate("/")}>
          홈으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div style={{
      width: "100%", height: "100vh", display: "flex", flexDirection: "column",
      background: "var(--color-surface)", overflow: "hidden",
      paddingTop: "env(safe-area-inset-top, 0px)",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px", background: "var(--color-surface-container-lowest)",
        borderBottom: "1px solid var(--color-outline-variant)",
        display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft"
          onClick={() => navigate("/")}
          style={{ marginLeft: "-8px", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: "var(--typo-body-2-n---bold-size)", fontWeight: "var(--typo-body-2-n---bold-weight)", lineHeight: "var(--typo-body-2-n---bold-line-height)", letterSpacing: "var(--typo-body-2-n---bold-letter-spacing)", color: "var(--color-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tripName}
          </h1>
          <p style={{ margin: 0, fontSize: "var(--typo-caption-2-regular-size)", fontWeight: "var(--typo-caption-2-regular-weight)", lineHeight: "var(--typo-caption-2-regular-line-height)", color: "var(--color-on-surface-variant2)" }}>
            {tripSubtitle}
          </p>
        </div>
        {/* Online presence indicators */}
        {!isLegacy && onlineUsers.length > 1 && (
          <div style={{
            display: "flex", alignItems: "center", marginRight: "-4px",
          }}>
            {onlineUsers.filter((u) => u.id !== user?.id).slice(0, 3).map((u, i) => (
              <div key={u.id} style={{
                width: "24px", height: "24px", borderRadius: "50%",
                border: "2px solid var(--color-surface-container-lowest)",
                marginLeft: i > 0 ? "-8px" : "0",
                overflow: "hidden", flexShrink: 0,
                position: "relative", zIndex: 3 - i,
              }} title={u.name}>
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    background: "var(--color-primary-container)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "10px", fontWeight: 700,
                    color: "var(--color-on-primary-container)",
                  }}>
                    {(u.name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Green dot: online */}
                <div style={{
                  position: "absolute", bottom: "-1px", right: "-1px",
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: "#22C55E", border: "1.5px solid var(--color-surface-container-lowest)",
                }} />
              </div>
            ))}
            {onlineUsers.length > 4 && (
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%",
                border: "2px solid var(--color-surface-container-lowest)",
                marginLeft: "-8px",
                background: "var(--color-surface-container)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "9px", fontWeight: 700,
                color: "var(--color-on-surface-variant2)",
                flexShrink: 0,
              }}>
                +{onlineUsers.length - 4}
              </div>
            )}
          </div>
        )}
        {/* Share / Invite button (Supabase trips only, all roles) */}
        {!isLegacy && (
          <Button variant="neutral" size="lg" iconOnly="share"
            onClick={() => setShowShareSheet(true)}
            title="공유 및 초대" />
        )}
        {/* Viewer badge */}
        {!isLegacy && !canEdit && (
          <span style={{
            padding: "4px 8px", borderRadius: "var(--radius-md, 8px)",
            background: "var(--color-surface-container-low)",
            fontSize: "var(--typo-caption-2-bold-size)",
            fontWeight: "var(--typo-caption-2-bold-weight)",
            color: "var(--color-on-surface-variant2)",
          }}>
            보기 전용
          </span>
        )}
        <Button variant="neutral" size="lg" iconOnly="compass" onClick={() => setShowGuide(true)}
          title="여행 가이드" />
        <Button variant="neutral" size="lg" iconOnly="file" onClick={() => setShowDocs(true)}
          title="여행 서류" />
      </div>

      {/* Day tabs */}
      <div style={{
        display: "flex", gap: 0, padding: "0 12px",
        background: "var(--color-surface-container-lowest)",
        flexShrink: 0, alignItems: "center",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Tab
            items={DAYS.map((day, i) => ({ label: `D${i + 1}`, value: i }))}
            value={selectedDay}
            onChange={setSelectedDay}
            size="md"
          />
        </div>

        {/* Day reorder + add buttons (only if can edit) */}
        {canEdit && (
          <div style={{ flexShrink: 0, display: "flex", gap: "6px", marginLeft: "12px", paddingRight: "4px" }}>
            <Button variant="neutral" size="sm" iconOnly="swap"
              onClick={handleOpenReorder}
              title="순서 변경" />
            <Button variant="neutral" size="sm" iconOnly="plus"
              onClick={() => setShowAddDay(true)}
              title="날짜 추가" />
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>

        {/* Day title card */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          marginBottom: "16px", padding: "14px 16px",
          background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px)", border: "1px solid var(--color-outline-variant)",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "var(--radius-md, 8px)",
            background: "var(--color-primary)", display: "flex",
            alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Icon name={current.icon} size={20} style={{ filter: "brightness(0) invert(1)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h2
                  onClick={canEdit ? () => { setEditingDayIdx(toOrigIdx(selectedDay)); setEditDayLabel(current.label); } : undefined}
                  style={{
                    margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)",
                    letterSpacing: "var(--typo-body-1-n---bold-letter-spacing)", cursor: canEdit ? "pointer" : "default",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  title={canEdit ? "이름 수정" : undefined}
                >
                  {current.label}
                </h2>
                {canEdit && (
                  <Button variant="ghost-neutral" size="xsm" iconOnly="edit"
                    onClick={() => { setEditingDayIdx(toOrigIdx(selectedDay)); setEditDayLabel(current.label); }}
                    style={{ width: "24px", height: "24px" }} />
                )}
                {canEdit && toOrigIdx(selectedDay) >= BASE_DAYS.length && (
                  <Button variant="ghost-neutral" size="xsm" iconOnly="trash"
                    onClick={() => handleDeleteDay(toOrigIdx(selectedDay))}
                    style={{ width: "24px", height: "24px" }} />
                )}
              </div>
            <p style={{ margin: "2px 0 0", fontSize: "var(--typo-caption-2-regular-size)", fontWeight: "var(--typo-caption-2-regular-weight)", lineHeight: "var(--typo-caption-2-regular-line-height)", color: "var(--color-on-surface-variant2)" }}>
              {current.date} · {current.stay}
            </p>
          </div>
          {canEdit && (
            <div style={{ flexShrink: 0 }}>
              <Button variant="primary" size="sm" iconLeft="plus"
                onClick={() => setEditTarget({ dayIdx: toOrigIdx(selectedDay), sectionIdx: -1, itemIdx: null, item: null })}>
                일정 추가
              </Button>
            </div>
          )}
        </div>

        {/* Sections */}
        {current.sections.length === 0 || current.sections.every((s) => !s.items || s.items.length === 0) ? (
          /* ── Empty State: no schedule items at all ── */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "48px 20px", textAlign: "center",
          }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "var(--color-primary-container)", display: "flex",
              alignItems: "center", justifyContent: "center", marginBottom: "16px",
            }}>
              <Icon name="calendar" size={24} />
            </div>
            <p style={{
              margin: "0 0 6px", fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)",
            }}>
              아직 일정이 없습니다
            </p>
            <p style={{
              margin: "0 0 20px", fontSize: "var(--typo-caption-1-regular-size)",
              fontWeight: "var(--typo-caption-1-regular-weight)", color: "var(--color-on-surface-variant2)",
              lineHeight: "var(--typo-caption-1-regular-line-height)",
            }}>
              {canEdit
                ? `상단의 "일정 추가" 버튼을 눌러\n새로운 일정을 추가해보세요`
                : "아직 추가된 일정이 없습니다"}
            </p>
            {canEdit && (
              <Button variant="primary" size="md" iconLeft="plus"
                onClick={() => setEditTarget({ dayIdx: toOrigIdx(selectedDay), sectionIdx: -1, itemIdx: null, item: null })}>
                일정 추가
              </Button>
            )}
          </div>
        ) : (
          current.sections.map((section, si) => (
            <div key={si} style={{ marginBottom: "12px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "0 4px", marginBottom: "8px",
              }}>
                <div style={{
                  width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-primary)",
                }} />
                <span style={{
                  fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)", color: "var(--color-primary)", letterSpacing: "var(--typo-caption-2-bold-letter-spacing)",
                }}>
                  {section.title}
                </span>
                <div style={{ flex: 1, height: "1px", background: "var(--color-primary-container)" }} />
              </div>

              <div style={{
                background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--color-outline-variant)", overflow: "hidden",
              }}>
                {section.items.length === 0 ? (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "24px 16px", gap: "8px",
                  }}>
                    <Icon name="plus" size={14} style={{ opacity: 0.3 }} />
                    <span style={{
                      fontSize: "var(--typo-caption-1-regular-size)",
                      fontWeight: "var(--typo-caption-1-regular-weight)",
                      color: "var(--color-on-surface-variant2)",
                    }}>
                      일정이 비어있습니다
                    </span>
                  </div>
                ) : (
                  section.items.map((item, ii) => {
                    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
                    const isLast = ii === section.items.length - 1;
                    const hasDetail = !!item.detail && !!(item.detail.image || item.detail.images?.length || item.detail.tip || item.detail.address || item.detail.timetable);
                    const effectiveSi = (section._isExtra || item._extra) ? -1 : si;
                    const handleClick = () => {
                      if (hasDetail) {
                        setActiveDetail({ ...item.detail, _item: item, _si: effectiveSi, _ii: ii, _di: selectedDay });
                      }
                    };
                    return (
                      <div
                        key={ii}
                        onClick={hasDetail ? handleClick : undefined}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: "8px",
                          padding: "10px 12px",
                          borderBottom: isLast ? "none" : "1px solid var(--color-surface-dim)",
                          background: "transparent",
                          cursor: hasDetail ? "pointer" : "default",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => { if (hasDetail) e.currentTarget.style.background = "var(--color-surface-container-low)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{
                          width: "38px", flexShrink: 0, textAlign: "right",
                          fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)", color: "var(--color-on-surface-variant2)",
                          fontVariantNumeric: "tabular-nums",
                          lineHeight: "20px", whiteSpace: "nowrap",
                        }}>
                          {item.time}
                        </span>
                        <div style={{ width: "3px", flexShrink: 0, borderRadius: "2px", background: cfg.border, alignSelf: "stretch", minHeight: "20px" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", minHeight: "20px" }}>
                            <p style={{
                              margin: 0, fontSize: "var(--typo-label-2-medium-size)", fontWeight: "var(--typo-label-2-medium-weight)", color: "var(--color-on-surface)", lineHeight: "20px",
                            }}>
                              {item.desc}
                            </p>
                            {hasDetail && (
                              <Icon name="chevronRight" size={12} style={{ opacity: 0.35, flexShrink: 0 }} />
                            )}
                          </div>
                          {item.sub && (
                            <p style={{ margin: "2px 0 0", fontSize: "var(--typo-caption-2-regular-size)", fontWeight: "var(--typo-caption-2-regular-weight)", color: "var(--color-on-surface-variant2)", lineHeight: "var(--typo-caption-2-regular-line-height)" }}>
                              {item.sub}
                            </p>
                          )}
                        </div>
                        {item.detail && item.detail.address && (
                          <div style={{ flexShrink: 0, alignSelf: "center" }}>
                            <MapButton query={item.detail.address} />
                          </div>
                        )}
                        {/* Edit / Delete (only if can edit) */}
                        {canEdit && (
                          <div style={{ display: "flex", gap: "4px", flexShrink: 0, alignSelf: "center" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost-neutral" size="xsm" iconOnly="edit"
                              onClick={() => setEditTarget({ item, sectionIdx: effectiveSi, itemIdx: ii, dayIdx: toOrigIdx(selectedDay) })} />
                            <Button variant="ghost-neutral" size="xsm" iconOnly="trash"
                              onClick={() => handleDeleteItem(toOrigIdx(selectedDay), effectiveSi, ii, item)} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))
        )}

        {/* Auto-generated day summary */}
        {(() => {
          const summary = generateDaySummary(current);
          return summary ? (
            <div style={{
              marginTop: "4px", padding: "11px 14px",
              background: "var(--color-surface-container-low)", borderRadius: "var(--radius-md, 8px)", border: "1px dashed var(--color-outline-variant)",
            }}>
              <p style={{ margin: 0, fontSize: "var(--typo-caption-2-regular-size)", fontWeight: "var(--typo-caption-2-regular-weight)", color: "var(--color-on-surface-variant2)", lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <Icon name="pin" size={12} style={{ marginTop: "2px" }} /><span>{summary}</span>
              </p>
            </div>
          ) : null;
        })()}
      </div>

      {/* Detail Dialog */}
      <DetailDialog
        detail={activeDetail}
        onClose={() => setActiveDetail(null)}
        dayColor="var(--color-primary)"
      />

      {/* Document Dialog */}
      {showDocs && <DocumentDialog onClose={() => setShowDocs(false)} tripId={isLegacy ? null : tripId} isLegacy={isLegacy} />}

      {/* Shopping Guide Dialog */}
      {showGuide && <ShoppingGuideDialog onClose={() => setShowGuide(false)} />}

      {/* Day Info Dialog */}
      {dayInfoTab && <DayInfoDialog dayNum={current.day} tab={dayInfoTab} onClose={() => setDayInfoTab(null)} color="var(--color-primary)" />}

      {/* Edit/Add Item Dialog (only if can edit) */}
      {editTarget && canEdit && (
        <EditItemDialog
          item={editTarget.item}
          sectionIdx={editTarget.sectionIdx}
          itemIdx={editTarget.itemIdx}
          dayIdx={editTarget.dayIdx}
          onSave={handleSaveItem}
          onDelete={editTarget.item?._custom ? handleDeleteItem : null}
          onClose={() => setEditTarget(null)}
          color="var(--color-primary)"
          tripId={isLegacy ? null : tripId}
        />
      )}

      {/* Floating Map Button */}
      <Button variant="primary" size="xlg" iconOnly="map"
        onClick={() => setShowMap(true)}
        title="여행 지도"
        style={{
          position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", right: "24px", zIndex: 900,
          width: "52px", height: "52px",
          boxShadow: "var(--shadow-heavy)",
        }} />

      {/* Full Map Dialog */}
      {showMap && <FullMapDialog days={DAYS} onClose={() => setShowMap(false)} />}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Edit Day Name Dialog */}
      {editingDayIdx !== null && canEdit && (
        <BottomSheet onClose={() => setEditingDayIdx(null)} maxHeight="auto" zIndex={3000}>
          <div style={{ padding: "8px 24px 24px" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon name="edit" size={16} />이름 수정
            </h3>
            <Field size="xlg" variant="outlined"
              value={editDayLabel}
              onChange={(e) => setEditDayLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editDayLabel.trim()) { handleEditDayLabel(editingDayIdx, editDayLabel); }
                if (e.key === "Escape") setEditingDayIdx(null);
              }}
              placeholder="이름을 입력하세요"
              style={{ marginBottom: "20px" }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <Button variant="neutral" size="lg" onClick={() => setEditingDayIdx(null)} style={{ flex: 1 }}>취소</Button>
              <Button variant="primary" size="lg"
                onClick={() => { if (editDayLabel.trim()) handleEditDayLabel(editingDayIdx, editDayLabel); }}
                disabled={!editDayLabel.trim()}
                style={{ flex: 1 }}>
                저장
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Add Day Dialog */}
      {showAddDay && canEdit && (
        <AddDayDialog
          onAdd={handleAddDay}
          onCancel={() => setShowAddDay(false)}
          existingDays={DAYS}
        />
      )}

      {/* ── Share & Invite Bottom Sheet ── */}
      {showShareSheet && !isLegacy && (
        <BottomSheet onClose={() => setShowShareSheet(false)} maxHeight="70vh" zIndex={3000}>
          <div style={{ padding: "8px 24px 24px" }}>
            <h3 style={{
              margin: "0 0 20px",
              fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)",
              color: "var(--color-on-surface)",
            }}>
              공유 및 초대
            </h3>

            {/* Share link section */}
            <div style={{ marginBottom: "20px" }}>
              <p style={{
                margin: "0 0 8px",
                fontSize: "var(--typo-caption-1-bold-size)",
                fontWeight: "var(--typo-caption-1-bold-weight)",
                color: "var(--color-on-surface-variant)",
              }}>
                초대 링크
              </p>
              <div style={{
                display: "flex", gap: "8px", alignItems: "center",
              }}>
                <div style={{
                  flex: 1, padding: "10px 14px",
                  borderRadius: "var(--radius-md, 8px)",
                  background: "var(--color-surface-container-low)",
                  fontSize: "var(--typo-caption-1-regular-size)",
                  color: "var(--color-on-surface-variant2)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  userSelect: "all",
                }}>
                  {shareCode ? getShareLink(shareCode) : "링크 생성 중..."}
                </div>
                <Button variant="primary" size="lg" iconOnly="copy"
                  onClick={handleCopyShareLink}
                  disabled={!shareCode} />
              </div>
              <p style={{
                margin: "8px 0 0",
                fontSize: "var(--typo-caption-2-regular-size)",
                color: "var(--color-on-surface-variant2)",
                lineHeight: 1.5,
              }}>
                이 링크를 공유하면 누구나 이 여행에 참여하여 함께 일정을 편집할 수 있습니다.
              </p>

              {/* Native share button for mobile */}
              {typeof navigator.share === "function" && shareCode && (
                <Button
                  variant="neutral"
                  size="lg"
                  iconLeft="share"
                  onClick={async () => {
                    try {
                      await navigator.share({
                        title: tripMeta?.name || "여행 초대",
                        text: `"${tripMeta?.name || "여행"}"에 참여해보세요!`,
                        url: getShareLink(shareCode),
                      });
                    } catch { /* user cancelled */ }
                  }}
                  style={{ marginTop: "10px", width: "100%" }}
                >
                  다른 앱으로 공유
                </Button>
              )}
            </div>

            {/* Members list */}
            {tripMeta?.members?.length > 0 && (
              <div>
                <p style={{
                  margin: "0 0 8px",
                  fontSize: "var(--typo-caption-1-bold-size)",
                  fontWeight: "var(--typo-caption-1-bold-weight)",
                  color: "var(--color-on-surface-variant)",
                }}>
                  멤버 ({tripMeta.members.length}명)
                </p>
                <div style={{
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-outline-variant)",
                  overflow: "hidden",
                }}>
                  {tripMeta.members.map((m, i) => {
                    const isOnline = onlineUsers.some((ou) => ou.id === m.id);
                    return (
                      <div key={m.id} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 14px",
                        borderBottom: i < tripMeta.members.length - 1 ? "1px solid var(--color-surface-dim)" : "none",
                        background: "var(--color-surface-container-lowest)",
                      }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt="" style={{
                              width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover",
                            }} />
                          ) : (
                            <div style={{
                              width: "28px", height: "28px", borderRadius: "50%",
                              background: "var(--color-primary-container)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)",
                              color: "var(--color-on-primary-container)",
                            }}>
                              {(m.name || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                          {isOnline && (
                            <div style={{
                              position: "absolute", bottom: "-1px", right: "-1px",
                              width: "8px", height: "8px", borderRadius: "50%",
                              background: "#22C55E", border: "1.5px solid var(--color-surface-container-lowest)",
                            }} />
                          )}
                        </div>
                        <span style={{
                          flex: 1, fontSize: "var(--typo-label-2-medium-size)",
                          fontWeight: "var(--typo-label-2-medium-weight)", color: "var(--color-on-surface)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {m.name}
                          {m.id === user?.id && (
                            <span style={{ marginLeft: "4px", fontSize: "var(--typo-caption-3-regular-size)", color: "var(--color-on-surface-variant2)" }}>(나)</span>
                          )}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          {isOnline && (
                            <span style={{
                              fontSize: "var(--typo-caption-3-regular-size)",
                              color: "#22C55E",
                            }}>온라인</span>
                          )}
                          <span style={{
                            fontSize: "var(--typo-caption-2-regular-size)",
                            color: "var(--color-on-surface-variant2)",
                            padding: "2px 6px", borderRadius: "4px",
                            background: m.role === "owner" ? "var(--color-primary-container)" : "var(--color-surface-container-low)",
                          }}>
                            {m.role === "owner" ? "소유자" : m.role === "editor" ? "편집자" : "보기"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </BottomSheet>
      )}

      {/* ── Day Reorder Bottom Sheet ── */}
      {showReorder && (
        <BottomSheet onClose={() => setShowReorder(false)} maxHeight="70vh" zIndex={3000}>
          <div style={{ padding: "8px 24px 24px" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "16px",
            }}>
              <h3 style={{
                margin: 0,
                fontSize: "var(--typo-body-1-n---bold-size)",
                fontWeight: "var(--typo-body-1-n---bold-weight)",
                color: "var(--color-on-surface)",
              }}>
                Day 순서 변경
              </h3>
              <Button variant="primary" size="sm" onClick={handleReorderConfirm}>
                적용
              </Button>
            </div>

            <div style={{
              display: "flex", flexDirection: "column", gap: "6px",
              maxHeight: "50vh", overflowY: "auto",
            }}>
              {reorderList.map((item, i) => (
                <div key={`${item.idx}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-outline-variant)",
                  background: "var(--color-surface-container-lowest)",
                }}>
                  {/* Day number badge */}
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    background: "var(--color-primary-container)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "var(--typo-caption-1-bold-size)",
                    fontWeight: "var(--typo-caption-1-bold-weight)",
                    color: "var(--color-on-primary-container)",
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>

                  {/* Day label */}
                  <span style={{
                    flex: 1,
                    fontSize: "var(--typo-label-2-medium-size)",
                    fontWeight: "var(--typo-label-2-medium-weight)",
                    color: "var(--color-on-surface)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {item.label}
                  </span>

                  {/* Up / Down buttons */}
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    <button
                      onClick={() => handleReorderMove(i, -1)}
                      disabled={i === 0}
                      style={{
                        width: "30px", height: "30px", borderRadius: "var(--radius-md, 8px)",
                        border: "1px solid var(--color-outline-variant)",
                        background: i === 0 ? "var(--color-surface-dim)" : "var(--color-surface-container-low)",
                        cursor: i === 0 ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: i === 0 ? 0.3 : 1,
                      }}
                    >
                      <Icon name="chevronUp" size={14} />
                    </button>
                    <button
                      onClick={() => handleReorderMove(i, 1)}
                      disabled={i === reorderList.length - 1}
                      style={{
                        width: "30px", height: "30px", borderRadius: "var(--radius-md, 8px)",
                        border: "1px solid var(--color-outline-variant)",
                        background: i === reorderList.length - 1 ? "var(--color-surface-dim)" : "var(--color-surface-container-low)",
                        cursor: i === reorderList.length - 1 ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: i === reorderList.length - 1 ? 0.3 : 1,
                      }}
                    >
                      <Icon name="chevronDown" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          key={Date.now()}
          message={toast.message}
          icon={toast.icon}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
