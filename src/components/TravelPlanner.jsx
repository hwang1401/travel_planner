import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePresence } from "../hooks/usePresence";

/* Data imports */
import { mergeData, generateDaySummary } from "../utils/scheduleUtils";
import { TYPE_CONFIG } from "../data/guides";
import { COLOR, SPACING, RADIUS, TYPE_LABELS, getTypeConfig } from "../styles/tokens";
/* Service imports */
import { getTrip, updateTrip, getShareCode, formatDateRange, getTripDuration } from "../services/tripService";
import { loadSchedule, saveSchedule, subscribeToSchedule, createDebouncedSave } from "../services/scheduleService";
import { getMyRole, getShareLink } from "../services/memberService";
import { getRegionsFromItems, getRegionCodesFromDestinations, getRegionDisplayName, upsertPlaceToRAG } from "../services/ragService";

/* Common component imports */
import Icon from "./common/Icon";
import Button from "./common/Button";
import BottomSheet from "./common/BottomSheet";
import Field from "./common/Field";
import Tab from "./common/Tab";
import ConfirmDialog from "./common/ConfirmDialog";
import Toast from "./common/Toast";
import Checkbox from "./common/Checkbox";
import EmptyState from "./common/EmptyState";
import ScheduleSkeleton from "./common/ScheduleSkeleton";
import IconContainer from "./common/IconContainer";
import PullToRefresh from "./common/PullToRefresh";

/* Dialog imports */
import DetailDialog from "./dialogs/DetailDialog";
import AddRAGPlaceSheet from "./dialogs/AddRAGPlaceSheet";
import DocumentDialog from "./dialogs/DocumentDialog";
import ShoppingGuideDialog from "./dialogs/ShoppingGuideDialog";
import AIChatDialog from "./dialogs/AIChatDialog";
import TimePickerDialog from "./common/TimePickerDialog";
import AddDayDialog from "./dialogs/AddDayDialog";
import DuplicateReviewDialog from "./dialogs/DuplicateReviewDialog";

/* Map imports */
import FullMapDialog from "./map/FullMapDialog";
import MapButton from "./map/MapButton";
import { getItemCoords } from "../data/locations";

/* Schedule components */
import PlaceCard from "./schedule/PlaceCard";
import TravelTimeConnector from "./schedule/TravelTimeConnector";
import AddPlacePage from "./schedule/AddPlacePage";
import PasteInfoPage from "./schedule/PasteInfoPage";
import { getDistance, getTravelInfo } from "../utils/distance";
import { getTodayDayIndex, getCurrentItemIndex, isTodayInTrip } from "../utils/today";

/**
 * 아이템 배열에서 target과 같은 아이템의 인덱스를 찾음.
 * _id가 있으면 _id 우선, 없으면 time+desc fallback.
 */
function findItemIndex(items, target) {
  if (!target || !items) return -1;
  if (target._id) {
    const idx = items.findIndex((it) => it && it._id === target._id);
    if (idx >= 0) return idx;
  }
  return items.findIndex((it) =>
    it && it.time === target.time && it.desc === target.desc
  );
}


/**
 * 기존 데이터에 _id가 없는 아이템에 UUID 부여 (로드 시 마이그레이션).
 */
function ensureItemIds(data) {
  if (!data) return data;
  const next = { ...data };

  if (next._extraDays) {
    next._extraDays = next._extraDays.map((day) => {
      if (!day?.sections) return day;
      return {
        ...day,
        sections: day.sections.map((sec) => ({
          ...sec,
          items: (sec.items || []).map((it) => {
            if (!it) return it;
            let item = it;
            if (!item._id) item = { ...item, _id: crypto.randomUUID() };
            // _extraDays.sections 내 아이템은 _extra 플래그가 있으면 안 됨
            // (_extra는 extraItems 전용 — 잘못 설정되면 수정이 저장 안 되는 버그 발생)
            if (item._extra) {
              if (item === it) item = { ...item };
              delete item._extra;
            }
            return item;
          }),
        })),
      };
    });
  }

  const dayKeys = Object.keys(next).filter((k) => !k.startsWith("_") && !isNaN(Number(k)));
  for (const dk of dayKeys) {
    const dayData = next[dk];
    if (!dayData) continue;

    if (dayData.extraItems) {
      next[dk] = next[dk] === dayData ? { ...dayData } : next[dk];
      next[dk].extraItems = dayData.extraItems.map((it) =>
        it && !it._id ? { ...it, _id: crypto.randomUUID() } : it
      );
    }

    if (dayData.sections) {
      next[dk] = next[dk] === dayData ? { ...dayData } : next[dk];
      next[dk].sections = { ...dayData.sections };
      for (const sk of Object.keys(dayData.sections || {})) {
        const sec = dayData.sections[sk];
        if (!sec?.items) continue;
        next[dk].sections[sk] = {
          ...sec,
          items: sec.items.map((it) =>
            it && !it._id ? { ...it, _id: crypto.randomUUID() } : it
          ),
        };
      }
    }
  }

  return next;
}

/**
 * 아이템 키 생성: _id 우선, time|desc fallback (중복 판별·sanitize 등에서 통일 사용).
 */
function getItemKey(item) {
  return item._id || `${item.time}|${item.desc}`;
}

/**
 * Day에서 특정 아이템을 identity 기반으로 삭제하는 통합 헬퍼.
 * extraItems → sections overlay → _extraDays 순으로 탐색하며, 1곳에서 삭제되면 중단.
 * next 객체를 **직접 변이**하므로 호출 전 얕은 복사 필수.
 *
 * @param {object} next - customData의 얕은 복사본
 * @param {object} prev - 이전 customData (shallow-copy guard 비교용)
 * @param {number} dayIdx - 원본 Day 인덱스
 * @param {object} target - 삭제할 아이템 (findItemIndex로 매칭)
 * @param {number} baseLen - base days 길이 (항상 0)
 * @returns {boolean} 삭제 성공 여부
 */
function removeItemFromDay(next, prev, dayIdx, target, baseLen) {
  if (!target) return false;
  let deleted = false;

  // 1) extraItems에서 삭제
  if (next[dayIdx]?.extraItems) {
    next[dayIdx] = next[dayIdx] === prev[dayIdx] ? { ...next[dayIdx] } : next[dayIdx];
    const idx = findItemIndex(next[dayIdx].extraItems, target);
    if (idx >= 0) {
      next[dayIdx].extraItems = [...next[dayIdx].extraItems];
      next[dayIdx].extraItems.splice(idx, 1);
      deleted = true;
    }
    if (next[dayIdx].extraItems?.length === 0) delete next[dayIdx].extraItems;
  }

  // 2) sections overlay에서 삭제 — extraItems에서 이미 삭제했으면 스킵
  if (!deleted && next[dayIdx]?.sections) {
    next[dayIdx] = next[dayIdx] === prev[dayIdx] ? { ...next[dayIdx] } : next[dayIdx];
    const secKeys = Object.keys(next[dayIdx].sections || {});
    for (const sk of secKeys) {
      if (deleted) break;
      const sec = next[dayIdx].sections[sk];
      if (!sec?.items) continue;
      const idx = findItemIndex(sec.items, target);
      if (idx >= 0) {
        next[dayIdx].sections = next[dayIdx].sections === prev[dayIdx]?.sections ? { ...next[dayIdx].sections } : next[dayIdx].sections;
        next[dayIdx].sections[sk] = { ...sec, items: [...sec.items] };
        next[dayIdx].sections[sk].items.splice(idx, 1);
        deleted = true;
      }
    }
  }

  // 3) _extraDays에서도 삭제 — 위에서 이미 삭제했으면 스킵
  //    baseLen > 0이면 extraIdx = dayIdx - baseLen, baseLen === 0이면 extraIdx = dayIdx
  const extraIdx = dayIdx - baseLen;
  if (!deleted && extraIdx >= 0 && next._extraDays?.[extraIdx]) {
    const ed = next._extraDays[extraIdx];
    const edSections = ed.sections || [];
    let edChanged = false;
    const newEdSections = edSections.map((sec) => {
      if (deleted || !sec?.items) return sec;
      const idx = findItemIndex(sec.items, target);
      if (idx >= 0) {
        edChanged = true;
        deleted = true;
        const newItems = [...sec.items];
        newItems.splice(idx, 1);
        return { ...sec, items: newItems };
      }
      return sec;
    });
    if (edChanged) {
      next._extraDays = Array.isArray(next._extraDays) && next._extraDays !== prev._extraDays
        ? next._extraDays : [...(next._extraDays || [])];
      next._extraDays[extraIdx] = { ...ed, sections: newEdSections };
    }
  }

  return deleted;
}

/**
 * sanitizeScheduleData: overlay와 extraItems 간 중복 아이템 제거.
 * 편집 저장 시 merge된 _extra 아이템이 overlay sections에 흡수된 경우를 정리.
 */
function sanitizeScheduleData(data, baseLen = 0) {
  if (!data) return data;
  const next = { ...data };
  let changed = false;

  const dayKeys = Object.keys(next).filter((k) => !k.startsWith("_") && !isNaN(Number(k)));

  for (const dk of dayKeys) {
    const dayData = next[dk];
    if (!dayData) continue;

    const extras = dayData.extraItems;
    if (!extras || extras.length === 0 || !dayData.sections) continue;

    const extraSet = new Set(extras.map(getItemKey));
    const secKeys = Object.keys(dayData.sections);
    for (const sk of secKeys) {
      const sec = dayData.sections[sk];
      if (!sec?.items) continue;
      const cleaned = sec.items.filter((it) => {
        if (!it) return false;
        return !it._extra && !extraSet.has(getItemKey(it));
      });
      if (cleaned.length !== sec.items.length) {
        if (!changed) changed = true;
        next[dk] = next[dk] === dayData ? { ...dayData } : next[dk];
        next[dk].sections = next[dk].sections === dayData.sections ? { ...dayData.sections } : next[dk].sections;
        next[dk].sections[sk] = { ...sec, items: cleaned };
      }
    }
  }

  if (next._extraDays) {
    next._extraDays = next._extraDays.map((day, i) => {
      if (!day?.sections) return day;
      const dayIdx = baseLen + i; // CR-2 fix: 올바른 overlay 인덱스
      const dayData = next[dayIdx];
      const extras = dayData?.extraItems;
      if (!extras || extras.length === 0) return day;

      const extraSet = new Set(extras.map(getItemKey));
      let dayChanged = false;
      const newSections = day.sections.map((sec) => {
        if (!sec?.items) return sec;
        const cleaned = sec.items.filter((it) => {
          if (!it) return false;
          return !it._extra && !extraSet.has(getItemKey(it));
        });
        if (cleaned.length !== sec.items.length) {
          dayChanged = true;
          return { ...sec, items: cleaned };
        }
        return sec;
      });
      return dayChanged ? { ...day, sections: newSections } : day;
    });
  }

  if (changed) console.log("[TravelPlanner] Sanitized duplicate items from schedule data");
  return next;
}

