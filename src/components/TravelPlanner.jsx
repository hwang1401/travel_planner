import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePresence } from "../hooks/usePresence";

/* Data imports */
import { BASE_DAYS } from "../data/days";
import { loadCustomData, mergeData, generateDaySummary } from "../data/storage";
import { TYPE_CONFIG } from "../data/guides";
import { COLOR, SPACING, RADIUS, TYPE_LABELS, getTypeConfig } from "../styles/tokens";
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
import EmptyState from "./common/EmptyState";
import ScheduleSkeleton from "./common/ScheduleSkeleton";

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
import { getItemCoords } from "../data/locations";

/* Schedule components */
import PlaceCard from "./schedule/PlaceCard";
import TravelTimeConnector from "./schedule/TravelTimeConnector";
// IconContainer removed — action sheet uses direct Icon placement
import AddPlacePage from "./schedule/AddPlacePage";
import PasteInfoPage from "./schedule/PasteInfoPage";
import { getDistance, getTravelInfo } from "../utils/distance";
import { getTodayDayIndex, getCurrentItemIndex, isTodayInTrip } from "../utils/today";

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
  const [openAiTab, setOpenAiTab] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [editingDayIdx, setEditingDayIdx] = useState(null);
  const [editDayLabel, setEditDayLabel] = useState("");
  const [showDayMoreMenu, setShowDayMoreMenu] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const dayNameInputRef = useRef(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [toast, setToast] = useState(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareCode, setShareCode] = useState(null);
  const [showReorder, setShowReorder] = useState(false);
  const [reorderList, setReorderList] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [showPasteInfo, setShowPasteInfo] = useState(false);
  const todayInitDone = useRef(false);

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

        // Auto-migrate: add _standalone flag for non-legacy Supabase trips
        const schedData = schedule.data || {};
        if (!schedData._standalone) {
          // Legacy-duplicated data has numeric keys with `sections` overrides
          const hasLegacySections = Object.keys(schedData).some(
            (k) => !k.startsWith("_") && !isNaN(Number(k)) && schedData[k]?.sections
          );
          if (!hasLegacySections) schedData._standalone = true;
        }
        setCustomData(schedData);
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
        const rtData = payload.data || {};
        if (!rtData._standalone) {
          const hasLegacySections = Object.keys(rtData).some(
            (k) => !k.startsWith("_") && !isNaN(Number(k)) && rtData[k]?.sections
          );
          if (!hasLegacySections) rtData._standalone = true;
        }
        setCustomData(rtData);
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

  /* ── Base length: legacy/duplicated trips use BASE_DAYS, standalone trips use 0 ── */
  const baseLen = useMemo(() => {
    if (isLegacy) return BASE_DAYS.length;
    // _standalone flag = new Supabase trip → no BASE_DAYS
    if (customData._standalone) return 0;
    // No flag = duplicated-from-legacy → use BASE_DAYS
    return BASE_DAYS.length;
  }, [customData._standalone, isLegacy]);

  /* ── Merge data ── */
  const DAYS = useMemo(() => {
    const base = baseLen > 0 ? BASE_DAYS : [];
    return mergeData(base, customData);
  }, [customData, baseLen]);

  const current = DAYS[selectedDay];

  /* ── Auto-select today's day (once) ── */
  useEffect(() => {
    if (todayInitDone.current || DAYS.length === 0) return;
    todayInitDone.current = true;
    if (isTodayInTrip(DAYS)) {
      const todayIdx = getTodayDayIndex(DAYS);
      if (todayIdx !== 0) setSelectedDay(todayIdx);
    }
  }, [DAYS]);

  /* ── 인라인 날짜 이름 편집 시 입력 포커스 ── */
  useEffect(() => {
    if (editingDayIdx === null) return;
    const t = setTimeout(() => dayNameInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [editingDayIdx]);

  /* ── "지금" indicator: flatten all items and find current ── */
  const nowItemKey = useMemo(() => {
    if (!current || !isTodayInTrip(DAYS)) return null;
    const allItems = current.sections?.flatMap((s) => s.items?.filter(Boolean) || []) || [];
    const { index, status } = getCurrentItemIndex(allItems);
    if (index >= 0 && (status === "current" || status === "next")) {
      // Build a key: sectionIdx-itemIdx
      let counter = 0;
      for (let si = 0; si < (current.sections?.length || 0); si++) {
        const items = current.sections[si].items?.filter(Boolean) || [];
        for (let ii = 0; ii < items.length; ii++) {
          if (counter === index) return `${si}-${ii}`;
          counter++;
        }
      }
    }
    return null;
  }, [current, DAYS]);

  /* ── Compute route summary for current day ── */
  const routeSummary = useMemo(() => {
    if (!current) return null;
    let placeCount = 0;
    let totalDistance = 0;
    let prevCoords = null;
    const allItems = current.sections?.flatMap((s) => s.items?.filter(Boolean) || []) || [];
    for (const item of allItems) {
      const loc = getItemCoords(item, selectedDay);
      if (loc) {
        placeCount++;
        if (prevCoords) {
          totalDistance += getDistance(prevCoords[0], prevCoords[1], loc.coords[0], loc.coords[1]);
        }
        prevCoords = loc.coords;
      }
    }
    if (placeCount < 2) return null;
    const distText = totalDistance < 1000 ? `${Math.round(totalDistance)}m` : `${(totalDistance / 1000).toFixed(1)}km`;
    return `${placeCount}개 장소 · 이동거리 약 ${distText}`;
  }, [current, selectedDay]);

  /* Map display index → original (pre-reorder) index for customData access */
  const dayIndexMap = useMemo(() => {
    const totalDays = baseLen + (customData._extraDays || []).length;
    if (customData._dayOrder && customData._dayOrder.length === totalDays) {
      return customData._dayOrder;
    }
    return Array.from({ length: totalDays }, (_, i) => i);
  }, [customData._dayOrder, customData._extraDays, baseLen]);

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
        sections: [
          { title: "오전", items: [] },
          { title: "오후", items: [] },
          { title: "저녁", items: [] },
        ],
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
        if (idx >= 0) setSelectedDay(baseLen + idx);
      } else {
        setSelectedDay(baseLen + extraDays.length);
      }
    }, 50);
  }, [customData, updateCustomData, baseLen]);

  const handleEditDayLabel = useCallback((dayIdx, newLabel) => {
    updateCustomData((prev) => {
      const next = { ...prev };
      if (dayIdx < baseLen) {
        if (!next._dayOverrides) next._dayOverrides = {};
        next._dayOverrides[dayIdx] = { ...(next._dayOverrides[dayIdx] || {}), label: newLabel };
      } else {
        const extraIdx = dayIdx - baseLen;
        if (next._extraDays && next._extraDays[extraIdx]) {
          next._extraDays = [...next._extraDays];
          next._extraDays[extraIdx] = { ...next._extraDays[extraIdx], label: newLabel };
        }
      }
      return { ...next };
    });
    setEditingDayIdx(null);
    setToast({ message: "날짜 이름이 변경되었습니다", icon: "edit" });
  }, [updateCustomData, baseLen]);

  const handleDeleteDay = useCallback((dayIdx) => {
    if (dayIdx < baseLen) return;
    setConfirmDialog({
      title: "날짜 삭제",
      message: "이 날짜와 포함된 모든 일정이 삭제됩니다.\n정말 삭제하시겠습니까?",
      confirmLabel: "삭제",
      onConfirm: () => {
        updateCustomData((prev) => {
          const next = { ...prev };
          const extraIdx = dayIdx - baseLen;
          if (next._extraDays) {
            next._extraDays = next._extraDays.filter((_, i) => i !== extraIdx);
            next._extraDays = next._extraDays.map((d, i) => ({
              ...d, day: baseLen + i + 1,
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
  }, [updateCustomData, baseLen]);

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
          // Get current items: from BASE_DAYS for legacy, from _extraDays for standalone
          const sourceSec = baseLen > 0
            ? BASE_DAYS[dayIdx]?.sections?.[sectionIdx]
            : next._extraDays?.[dayIdx - baseLen]?.sections?.[sectionIdx];
          next[dayIdx].sections[sectionIdx] = { items: [...(sourceSec?.items || [])] };
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
  }, [updateCustomData, DAYS, dayIndexMap, toOrigIdx, current, editTarget, baseLen]);

  /* 삭제 실행 로직 (확인 다이얼로그 바깥에서 재사용) */
  const performDeleteItem = useCallback((dayIdx, sectionIdx, itemIdx, itemRef) => {
    updateCustomData((prev) => {
      const next = { ...prev };
      if (sectionIdx === -1) {
        if (next[dayIdx]?.extraItems) {
          next[dayIdx] = { ...next[dayIdx] };
          const target = itemRef ?? editTarget?.item;
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
          if (next[dayIdx].extraItems.length === 0) delete next[dayIdx].extraItems;
        }
      } else {
        if (!next[dayIdx]) next[dayIdx] = {};
        if (!next[dayIdx].sections) next[dayIdx].sections = {};
        if (!next[dayIdx].sections[sectionIdx]) {
          const sourceSec2 = baseLen > 0
            ? BASE_DAYS[dayIdx]?.sections?.[sectionIdx]
            : next._extraDays?.[dayIdx - baseLen]?.sections?.[sectionIdx];
          next[dayIdx].sections[sectionIdx] = { items: [...(sourceSec2?.items || [])] };
        } else {
          next[dayIdx].sections[sectionIdx] = { ...next[dayIdx].sections[sectionIdx], items: [...next[dayIdx].sections[sectionIdx].items] };
        }
        next[dayIdx].sections[sectionIdx].items.splice(itemIdx, 1);
      }
      return { ...next };
    });
    setEditTarget(null);
    setToast({ message: "일정이 삭제되었습니다", icon: "trash" });
  }, [updateCustomData, editTarget, baseLen]);

  const handleDeleteItem = useCallback((dayIdx, sectionIdx, itemIdx, itemRef) => {
    setConfirmDialog({
      title: "일정 삭제",
      message: "이 일정을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      onConfirm: () => {
        performDeleteItem(dayIdx, sectionIdx, itemIdx, itemRef);
        setConfirmDialog(null);
      },
    });
  }, [performDeleteItem]);

  /* 정보 다이얼로그에서 삭제 시: 다이얼로그 닫고 확인 후 삭제 */
  const handleDeleteFromDetail = useCallback((d) => {
    if (!d?._item?._custom) return;
    setActiveDetail(null);
    setConfirmDialog({
      title: "일정 삭제",
      message: "이 일정을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      onConfirm: () => {
        performDeleteItem(toOrigIdx(d._di ?? selectedDay), d._si, d._ii, d._item);
        setConfirmDialog(null);
      },
    });
  }, [performDeleteItem, toOrigIdx, selectedDay]);

  /* ── Bulk Import: replace or append ── */
  const handleBulkImport = useCallback((items, mode) => {
    if (!items || items.length === 0) return;
    const dayIdx = toOrigIdx(selectedDay);
    if (mode === "replace") {
      updateCustomData((prev) => {
        const next = { ...prev };
        if (next[dayIdx]) {
          delete next[dayIdx].sections;
          delete next[dayIdx].extraItems;
        }
        if (baseLen === 0 && next._extraDays?.[dayIdx - baseLen]) {
          next._extraDays = [...next._extraDays];
          const extraDay = { ...next._extraDays[dayIdx - baseLen] };
          extraDay.sections = extraDay.sections.map((sec) => ({ ...sec, items: [] }));
          next._extraDays[dayIdx - baseLen] = extraDay;
        }
        if (!next[dayIdx]) next[dayIdx] = {};
        next[dayIdx].extraItems = [...items];
        return { ...next };
      });
      setToast({ message: `${items.length}개 일정으로 교체되었습니다`, icon: "check" });
    } else {
      updateCustomData((prev) => {
        const next = { ...prev };
        if (!next[dayIdx]) next[dayIdx] = {};
        if (!next[dayIdx].extraItems) next[dayIdx].extraItems = [];
        next[dayIdx].extraItems = [...next[dayIdx].extraItems, ...items];
        return { ...next };
      });
      setToast({ message: `${items.length}개 일정이 추가되었습니다`, icon: "check" });
    }
  }, [updateCustomData, toOrigIdx, selectedDay, baseLen]);

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

  /* ── Loading state: 스켈레톤 ── */
  if (!isLegacy && (tripLoading || scheduleLoading)) {
    return <ScheduleSkeleton />;
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
      {/* Header — 탭 섹션과 동일 배경, 하단 보더로 구분 */}
      <div style={{
        padding: "12px 16px 12px 8px",
        background: "var(--color-surface-container-lowest)",
        borderBottom: "1px solid var(--color-outline-variant)",
        display: "flex", alignItems: "center", gap: "4px", flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft"
          onClick={() => navigate("/")}
          style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ margin: 0, fontSize: "var(--typo-body-2-n---bold-size)", fontWeight: "var(--typo-body-2-n---bold-weight)", lineHeight: "var(--typo-body-2-n---bold-line-height)", letterSpacing: "var(--typo-body-2-n---bold-letter-spacing)", color: "var(--color-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tripName}
            </h1>
            {/* Viewer badge */}
            {!isLegacy && !canEdit && (
              <span style={{
                padding: "2px 6px", borderRadius: "var(--radius-sm, 4px)",
                background: "var(--color-surface-container-lowest)",
                fontSize: "var(--typo-caption-3-bold-size)",
                fontWeight: "var(--typo-caption-3-bold-weight)",
                color: "var(--color-on-surface-variant2)",
                flexShrink: 0,
              }}>
                보기 전용
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "var(--typo-caption-2-regular-size)", fontWeight: "var(--typo-caption-2-regular-weight)", lineHeight: "var(--typo-caption-2-regular-line-height)", color: "var(--color-on-surface-variant2)" }}>
            {tripSubtitle}
          </p>
        </div>
        {/* Share button (Supabase trips only) */}
        {!isLegacy && (
          <Button variant="ghost-neutral" size="sm" iconOnly="share"
            onClick={() => setShowShareSheet(true)}
            title="공유 및 초대" />
        )}
        {/* More menu button */}
        <Button variant="ghost-neutral" size="sm" iconOnly="list"
          onClick={() => setShowMoreMenu(true)}
          title="더보기" />
      </div>

      {/* ── Day header zone: tabs + day info panel (sticky) ── */}
      <div style={{
        flexShrink: 0,
        background: "var(--color-surface-container-lowest)",
        borderBottom: "1px solid var(--color-outline-variant)",
      }}>
        {/* Day tabs row */}
        <div style={{
          display: "flex", gap: 0, padding: "0 12px",
          alignItems: "center",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {DAYS.length > 0 ? (
              <Tab
                items={DAYS.map((day, i) => ({ label: `D${i + 1}`, value: i }))}
                value={selectedDay}
                onChange={setSelectedDay}
                size="md"
              />
            ) : (
              <div style={{ padding: "10px 4px", fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)" }}>
                날짜를 추가해 주세요
              </div>
            )}
          </div>

          {/* Day reorder + add buttons */}
          {canEdit && (
            <div style={{ flexShrink: 0, display: "flex", gap: "var(--spacing-sp60)", marginLeft: "var(--spacing-sp120)", paddingRight: "var(--spacing-sp40)" }}>
              {DAYS.length > 1 && (
                <Button variant="neutral" size="sm" iconOnly="swap"
                  onClick={handleOpenReorder}
                  title="순서 변경"
                  className="day-reorder-btn" />
              )}
              <Button variant="neutral" size="sm" iconOnly="plus"
                onClick={() => setShowAddDay(true)}
                title="날짜 추가" />
            </div>
          )}
        </div>

        {/* Day info panel — 인라인 이름 편집 또는 제목 + ··· + 추가 */}
        {current && (
          <div style={{ padding: "10px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {canEdit && editingDayIdx === toOrigIdx(selectedDay) ? (
                /* 인라인 이름 편집: 입력 + 완료 + 취소 */
                <>
                  <input
                    ref={dayNameInputRef}
                    type="text"
                    value={editDayLabel}
                    onChange={(e) => setEditDayLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editDayLabel.trim()) {
                        handleEditDayLabel(editingDayIdx, editDayLabel);
                        setEditingDayIdx(null);
                      }
                      if (e.key === "Escape") {
                        setEditDayLabel(current.label);
                        setEditingDayIdx(null);
                      }
                    }}
                    style={{
                      flex: 1, minWidth: 0,
                      padding: "8px 12px",
                      fontSize: "var(--typo-body-2-n---bold-size)",
                      fontWeight: "var(--typo-body-2-n---bold-weight)",
                      color: "var(--color-on-surface)",
                      background: "var(--color-surface-container-lowest)",
                      border: "1px solid var(--color-outline-variant)",
                      borderRadius: "var(--radius-md)",
                      outline: "none",
                    }}
                    placeholder="날짜 이름"
                  />
                  <Button variant="primary" size="xsm" iconOnly="check"
                    onClick={() => { if (editDayLabel.trim()) handleEditDayLabel(editingDayIdx, editDayLabel); setEditingDayIdx(null); }}
                    disabled={!editDayLabel.trim()}
                    style={{ flexShrink: 0 }}
                    title="저장" />
                  <Button variant="ghost-neutral" size="xsm" iconOnly="close"
                    onClick={() => { setEditDayLabel(current.label); setEditingDayIdx(null); }}
                    style={{ flexShrink: 0 }}
                    title="취소" />
                </>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button
                      type="button"
                      style={{
                        width: "100%", cursor: canEdit ? "pointer" : "default",
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: 0, border: "none", background: "none",
                        textAlign: "left", fontFamily: "inherit",
                      }}
                      onClick={canEdit ? () => setShowDayMoreMenu(true) : undefined}
                      title={canEdit ? "날짜 이름 수정 또는 삭제" : undefined}
                    >
                      <h2 style={{
                        margin: 0, fontSize: "var(--typo-body-2-n---bold-size)", fontWeight: "var(--typo-body-2-n---bold-weight)", color: "var(--color-on-surface)",
                        letterSpacing: "var(--typo-body-2-n---bold-letter-spacing)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {current.label}
                      </h2>
                      {canEdit && (
                        <Icon name="edit" size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
                      )}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sp40)", flexWrap: "wrap", marginTop: "var(--spacing-sp20)" }}>
                      {(current.date || current.stay) && (
                        <span style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)" }}>
                          {[current.date, current.stay].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {routeSummary && (
                        <>
                          {(current.date || current.stay) && <span style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-outline-variant)" }}>·</span>}
                          <span style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-primary)", fontWeight: 600 }}>
                            {routeSummary}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <Button variant="primary" size="xsm" iconLeft="plus"
                      onClick={() => setShowAddSheet(true)}
                      style={{ borderRadius: "16px", flexShrink: 0 }}>
                      일정 추가
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Main content: scrollable timeline ── */}
      <div
        onTouchStart={(e) => {
          const t = e.touches[0];
          e.currentTarget._swipeStartX = t.clientX;
          e.currentTarget._swipeStartY = t.clientY;
          e.currentTarget._swipeDecided = false;
        }}
        onTouchMove={(e) => {
          if (e.currentTarget._swipeDecided) return;
          const dx = Math.abs(e.touches[0].clientX - (e.currentTarget._swipeStartX || 0));
          const dy = Math.abs(e.touches[0].clientY - (e.currentTarget._swipeStartY || 0));
          if (dx > 15 || dy > 15) {
            e.currentTarget._swipeDecided = true;
            e.currentTarget._swipeIsHorizontal = dx > dy * 1.5;
          }
        }}
        onTouchEnd={(e) => {
          if (!e.currentTarget._swipeIsHorizontal) return;
          const dx = e.changedTouches[0].clientX - (e.currentTarget._swipeStartX || 0);
          if (Math.abs(dx) < 50) return;
          if (dx > 0 && selectedDay > 0) {
            setSelectedDay(selectedDay - 1);
          } else if (dx < 0 && selectedDay < DAYS.length - 1) {
            setSelectedDay(selectedDay + 1);
          }
        }}
        style={{ flex: 1, overflowY: "auto", padding: "12px 16px 32px", touchAction: "pan-y" }}>

        {/* Empty trip state */}
        {!current && (
          <EmptyState
            icon="calendar"
            title="아직 일정이 없습니다"
            description="날짜를 추가하고 일정을 계획해 보세요"
            actions={canEdit ? { label: "날짜 추가", variant: "primary", iconLeft: "plus", onClick: () => setShowAddDay(true) } : undefined}
          />
        )}

        {/* Timeline — flat list of all items across sections */}
        {current && (() => {
          // Flatten all section items into one list, preserving section/item indices
          const allItems = [];
          current.sections.forEach((sec, si) => {
            if (!sec.items) return;
            sec.items.filter(Boolean).forEach((item, ii) => {
              allItems.push({ item, si, ii, section: sec });
            });
          });

          if (allItems.length === 0) return (
            <EmptyState
              icon="calendar"
              title="아직 일정이 없습니다"
              description={canEdit
                ? "일정 추가 버튼을 눌러\n새로운 일정을 추가해보세요"
                : "아직 추가된 일정이 없습니다"}
              actions={canEdit ? [
                { label: "추가하기", variant: "primary", iconLeft: "plus", onClick: () => setShowAddSheet(true) },
              ] : undefined}
            />
          );

          let globalOrder = 0;
          return (
            <div>
              {allItems.map((entry, flatIdx) => {
                const { item, si, ii, section } = entry;
                const effectiveSi = (section._isExtra || item._extra) ? -1 : si;
                const resolvedLoc = getItemCoords(item, selectedDay);
                const resolvedAddress = item.detail?.address || (resolvedLoc ? resolvedLoc.label : "");
                const enrichedItem = resolvedAddress && !item.detail?.address
                  ? { ...item, detail: { ...(item.detail || {}), address: resolvedAddress, name: item.detail?.name || item.desc, category: item.detail?.category || TYPE_LABELS[item.type] || "정보" } }
                  : item;
                const isClickable = true;
                const itemOrder = resolvedLoc ? ++globalOrder : null;
                const isNow = nowItemKey === `${si}-${ii}`;
                const isLastItem = flatIdx === allItems.length - 1;

                // Previous item for TravelTimeConnector
                const prevEntry = flatIdx > 0 ? allItems[flatIdx - 1] : null;
                const prevItem = prevEntry?.item || null;
                const prevLoc = prevItem ? getItemCoords(prevItem, selectedDay) : null;

                const handleClick = () => {
                  const detail = enrichedItem.detail || {};
                  setActiveDetail({
                    ...detail,
                    name: detail.name || enrichedItem.desc || "",
                    category: detail.category || TYPE_LABELS[enrichedItem.type] || "정보",
                    _item: enrichedItem, _si: effectiveSi, _ii: ii, _di: selectedDay,
                  });
                };

                return (
                  <div key={`${si}-${ii}`}>
                    {flatIdx > 0 && (
                      <TravelTimeConnector
                        fromCoords={prevLoc?.coords}
                        toCoords={resolvedLoc?.coords}
                        fromLabel={prevItem?.detail?.address || prevLoc?.label}
                        toLabel={resolvedAddress || resolvedLoc?.label}
                      />
                    )}
                    <PlaceCard
                      item={enrichedItem}
                      order={itemOrder}
                      isNow={isNow}
                      isClickable={isClickable}
                      onClick={handleClick}
                      isLast={isLastItem}
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Auto-generated day summary */}
        {current && (() => {
          const summary = generateDaySummary(current);
          return summary ? (
            <div style={{
              marginTop: "4px", padding: "11px 14px",
              background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px)", border: "1px dashed var(--color-outline-variant)",
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
        onEdit={canEdit ? (d) => {
          const item = d._item;
          if (item) {
            setEditTarget({ item, sectionIdx: d._si, itemIdx: d._ii, dayIdx: toOrigIdx(d._di ?? selectedDay) });
          }
        } : undefined}
        onDelete={canEdit && activeDetail?._item?._custom ? handleDeleteFromDetail : undefined}
      />

      {/* Document Dialog */}
      {showDocs && <DocumentDialog onClose={() => setShowDocs(false)} tripId={isLegacy ? null : tripId} isLegacy={isLegacy} />}

      {/* Shopping Guide Dialog */}
      {showGuide && <ShoppingGuideDialog onClose={() => setShowGuide(false)} destinations={tripMeta?.destinations} />}

      {/* Day Info Dialog */}
      {dayInfoTab && current && <DayInfoDialog dayNum={current.day} tab={dayInfoTab} onClose={() => setDayInfoTab(null)} color="var(--color-primary)" />}

      {/* "추가하기" Action Sheet — 아이콘 직접 배치, 색상으로 구분 */}
      {showAddSheet && canEdit && (
        <BottomSheet onClose={() => setShowAddSheet(false)} maxHeight="auto" title="추가하기">
          <div style={{
            padding: "var(--spacing-sp80) var(--spacing-sp200) var(--spacing-sp240)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-sp40)",
          }}>
            {[
              { icon: "pin", iconColor: "var(--color-primary)", label: "장소 추가", desc: "검색해서 장소를 추가해요", onClick: () => { setShowAddSheet(false); setShowAddPlace(true); } },
              { icon: "document", iconColor: "var(--color-on-surface-variant)", label: "예약 정보 붙여넣기", desc: "확인메일, 바우처를 복붙하면 AI가 정리", onClick: () => { setShowAddSheet(false); setShowPasteInfo(true); } },
              { icon: "flash", iconColor: "var(--color-on-surface-variant)", label: "AI와 대화하며 계획하기", desc: "여행 스타일을 알려주면 AI가 일정을 제안해요", onClick: () => { setShowAddSheet(false); setEditTarget({ dayIdx: toOrigIdx(selectedDay), sectionIdx: -1, itemIdx: null, item: null }); setOpenAiTab(true); } },
            ].map((action, i) => (
              <div
                key={i}
                onClick={action.onClick}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--spacing-sp120)",
                  minHeight: "48px",
                  padding: "var(--spacing-sp120) var(--spacing-sp40)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  transition: "background var(--transition-fast)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-surface-container-lowest)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <Icon name={action.icon} size={20} style={{
                  flexShrink: 0,
                  marginTop: "2px",
                  color: action.iconColor,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: "var(--typo-label-2-medium-size)",
                    fontWeight: 600,
                    color: "var(--color-on-surface)",
                  }}>{action.label}</p>
                  <p style={{
                    margin: "var(--spacing-sp20) 0 0",
                    fontSize: "var(--typo-caption-2-regular-size)",
                    color: "var(--color-on-surface-variant2)",
                    lineHeight: 1.4,
                  }}>{action.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Edit/Add Item Dialog (only if can edit) */}
      {editTarget && canEdit && (
        <EditItemDialog
          item={editTarget.item}
          sectionIdx={editTarget.sectionIdx}
          itemIdx={editTarget.itemIdx}
          dayIdx={editTarget.dayIdx}
          onSave={handleSaveItem}
          onDelete={editTarget.item?._custom ? handleDeleteItem : null}
          onClose={() => { setEditTarget(null); setOpenAiTab(false); }}
          color="var(--color-primary)"
          tripId={isLegacy ? null : tripId}
          currentDay={current}
          onBulkImport={handleBulkImport}
          initialTab={openAiTab ? 2 : 0}
          aiOnly={openAiTab}
        />
      )}

      {/* Add Place Page (full-screen) */}
      <AddPlacePage
        open={showAddPlace}
        onClose={() => setShowAddPlace(false)}
        onSave={(item) => handleSaveItem(item, toOrigIdx(selectedDay), -1, null)}
        dayIdx={toOrigIdx(selectedDay)}
      />

      {/* Paste Info Page (full-screen) */}
      <PasteInfoPage
        open={showPasteInfo}
        onClose={() => setShowPasteInfo(false)}
        onImport={(items) => handleBulkImport(items, toOrigIdx(selectedDay))}
        context={current ? `Day ${current.day} ${current.label || ''}` : ''}
      />

      {/* Floating Map Button */}
      <Button variant="primary" size="xlg" iconOnly="map"
        onClick={() => setShowMap(true)}
        title="여행 지도"
        style={{
          position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", right: "24px", zIndex: "var(--z-fab)",
          width: "52px", height: "52px",
          boxShadow: "var(--shadow-strong)",
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

      {/* 날짜 ··· 메뉴: 이름 수정(인라인) / 이 날짜 삭제 */}
      {showDayMoreMenu && current && canEdit && (
        <BottomSheet onClose={() => setShowDayMoreMenu(false)} maxHeight="auto" zIndex="var(--z-confirm)" title={current.label}>
          <div style={{ padding: "8px 24px 24px" }}>
            <button
              type="button"
              onClick={() => { setShowDayMoreMenu(false); setEditingDayIdx(toOrigIdx(selectedDay)); setEditDayLabel(current.label); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "12px",
                padding: "14px 0", border: "none", background: "none", cursor: "pointer",
                fontSize: "var(--typo-body-2-n---regular-size)", color: "var(--color-on-surface)",
                fontFamily: "inherit", textAlign: "left",
              }}
            >
              <Icon name="edit" size={20} style={{ flexShrink: 0, color: "var(--color-on-surface-variant)" }} />
              이름 수정
            </button>
            {toOrigIdx(selectedDay) >= baseLen && (
              <button
                type="button"
                onClick={() => { setShowDayMoreMenu(false); handleDeleteDay(toOrigIdx(selectedDay)); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "12px",
                  padding: "14px 0", border: "none", background: "none", cursor: "pointer",
                  fontSize: "var(--typo-body-2-n---regular-size)", color: "var(--color-error)",
                  fontFamily: "inherit", textAlign: "left",
                }}
              >
                <Icon name="trash" size={20} style={{ flexShrink: 0, color: "var(--color-error)" }} />
                이 날짜 삭제
              </button>
            )}
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
        <BottomSheet onClose={() => setShowShareSheet(false)} maxHeight="70vh" zIndex="var(--z-confirm)" title="공유 및 초대">
          <div style={{ padding: "8px 24px 24px" }}>

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
                  background: "var(--color-surface-container-lowest)",
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
                              background: "var(--color-success)", border: "1.5px solid var(--color-surface-container-lowest)",
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
                              color: "var(--color-success)",
                            }}>온라인</span>
                          )}
                          <span style={{
                            fontSize: "var(--typo-caption-2-regular-size)",
                            color: "var(--color-on-surface-variant2)",
                            padding: "2px 6px", borderRadius: "4px",
                            background: m.role === "owner" ? "var(--color-primary-container)" : "var(--color-surface-container-lowest)",
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
        <BottomSheet onClose={() => setShowReorder(false)} maxHeight="70vh" zIndex="var(--z-confirm)" title="Day 순서 변경">
          <div style={{ padding: "8px 24px 24px" }}>
            <div style={{
              display: "flex", justifyContent: "flex-end",
              marginBottom: "12px",
            }}>
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
                        background: i === 0 ? "var(--color-surface-dim)" : "var(--color-surface-container-lowest)",
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
                        background: i === reorderList.length - 1 ? "var(--color-surface-dim)" : "var(--color-surface-container-lowest)",
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

      {/* More Menu */}
      {showMoreMenu && (
        <BottomSheet onClose={() => setShowMoreMenu(false)} maxHeight="auto" zIndex="var(--z-confirm)">
          <div style={{ padding: "8px 20px 20px" }}>
            {[
              { icon: "compass", label: "여행 가이드", onClick: () => { setShowMoreMenu(false); setShowGuide(true); } },
              { icon: "file", label: "여행 서류", onClick: () => { setShowMoreMenu(false); setShowDocs(true); } },
              ...(!isLegacy ? [{ icon: "persons", label: `멤버 (${tripMeta?.members?.length || 0}명)`, onClick: () => { setShowMoreMenu(false); setShowShareSheet(true); } }] : []),
            ].map((menuItem, idx) => (
              <button
                key={idx}
                onClick={menuItem.onClick}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  width: "100%", padding: "14px 4px",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: idx < 2 ? "1px solid var(--color-surface-dim)" : "none",
                  textAlign: "left",
                }}
              >
                <Icon name={menuItem.icon} size={18} style={{ color: "var(--color-on-surface-variant)", opacity: 0.7 }} />
                <span style={{
                  fontSize: "var(--typo-label-2-medium-size)",
                  fontWeight: "var(--typo-label-2-medium-weight)",
                  color: "var(--color-on-surface)",
                }}>
                  {menuItem.label}
                </span>
              </button>
            ))}
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