/**
 * Day 단위 병합: 로컬에서 수정한 Day(dirty)는 보존, 나머지는 remote로 갱신.
 * 동시 편집 시 다른 사용자의 변경을 수신하면서 로컬 미저장 변경을 보호.
 */
function mergeDayLevel(local, remote, dirtyDays, dirtyMeta) {
  // Day 수가 다르고 dirty day가 있으면 인덱스 불일치 위험 → 로컬 유지
  const localExtraLen = local._extraDays?.length || 0;
  const remoteExtraLen = remote._extraDays?.length || 0;
  if (dirtyDays.size > 0 && localExtraLen !== remoteExtraLen && !dirtyMeta) {
    return local;
  }

  const merged = { ...remote }; // remote 기반으로 시작

  // 1) dirty한 numeric day key는 로컬 값 유지
  for (const dayIdx of dirtyDays) {
    if (local[dayIdx] !== undefined) {
      merged[dayIdx] = local[dayIdx];
    }
  }

  // 2) meta key: dirtyMeta이면 로컬 유지, 아니면 remote 유지 (이미 spread됨)
  if (dirtyMeta) {
    merged._dayOrder = local._dayOrder;
    merged._extraDays = local._extraDays;
    merged._dayOverrides = local._dayOverrides;
    merged._standalone = local._standalone;
    // undefined인 키는 정리
    if (merged._dayOrder === undefined) delete merged._dayOrder;
    if (merged._dayOverrides === undefined) delete merged._dayOverrides;
  }

  return merged;
}

export default function TravelPlanner() {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const { user } = useAuth();

  /* ── Trip metadata (Supabase trips only) ── */
  const [tripMeta, setTripMeta] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [tripLoading, setTripLoading] = useState(true);

  /* ── Schedule data ── */
  const [customData, setCustomData] = useState({});
  const [scheduleLoading, setScheduleLoading] = useState(true);

  /* ── UI state ── */
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeDetail, setActiveDetail] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  // editTarget 제거됨 (항상 null이었으므로 dead code — HI-4)
  const [openAiTab, setOpenAiTab] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [longPressSelection, setLongPressSelection] = useState(new Set());
  const [showLongPressMoveSheet, setShowLongPressMoveSheet] = useState(false);
  const [timeEditItem, setTimeEditItem] = useState(null); // { item, si, ii, dayIdx }
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
  const [addNearbyPlace, setAddNearbyPlace] = useState(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [showPasteInfo, setShowPasteInfo] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedBulkKeys, setSelectedBulkKeys] = useState(() => new Set());
  /** 일정 추가 직후 새 지역이 있으면 "여행지에 추가할까요?" 시트. 여러 개일 때 선택 가능 */
  const [addDestinationSheet, setAddDestinationSheet] = useState(null);
  const [addDestinationSelected, setAddDestinationSelected] = useState(() => new Set());
  const [duplicateReview, setDuplicateReview] = useState(null);
  const todayInitDone = useRef(false);

  /* ── Debounced save ref ── */
  const debouncedSaveRef = useRef(null);
  const lastSaveTimestampRef = useRef(0);
  const lastSavedVersionRef = useRef(0);
  /* 일괄 삭제 확인 시 사용할 payload (클로저/배치로 인한 selectedBulkKeys 손실 방지) */
  const bulkDeletePayloadRef = useRef(null);
  /* 일괄 삭제 직후 즉시 저장할 데이터 (디바운서/리얼타임 덮어쓰기 방지) */
  const bulkDeleteNextRef = useRef(null);
  /* 삭제 복구용: 스택 기반 undo (연속 삭제 시 마지막 복구가 이전 삭제도 포함) */
  const deleteUndoRef = useRef([]);
  /* ── Dirty Day 추적: 동시 편집 시 Day 단위 병합에 사용 ── */
  const dirtyDaysRef = useRef(new Set());    // 수정된 day 원본 인덱스
  const dirtyMetaRef = useRef(false);         // _dayOrder, _extraDays 구조, _dayOverrides 수정 여부
  const dirtyGenRef = useRef(0);              // 세대 카운터 (저장 완료 시 조기 클리어 방지)
  const lastReceivedRtVersionRef = useRef(0); // 마지막 수신 realtime 버전 (순서 역전 방지용)
  const clearDirtyTimerRef = useRef(null);    // dirty 추적 지연 해제 타이머

  /* ── Presence: who is online ── */
  const presenceUser = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    };
  }, [user]);
  const { onlineUsers } = usePresence(tripId, presenceUser);

  /* ── Permissions ── */
  const canEdit = myRole === "owner" || myRole === "editor";

  /* ── Load trip metadata + schedule from Supabase ── */
  useEffect(() => {
    if (!tripId) return;

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

        // Auto-migrate: ensure _standalone flag
        const schedData = schedule.data || {};
        if (!schedData._standalone) schedData._standalone = true;
        const loadBaseLen = 0;
        setCustomData(sanitizeScheduleData(ensureItemIds(schedData), loadBaseLen));
        lastSavedVersionRef.current = schedule.version ?? 0;
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
  }, [tripId]);

  /* ── Pull-to-refresh: 일정 다시 불러오기 ── */
  const refreshSchedule = useCallback(async () => {
    if (!tripId) return;
    try {
      const schedule = await loadSchedule(tripId);
      const schedData = schedule?.data || {};
      if (!schedData._standalone) schedData._standalone = true;
      const refreshBaseLen = 0;
      setCustomData(sanitizeScheduleData(ensureItemIds(schedData), refreshBaseLen));
    } catch (err) {
      console.error("[TravelPlanner] Refresh error:", err);
    }
  }, [tripId]);

  /* ── Dirty Day 추적 헬퍼 (debounced save 콜백에서 사용하므로 위에 정의) ── */
  const clearDirtyTracking = useCallback(() => {
    dirtyDaysRef.current = new Set();
    dirtyMetaRef.current = false;
    if (clearDirtyTimerRef.current) {
      clearTimeout(clearDirtyTimerRef.current);
      clearDirtyTimerRef.current = null;
    }
  }, []);

  /** 저장 완료 후 dirty 추적을 일정 시간 유지한 뒤 해제 (다른 사용자 realtime이 도착할 여유) */
  const scheduleClearDirtyTracking = useCallback((saveGen) => {
    if (clearDirtyTimerRef.current) clearTimeout(clearDirtyTimerRef.current);
    clearDirtyTimerRef.current = setTimeout(() => {
      clearDirtyTimerRef.current = null;
      if (dirtyGenRef.current === saveGen) clearDirtyTracking();
    }, 3000);
  }, [clearDirtyTracking]);

  /* ── Setup debounced save for Supabase trips ── */
  useEffect(() => {
    if (!tripId) return;
    const ds = createDebouncedSave(tripId, 800, (version) => {
      lastSavedVersionRef.current = version;
      // 저장 완료 시점의 dirtyGen을 캡처하여 지연 해제 예약
      scheduleClearDirtyTracking(dirtyGenRef.current);
    });
    debouncedSaveRef.current = ds;
    return () => { ds.cancel(); };
  }, [tripId, scheduleClearDirtyTracking]);

  /* ── Realtime subscription for Supabase trips ── */
  useEffect(() => {
    if (!tripId) return;

    const unsubscribe = subscribeToSchedule(tripId, (payload) => {
      // 절대 본인 저장분을 realtime으로 덮어쓰지 않음
      if (payload.updatedBy === user?.id) return;

      const rtVersion = payload.version ?? 0;

      // 이미 수신한 버전 이하의 이벤트는 무시 (순서 역전 방어)
      if (rtVersion > 0 && rtVersion <= lastReceivedRtVersionRef.current) return;
      if (rtVersion > 0) lastReceivedRtVersionRef.current = rtVersion;

      const rtData = payload.data || {};
      if (!rtData._standalone) rtData._standalone = true;
      const rtBaseLen = 0;
      const sanitizedRemote = sanitizeScheduleData(ensureItemIds(rtData), rtBaseLen);

      // 로컬에 수정사항 없으면 기존처럼 전체 교체 (fast path)
      if (dirtyDaysRef.current.size === 0 && !dirtyMetaRef.current) {
        setCustomData(sanitizedRemote);
        return;
      }

      // Day 단위 병합: dirty day는 로컬 유지, 나머지는 remote 수용
      setCustomData((localData) =>
        mergeDayLevel(localData, sanitizedRemote, dirtyDaysRef.current, dirtyMetaRef.current)
      );
    });

    return unsubscribe;
  }, [tripId, user?.id]);

  /* ── Persist schedule data ── */
  const persistSchedule = useCallback((newData) => {
    if (debouncedSaveRef.current) {
      lastSaveTimestampRef.current = Date.now();
      debouncedSaveRef.current.save(newData);
    }
  }, []);

  /* ── Save-aware setCustomData ── */
  const updateCustomData = useCallback((updater) => {
    setCustomData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // _extraDays 참조가 바뀌었으면 자동으로 meta dirty 표시
      // (standalone 여행에서 아이템 이동/삭제/수정 시 _extraDays 내부를 수정하는데
      //  markMetaDirty()를 빠뜨리기 쉬움 → 여기서 자동 감지)
      if (next._extraDays !== prev._extraDays) {
        dirtyMetaRef.current = true;
        dirtyGenRef.current++;
      }
      persistSchedule(next);
      return next;
    });
  }, [persistSchedule]);

  /* ── Dirty Day 추적 헬퍼 ── */
  const markDayDirty = useCallback((origDayIdx) => {
    dirtyDaysRef.current = new Set(dirtyDaysRef.current).add(origDayIdx);
    dirtyGenRef.current++;
  }, []);

  const markMetaDirty = useCallback(() => {
    dirtyMetaRef.current = true;
    dirtyGenRef.current++;
  }, []);

  /** 즉시 저장 헬퍼: debounce를 취소하고 saveSchedule을 직접 호출 */
  const immediateSave = useCallback((snapshot) => {
    if (!tripId || !snapshot) return;
    lastSaveTimestampRef.current = Date.now();
    debouncedSaveRef.current?.cancel?.();
    const saveGen = dirtyGenRef.current;
    saveSchedule(tripId, snapshot)
      .then((version) => {
        if (version > 0) lastSavedVersionRef.current = version;
        if (dirtyGenRef.current === saveGen) scheduleClearDirtyTracking(saveGen);
      })
      .catch((err) => {
        console.error("[TravelPlanner] Save failed:", err);
        const errMsg = err?.message || err?.code || String(err);
        setToast({ message: `저장 실패: ${errMsg}`, icon: "info" });
      });
  }, [tripId, scheduleClearDirtyTracking]);

  /* ── 삭제 복구: 스택 최상위 스냅샷으로 state 복원 후 재저장 ── */
  const handleDeleteUndo = useCallback(() => {
    const stack = deleteUndoRef.current;
    if (!stack || stack.length === 0) return;
    const payload = stack[stack.length - 1];
    deleteUndoRef.current = stack.slice(0, -1); // pop
    const { snapshot } = payload;

    // 복원 전: 모든 day + meta를 dirty 마킹하여 realtime 덮어쓰기 방지
    dirtyMetaRef.current = true;
    const numDays = (snapshot._extraDays?.length || 0) +
      Object.keys(snapshot).filter((k) => !k.startsWith("_") && !isNaN(Number(k))).length;
    for (let i = 0; i < numDays; i++) dirtyDaysRef.current.add(i);
    dirtyGenRef.current++;

    updateCustomData(() => snapshot);
    immediateSave(snapshot);
    setToast({ message: "복구했어요", icon: "check" });
  }, [updateCustomData, immediateSave]);

  const baseLen = 0;

  /* ── Merge data ── */
  const DAYS = useMemo(() => {
    return mergeData([], customData);
  }, [customData]);

  /* ── 새 일정 생성 시 Day 1 자동 생성: standalone이고 일정이 비어 있으면 Day 1 하나 생성 ── */
  const defaultDay1 = useMemo(() => ({
    day: 1,
    date: "Day 1",
    label: "Day 1",
    color: "var(--color-primary)",
    icon: "pin",
    stay: "",
    booked: false,
    sections: [
      { title: "오전", items: [] },
      { title: "오후", items: [] },
      { title: "저녁", items: [] },
    ],
    notes: "",
    _custom: true,
  }), []);
  useEffect(() => {
    if (scheduleLoading) return;
    const extra = customData._extraDays;
    if (extra && extra.length > 0) return;
    updateCustomData((prev) => ({ ...prev, _standalone: true, _extraDays: [defaultDay1] }));
  }, [scheduleLoading, customData._extraDays, updateCustomData, defaultDay1]);

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

  /* ── Current day items (flat list with si, ii) for bulk delete and detail nav ── */
  const currentDayItems = useMemo(() => {
    if (!current?.sections) return [];
    const list = [];
    current.sections.forEach((sec, si) => {
      (sec.items || []).filter(Boolean).forEach((item, ii) => {
        list.push({ item, si, ii, section: sec });
      });
    });
    return list;
  }, [current]);

  /* ── Detail payloads for current day (for modal prev/next) ── */
  const allDetailPayloads = useMemo(() => {
    return currentDayItems.map(({ item, si, ii, section }) => {
      // _extra 아이템은 extraItems에 저장되므로 sectionIdx를 -1로 설정
      const effectiveSi = item._extra ? -1 : si;
      const resolvedLoc = getItemCoords(item, selectedDay);
      // item에 lat/lon이 이미 있으면 getItemCoords의 label은 name/desc (주소 아님) → 주소 fallback으로 사용 금지
      const hasOwnCoords = item.detail?.lat != null && item.detail?.lon != null;
      const resolvedAddress = item.detail?.address || (!hasOwnCoords && resolvedLoc ? resolvedLoc.label : "");
      const enrichedItem = resolvedAddress && !item.detail?.address
        ? { ...item, detail: { ...(item.detail || {}), address: resolvedAddress, name: item.detail?.name || item.desc, category: item.detail?.category || TYPE_LABELS[item.type] || "정보" } }
        : item;
      const detail = enrichedItem.detail || {};
      return {
        ...detail,
        name: detail.name || enrichedItem.desc || "",
        category: detail.category || TYPE_LABELS[enrichedItem.type] || "정보",
        timetable: detail.timetable ?? enrichedItem.detail?.timetable,
        image: detail.image ?? enrichedItem.detail?.image,
        images: detail.images ?? enrichedItem.detail?.images,
        _item: enrichedItem,
        _si: effectiveSi,
        _ii: ii,
        _di: selectedDay,
      };
    });
  }, [currentDayItems, selectedDay]);

  const currentDetailIndex = (() => {
    if (activeDetail == null || allDetailPayloads.length === 0) return -1;
    const explicit = activeDetail._index;
    if (typeof explicit === "number" && explicit >= 0 && explicit < allDetailPayloads.length) return explicit;
    return allDetailPayloads.findIndex((p) => p._si === activeDetail._si && p._ii === activeDetail._ii && p._di === activeDetail._di);
  })();

  const onDetailNavigateToIndex = useCallback((index) => {
    if (index >= 0 && index < allDetailPayloads.length) {
      setActiveDetail({ ...allDetailPayloads[index], _index: index });
    }
  }, [allDetailPayloads]);

  /** RAG place → schedule item for 일정추가 */
  const ragPlaceToItem = useCallback((place) => ({
    _id: crypto.randomUUID(),
    desc: place.name_ko || "",
    type: place.type || "info",
    time: "12:00",
    detail: {
      name: place.name_ko,
      address: place.address,
      lat: place.lat,
      lon: place.lon,
      image: place.image_url,
      placeId: place.google_place_id,
    },
    _custom: true,
  }), []);

  /** First section index that has an item of this type, or -1 (extraItems) */
  const sectionIdxForType = useCallback((day, type) => {
    if (!day?.sections) return -1;
    for (let si = 0; si < day.sections.length; si++) {
      const items = day.sections[si]?.items || [];
      if (items.some((it) => it?.type === type)) return si;
    }
    return -1;
  }, []);

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
    return tripMeta?.name || "여행 일정";
  }, [tripMeta]);

  const tripSubtitle = useMemo(() => {
    if (!tripMeta) return "";
    return formatDateRange(tripMeta);
  }, [tripMeta]);

  /* ── Display day number and date (order + trip dates) ── */
  const displayDayInfo = useMemo(() => {
    const DAY_WEEK = ["일", "월", "화", "수", "목", "금", "토"];
    const formatMd = (date) => {
      const m = date.getMonth() + 1;
      const d_ = date.getDate();
      const w = DAY_WEEK[date.getDay()];
      return `${m}/${d_} (${w})`;
    };
    return DAYS.map((day, i) => {
      const displayDayNumber = i + 1;
      let displayDate = day.date;
      if (tripMeta?.startDate) {
        const start = new Date(tripMeta.startDate);
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        displayDate = formatMd(d);
      }
      return { displayDayNumber, displayDate };
    });
  }, [DAYS, tripMeta?.startDate]);

  /* ── Handlers ── */
  const handleAddDay = useCallback((labelOrEmpty) => {
    const labelTrimmed = (labelOrEmpty || "").trim();
    const nextDayNum = DAYS.length === 0 ? 1 : Math.max(...DAYS.map((d) => d.day), 0) + 1;
    const displayLabel = labelTrimmed || `Day ${nextDayNum}`;

    let nextSnapshot = null;
    markMetaDirty();
    updateCustomData((prev) => {
      const next = { ...prev };
      const existingExtra = next._extraDays || [];
      const newDay = {
        day: nextDayNum,
        date: `Day ${nextDayNum}`,
        label: displayLabel,
        color: "var(--color-primary)",
        icon: "pin",
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
      next._extraDays = [...existingExtra, newDay];
      delete next._dayOrder;
      nextSnapshot = { ...next };
      return next;
    });

    // 즉시 저장
    immediateSave(nextSnapshot);

    setShowAddDay(false);
    setToast({ message: `Day ${nextDayNum} 추가 완료`, icon: "check" });
    const prevExtraLen = customData._extraDays?.length ?? 0;
    setTimeout(() => setSelectedDay(baseLen + prevExtraLen), 50);
  }, [DAYS, baseLen, customData._extraDays?.length, updateCustomData, immediateSave]);

  const handleEditDayLabel = useCallback((dayIdx, newLabel) => {
    markMetaDirty();
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
    if (DAYS.length <= 1) {
      setToast({ message: "마지막 날짜는 삭제할 수 없어요. 최소 1일 이상 유지해 주세요.", icon: "info" });
      return;
    }
    setConfirmDialog({
      title: "날짜 삭제",
      message: "이 날짜와 포함된 모든 일정이 삭제됩니다.\n정말 삭제하시겠습니까?",
      confirmLabel: "삭제",
      onConfirm: () => {
        let nextSnapshot = null;
        markMetaDirty();
        updateCustomData((prev) => {
          deleteUndoRef.current = [...deleteUndoRef.current, { snapshot: prev }];

          const next = { ...prev };
          const extraIdx = dayIdx - baseLen;
          const totalDaysBefore = baseLen + (prev._extraDays?.length || 0);

          // 1) _extraDays에서 해당 Day 제거
          if (next._extraDays) {
            next._extraDays = next._extraDays.filter((_, i) => i !== extraIdx);
            next._extraDays = next._extraDays.map((d, i) => ({
              ...d, day: baseLen + i + 1,
            }));
          }

          // 2) 숫자 키 overlay 정리: 삭제된 Day의 overlay 제거 + 뒤쪽 인덱스 시프트
          delete next[dayIdx];
          for (let i = dayIdx + 1; i < totalDaysBefore; i++) {
            if (next[i] !== undefined) {
              next[i - 1] = next[i];
              delete next[i];
            }
          }
          delete next[totalDaysBefore - 1];

          // 3) _dayOverrides 시프트
          if (next._dayOverrides) {
            const newOverrides = {};
            for (const [k, v] of Object.entries(next._dayOverrides)) {
              const ki = Number(k);
              if (ki === dayIdx) continue;
              if (ki > dayIdx) newOverrides[ki - 1] = v;
              else newOverrides[ki] = v;
            }
            next._dayOverrides = Object.keys(newOverrides).length > 0 ? newOverrides : undefined;
            if (!next._dayOverrides) delete next._dayOverrides;
          }

          // _dayOrder에서 삭제된 dayIdx 제거 + 나머지 인덱스 시프트
          if (next._dayOrder) {
            next._dayOrder = next._dayOrder
              .filter((idx) => idx !== dayIdx)
              .map((idx) => (idx > dayIdx ? idx - 1 : idx));
            // 시프트 결과가 기본 순서와 같으면 제거
            const isDefault = next._dayOrder.every((v, i) => v === i);
            if (isDefault || next._dayOrder.length === 0) delete next._dayOrder;
          }
          const result = { ...next };
          nextSnapshot = result;
          return result;
        });

        // 즉시 저장
        immediateSave(nextSnapshot);

        setSelectedDay((prev) => Math.max(0, prev - 1));
        setConfirmDialog(null);
        setToast({
          message: "날짜가 삭제되었습니다",
          icon: "trash",
          actionLabel: "복구",
          onAction: handleDeleteUndo,
          onDone: () => { deleteUndoRef.current = []; },
        });
      },
    });
  }, [updateCustomData, baseLen, DAYS.length, setToast, immediateSave, handleDeleteUndo]);

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
    let nextSnapshot = null;
    markMetaDirty();
    updateCustomData((prev) => {
      // MD-2: 동시편집으로 Day 수가 변경되었으면 reorder 취소
      const totalDays = baseLen + (prev._extraDays?.length || 0);
      if (newOrder.length !== totalDays) {
        setToast({ message: "Day 수가 변경되어 순서 변경이 취소되었습니다", icon: "info" });
        return prev;
      }
      const result = { ...prev, _dayOrder: newOrder };
      nextSnapshot = result;
      return result;
    });

    // 즉시 저장
    immediateSave(nextSnapshot);

    setShowReorder(false);
    setSelectedDay(0);
    setToast({ message: "Day 순서가 변경되었습니다", icon: "swap" });
  }, [reorderList, updateCustomData, baseLen, immediateSave]);

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

    let nextSnapshot = null;
    markDayDirty(dayIdx);

    updateCustomData((prev) => {
      const computeNext = (p) => {
        const next = { ...p };
        if (sectionIdx === -1) {
          if (!next[dayIdx]) next[dayIdx] = {};
          if (!next[dayIdx].extraItems) next[dayIdx].extraItems = [];
          if (itemIdx !== undefined && itemIdx !== null) {
            next[dayIdx].extraItems = [...next[dayIdx].extraItems];
            // _extra 아이템의 itemIdx는 merged section 내 인덱스이므로
            // extraItems 배열 인덱스와 다를 수 있음 → _id 기반으로 정확한 위치 검색
            const actualIdx = findItemIndex(next[dayIdx].extraItems, newItem);
            if (actualIdx >= 0) {
              next[dayIdx].extraItems[actualIdx] = newItem;
            } else {
              console.warn("[TravelPlanner] handleSaveItem: extraItem not found for edit", { dayIdx, newItem });
            }
          } else {
            next[dayIdx].extraItems.push(newItem);
          }
        } else {
          if (!next[dayIdx]) next[dayIdx] = {};
          if (!next[dayIdx].sections) next[dayIdx].sections = {};
          if (!next[dayIdx].sections[sectionIdx]) {
            const sourceSec = next._extraDays?.[dayIdx]?.sections?.[sectionIdx];
            next[dayIdx].sections[sectionIdx] = { items: [...(sourceSec?.items || [])] };
          }
          if (itemIdx !== undefined && itemIdx !== null) {
            next[dayIdx] = { ...next[dayIdx] };
            next[dayIdx].sections = { ...next[dayIdx].sections };
            const sec = next[dayIdx].sections[sectionIdx];
            const newItems = [...(sec.items || [])];
            if (itemIdx < newItems.length) {
              newItems[itemIdx] = newItem;
            } else {
              console.warn("[TravelPlanner] handleSaveItem: itemIdx out of bounds", { dayIdx, sectionIdx, itemIdx, length: newItems.length });
            }
            next[dayIdx].sections[sectionIdx] = { ...sec, items: newItems };

            const extraIdx = dayIdx - baseLen;
            if (extraIdx >= 0 && next._extraDays?.[extraIdx]) {
              const ed = next._extraDays[extraIdx];
              const edSections = ed.sections || [];
              const edSec = edSections[sectionIdx];
              if (edSec && Array.isArray(edSec.items)) {
                const edNewItems = [...edSec.items];
                if (itemIdx < edNewItems.length) {
                  edNewItems[itemIdx] = newItem;
                }
                const nextExtra = [...next._extraDays];
                nextExtra[extraIdx] = {
                  ...ed,
                  sections: edSections.map((s, i) => i === sectionIdx ? { ...s, items: edNewItems } : s),
                };
                next._extraDays = nextExtra;
              }
            }
          }
        }
        return { ...next };
      };

      const result = computeNext(prev);
      nextSnapshot = result;
      return result;
    });


    immediateSave(nextSnapshot);
    // 수정한 항목이 지금 정보 다이얼로그에 열려 있으면 activeDetail 갱신 (시간표 등 반영)
    setActiveDetail((prev) => {
      if (!prev || prev._si !== sectionIdx || prev._ii !== itemIdx) return prev;
      if (toOrigIdx(prev._di) !== dayIdx) return prev;
      return { ...prev, ...(newItem.detail || {}), timetable: newItem.detail?.timetable, _item: newItem };
    });
    const isEdit = itemIdx !== undefined && itemIdx !== null;
    const editToastMsg = opts.editKind
      ? (opts.editKind === 'hours' && newItem?.type === 'stay'
          ? '체크인·체크아웃이 변경되었습니다'
          : { address: '주소가 변경되었습니다', time: '시간이 변경되었습니다', desc: '이름이 변경되었습니다', tip: '메모가 변경되었습니다', price: '가격이 변경되었습니다', hours: '영업시간이 변경되었습니다', highlights: '포인트가 변경되었습니다', image: '이미지가 변경되었습니다', timetable: '시간표가 변경되었습니다', sub: '부가정보가 변경되었습니다', type: '유형이 변경되었습니다', move: '구간이 변경되었습니다' }[opts.editKind])
      : null;
    setToast({ message: isEdit ? (editToastMsg ?? '일정이 수정되었습니다') : '일정이 추가되었습니다', icon: isEdit ? 'edit' : 'check' });
    // 수동 추가된 장소를 rag_places에 캐싱 (fire-and-forget, 추가 API 비용 없음)
    if (!isEdit && newItem?.detail?.placeId) {
      upsertPlaceToRAG(newItem, tripMeta?.destinations).catch(() => {});
    }
    // 일정 추가 직후에만: 새 지역이 있으면 "여행지에 추가할까요?" 시트 (직접 추가·AI·붙여넣기 공통)
    if (!isEdit && tripId && Array.isArray(tripMeta?.destinations)) {
      const itemRegions = getRegionsFromItems([newItem]);
      const currentRegions = getRegionCodesFromDestinations(tripMeta.destinations);
      const newRegionCodes = itemRegions.filter((r) => !currentRegions.includes(r));
      const newRegionNames = newRegionCodes.map(getRegionDisplayName).filter(Boolean);
      if (newRegionNames.length > 0) {
        setAddDestinationSelected(new Set(newRegionNames));
        setAddDestinationSheet({ regionNames: newRegionNames, regionCodes: newRegionCodes });
      }
    }
  }, [updateCustomData, DAYS, dayIndexMap, toOrigIdx, current, baseLen, immediateSave, tripMeta]);

  /* 삭제 실행 로직 (확인 다이얼로그 바깥에서 재사용) */
  const performDeleteItem = useCallback((dayIdx, sectionIdx, itemIdx, itemRef) => {
    const target = itemRef;

    let nextSnapshot = null;
    markDayDirty(dayIdx);

    updateCustomData((prev) => {
      deleteUndoRef.current = [...deleteUndoRef.current, { snapshot: prev }];

      const next = { ...prev };
      const deleted = removeItemFromDay(next, prev, dayIdx, target, baseLen);
      if (!deleted) {
        console.warn("[TravelPlanner] performDeleteItem: target not found", { dayIdx, target });
      }

      const result = { ...next };
      nextSnapshot = result;
      return result;
    });

    // 4) 즉시 저장 (debounce 대신)
    immediateSave(nextSnapshot);


    setToast({
      message: "일정이 삭제되었습니다",
      icon: "trash",
      actionLabel: "복구",
      onAction: handleDeleteUndo,
      onDone: () => { deleteUndoRef.current = []; },
    });
  }, [updateCustomData, baseLen, immediateSave, handleDeleteUndo]);

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

  /* DetailDialog 인라인 수정: 필드 단위 저장 (displayIdx → origIdx 변환) */
  const handleSaveFieldFromDetail = useCallback((displayIdx, sectionIdx, itemIdx, updatedItem, editKind) => {
    const dayIdx = toOrigIdx(displayIdx);
    handleSaveItem(updatedItem, dayIdx, sectionIdx, itemIdx, { skipDuplicateCheck: true, editKind });
    setActiveDetail((prev) => {
      if (!prev) return prev;
      const newDetail = updatedItem.detail || {};
      return {
        ...prev,
        ...newDetail,
        name: newDetail.name || updatedItem.desc || prev.name,
        category: newDetail.category || prev.category,
        timetable: newDetail.timetable ?? prev.timetable,
        _item: updatedItem,
      };
    });
  }, [handleSaveItem, toOrigIdx]);

  /* 정보 다이얼로그에서 삭제 시: 확인 다이얼로그를 DetailDialog 위에 표시 → 확인 후 삭제+닫기 */
  const handleDeleteFromDetail = useCallback((d) => {
    if (!d?._item?._custom) return;
    setConfirmDialog({
      title: "일정 삭제",
      message: "이 일정을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      onConfirm: () => {
        setActiveDetail(null);
        performDeleteItem(toOrigIdx(d._di ?? selectedDay), d._si, d._ii, d._item);
        setConfirmDialog(null);
      },
    });
  }, [performDeleteItem, toOrigIdx, selectedDay]);

  /* 일정을 다른 Day로 이동: 현재 Day에서 제거 → 선택한 Day 마지막(extraItems)에 추가 */
  const handleMoveToDay = useCallback((detailPayload, targetDisplayIdx) => {
    const item = detailPayload?._item;
    if (!item) return;
    const sourceDayIdx = toOrigIdx(detailPayload._di ?? selectedDay);
    const targetDayIdx = toOrigIdx(targetDisplayIdx);
    if (sourceDayIdx === targetDayIdx) return;

    const mergedSource = DAYS.find((_, i) => toOrigIdx(i) === sourceDayIdx);
    const mergedTarget = DAYS.find((_, i) => toOrigIdx(i) === targetDayIdx);

    let nextSnapshot = null;
    markDayDirty(sourceDayIdx);
    markDayDirty(targetDayIdx);

    updateCustomData((prev) => {
      const next = { ...prev };

      // ── Source: identity 기반 삭제 (통합 헬퍼) ──
      removeItemFromDay(next, prev, sourceDayIdx, item, baseLen);

      // ── Target: 항상 extraItems에 추가 (통일) ──
      const itemToAdd = { ...item, _custom: true };
      delete itemToAdd._extra; // merge 시 자동으로 붙여줌
      if (!itemToAdd._id) itemToAdd._id = crypto.randomUUID();
      next[targetDayIdx] = next[targetDayIdx] ? { ...next[targetDayIdx] } : {};
      next[targetDayIdx].extraItems = [...(next[targetDayIdx].extraItems || []), itemToAdd];

      nextSnapshot = next;
      return next;
    });

    // 즉시 저장 (debounce 대신) — 동시 편집 시 데이터 유실 방지
    immediateSave(nextSnapshot);

    setActiveDetail(null);
    const targetLabel = mergedTarget?.label || `Day ${mergedTarget?.day ?? targetDisplayIdx + 1}`;
    setToast({ message: `${targetLabel}(으)로 이동했어요`, icon: "check" });
    setSelectedDay(targetDisplayIdx);
  }, [updateCustomData, DAYS, toOrigIdx, selectedDay, baseLen, immediateSave]);

  /* ── 롱프레스 선택 모드 ── */
  const longPressMode = longPressSelection.size > 0;

  const handleLongPressToggle = useCallback((item) => {
    if (bulkDeleteMode) return; // 기존 bulk 모드와 동시 비활성
    setLongPressSelection((prev) => {
      const next = new Set(prev);
      const key = getItemKey(item);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [bulkDeleteMode]);

  const isLongPressSelected = useCallback((item) => {
    const key = getItemKey(item);
    return longPressSelection.has(key);
  }, [longPressSelection]);

  const handleLongPressDelete = useCallback(() => {
    if (longPressSelection.size === 0) return;
    const items = currentDayItems.filter(({ item }) => {
      const key = getItemKey(item);
      return longPressSelection.has(key);
    });
    if (items.length === 0) return;
    setConfirmDialog({
      title: `${items.length}개 삭제`,
      message: `선택한 ${items.length}개 일정을 삭제하시겠습니까?`,
      confirmLabel: "삭제",
      onConfirm: () => {
        const dayIdx = toOrigIdx(selectedDay);
        let nextSnapshot = null;
        markDayDirty(dayIdx);

        // 모든 아이템을 한 번의 updateCustomData에서 삭제 (단일 저장)
        updateCustomData((prev) => {
          deleteUndoRef.current = [...deleteUndoRef.current, { snapshot: prev }];
          const next = { ...prev };

          for (const { item } of items) {
            removeItemFromDay(next, prev, dayIdx, item, baseLen);
          }

          const result = { ...next };
          nextSnapshot = result;
          return result;
        });

        // 1회만 즉시 저장
        immediateSave(nextSnapshot);

        setLongPressSelection(new Set());
        setConfirmDialog(null);
        setToast({
          message: `${items.length}개 일정이 삭제되었습니다`,
          icon: "trash",
          actionLabel: "복구",
          onAction: handleDeleteUndo,
          onDone: () => { deleteUndoRef.current = []; },
        });
      },
    });
  }, [longPressSelection, currentDayItems, updateCustomData, toOrigIdx, selectedDay, baseLen, immediateSave, handleDeleteUndo]);

  const handleLongPressMoveToDay = useCallback((targetDisplayIdx) => {
    if (longPressSelection.size === 0) return;
    const items = currentDayItems.filter(({ item }) => {
      const key = getItemKey(item);
      return longPressSelection.has(key);
    });
    if (items.length === 0) return;

    const sourceDayIdx = toOrigIdx(selectedDay);
    const targetDayIdx = toOrigIdx(targetDisplayIdx);
    if (sourceDayIdx === targetDayIdx) return;

    let nextSnapshot = null;
    markDayDirty(sourceDayIdx);
    markDayDirty(targetDayIdx);

    // 모든 아이템을 한 번의 updateCustomData에서 이동 (단일 저장)
    updateCustomData((prev) => {
      const next = { ...prev };

      for (const { item } of items) {
        // ── Source 제거 (통합 헬퍼) ──
        removeItemFromDay(next, prev, sourceDayIdx, item, baseLen);

        // ── Target 추가 ──
        const itemToAdd = { ...item, _custom: true };
        delete itemToAdd._extra;
        if (!itemToAdd._id) itemToAdd._id = crypto.randomUUID();
        next[targetDayIdx] = next[targetDayIdx] ? { ...next[targetDayIdx] } : {};
        next[targetDayIdx].extraItems = [...(next[targetDayIdx].extraItems || []), itemToAdd];
      }

      nextSnapshot = next;
      return next;
    });

    // 1회만 즉시 저장
    immediateSave(nextSnapshot);

    setLongPressSelection(new Set());
    setShowLongPressMoveSheet(false);
    const mergedTarget = DAYS.find((_, i) => toOrigIdx(i) === targetDayIdx);
    const targetLabel = mergedTarget?.label || `Day ${mergedTarget?.day ?? targetDisplayIdx + 1}`;
    setToast({ message: `${items.length}개를 ${targetLabel}(으)로 이동했어요`, icon: "check" });
    setSelectedDay(targetDisplayIdx);
  }, [longPressSelection, currentDayItems, updateCustomData, DAYS, toOrigIdx, selectedDay, baseLen, immediateSave]);

  /* ── PlaceCard 시간 영역 탭 → 시간 수정 다이얼로그 (canEdit이면 모든 아이템) ── */
  const handleTimeClickFromCard = useCallback((item, si, ii) => {
    setTimeEditItem({ item, si, ii, dayIdx: toOrigIdx(selectedDay) });
  }, [toOrigIdx, selectedDay]);

  const handleTimeEditSave = useCallback((newTime) => {
    if (!timeEditItem) return;
    const { item, si, ii, dayIdx } = timeEditItem;
    const prevTime = (item?.time || '').trim();
    const nextTime = (newTime || '').trim();
    if (prevTime === nextTime) {
      setTimeEditItem(null);
      return;
    }
    const updated = { ...item, time: newTime };
    if (updated.detail) updated.detail = { ...updated.detail };
    handleSaveItem(updated, dayIdx, si, ii, { skipDuplicateCheck: true });
    setTimeEditItem(null);
  }, [timeEditItem, handleSaveItem]);

  const runBulkDeleteWithPayload = useCallback((payload) => {
    if (!payload) return;
    const { keys, entries, dayIdx } = payload;
    markDayDirty(dayIdx);

    updateCustomData((prev) => {
      deleteUndoRef.current = [...deleteUndoRef.current, { snapshot: prev }];

      const next = { ...prev };

      for (const entry of entries) {
        if (!entry.item) continue;
        removeItemFromDay(next, prev, dayIdx, entry.item, baseLen);
      }

      const result = { ...next };
      bulkDeleteNextRef.current = result;
      return result;
    });

    // 즉시 저장
    immediateSave(bulkDeleteNextRef.current);
    bulkDeleteNextRef.current = null;

    setBulkDeleteMode(false);
    setSelectedBulkKeys(new Set());
    setConfirmDialog(null);
    setToast({
      message: `${keys.length}개 일정이 삭제되었습니다`,
      icon: "trash",
      actionLabel: "복구",
      onAction: handleDeleteUndo,
      onDone: () => { deleteUndoRef.current = []; },
    });
    bulkDeletePayloadRef.current = null;
  }, [updateCustomData, baseLen, immediateSave, handleDeleteUndo]);

  const handleBulkDeleteConfirm = useCallback(() => {
    const payload = bulkDeletePayloadRef.current;
    runBulkDeleteWithPayload(payload);
  }, [runBulkDeleteWithPayload]);

  const handleBulkDeleteClick = useCallback(() => {
    const n = selectedBulkKeys.size;
    if (n === 0) return;
    const dayIdx = toOrigIdx(selectedDay);
    const keys = Array.from(selectedBulkKeys);
    const entries = keys.map((k) => {
      const [si, ii] = k.split("-").map(Number);
      return currentDayItems.find((e) => e.si === si && e.ii === ii);
    }).filter(Boolean);
    bulkDeletePayloadRef.current = { keys, entries, dayIdx, baseLen };
    setConfirmDialog({
      title: "일정 일괄 삭제",
      message: `${n}개 일정을 삭제할까요?`,
      confirmLabel: "삭제",
      onConfirm: handleBulkDeleteConfirm,
    });
  }, [selectedBulkKeys, selectedDay, toOrigIdx, currentDayItems, baseLen, handleBulkDeleteConfirm]);

  /* ── Bulk Import: 실제 추가/교체 실행 (즉시 저장 + 토스트 + 여행지 시트) ── */
  const applyBulkImport = useCallback((items, mode, dayIdx) => {
    if (!items || items.length === 0) return;
    let nextSnapshot = null;
    markDayDirty(dayIdx);

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
        const result = { ...next };
        nextSnapshot = result;
        return result;
      });
      setToast({ message: `${items.length}개 일정으로 교체되었습니다`, icon: "check" });
    } else {
      updateCustomData((prev) => {
        const next = { ...prev };
        if (!next[dayIdx]) next[dayIdx] = {};
        if (!next[dayIdx].extraItems) next[dayIdx].extraItems = [];
        next[dayIdx].extraItems = [...next[dayIdx].extraItems, ...items];
        const result = { ...next };
        nextSnapshot = result;
        return result;
      });
      setToast({ message: `${items.length}개 일정이 추가되었습니다`, icon: "check" });
    }

    immediateSave(nextSnapshot);

    if (tripId && Array.isArray(tripMeta?.destinations)) {
      const itemRegions = getRegionsFromItems(items);
      const currentRegions = getRegionCodesFromDestinations(tripMeta.destinations);
      const newRegionCodes = itemRegions.filter((r) => !currentRegions.includes(r));
      const newRegionNames = newRegionCodes.map(getRegionDisplayName).filter(Boolean);
      if (newRegionNames.length > 0) {
        setAddDestinationSelected(new Set(newRegionNames));
        setAddDestinationSheet({ regionNames: newRegionNames, regionCodes: newRegionCodes });
      }
    }
  }, [updateCustomData, baseLen, immediateSave, tripId, tripMeta]);

  /* ── Bulk Import: replace는 바로 적용, append는 중복 체크 후 적용 또는 DuplicateReviewDialog ── */
  const handleBulkImport = useCallback((items, mode, targetDisplayIdx) => {
    if (!items || items.length === 0) return;
    const viewIdx = targetDisplayIdx != null ? targetDisplayIdx : selectedDay;
    const dayIdx = toOrigIdx(viewIdx);
    const itemsWithIds = items.map((it) => (it._id ? it : { ...it, _id: crypto.randomUUID() }));

    if (mode === "replace") {
      applyBulkImport(itemsWithIds, "replace", dayIdx);
      return;
    }

    const targetDay = DAYS[viewIdx];
    const existingItems = targetDay?.sections?.flatMap((sec) => sec.items || []) || [];
    const existingKeys = new Set(existingItems.map(getItemKey));
    const duplicates = [];
    const clean = [];
    for (const item of itemsWithIds) {
      if (existingKeys.has(getItemKey(item))) {
        duplicates.push(item);
      } else {
        clean.push(item);
      }
    }

    if (duplicates.length === 0) {
      applyBulkImport(itemsWithIds, "append", dayIdx);
    } else {
      setDuplicateReview({ cleanItems: clean, duplicateItems: duplicates, dayIdx });
    }
  }, [toOrigIdx, selectedDay, DAYS, applyBulkImport]);

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
  if (tripLoading || scheduleLoading) {
    return <ScheduleSkeleton />;
  }

  /* ── No access ── */
  if (!myRole) {
    return (
      <div style={{
        width: "100%", height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--color-surface)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        padding: SPACING.xxl,
      }}>
        <Icon name="lock" size={48} style={{ opacity: 0.3, marginBottom: SPACING.xl }} />
        <p style={{
          fontSize: "var(--typo-body-1-n---bold-size)",
          fontWeight: "var(--typo-body-1-n---bold-weight)",
          color: "var(--color-on-surface)", marginBottom: SPACING.md,
        }}>
          접근 권한이 없습니다
        </p>
        <p style={{
          fontSize: "var(--typo-caption-1-regular-size)",
          color: "var(--color-on-surface-variant2)", textAlign: "center", marginBottom: SPACING.xxxl,
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
        padding: `${SPACING.lg} ${SPACING.xl} ${SPACING.lg} ${SPACING.md}`,
        background: "var(--color-surface-container-lowest)",
        borderBottom: "1px solid var(--color-outline-variant)",
        display: "flex", alignItems: "center", gap: SPACING.sm, flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="md" iconOnly="chevronLeft"
          onClick={() => navigate("/")}
          style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.md }}>
            <h1 style={{ margin: 0, fontSize: "var(--typo-body-2-n---bold-size)", fontWeight: "var(--typo-body-2-n---bold-weight)", lineHeight: "var(--typo-body-2-n---bold-line-height)", letterSpacing: "var(--typo-body-2-n---bold-letter-spacing)", color: "var(--color-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tripName}
            </h1>
            {/* Viewer badge */}
            {!canEdit && (
              <span style={{
                padding: `${SPACING.xs} ${SPACING.ms}`, borderRadius: "var(--radius-sm, 4px)",
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
        {/* 온라인 멤버 아바타 (홈 카드 스타일 겹침 + 온라인 인디케이터) */}
        {onlineUsers.length > 0 && (() => {
          const show = onlineUsers.slice(0, 3);
          const sz = 24;
          const overlap = 8;
          return (
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <div style={{ position: "relative", width: sz + (show.length - 1) * (sz - overlap), height: sz }}>
                {show.map((ou, i) => (
                  <div key={ou.id} style={{
                    position: "absolute", left: i * (sz - overlap),
                    width: sz, height: sz, borderRadius: "50%",
                    border: "1.5px solid var(--color-surface-container-lowest)",
                    background: "var(--color-surface-container)",
                    overflow: "hidden",
                    zIndex: show.length - i,
                  }}>
                    {ou.avatarUrl ? (
                      <img src={ou.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                    ) : null}
                    <span style={{ display: ou.avatarUrl ? "none" : "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--color-on-surface-variant)" }}>{(ou.name || "?")[0]}</span>
                    <div style={{
                      position: "absolute", bottom: -1, right: -1,
                      width: 8, height: 8, borderRadius: "50%",
                      background: "var(--color-success)", border: "1.5px solid var(--color-surface-container-lowest)",
                    }} />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {/* Share button */}
        <Button variant="ghost-neutral" size="md" iconOnly="share"
          onClick={() => setShowShareSheet(true)}
          title="공유 및 초대" />
        {/* More menu button */}
        <Button variant="ghost-neutral" size="md" iconOnly="moreHorizontal"
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
          display: "flex", gap: 0, padding: `0 ${SPACING.lg}`,
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
              <div style={{ padding: "var(--spacing-sp100) var(--spacing-sp40)", fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)" }}>
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
          <div style={{ padding: `var(--spacing-sp100) ${SPACING.xl} ${SPACING.lg}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: SPACING.md }}>
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
                      padding: `${SPACING.md} ${SPACING.lg}`,
                      fontSize: "var(--typo-body-2-n---bold-size)",
                      fontWeight: "var(--typo-body-2-n---bold-weight)",
                      color: "var(--color-on-surface)",
                      background: "var(--color-surface-container-lowest)",
                      border: "1px solid var(--color-outline-variant)",
                      borderRadius: RADIUS.md,
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
                        display: "flex", alignItems: "center", gap: SPACING.ms,
                        padding: 0, border: "none", background: "none",
                        textAlign: "left", fontFamily: "inherit",
                        color: "var(--color-on-surface)",
                      }}
                      onClick={canEdit ? () => setShowDayMoreMenu(true) : undefined}
                      title={canEdit ? "날짜 이름 수정 또는 삭제" : undefined}
                    >
                      <h2 style={{
                        margin: 0, fontSize: "var(--typo-body-2-n---bold-size)", fontWeight: "var(--typo-body-2-n---bold-weight)", color: "inherit",
                        letterSpacing: "var(--typo-body-2-n---bold-letter-spacing)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {current.label}
                      </h2>
                      {canEdit && (
                        <Icon name="edit" size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
                      )}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sp40)", flexWrap: "wrap", marginTop: "var(--spacing-sp20)" }}>
                      {(displayDayInfo[selectedDay]?.displayDate || current.stay) && (
                        <span style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)" }}>
                          {[displayDayInfo[selectedDay]?.displayDate, current.stay].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {routeSummary && (
                        <>
                          {(displayDayInfo[selectedDay]?.displayDate || current.stay) && <span style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-outline-variant)" }}>·</span>}
                          <span style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-primary)", fontWeight: 600 }}>
                            {routeSummary}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: "var(--spacing-sp80)", flexShrink: 0, alignItems: "center" }}>
                      {!bulkDeleteMode ? (
                        <>
                          <Button variant="neutral" size="sm" iconOnly="trash"
                            onClick={() => { setBulkDeleteMode(true); setSelectedBulkKeys(new Set()); }}
                            style={{ borderRadius: "16px" }}
                            title="일괄 삭제"
                            aria-label="일괄 삭제" />
                          <Button variant="primary" size="sm" iconLeft="plus"
                            onClick={() => setShowAddSheet(true)}
                            style={{ borderRadius: "16px" }}>
                            일정 추가
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost-neutral" size="xsm"
                            onClick={() => { setBulkDeleteMode(false); setSelectedBulkKeys(new Set()); }}
                            style={{ borderRadius: "16px" }}
                            aria-label="취소">
                            취소
                          </Button>
                          <Button variant="primary" size="xsm"
                            onClick={handleBulkDeleteClick}
                            disabled={selectedBulkKeys.size === 0}
                            style={{ borderRadius: "16px" }}
                            aria-label={`${selectedBulkKeys.size}개 삭제`}>
                            {selectedBulkKeys.size}개 삭제
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Main content: scrollable timeline + pull-to-refresh ── */}
      <PullToRefresh onRefresh={refreshSchedule} disabled={scheduleLoading}>
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
          style={{ padding: `${SPACING.lg} ${SPACING.xl} var(--spacing-sp320)`, touchAction: "pan-y" }}>

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
          const allItems = currentDayItems;

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

          const allKeys = new Set(allItems.map((e) => `${e.si}-${e.ii}`));
          const allSelected = allKeys.size > 0 && allKeys.size === selectedBulkKeys.size;
          const toggleSelectAll = () => {
            if (allSelected) setSelectedBulkKeys(new Set());
            else setSelectedBulkKeys(new Set(allKeys));
          };

          let globalOrder = 0;
          return (
            <div>
              {bulkDeleteMode && allItems.length > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: SPACING.ms,
                  padding: `${SPACING.ms} 0 ${SPACING.md}`, marginBottom: SPACING.sm,
                  borderBottom: "1px solid var(--color-outline-variant)",
                }}>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    style={{
                      display: "flex", alignItems: "center", gap: SPACING.ms,
                      border: "none", background: "none", cursor: "pointer",
                      fontSize: "var(--typo-caption-1-regular-size)",
                      color: "var(--color-primary)", fontWeight: 600,
                      fontFamily: "inherit",
                    }}
                    aria-label={allSelected ? "전체 해제" : "전체 선택"}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: 4,
                      border: "2px solid var(--color-outline-variant)",
                      background: allSelected ? "var(--color-primary)" : "transparent",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {allSelected && <Icon name="check" size={10} style={{ filter: "brightness(0) invert(1)" }} />}
                    </span>
                    {allSelected ? "전체 해제" : "전체 선택"}
                  </button>
                </div>
              )}
              {allItems.map((entry, flatIdx) => {
                const { item, si, ii, section } = entry;
                // _extra 아이템은 extraItems에 저장되므로 sectionIdx를 -1로 설정
                const effectiveSi = item._extra ? -1 : si;
                const resolvedLoc = getItemCoords(item, selectedDay);
                // item에 lat/lon이 이미 있으면 getItemCoords의 label은 name/desc (주소 아님) → 주소 fallback으로 사용 금지
                const hasOwnCoords = item.detail?.lat != null && item.detail?.lon != null;
                const resolvedAddress = item.detail?.address || (!hasOwnCoords && resolvedLoc ? resolvedLoc.label : "");
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

                const bulkKey = `${si}-${ii}`;
                const isBulkSelected = selectedBulkKeys.has(bulkKey);
                const toggleBulk = () => {
                  setSelectedBulkKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(bulkKey)) next.delete(bulkKey);
                    else next.add(bulkKey);
                    return next;
                  });
                };

                const handleClick = () => {
                  if (bulkDeleteMode) {
                    toggleBulk();
                    return;
                  }
                  const detail = enrichedItem.detail || {};
                  setActiveDetail({
                    ...detail,
                    name: detail.name || enrichedItem.desc || "",
                    category: detail.category || TYPE_LABELS[enrichedItem.type] || "정보",
                    timetable: detail.timetable ?? enrichedItem.detail?.timetable,
                    _item: enrichedItem, _si: effectiveSi, _ii: ii, _di: selectedDay,
                    _index: flatIdx,
                  });
                };

                return (
                  <div key={bulkKey}>
                    {flatIdx > 0 && (
                      <TravelTimeConnector
                        fromCoords={prevLoc?.coords}
                        toCoords={resolvedLoc?.coords}
                        fromLabel={prevItem?.detail?.address || prevLoc?.label}
                        toLabel={resolvedAddress || resolvedLoc?.label}
                      />
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: SPACING.md }}>
                      {bulkDeleteMode && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleBulk(); }}
                          style={{
                            flexShrink: 0,
                            width: 18, height: 18, borderRadius: 4,
                            border: "2px solid var(--color-outline-variant)",
                            background: isBulkSelected ? "var(--color-primary)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", padding: 0,
                          }}
                          aria-label={isBulkSelected ? "선택 해제" : "선택"}
                          aria-checked={isBulkSelected}
                        >
                          {isBulkSelected && <Icon name="check" size={10} style={{ filter: "brightness(0) invert(1)" }} />}
                        </button>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <PlaceCard
                          item={enrichedItem}
                          order={itemOrder}
                          isNow={isNow}
                          isClickable={!bulkDeleteMode && !longPressMode && isClickable}
                          onClick={handleClick}
                          isLast={isLastItem}
                          onTimeClick={canEdit ? (itm) => handleTimeClickFromCard(itm, effectiveSi, ii) : undefined}
                          onLongPress={canEdit ? handleLongPressToggle : undefined}
                          isSelected={isLongPressSelected(enrichedItem)}
                          selectionMode={longPressMode}
                        />
                      </div>
                    </div>
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
              marginTop: SPACING.sm, padding: `11px ${SPACING.lx}`,
              background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px)", border: "1px dashed var(--color-outline-variant)",
            }}>
              <p style={{ margin: 0, fontSize: "var(--typo-caption-2-regular-size)", fontWeight: "var(--typo-caption-2-regular-weight)", color: "var(--color-on-surface-variant2)", lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: SPACING.ms }}>
                <Icon name="pin" size={12} style={{ marginTop: SPACING.xs }} /><span>{summary}</span>
              </p>
            </div>
          ) : null;
        })()}
        </div>
      </PullToRefresh>

      {/* RAG 장소 일정추가 시트 (프리필 폼, 시간만 선택 후 저장) */}
      {addNearbyPlace && (
        <AddRAGPlaceSheet
          place={addNearbyPlace}
          onConfirm={(item, dayIdx) => {
            handleSaveItem(item, toOrigIdx(dayIdx ?? selectedDay), -1, null);
            setToast({ message: '일정에 추가되었습니다', icon: 'check' });
            setAddNearbyPlace(null);
          }}
          onClose={() => setAddNearbyPlace(null)}
          allDays={DAYS}
          selectedDayIdx={selectedDay}
        />
      )}

      {/* Detail Dialog (activeDetail 있을 때만 마운트 → useScrollLock 정상 동작) */}
      {activeDetail && (
      <DetailDialog
        detail={activeDetail}
        onClose={() => setActiveDetail(null)}
        dayColor="var(--color-primary)"
        tripId={tripId}
        onDelete={canEdit && activeDetail?._item?._custom ? handleDeleteFromDetail : undefined}
        onMoveToDay={canEdit && activeDetail?._item?._custom ? handleMoveToDay : undefined}
        onSaveField={canEdit ? handleSaveFieldFromDetail : undefined}
        moveDayOptions={DAYS.map((d, i) => ({ label: d.label || `Day ${d.day}`, displayIdx: i }))}
        currentDayDisplayIdx={selectedDay}
        allDetailPayloads={allDetailPayloads}
        currentDetailIndex={currentDetailIndex}
        onNavigateToIndex={allDetailPayloads.length > 1 ? onDetailNavigateToIndex : undefined}
        onAddToSchedule={canEdit ? (place) => setAddNearbyPlace(place) : undefined}
      />
      )}

      {/* Document Dialog */}
      {showDocs && <DocumentDialog onClose={() => setShowDocs(false)} tripId={tripId} />}

      {/* Shopping Guide Dialog */}
      {showGuide && <ShoppingGuideDialog onClose={() => setShowGuide(false)} destinations={tripMeta?.destinations} />}

      {/* "추가하기" Action Sheet — IconContainer로 아이콘 래핑 */}
      {showAddSheet && canEdit && (
        <BottomSheet onClose={() => setShowAddSheet(false)} maxHeight="auto" title="추가하기">
          <div style={{
            padding: "var(--spacing-sp80) var(--spacing-sp200) var(--spacing-sp240)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-sp40)",
          }}>
            {[
              { icon: "pin", iconColor: "var(--color-on-surface-variant)", label: "직접 일정 추가", desc: "시간·유형·일정명을 직접 입력해요", onClick: () => { setShowAddSheet(false); setShowAddPlace(true); } },
              { icon: "document", iconColor: "var(--color-on-surface-variant)", label: "예약 정보 붙여넣기", desc: "확인메일, 바우처를 복붙하면 AI가 정리", onClick: () => { setShowAddSheet(false); setShowPasteInfo(true); } },
              { icon: "flash", iconColor: "var(--color-on-surface-variant)", label: "AI와 대화하며 계획하기", desc: "여행 스타일을 알려주면 AI가 일정을 제안해요", onClick: () => { setShowAddSheet(false); setShowAiChat(true); } },
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
                <IconContainer name={action.icon} size={20} iconColor={action.iconColor} />
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

      {/* AI Chat Dialog */}
      {showAiChat && (
        <AIChatDialog
          onClose={() => setShowAiChat(false)}
          onBulkImport={handleBulkImport}
          currentDay={current}
          destinations={tripMeta?.destinations}
          allDays={DAYS}
        />
      )}

      {/* Add Place Page (full-screen) */}
      <AddPlacePage
        open={showAddPlace}
        onClose={() => setShowAddPlace(false)}
        onSave={(item, dayIdx) => handleSaveItem(item, toOrigIdx(dayIdx ?? selectedDay), -1, null)}
        dayIdx={toOrigIdx(selectedDay)}
        tripId={tripId}
        allDays={DAYS}
        selectedDayIdx={selectedDay}
      />

      {/* Paste Info Page (full-screen) */}
      <PasteInfoPage
        open={showPasteInfo}
        onClose={() => setShowPasteInfo(false)}
        onImport={(items) => handleBulkImport(items, "append")}
        context={current ? `Day ${current.day} ${current.label || ''}` : ''}
      />

      {/* Floating Map Button */}
      <Button variant="primary" size="xlg" iconOnly="map"
        onClick={() => setShowMap(true)}
        title="여행 지도"
        style={{
          position: "fixed", bottom: "calc(24px + var(--safe-area-bottom, 0px))", right: "24px", zIndex: "var(--z-fab)",
          width: "52px", height: "52px",
          boxShadow: "var(--shadow-strong)",
        }} />

      {/* Full Map Dialog */}
      {showMap && (
          <FullMapDialog
            days={DAYS}
            initialDay={selectedDay}
            onClose={() => setShowMap(false)}
            onAddItem={canEdit ? (dayIdx, item, sectionIdx) => {
              handleSaveItem(item, dayIdx, sectionIdx ?? -1, null);
              setToast({ message: '일정에 추가되었습니다', icon: 'check' });
            } : undefined}
          />
        )}

      {/* Confirm Dialog */}
      {/* ── 롱프레스 선택 액션바 ── */}
      {longPressMode && (
        <div style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 1500,
          padding: `${SPACING.xl} ${SPACING.xxl}`,
          paddingBottom: `var(--safe-area-bottom, 0px)`,
          display: "flex", gap: SPACING.lg, alignItems: "center",
          borderTop: "1px solid var(--color-outline-variant)",
          background: "var(--color-surface)",
          boxShadow: "var(--shadow-strong)",
          animation: "slideUpActionBar 0.2s ease",
        }}>
          <button
            type="button"
            onClick={() => setLongPressSelection(new Set())}
            style={{
              display: "flex", alignItems: "center", gap: SPACING.md,
              border: "none", background: "var(--color-primary-container)",
              borderRadius: "var(--radius-circle, 999px)",
              padding: `${SPACING.ms} ${SPACING.lg} ${SPACING.ms} ${SPACING.md}`,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Icon name="close" size={14} style={{ color: "var(--color-primary)" }} />
            <span style={{ fontSize: "var(--typo-label-2-bold-size)", fontWeight: 700, color: "var(--color-primary)" }}>
              {longPressSelection.size}개
            </span>
          </button>
          <div style={{ flex: 1 }} />
          {DAYS.length > 1 && (
            <Button variant="ghost-neutral" size="sm" iconLeft="pin" onClick={() => setShowLongPressMoveSheet(true)}>
              Day 이동
            </Button>
          )}
          <Button variant="ghost-danger" size="sm" iconLeft="trash" onClick={handleLongPressDelete}>
            삭제
          </Button>
          <style>{`@keyframes slideUpActionBar { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      )}

      {/* 롱프레스 Day 이동 시트 */}
      {showLongPressMoveSheet && (
        <BottomSheet onClose={() => setShowLongPressMoveSheet(false)} maxHeight="70vh" zIndex={3100} title="어느 날로 옮길까요?">
          <div style={{ padding: `${SPACING.lg} ${SPACING.xxl} ${SPACING.xxxl}`, display: "flex", flexDirection: "column", gap: SPACING.md }}>
            {DAYS.map((d, i) => {
              if (i === selectedDay) return null;
              const dayNum = i + 1;
              const label = d.label || `Day ${d.day}`;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleLongPressMoveToDay(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: SPACING.lg,
                    width: "100%", padding: `${SPACING.lg} ${SPACING.xl}`,
                    border: "1px solid var(--color-outline-variant)",
                    borderRadius: "var(--radius-lg, 12px)", background: "var(--color-surface-container-lowest)",
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-primary-container)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-surface-container-lowest)"; e.currentTarget.style.borderColor = "var(--color-outline-variant)"; }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: "var(--radius-md, 8px)",
                    background: "var(--color-primary-container)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: "var(--typo-label-2-bold-size)", fontWeight: 700, color: "var(--color-primary)" }}>
                      {dayNum}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={{ fontSize: "var(--typo-label-2-medium-size)", fontWeight: 600, color: "var(--color-on-surface)" }}>
                      Day {dayNum}
                    </div>
                    {label !== `Day ${d.day}` && (
                      <div style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)", marginTop: "1px" }}>
                        {label}
                      </div>
                    )}
                  </div>
                  <Icon name="chevronRight" size={14} style={{ opacity: 0.3, flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {/* PlaceCard 시간 영역 탭 → 시간 변경 다이얼로그 (open 필수) */}
      {timeEditItem && (
        <TimePickerDialog
          open
          value={timeEditItem.item.time || '12:00'}
          onConfirm={handleTimeEditSave}
          onClose={() => setTimeEditItem(null)}
          minuteStep={5}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* 중복 일정 리뷰: AI 파싱/일괄 추가 append 시 중복이 있으면 표시 */}
      {duplicateReview && (
        <DuplicateReviewDialog
          cleanItems={duplicateReview.cleanItems}
          duplicateItems={duplicateReview.duplicateItems}
          onConfirm={(selectedItems) => {
            if (selectedItems.length > 0) {
              applyBulkImport(selectedItems, "append", duplicateReview.dayIdx);
            }
            setDuplicateReview(null);
          }}
          onClose={() => setDuplicateReview(null)}
        />
      )}

      {/* 여행지 추가 시트: 일정 추가 직후 새 지역이 있으면 표시. 여러 개일 때 선택 가능 */}
      {addDestinationSheet && (
        <BottomSheet
          title="여행지 추가"
          onClose={() => { setAddDestinationSheet(null); setAddDestinationSelected(new Set()); }}
          zIndex={9500}
        >
          <div style={{ padding: SPACING.xxl, display: "flex", flexDirection: "column", gap: SPACING.xl }}>
            <p style={{ margin: 0, fontSize: "var(--typo-body-2-n---regular-size)", color: "var(--color-on-surface-variant)", lineHeight: 1.5 }}>
              여행지가 추가되었습니다. 아래 여행지를 해당 여행의 여행지에 추가할까요?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACING.md }}>
              {addDestinationSheet.regionNames.map((name) => (
                <Checkbox
                  key={name}
                  label={name}
                  checked={addDestinationSelected.has(name)}
                  onChange={() => {
                    setAddDestinationSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(name)) next.delete(name);
                      else next.add(name);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: SPACING.md, marginTop: SPACING.md }}>
              <Button
                variant="neutral"
                size="lg"
                style={{ flex: 1 }}
                onClick={() => { setAddDestinationSheet(null); setAddDestinationSelected(new Set()); }}
              >
                나중에
              </Button>
              <Button
                variant="primary"
                size="lg"
                style={{ flex: 1 }}
                onClick={async () => {
                  const toAdd = Array.from(addDestinationSelected);
                  setAddDestinationSheet(null);
                  setAddDestinationSelected(new Set());
                  if (toAdd.length === 0 || !tripId || !tripMeta) return;
                  const nextDest = [...(tripMeta.destinations || []), ...toAdd];
                  const updated = await updateTrip(tripId, { destinations: nextDest });
                  if (updated) setTripMeta((prev) => (prev ? { ...prev, destinations: nextDest } : prev));
                }}
              >
                추가할게요
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* 날짜 ··· 메뉴: 이름 수정(인라인) / 이 날짜 삭제 */}
      {showDayMoreMenu && current && canEdit && (
        <BottomSheet onClose={() => setShowDayMoreMenu(false)} maxHeight="auto" zIndex="var(--z-confirm)" title={current.label}>
          <div style={{ padding: `${SPACING.md} ${SPACING.xxxl} ${SPACING.xxxl}` }}>
            <button
              type="button"
              onClick={() => { setShowDayMoreMenu(false); setEditingDayIdx(toOrigIdx(selectedDay)); setEditDayLabel(current.label); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: SPACING.lg,
                padding: `${SPACING.lx} 0`, border: "none", background: "none", cursor: "pointer",
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
                  width: "100%", display: "flex", alignItems: "center", gap: SPACING.lg,
                  padding: `${SPACING.lx} 0`, border: "none", background: "none", cursor: "pointer",
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
        />
      )}

      {/* ── Share & Invite Bottom Sheet ── */}
      {showShareSheet && (
        <BottomSheet onClose={() => setShowShareSheet(false)} maxHeight="70vh" zIndex="var(--z-confirm)" title="공유 및 초대">
          <div style={{ padding: `${SPACING.md} ${SPACING.xxxl} ${SPACING.xxxl}` }}>

            {/* Share link section */}
            <div style={{ marginBottom: SPACING.xxl }}>
              <p style={{
                margin: `0 0 ${SPACING.md}`,
                fontSize: "var(--typo-caption-1-bold-size)",
                fontWeight: "var(--typo-caption-1-bold-weight)",
                color: "var(--color-on-surface-variant)",
              }}>
                초대 링크
              </p>
              <div style={{
                display: "flex", gap: SPACING.md, alignItems: "center",
              }}>
                <div style={{
                  flex: 1, padding: `${SPACING.ml} ${SPACING.lx}`,
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
                margin: `${SPACING.md} 0 0`,
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
                  style={{ marginTop: SPACING.ml, width: "100%" }}
                >
                  다른 앱으로 공유
                </Button>
              )}
            </div>

            {/* Members list */}
            {tripMeta?.members?.length > 0 && (
              <div>
                <p style={{
                  margin: `0 0 ${SPACING.md}`,
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
                        display: "flex", alignItems: "center", gap: SPACING.ml,
                        padding: `${SPACING.ml} ${SPACING.lx}`,
                        borderBottom: i < tripMeta.members.length - 1 ? "1px solid var(--color-surface-dim)" : "none",
                        background: "var(--color-surface-container-lowest)",
                      }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt="" style={{
                              width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover",
                            }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                          ) : null}
                          <div style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            background: "var(--color-primary-container)",
                            display: m.avatarUrl ? "none" : "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)",
                            color: "var(--color-on-primary-container)",
                          }}>
                            {(m.name || "?").charAt(0).toUpperCase()}
                          </div>
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
                            <span style={{ marginLeft: SPACING.sm, fontSize: "var(--typo-caption-3-regular-size)", color: "var(--color-on-surface-variant2)" }}>(나)</span>
                          )}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: SPACING.ms, flexShrink: 0 }}>
                          {isOnline && (
                            <span style={{
                              fontSize: "var(--typo-caption-3-regular-size)",
                              color: "var(--color-success)",
                            }}>온라인</span>
                          )}
                          <span style={{
                            fontSize: "var(--typo-caption-2-regular-size)",
                            color: "var(--color-on-surface-variant2)",
                            padding: `${SPACING.xs} ${SPACING.ms}`, borderRadius: "4px",
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
        <BottomSheet
          onClose={() => {
            const newOrder = reorderList.map((item) => item.origIdx);
            const current = customData._dayOrder || DAYS.map((_, i) => i);
            const same = newOrder.length === current.length && newOrder.every((v, i) => v === current[i]);
            if (same) {
              setShowReorder(false);
            } else {
              handleReorderConfirm();
            }
          }}
          maxHeight="85vh"
          zIndex="var(--z-confirm)"
          title="Day 순서 변경"
        >
          <div style={{ padding: SPACING.xxxl }}>
            <div style={{
              display: "flex", flexDirection: "column", gap: SPACING.ms,
              maxHeight: "60vh", overflowY: "auto",
            }}>
              {reorderList.map((item, i) => (
                <div key={`${item.idx}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: SPACING.ml,
                  padding: `${SPACING.ml} ${SPACING.lg}`,
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
                  <div style={{ display: "flex", gap: SPACING.sm, flexShrink: 0 }}>
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

      {/* More Menu — 구분선 있는 버전으로 통일 */}
      {showMoreMenu && (
        <BottomSheet onClose={() => setShowMoreMenu(false)} maxHeight="auto" zIndex="var(--z-confirm)" title="">
          <div style={{ padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.xxxl}`, display: 'flex', flexDirection: 'column' }}>
            {[
              { icon: "compass", label: "여행 가이드", onClick: () => { setShowMoreMenu(false); setShowGuide(true); } },
              { icon: "file", label: "여행 서류", onClick: () => { setShowMoreMenu(false); setShowDocs(true); } },
              { icon: "persons", label: `멤버 (${tripMeta?.members?.length || 0}명)`, onClick: () => { setShowMoreMenu(false); setShowShareSheet(true); } },
            ].map((menuItem, idx) => (
              <button
                key={idx}
                type="button"
                onClick={menuItem.onClick}
                style={{
                  display: "flex", alignItems: "center", gap: SPACING.md,
                  width: "100%", padding: `${SPACING.lg} ${SPACING.xl}`,
                  border: "none", borderTop: idx > 0 ? "1px solid var(--color-outline-variant)" : "none",
                  borderRadius: 0, background: "transparent",
                  color: "var(--color-on-surface)", fontSize: "var(--typo-label-2-medium-size)",
                  fontWeight: "var(--typo-label-2-medium-weight)", cursor: "pointer", textAlign: "left",
                }}
              >
                <Icon name={menuItem.icon} size={20} style={{ opacity: 0.7, flexShrink: 0 }} />
                <span>{menuItem.label}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.actionLabel ? `undo-${Date.now()}` : Date.now()}
          message={toast.message}
          icon={toast.icon}
          onDone={() => { toast.onDone?.(); setToast(null); }}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      )}
    </div>
  );
}
