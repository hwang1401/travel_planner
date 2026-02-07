import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ── Icon Helper ── */
const ICON_MAP = {
  /* ── Button icons (solid, for action triggers) ── */
  close: "/icons/Close/Close.svg",
  edit: "/icons/Edit/Edit 1.svg",
  trash: "/icons/Trash/Trash 2.svg",
  plus: "/icons/Plus/Plus.svg",
  plusCircle: "/icons/Plus/Circle.svg",
  sync: "/icons/Sync.svg",
  /* ── Flat icons (for text/header companions) ── */
  map: "/icons/Map.svg",
  pin: "/icons/Pin.svg",
  clock: "/icons/Clock.svg",
  calendar: "/icons/Calendar.svg",
  pricetag: "/icons/Pricetag.svg",
  file: "/icons/File/File.svg",
  home: "/icons/Home.svg",
  shopping: "/icons/Shopping/Bag.svg",
  briefcase: "/icons/Briefcase.svg",
  navigation: "/icons/Navigation/Navigation 1.svg",
  bookmark: "/icons/Bookmark.svg",
  flash: "/icons/Flash/On.svg",
  lock: "/icons/Lock.svg",
  globe: "/icons/Globe/Globe 1.svg",
  car: "/icons/Car.svg",
  compass: "/icons/Compass.svg",
  fire: "/icons/Fire.svg",
  bulb: "/icons/Bulb.svg",
  bookOpen: "/icons/Book/Open.svg",
  info: "/icons/Info.svg",
  flag: "/icons/Flag.svg",
  star: "/icons/Star/fiiled.svg",
  chevronDown: "/icons/Arrow/Arrowhead/Down.svg",
  chevronUp: "/icons/Arrow/Arrowhead/Up.svg",
  externalLink: "/icons/External Link.svg",
};
function Icon({ name, size = 16, style = {}, className = "" }) {
  const src = ICON_MAP[name] || name;
  return <img src={src} alt="" width={size} height={size} style={{ display: "block", flexShrink: 0, ...style }} className={className} />;
}

/* ── Location Coordinates DB ── */
const LOCATION_COORDS = {
  // 후쿠오카
  "인천공항": [37.4602, 126.4407],
  "후쿠오카공항": [33.5854, 130.4510],
  "하카타역": [33.5898, 130.4207],
  "하카타 숙소": [33.5873, 130.4148],
  "캐널시티": [33.5894, 130.4112],
  "나카스": [33.5928, 130.4075],
  "돈키호테 나카스": [33.5932, 130.4068],
  "쿠라스시 나카스": [33.5932, 130.4068],
  "텐진": [33.5903, 130.3988],
  // 구마모토
  "구마모토역": [32.7898, 130.6886],
  "시모토리": [32.8014, 130.7100],
  "코란테이": [32.8018, 130.7105],
  "구마모토성": [32.8060, 130.7058],
  "조사이엔": [32.8040, 130.7045],
  "스이젠지": [32.7950, 130.7270],
  "스가노야": [32.8010, 130.7115],
  "야츠다": [32.8015, 130.7098],
  // 아소
  "아소역": [32.9480, 131.0840],
  "이마킨 식당": [32.9695, 131.0515],
  "쿠사센리": [32.8850, 131.0650],
  "아소산": [32.8840, 131.0840],
  "아소 신사": [32.9510, 131.1157],
  "몬젠마치": [32.9508, 131.1152],
  // 유후인
  "유후인역": [33.2665, 131.3690],
  "유노쓰보거리": [33.2672, 131.3740],
  "긴린코": [33.2660, 131.3798],
  "플로럴빌리지": [33.2678, 131.3730],
  // 쿠루메
  "쿠루메역": [33.3167, 130.5083],
};

function getItemCoords(item, dayIdx) {
  const desc = item.desc || "";
  const addr = item.detail?.address || "";
  const name = item.detail?.name || "";
  const all = desc + " " + addr + " " + name;

  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (all.includes(key)) return { coords, label: key };
  }
  // Fuzzy match
  if (all.includes("공항") && all.includes("후쿠오카")) return { coords: LOCATION_COORDS["후쿠오카공항"], label: "후쿠오카공항" };
  if (all.includes("공항") && all.includes("인천")) return { coords: LOCATION_COORDS["인천공항"], label: "인천공항" };
  if (all.includes("하카타") && all.includes("역")) return { coords: LOCATION_COORDS["하카타역"], label: "하카타역" };
  if (all.includes("구마모토") && all.includes("역")) return { coords: LOCATION_COORDS["구마모토역"], label: "구마모토역" };
  if (all.includes("유후인") && all.includes("역")) return { coords: LOCATION_COORDS["유후인역"], label: "유후인역" };
  if (all.includes("쿠루메")) return { coords: LOCATION_COORDS["쿠루메역"], label: "쿠루메역" };
  if (all.includes("시모토리") || all.includes("下通")) return { coords: LOCATION_COORDS["시모토리"], label: "시모토리" };
  if (all.includes("캐널시티") || all.includes("キャナル")) return { coords: LOCATION_COORDS["캐널시티"], label: "캐널시티" };
  if (all.includes("나카스") || all.includes("中洲")) return { coords: LOCATION_COORDS["나카스"], label: "나카스" };
  if (all.includes("아소산") || all.includes("쿠사센리") || all.includes("나카다케")) return { coords: LOCATION_COORDS["쿠사센리"], label: "쿠사센리" };
  if (all.includes("아소") && all.includes("역")) return { coords: LOCATION_COORDS["아소역"], label: "아소역" };
  if (all.includes("스이젠지") || all.includes("水前寺")) return { coords: LOCATION_COORDS["스이젠지"], label: "스이젠지" };
  if (all.includes("긴린코") || all.includes("金鱗湖")) return { coords: LOCATION_COORDS["긴린코"], label: "긴린코" };
  if (all.includes("유후인")) return { coords: LOCATION_COORDS["유후인역"], label: "유후인" };
  if (all.includes("텐진") || all.includes("天神")) return { coords: LOCATION_COORDS["텐진"], label: "텐진" };
  // stay type fallback — match by day's accommodation
  if (item.type === "stay") {
    if (all.includes("숙소") || all.includes("체크인") || all.includes("체크아웃") || all.includes("복귀") || all.includes("휴식") || all.includes("호텔") || all.includes("마무리") || all.includes("짐")) {
      // Try text-based match first
      if (all.includes("유후인") || all.includes("료칸")) return { coords: LOCATION_COORDS["유후인역"], label: "유후인 숙소" };
      if (all.includes("구마모토")) return { coords: LOCATION_COORDS["구마모토역"], label: "구마모토 숙소" };
      if (all.includes("하카타") || all.includes("스미요시") || all.includes("住吉")) return { coords: LOCATION_COORDS["하카타 숙소"], label: "하카타 숙소" };
      // Fallback by day index
      const dayStayMap = { 0: "하카타 숙소", 1: "구마모토역", 2: "구마모토역", 3: "유후인역", 4: "하카타 숙소" };
      const stayKey = dayStayMap[dayIdx];
      if (stayKey && LOCATION_COORDS[stayKey]) return { coords: LOCATION_COORDS[stayKey], label: stayKey === "구마모토역" ? "구마모토 숙소" : stayKey === "유후인역" ? "유후인 숙소" : stayKey };
    }
  }
  return null;
}

function createDayIcon(color, label) {
  const text = String(label);
  const isMulti = text.includes("·");
  const w = isMulti ? 40 : 28;
  return L.divIcon({
    className: "",
    html: `<div style="
      min-width:${w}px;height:28px;border-radius:14px;padding:0 ${isMulti ? 6 : 0}px;
      background:${color};color:#fff;font-size:${isMulti ? 10 : 11}px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      white-space:nowrap;
    ">${text}</div>`,
    iconSize: [w, 28],
    iconAnchor: [w / 2, 14],
    popupAnchor: [0, -16],
  });
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

/* ── Bottom Sheet (reusable wrapper for mobile-style modals) ── */
function BottomSheet({ onClose, maxHeight = "85vh", zIndex = 1000, children }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex,
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: "420px", maxHeight,
        background: "#fff", borderRadius: "20px 20px 0 0",
        overflow: "hidden", animation: "bottomSheetUp 0.3s cubic-bezier(0.16,1,0.3,1)",
        display: "flex", flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {/* Drag Handle */}
        <div style={{
          padding: "10px 0 2px", display: "flex", justifyContent: "center", flexShrink: 0,
          cursor: "grab",
        }}>
          <div style={{
            width: "36px", height: "4px", borderRadius: "2px", background: "#D5D4D8",
          }} />
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Confirm Dialog ── */
function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", animation: "fadeIn 0.15s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: "320px", background: "#fff",
        borderRadius: "18px", overflow: "hidden",
        animation: "slideUp 0.2s ease",
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
      }}>
        <div style={{ padding: "24px 24px 16px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 800, color: "#1a1a1a" }}>{title}</h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: 1.5 }}>{message}</p>
        </div>
        <div style={{ display: "flex", borderTop: "1px solid #EEECE6" }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "14px", border: "none", background: "none",
            fontSize: "14px", fontWeight: 500, color: "#888",
            cursor: "pointer", fontFamily: "inherit",
            borderRight: "1px solid #EEECE6",
          }}>취소</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "14px", border: "none", background: "none",
            fontSize: "14px", fontWeight: 700, color: confirmColor || "#D94F3B",
            cursor: "pointer", fontFamily: "inherit",
          }}>{confirmLabel || "확인"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Day Dialog (Bottom Sheet) ── */
function AddDayDialog({ onAdd, onCancel }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("pin");
  const icons = ["pin", "navigation", "car", "compass", "shopping", "flag", "home", "fire", "star", "bookmark"];

  return (
    <BottomSheet onClose={onCancel} maxHeight="auto" zIndex={3000}>
      <div style={{ padding: "8px 24px 24px" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 800, color: "#1c1b21", display: "flex", alignItems: "center", gap: "6px" }}>
          <Icon name="calendar" size={16} />날짜 추가
        </h3>
        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: "#888" }}>아이콘</p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {icons.map((ic) => (
              <button key={ic} onClick={() => setIcon(ic)} style={{
                width: "40px", height: "40px", borderRadius: "12px",
                border: icon === ic ? "2px solid #1a1a1a" : "1px solid #E8E6E1",
                background: icon === ic ? "#F5F5F0" : "#FAFAF8",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                transition: "all 0.1s",
              }}><Icon name={ic} size={18} /></button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: "#888" }}>날짜 이름 *</p>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && label.trim()) onAdd(label.trim(), icon); }}
            placeholder="예: 후쿠오카 자유시간"
            style={{
              width: "100%", padding: "12px 14px",
              border: "1.5px solid #E8E6E1", borderRadius: "12px",
              fontSize: "14px", fontFamily: "inherit", fontWeight: 500,
              background: "#FAFAF8", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#1a1a1a"; }}
            onBlur={(e) => { e.target.style.borderColor = "#E8E6E1"; }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "14px", border: "1px solid #E8E6E1", background: "#fff",
            borderRadius: "12px", fontSize: "14px", fontWeight: 600, color: "#888",
            cursor: "pointer", fontFamily: "inherit",
          }}>취소</button>
          <button
            onClick={() => { if (label.trim()) onAdd(label.trim(), icon); }}
            style={{
              flex: 1, padding: "14px", border: "none",
              borderRadius: "12px", fontSize: "14px", fontWeight: 700,
              background: label.trim() ? "#1a1a1a" : "#E8E6E1",
              color: label.trim() ? "#fff" : "#bbb",
              cursor: label.trim() ? "pointer" : "default",
              fontFamily: "inherit", transition: "all 0.15s",
            }}
          >추가</button>
        </div>
      </div>
    </BottomSheet>
  );
}

function FlyToPoint({ coords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, zoom || 14, { duration: 0.8 });
  }, [coords, zoom, map]);
  return null;
}

function FullMapDialog({ days, onClose }) {
  const [selectedDay, setSelectedDay] = useState(0);
  const [flyTarget, setFlyTarget] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [cardExpanded, setCardExpanded] = useState(true);
  const [mapDetail, setMapDetail] = useState(null);
  const markerRefs = useRef({});

  const day = days[selectedDay];

  // Collect pins for selected day (allow revisits as new pins)
  const dayPins = [];
  if (day) {
    let orderNum = 1;
    let lastCoordKey = null;
    day.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        const loc = getItemCoords(item, selectedDay);
        if (loc) {
          const coordKey = loc.coords[0] + "," + loc.coords[1];
          // Skip only consecutive duplicates (same place back-to-back)
          if (coordKey !== lastCoordKey) {
            const hasDetail = item.detail && (item.detail.image || item.detail.tip || item.detail.address || item.detail.timetable);
            dayPins.push({
              coords: loc.coords,
              label: loc.label,
              desc: item.desc,
              time: item.time,
              color: day.color,
              dayNum: day.day,
              order: orderNum++,
              _detail: hasDetail ? item.detail : null,
            });
          }
          lastCoordKey = coordKey;
        }
      });
    });
  }

  // Merge overlapping pins for map rendering (combine order labels like "4·7")
  const mapPins = [];
  dayPins.forEach((pin) => {
    const existing = mapPins.find((p) => p.coords[0] === pin.coords[0] && p.coords[1] === pin.coords[1]);
    if (existing) {
      existing.orders.push(pin.order);
      existing.mapLabel = existing.orders.join("·");
      existing.descs.push({ time: pin.time, desc: pin.desc });
    } else {
      mapPins.push({
        ...pin,
        orders: [pin.order],
        mapLabel: String(pin.order),
        descs: [{ time: pin.time, desc: pin.desc }],
      });
    }
  });

  const positions = dayPins.map((p) => p.coords);

  // Build timeline items for the card — match pins in order
  const timelineItems = [];
  const shownPinOrders = new Set();
  let pinCursor = 0; // tracks which pin we're matching next
  if (day) {
    let lastCoordKey = null;
    day.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        const loc = getItemCoords(item, selectedDay);
        let pinOrder = null;
        let coords = null;
        let hasPin = false;

        if (loc) {
          const coordKey = loc.coords[0] + "," + loc.coords[1];
          coords = loc.coords;
          // Advance pin cursor for non-consecutive-duplicate items (mirrors pin collection logic)
          if (coordKey !== lastCoordKey && pinCursor < dayPins.length) {
            pinOrder = dayPins[pinCursor].order;
            pinCursor++;
            hasPin = true;
          } else if (coordKey === lastCoordKey) {
            // Consecutive duplicate — point to same pin as previous
            hasPin = true;
            pinOrder = pinCursor > 0 ? dayPins[pinCursor - 1].order : null;
          }
          lastCoordKey = coordKey;
        }

        const isFirstShow = pinOrder && !shownPinOrders.has(pinOrder);
        if (isFirstShow) shownPinOrders.add(pinOrder);
        timelineItems.push({
          time: item.time,
          desc: item.desc,
          type: item.type,
          hasPin,
          coords,
          pinOrder,
          showNumber: isFirstShow,
        });
      });
    });
  }

  const handlePinClick = (pin) => {
    setSelectedPin(pin);
    setFlyTarget({ coords: pin.coords, ts: Date.now() });
  };

  const handleTimelineClick = (item) => {
    if (!item.hasPin) return;
    // Find the mapPin that contains this item's pinOrder
    const mp = mapPins.find((p) => p.orders.includes(item.pinOrder));
    if (mp) {
      setFlyTarget({ coords: mp.coords, ts: Date.now() });
      setSelectedPin(mp);
      // Open the popup on the matching marker after a short delay for flyTo
      const coordKey = mp.coords[0] + "," + mp.coords[1];
      setTimeout(() => {
        const marker = markerRefs.current[coordKey];
        if (marker) marker.openPopup();
      }, 400);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "#fff", display: "flex", flexDirection: "column",
      animation: "fadeIn 0.2s ease",
      paddingTop: "env(safe-area-inset-top, 0px)",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px", background: "#fff",
        borderBottom: "1px solid #E8E6E1",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1c1b21", display: "flex", alignItems: "center", gap: "6px" }}><Icon name="map" size={16} />여행 지도</h3>
        <button onClick={onClose} style={{
          border: "none", background: "#F2F1ED", borderRadius: "50%",
          width: "28px", height: "28px", cursor: "pointer",
          fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon name="close" size={14} /></button>
      </div>

      {/* Day tabs */}
      <div style={{
        display: "flex", background: "#fff", flexShrink: 0,
        borderBottom: "1px solid #E8E6E1", overflowX: "auto",
      }}>
        {days.map((d, i) => {
          const active = selectedDay === i;
          return (
            <button key={i} onClick={() => { setSelectedDay(i); setSelectedPin(null); setFlyTarget(null); }} style={{
              flex: "none", padding: "8px 14px", border: "none",
              background: "none", cursor: "pointer",
              borderBottom: active ? `2.5px solid ${d.color}` : "2.5px solid transparent",
              color: active ? d.color : "#bbb",
              fontWeight: active ? 700 : 400,
              fontSize: "11px", fontFamily: "inherit",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              D{d.day}
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={[33.0, 131.0]}
          zoom={10}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positions.length > 0 && !flyTarget && <FitBounds positions={positions} />}
          {flyTarget && <FlyToPoint coords={flyTarget.coords} zoom={14} key={flyTarget.ts} />}
          {dayPins.length > 1 && (
            <Polyline positions={dayPins.map((p) => p.coords)} color={day.color} weight={3} opacity={0.5} dashArray="8,6" />
          )}
          {mapPins.map((pin, pi) => {
            const coordKey = pin.coords[0] + "," + pin.coords[1];
            return (
            <Marker
              key={pi}
              ref={(ref) => { if (ref) markerRefs.current[coordKey] = ref; }}
              position={pin.coords}
              icon={createDayIcon(
                selectedPin && pin.orders.includes(selectedPin.order) ? "#1a1a1a" : pin.color,
                pin.mapLabel
              )}
              eventHandlers={{ click: () => handlePinClick(pin) }}
            >
              <Popup>
                <div style={{ fontSize: "12px", fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif", minWidth: "140px" }}>
                  <strong style={{ fontSize: "13px" }}>{pin.label}</strong>
                  {pin.descs.map((d, di) => (
                    <div key={di} style={{ color: "#48464d", marginTop: "3px" }}>
                      <span style={{ color: "#78767e" }}>{d.time}</span> {d.desc}
                    </div>
                  ))}
                  {pin._detail && (
                    <button onClick={(e) => { e.stopPropagation(); setMapDetail(pin._detail); }} style={{
                      marginTop: "8px", width: "100%", padding: "6px 0", border: "1px solid #E8E6E1",
                      borderRadius: "6px", background: "#FAFAF8", cursor: "pointer",
                      fontSize: "11px", fontWeight: 600, color: pin.color, fontFamily: "inherit",
                    }}>상세보기</button>
                  )}
                </div>
              </Popup>
            </Marker>
            );
          })}
        </MapContainer>

        {/* DetailDialog for map */}
        {mapDetail && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100 }}>
            <DetailDialog detail={mapDetail} onClose={() => setMapDetail(null)} dayColor={day?.color || "#333"} />
          </div>
        )}
      </div>

      {/* Bottom itinerary card */}
      <div style={{
        background: "#fff", borderTop: "1px solid #E8E6E1", flexShrink: 0,
        maxHeight: cardExpanded ? "35vh" : "44px", transition: "max-height 0.25s ease",
        overflow: "hidden", display: "flex", flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {/* Card header */}
        <button onClick={() => setCardExpanded(!cardExpanded)} style={{
          width: "100%", padding: "12px 16px", border: "none", background: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
        }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: day?.color || "#333" }}>
            Day {day?.day} — {day?.label}
          </span>
          <span style={{ fontSize: "11px", color: "#bbb" }}>
            {dayPins.length}곳 · {cardExpanded ? "▾" : "▴"}
          </span>
        </button>

        {/* Timeline list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
          {timelineItems.map((item, i) => (
            <div
              key={i}
              onClick={() => handleTimelineClick(item)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "7px 8px", borderRadius: "8px",
                cursor: item.hasPin ? "pointer" : "default",
                background: selectedPin && selectedPin.orders && selectedPin.orders.includes(item.pinOrder) ? `${day.color}12` : "transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (item.hasPin) e.currentTarget.style.background = "#F5F5F2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = selectedPin && selectedPin.orders && selectedPin.orders.includes(item.pinOrder) ? `${day.color}12` : "transparent"; }}
            >
              {/* Pin number (first occurrence only) or dot */}
              {item.showNumber ? (
                <div style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: day.color, color: "#fff", fontSize: "9px", fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>{item.pinOrder}</div>
              ) : (
                <div style={{
                  width: "20px", height: "20px", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <div style={{
                    width: item.hasPin ? "6px" : "4px",
                    height: item.hasPin ? "6px" : "4px",
                    borderRadius: "50%",
                    background: item.hasPin ? day.color + "60" : "#ddd",
                  }} />
                </div>
              )}
              <span style={{
                fontSize: "10px", fontWeight: 600, color: "#999",
                width: "36px", flexShrink: 0, textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}>{item.time}</span>
              <span style={{
                fontSize: "11px", color: item.hasPin ? "#333" : "#aaa",
                fontWeight: item.hasPin ? 500 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Timetable Database ── */
const TIMETABLE_DB = [
  {
    id: "hakata_kumamoto",
    label: "하카타 → 구마모토 (신칸센)",
    icon: "car",
    station: "하카타역",
    direction: "구마모토 방면",
    trains: [
      { time: "08:23", name: "さくら541", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "08:38", name: "つばめ315", dest: "熊本", note: "각역정차, 약 50분" },
      { time: "09:20", name: "みずほ601", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "09:28", name: "さくら543", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "09:47", name: "つばめ317", dest: "熊本", note: "각역정차, 약 50분" },
      { time: "10:20", name: "みずほ605", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "10:38", name: "さくら545", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "10:47", name: "つばめ319", dest: "熊本", note: "각역정차, 약 50분" },
      { time: "11:28", name: "さくら547", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "11:36", name: "つばめ321", dest: "熊本", note: "각역정차, 약 50분" },
      { time: "12:20", name: "みずほ607", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "12:28", name: "さくら549", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "13:28", name: "さくら551", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "14:28", name: "さくら553", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
      { time: "15:28", name: "さくら555", dest: "鹿児島中央", note: "구마모토 정차, 33분" },
    ],
    highlights: [
      "みずほ·さくら = 빠름(33분) / つばめ = 느림(50분)",
      "[참고] みずほ는 지정석만 가능 (자유석 없음, 지정석 횟수 차감)",
    ],
  },
  {
    id: "kumamoto_hakata",
    label: "구마모토 → 하카타 (신칸센)",
    icon: "car",
    station: "구마모토역",
    direction: "하카타 방면",
    trains: [
      { time: "08:42", name: "さくら540", dest: "博多", note: "33분" },
      { time: "09:42", name: "さくら542", dest: "博多", note: "33분" },
      { time: "10:42", name: "さくら544", dest: "博多", note: "33분" },
      { time: "11:42", name: "さくら546", dest: "博多", note: "33분" },
      { time: "12:42", name: "さくら548", dest: "博多", note: "33분" },
      { time: "13:42", name: "さくら550", dest: "博多", note: "33분" },
      { time: "14:42", name: "さくら552", dest: "博多", note: "33분" },
      { time: "15:42", name: "さくら554", dest: "博多", note: "33분" },
      { time: "16:42", name: "さくら556", dest: "博多", note: "33분" },
      { time: "17:42", name: "さくら558", dest: "博多", note: "33분" },
      { time: "18:42", name: "さくら560", dest: "博多", note: "33분" },
    ],
    highlights: [
      "さくら 자유석 탑승 가능 (JR 북큐슈 5일권)",
    ],
  },
  {
    id: "kumamoto_aso",
    label: "구마모토 → 아소 (JR 호히본선)",
    icon: "car",
    station: "구마모토역",
    direction: "아소 방면 (호히본선)",
    trains: [
      { time: "07:38", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분" },
      { time: "09:09", name: "특급 あそぼーい!", dest: "아소·별부", note: "약 1시간 15분" },
      { time: "10:30", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분" },
      { time: "12:19", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분" },
      { time: "14:10", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분" },
    ],
    highlights: [
      "특급 あそぼーい!(아소보이): 토·일·공휴일 운행 관광열차",
      "보통열차는 히고오즈(肥後大津)에서 환승 필요할 수 있음",
      "[참고] 열차 편수가 적으니 시간 반드시 확인!",
    ],
  },
  {
    id: "aso_kumamoto",
    label: "아소 → 구마모토 (JR 호히본선)",
    icon: "car",
    station: "아소역",
    direction: "구마모토 방면 (호히본선)",
    trains: [
      { time: "12:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분" },
      { time: "14:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분" },
      { time: "15:46", name: "특급 あそぼーい!", dest: "구마모토", note: "약 1시간 15분 → 17:01착" },
      { time: "16:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분 → 18:08착" },
      { time: "17:39", name: "보통열차", dest: "구마모토", note: "약 1시간 40분" },
    ],
    highlights: [
      "あそぼーい! 15:46발이 가장 빠름 (17:01 도착)",
      "놓칠 경우 16:28 보통열차 (18:08 도착)",
      "[참고] 열차 편수 적음 — 시간 조절 필요!",
    ],
  },
  {
    id: "hakata_yufuin",
    label: "하카타 → 유후인 (JR 특급)",
    icon: "car",
    station: "하카타역",
    direction: "유후인 방면",
    trains: [
      { time: "07:24", name: "특급 ゆふいんの森1호", dest: "유후인·별부", note: "약 2시간 15분" },
      { time: "09:24", name: "특급 ゆふいんの森3호", dest: "유후인·별부", note: "약 2시간 15분" },
      { time: "10:24", name: "특급 ゆふ3호", dest: "유후인·별부", note: "약 2시간 20분" },
      { time: "12:26", name: "특급 ゆふいんの森5호", dest: "유후인·별부", note: "약 2시간 15분" },
      { time: "15:28", name: "특급 ゆふ5호", dest: "유후인·별부", note: "약 2시간 20분" },
    ],
    highlights: [
      "ゆふいんの森: 전석 지정석 관광열차 (지정석 횟수 차감)",
      "ゆふ: 자유석 있음 (JR 북큐슈 5일권 자유석 탑승 가능)",
      "[참고] ゆふいんの森는 인기 많아 미리 예약 추천!",
    ],
  },
  {
    id: "yufuin_hakata",
    label: "유후인 → 하카타 (JR 특급)",
    icon: "car",
    station: "유후인역",
    direction: "하카타 방면",
    trains: [
      { time: "11:18", name: "특급 ゆふいんの森2호", dest: "博多", note: "약 2시간 15분" },
      { time: "13:55", name: "특급 ゆふ4호", dest: "博多", note: "약 2시간 20분" },
      { time: "15:38", name: "특급 ゆふいんの森4호", dest: "博多", note: "약 2시간 15분" },
      { time: "16:45", name: "특급 ゆふいんの森6호", dest: "博多", note: "약 2시간 15분" },
      { time: "17:06", name: "특급 ゆふ6호", dest: "博多", note: "약 2시간 20분" },
    ],
    highlights: [
      "ゆふいんの森: 전석 지정석 관광열차",
      "ゆふ: 자유석 있음 (JR 북큐슈 5일권)",
    ],
  },
  {
    id: "kumamoto_tram",
    label: "구마모토 노면전차",
    icon: "car",
    station: "구마모토역 전정",
    direction: "시모토리·스이젠지 방면",
    trains: [
      { time: "매 6~8분", name: "A계통", dest: "다시마에도리 → 건군신사", note: "170엔 균일요금" },
      { time: "매 6~8분", name: "B계통", dest: "가미구마모토 → 스이젠지", note: "170엔 균일요금" },
    ],
    highlights: [
      "A계통: 구마모토역 → 가라시마초 → 시모토리 → 건군신사",
      "B계통: 가미구마모토 → 시모토리 → 스이젠지 공원",
      "배차 간격 짧아 시간 구애 없이 탑승 가능",
      "1일권: 500엔 (3회 이상 탑승 시 이득)",
      "[팁] 하나바타초역 = 구마모토성 최근접역",
    ],
  },
  {
    id: "fukuoka_airport_bus",
    label: "후쿠오카공항 → 하카타역 (버스/지하철)",
    icon: "car",
    station: "후쿠오카공항 국제선 터미널",
    direction: "하카타역 방면",
    trains: [
      { time: "매 15~20분", name: "직행버스 (니시테츠)", dest: "하카타역 치쿠시구치", note: "약 20분 · 310엔" },
      { time: "매 5~8분", name: "셔틀+지하철", dest: "국내선 환승 → 하카타역", note: "약 25~35분 · 260엔" },
    ],
    highlights: [
      "직행버스: 국제선→하카타역 치쿠시구치 (환승 불필요)",
      "지하철: 무료셔틀로 국내선 이동 → 공항선 2정거장 (5분)",
      "짐 많으면 직행버스 추천 / 시간 정확성은 지하철 우세",
      "[참고] 직행버스는 도로 상황에 따라 지연 가능",
    ],
  },
  {
    id: "hakata_fukuoka_airport",
    label: "하카타역 → 후쿠오카공항 (버스/지하철)",
    icon: "car",
    station: "하카타역",
    direction: "후쿠오카공항 국제선 방면",
    trains: [
      { time: "매 15~20분", name: "직행버스 (니시테츠)", dest: "공항 국제선 터미널", note: "약 20분 · 310엔" },
      { time: "매 5~8분", name: "지하철+셔틀", dest: "공항역 → 국제선 환승", note: "약 25~35분 · 260엔" },
    ],
    highlights: [
      "직행버스: 하카타역 치쿠시구치 → 국제선 직행",
      "지하철: 하카타역 → 공항역(5분) → 무료셔틀로 국제선(10분)",
      "출국 2시간 전 공항 도착 권장",
      "[참고] 국제선은 국내선과 별도 터미널 — 환승 시간 여유 두기",
    ],
  },
  {
    id: "aso_bus_up",
    label: "아소역 → 쿠사센리·아소산 (산교버스)",
    icon: "car",
    station: "아소역앞",
    direction: "쿠사센리·아소산상 터미널 방면",
    trains: [
      { time: "09:40", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "10:25", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "11:50", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "12:50", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "13:30", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "14:10", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
      { time: "14:35", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔" },
    ],
    highlights: [
      "산교(産交)버스 운행 — JR패스 미적용",
      "쿠사센리 초원 + 나카다케 화구 전망",
      "[참고] 편수 적음 — 반드시 시간 확인 후 이동",
      "[참고] 혼잡 시 탑승 불가할 수 있으니 여유있게",
      "동절기(2월) 시간표 변동 가능 — 현지 확인 필수",
    ],
  },
  {
    id: "aso_bus_down",
    label: "아소산·쿠사센리 → 아소역 (산교버스)",
    icon: "car",
    station: "쿠사센리·아소산상 터미널",
    direction: "아소역앞 방면",
    trains: [
      { time: "10:15", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "11:00", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "12:20", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "13:20", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "14:00", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "14:40", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
      { time: "15:05", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔" },
    ],
    highlights: [
      "산교(産交)버스 운행 — JR패스 미적용",
      "[참고] 마지막 버스 놓치지 않도록 주의!",
      "동절기(2월) 시간표 변동 가능 — 현지 확인 필수",
    ],
  },
  {
    id: "kumamoto_kurume",
    label: "구마모토 → 쿠루메 (신칸센)",
    icon: "car",
    station: "구마모토역",
    direction: "쿠루메(하카타) 방면",
    trains: [
      { time: "08:00", name: "さくら540", dest: "博多", note: "쿠루메 20분 · 하카타 33분" },
      { time: "08:42", name: "つばめ310", dest: "博多", note: "쿠루메 약 30분" },
      { time: "09:42", name: "さくら542", dest: "博多", note: "쿠루메 20분" },
      { time: "10:42", name: "さくら544", dest: "博多", note: "쿠루메 20분" },
      { time: "11:42", name: "さくら546", dest: "博多", note: "쿠루메 20분" },
      { time: "12:42", name: "さくら548", dest: "博多", note: "쿠루메 20분" },
    ],
    highlights: [
      "JR 북큐슈 5일권 자유석 탑승 가능",
      "쿠루메역에서 JR큐다이본선 환승 → 유후인",
      "さくら가 빠름 (쿠루메까지 약 20분)",
    ],
  },
  {
    id: "kurume_yufuin",
    label: "쿠루메 → 유후인 (JR 큐다이본선)",
    icon: "car",
    station: "쿠루메역",
    direction: "유후인·오이타 방면",
    trains: [
      { time: "07:43", name: "보통열차", dest: "히타", note: "히타 환승, 약 2시간 30분" },
      { time: "08:45", name: "특급 ゆふいんの森1호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석" },
      { time: "10:45", name: "특급 ゆふいんの森3호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석" },
      { time: "11:45", name: "특급 ゆふ3호", dest: "유후인·별부", note: "약 1시간 45분 · 자유석 있음" },
      { time: "13:45", name: "특급 ゆふいんの森5호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석" },
      { time: "16:45", name: "특급 ゆふ5호", dest: "유후인·별부", note: "약 1시간 45분 · 자유석 있음" },
    ],
    highlights: [
      "ゆふいんの森: 전석 지정석 관광열차 (지정석 횟수 차감)",
      "ゆふ: 자유석 있음 (JR 북큐슈 5일권 자유석 탑승 가능)",
      "보통열차는 히타(日田)에서 환승 필요",
      "[참고] ゆふいんの森는 인기 많아 미리 예약 추천!",
    ],
  },
];

function findBestTrain(trains, targetTime) {
  if (!targetTime || !trains.length) return 0;
  const [h, m] = targetTime.split(":").map(Number);
  if (isNaN(h)) return 0;
  const target = h * 60 + m;
  let bestIdx = 0;
  let bestDiff = Infinity;
  trains.forEach((t, i) => {
    const [th, tm] = t.time.split(":").map(Number);
    if (isNaN(th)) return;
    const diff = (th * 60 + tm) - target;
    // prefer trains at or after target time, then closest before
    const score = diff >= 0 ? diff : 1440 + diff;
    if (score < bestDiff) { bestDiff = score; bestIdx = i; }
  });
  return bestIdx;
}

const BASE_DAYS = [
  {
    day: 1, date: "2/19 (목)", label: "인천 → 하카타",
    color: "#D94F3B", icon: "navigation", stay: "하카타 1박", booked: true,
    sections: [
      {
        title: "이동",
        items: [
          { time: "15:30", desc: "인천공항 출발 (KE8795)", type: "move",
            detail: {
              name: "인천 → 후쿠오카 (KE8795)",
              category: "교통",
              tip: "인천공항 출발 15:30 → 후쿠오카공항 도착 17:10",
              highlights: ["대한항공 KE8795", "비행시간 약 1시간 40분"],
              image: "/images/ticket_departure.jpg",
            }
          },
          { time: "17:10", desc: "후쿠오카공항 도착", type: "move",
            detail: {
              name: "후쿠오카공항 국제선 터미널",
              category: "교통",
              tip: "입국심사 + 수하물 수령까지 약 25~30분 소요",
              highlights: ["입국카드 기내에서 미리 작성", "세관 신고서 필요 (면세품 있을 경우)"],
            }
          },
          { time: "17:35", desc: "입국심사 + 수하물 수령", type: "info" },
          { time: "17:40", desc: "공항 직행버스 탑승 → 하카타역", type: "move", sub: "약 20분 · 310엔",
            detail: {
              name: "공항 → 하카타역 (직행버스)",
              category: "교통",
              tip: "국제선 터미널 1번 승차장에서 탑승",
              timetable: {
                _routeId: "fukuoka_airport_bus",
                station: "후쿠오카공항 국제선 터미널",
                direction: "하카타역 방면",
                trains: [
                  { time: "매 15~20분", name: "직행버스 (니시테츠)", dest: "하카타역 치쿠시구치", note: "약 20분 · 310엔", picked: true },
                  { time: "매 5~8분", name: "셔틀+지하철", dest: "국내선 환승 → 하카타역", note: "약 25~35분 · 260엔", picked: false },
                ],
              },
              highlights: [
                "직행버스: 국제선→하카타역 치쿠시구치 (환승 불필요)",
                "지하철: 무료셔틀로 국내선 이동 → 공항선 2정거장 (5분)",
                "짐 많으면 직행버스 추천 / 시간 정확성은 지하철 우세",
              ],
            }
          },
          { time: "18:05", desc: "하카타역 도착 → 숙소 이동", type: "move", sub: "도보 10분" },
          { time: "18:15", desc: "숙소 체크인 & 짐 맡기기", type: "stay",
            detail: {
              name: "하카타 숙소",
              category: "숙소",
              address: "福岡市博多区住吉 2-13-13",
              tip: "캐널시티까지 도보 3분 / 하카타역 도보 15분",
              highlights: ["체크인 후 짐만 맡기고 바로 출발"],
              image: "/images/day01_hakata_airbnb.jpeg",
            }
          },
        ],
      },
      {
        title: "저녁",
        items: [
          { time: "18:25", desc: "캐널시티 라멘스타디움", type: "food", sub: "도보 3분",
            detail: {
              name: "캐널시티 라멘스타디움",
              category: "식사",
              address: "福岡市博多区住吉1-2 キャナルシティ博多 5F",
              hours: "11:00~23:00 (연중무휴)",
              price: "~1,000엔",
              tip: "전국 유명 라멘 8개 점포가 모여있는 푸드코트 형태",
              highlights: ["후쿠오카 돈코츠 라멘 추천", "줄이 짧은 곳 골라도 다 맛있음"],
              image: "/images/ramen_stadium.jpg",
            }
          },
          { time: "19:05", desc: "나카스 강변 산책", type: "spot", sub: "도보 10분",
            detail: {
              name: "나카스 강변 (中洲)",
              category: "관광",
              address: "福岡市博多区中洲",
              tip: "나카스 네온사인이 강물에 비치는 야경이 포인트",
              highlights: ["후쿠오카 대표 야경 스팟", "강변 따라 걷기만 해도 분위기 좋음"],
              image: "/images/nakasu_river.jpeg",
            }
          },
          { time: "19:35", desc: "돈키호테 나카스점 (Gate's 2F)", type: "shop",
            detail: {
              name: "돈키호테 나카스 Gate's점",
              category: "쇼핑",
              address: "福岡市博多区中洲3-7-24 Gate's 2F",
              hours: "24시간 영업",
              tip: "면세 카운터 있음 (여권 필수)",
              highlights: ["과자·화장품·의약품 면세 가능", "쿠라스시와 같은 건물"],
              image: "/images/donki.jpg",
            }
          },
          { time: "20:20", desc: "쿠라스시 나카스점 (같은 건물 3F)", type: "food",
            detail: {
              name: "쿠라스시 (くら寿司) 나카스점",
              category: "식사",
              address: "福岡市博多区中洲3-7-24 Gate's 3F",
              hours: "11:00~23:00",
              price: "1인 1,500~2,500엔",
              tip: "회전초밥 체인, 터치패널 주문이라 일본어 몰라도 OK",
              highlights: ["5접시마다 가챠폰 게임 가능", "사이드 메뉴(우동·튀김)도 추천"],
              image: "/images/kura.jpg",
            }
          },
          { time: "21:10", desc: "패밀리마트 맥주 구매", type: "shop" },
          { time: "21:20", desc: "숙소 도착 & 마무리", type: "stay" },
        ],
      },
    ],
    notes: "숙소(스미요시)↔캐널시티 도보 3분 / 돈키호테·쿠라스시 같은 건물(Gate's)",
  },
  {
    day: 2, date: "2/20 (금)", label: "하카타 → 구마모토",
    color: "#D97B2B", icon: "car", stay: "구마모토 1박", booked: false,
    sections: [
      {
        title: "오전 · 이동",
        items: [
          { time: "10:00", desc: "스미요시 숙소 체크아웃", type: "stay" },
          { time: "10:15", desc: "하카타역으로 이동", type: "move", sub: "도보 15분" },
          { time: "10:30", desc: "JR 북큐슈 5일권 수령 & 개시", type: "info",
            detail: {
              name: "JR 북큐슈 5일권",
              category: "교통",
              image: "/images/jrpass_voucher.jpg",
              price: "17,000엔 / 인 (Klook 예매완료)",
              tip: "하카타역 JR 미도리노마도구치(みどりの窓口)에서 바우처→실물 교환",
              highlights: [
                "Day2~6 커버 (2/20~2/24)",
                "신칸센 자유석 무제한 · 지정석 6회",
                "예약번호: FGY393247 (성인 2매)",
                "여권 + Klook 바우처 바코드 필요",
              ],
            }
          },
          { time: "11:00", desc: "신칸센 탑승 (하카타→구마모토)", type: "move", sub: "33분",
            detail: {
              name: "하카타 → 구마모토 신칸센",
              category: "교통",
              image: "/images/sakura547.jpg",
              tip: "JR 북큐슈 5일권으로 자유석 탑승 가능 · 지정석도 6회까지 OK",
              timetable: {
                _routeId: "hakata_kumamoto",
                station: "하카타역",
                direction: "구마모토 방면",
                trains: [
                  { time: "10:20", name: "みずほ605", dest: "鹿児島中央", note: "구마모토 정차, 33분", picked: false },
                  { time: "10:38", name: "さくら545", dest: "鹿児島中央", note: "구마모토 정차, 33분", picked: false },
                  { time: "10:47", name: "つばめ319", dest: "熊本", note: "각역정차, 약 50분", picked: false },
                  { time: "11:28", name: "さくら547", dest: "鹿児島中央", note: "구마모토 정차, 33분", picked: true },
                  { time: "11:36", name: "つばめ321", dest: "熊本", note: "각역정차, 약 50분", picked: false },
                ],
              },
              highlights: [
                "みずほ·さくら = 빠름(33분) / つばめ = 느림(50분)",
                "[참고] みずほ는 지정석만 가능 (자유석 없음, 지정석 횟수 차감)",
              ],
            }
          },
          { time: "11:33", desc: "구마모토역 도착", type: "move",
            detail: {
              name: "구마모토역 도착",
              category: "교통",
              tip: "신칸센 출구 → 재래선·노면전차 안내판 따라 이동",
              highlights: ["코인로커: 역내 2층 (400~700엔)", "노면전차: 역 정면 광장에서 탑승"],
            }
          },
          { time: "11:40", desc: "역 코인로커에 짐 보관", type: "info", sub: "400~700엔" },
          { time: "11:50", desc: "노면전차 → 시모토리 방면", type: "move", sub: "15분 · 170엔",
            detail: {
              name: "노면전차 (구마모토역→시모토리)",
              category: "교통",
              tip: "구마모토역 전정에서 A계통 탑승 · 시모토리 하차",
              timetable: {
                _routeId: "kumamoto_tram",
                station: "구마모토역 전정",
                direction: "시모토리·스이젠지 방면",
                trains: [
                  { time: "매 6~8분", name: "A계통", dest: "다시마에도리 → 건군신사", note: "170엔 균일요금", picked: true },
                  { time: "매 6~8분", name: "B계통", dest: "가미구마모토 → 스이젠지", note: "170엔 균일요금", picked: false },
                ],
              },
              highlights: [
                "A계통 탑승 → '시모토리(辛島町)' 하차 (약 15분)",
                "배차 6~8분 간격이라 대기 시간 짧음",
                "1일권 500엔 (3회 이상 타면 이득)",
                "[팁] 하나바타초역 = 구마모토성 최근접",
              ],
            }
          },
        ],
      },
      {
        title: "점심 · 오후",
        items: [
          { time: "12:10", desc: "코란테이(紅蘭亭) — 타이피엔", type: "food", sub: "구마모토식 중화 당면 스프",
            detail: {
              name: "코란테이 (紅蘭亭) 시모토리 본점",
              category: "식사",
              address: "熊本市中央区下通1-6-1",
              hours: "11:00~21:00",
              price: "~1,200엔",
              tip: "1934년 창업, 구마모토 타이피엔의 원조급 노포",
              highlights: ["타이피엔: 해산물+야채+당면 스프", "구마모토에서만 먹을 수 있는 향토 중화요리", "시모토리 아케이드 안이라 찾기 쉬움"],
            }
          },
          { time: "13:00", desc: "구마모토성 입장", type: "spot", sub: "800엔 · 천수각 6층 전망대 + AR앱",
            detail: {
              name: "구마모토성 (熊本城)",
              category: "관광",
              address: "熊本市中央区本丸1-1",
              hours: "9:00~16:30 (입장 16:00까지)",
              price: "800엔 (와쿠와쿠자 세트 850엔)",
              tip: "구마모토성 공식 앱 다운로드 → AR로 옛 모습 비교 가능",
              highlights: ["일본 3대 명성", "천수각 6층 360도 파노라마 전망", "2016 지진 후 복원 — 돌담 복구 과정 볼 수 있음", "[팁] 하나바타초역에서 내리면 더 가까움"],
            }
          },
          { time: "14:30", desc: "성채원(조사이엔)", type: "shop", sub: "기념품 + 카라시렌콘 간식",
            detail: {
              name: "사쿠라노바바 조사이엔 (桜の馬場 城彩苑)",
              category: "쇼핑 · 간식",
              address: "熊本市中央区二の丸1-1-1",
              hours: "9:00~17:30 (점포별 상이)",
              tip: "구마모토성 바로 아래, 에도시대 성마을 재현 거리",
              highlights: ["카라시렌콘 간식 꼭 먹어보기", "구마모토 기념품 원스톱 쇼핑", "관광안내소도 있어서 지도·정보 수집 가능"],
            }
          },
          { time: "15:00", desc: "노면전차 → 스이젠지", type: "move", sub: "20분 · 170엔",
            detail: {
              name: "노면전차 (시모토리→스이젠지)",
              category: "교통",
              tip: "B계통 탑승 · 스이젠지코엔마에(水前寺公園) 하차",
              timetable: {
                _routeId: "kumamoto_tram",
                station: "시모토리(辛島町)",
                direction: "스이젠지 방면",
                trains: [
                  { time: "매 6~8분", name: "B계통", dest: "스이젠지 공원", note: "170엔 균일요금 · 약 20분", picked: true },
                ],
              },
              highlights: [
                "B계통 탑승 → '스이젠지코엔마에' 하차",
                "배차 6~8분 간격",
                "하차 후 도보 3분 → 스이젠지 조주엔 입구",
              ],
            }
          },
          { time: "15:25", desc: "스이젠지 조주엔", type: "spot", sub: "400엔 · 후지산 축소판 정원",
            detail: {
              name: "스이젠지 조주엔 (水前寺成趣園)",
              category: "관광",
              address: "熊本市中央区水前寺公園8-1",
              hours: "8:30~17:00",
              price: "400엔",
              tip: "도카이도 53경을 축소 재현한 일본 전통 정원",
              highlights: ["후지산 모양 언덕이 포토스팟", "연못 한바퀴 산책 약 30~40분", "구마모토성과 함께 2대 관광지"],
            }
          },
          { time: "16:05", desc: "노면전차 → 구마모토역 복귀", type: "move", sub: "20분 · 170엔",
            detail: {
              name: "노면전차 (스이젠지→구마모토역)",
              category: "교통",
              tip: "B계통 역방향 탑승 → 구마모토역 전정 하차",
              timetable: {
                _routeId: "kumamoto_tram",
                station: "스이젠지코엔마에",
                direction: "구마모토역 방면",
                trains: [
                  { time: "매 6~8분", name: "B계통 (역방향)", dest: "구마모토역 전정", note: "170엔 균일요금 · 약 20분", picked: true },
                ],
              },
              highlights: [
                "스이젠지코엔마에 → 구마모토역 전정",
                "배차 6~8분 간격",
                "역 도착 후 코인로커 짐 회수",
              ],
            }
          },
        ],
      },
      {
        title: "저녁",
        items: [
          { time: "16:35", desc: "역에서 짐 회수 → 호텔 체크인", type: "stay" },
          { time: "17:00", desc: "호텔에서 잠깐 휴식", type: "info" },
          { time: "18:00", desc: "스가노야 긴자도리점 — 말고기 코스", type: "food", sub: "코스 ~5,000엔 · 전일 예약 필수!",
            detail: {
              name: "스가노야 긴자도리점 (菅乃屋 銀座通り店)",
              category: "식사",
              image: "/images/suginoya.jpg",
              address: "熊本市中央区下通1-9-1 ダイワロイネットホテル 2F",
              hours: "11:30~14:00 / 17:00~20:30",
              price: "코스 5,000~8,000엔",
              tip: "구마모토 바사시의 대명사! 자사 목장 직송 말고기",
              highlights: ["코스: 바사시 모둠 → 구이 → 말고기 초밥 → 디저트", "희소 부위도 맛볼 수 있음", "[참고] 코스는 전일 예약 필수!", "온라인 예약 가능 (핫페퍼/구루나비)"],
            }
          },
          { time: "19:30", desc: "시모토리 야간 산책", type: "spot",
            detail: {
              name: "시모토리 · 신시가이 아케이드",
              category: "관광",
              address: "熊本市中央区下通 / 新市街",
              tip: "구마모토 최대 번화가, 지붕 있는 아케이드라 비와도 OK",
              highlights: ["다양한 카페·숍·이자카야 밀집", "밤에도 안전하고 활기찬 거리"],
            }
          },
          { time: "20:00", desc: "편의점 맥주 → 호텔 복귀", type: "stay" },
        ],
      },
    ],
    notes: "교통: 노면전차 170엔×3~4회 ≈ 700엔 / 입장료: 성 800엔 + 정원 400엔 = 1,200엔",
  },
  {
    day: 3, date: "2/21 (토)", label: "아소산 당일치기",
    color: "#B8912A", icon: "flag", stay: "구마모토 1박", booked: false,
    sections: [
      {
        title: "오전 · 이동",
        items: [
          { time: "10:30", desc: "구마모토역 출발 (JR 호히본선)", type: "move", sub: "JR패스 이용 · 약 1시간 15분",
            detail: {
              name: "구마모토 → 아소 (JR 호히본선)",
              category: "교통",
              image: "/images/asoboi.jpeg",
              tip: "JR 북큐슈 5일권 커버 · 특급 이용 시 지정석 횟수 차감",
              timetable: {
                _routeId: "kumamoto_aso",
                station: "구마모토역",
                direction: "아소 방면 (호히본선)",
                trains: [
                  { time: "09:09", name: "특급 あそぼーい!", dest: "아소·별부", note: "약 1시간 15분", picked: true },
                  { time: "10:30", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분", picked: false },
                  { time: "12:19", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분", picked: false },
                ],
              },
              highlights: [
                "특급 あそぼーい!(아소보이): 토·일·공휴일 운행 관광열차",
                "보통열차는 히고오즈(肥後大津)에서 환승 필요할 수 있음",
                "[참고] 열차 편수가 적으니 시간 반드시 확인!",
              ],
            }
          },
          { time: "11:45", desc: "아소역 도착", type: "move",
            detail: {
              name: "아소역 도착",
              category: "교통",
              tip: "아소역 앞 버스 정류장에서 아소산행 버스 탑승",
              highlights: ["역 앞 관광안내소에서 지도·정보 수집 가능", "코인로커 있음 (400엔~)"],
            }
          },
        ],
      },
      {
        title: "점심",
        items: [
          { time: "12:00", desc: "이마킨 식당 — 아카규동", type: "food", sub: "아카우시 덮밥 1,780엔",
            detail: {
              name: "이마킨 식당 (いまきん食堂)",
              category: "식사",
              address: "阿蘇市内牧290",
              hours: "11:00~15:00 (수요일 휴무)",
              price: "1,780엔",
              tip: "100년 넘은 노포, 토요일이라 일찍 갈수록 좋음",
              highlights: ["레어 구이 아카우시 + 온천 달걀 + 특제 소스", "아소 대표 맛집 — 줄서는 곳이니 일찍 도착 추천"],
            }
          },
        ],
      },
      {
        title: "오후 · 아소산 관광",
        items: [
          { time: "13:00", desc: "아소역 앞 버스 탑승 → 아소산", type: "move", sub: "약 26분 · ~600엔",
            detail: {
              name: "아소역 → 쿠사센리 (산교버스)",
              category: "교통",
              tip: "아소역앞 버스 정류장에서 아소 등산선 탑승",
              timetable: {
                _routeId: "aso_bus_up",
                station: "아소역앞",
                direction: "쿠사센리·아소산상 터미널 방면",
                trains: [
                  { time: "09:40", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "10:25", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "11:50", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "12:50", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: true },
                  { time: "13:30", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "14:10", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "14:35", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                ],
              },
              highlights: [
                "산교(産交)버스 운행 — JR패스 미적용",
                "[참고] 편수 적음 — 반드시 시간 확인",
                "[참고] 혼잡 시 탑승 불가 가능 — 여유있게",
                "동절기(2월) 시간표 변동 가능 — 현지 확인 필수",
              ],
            }
          },
          { time: "13:30", desc: "쿠사센리 초원 + 나카다케 화구 전망", type: "spot", sub: "약 1시간",
            detail: {
              name: "쿠사센리 · 나카다케 화구",
              category: "관광",
              address: "아소산 정상부",
              tip: "화산활동에 따라 화구 접근 제한 가능 — 당일 확인 필수",
              highlights: ["쿠사센리 초원 산책 + 나카다케 활화산 전망", "[참고] 화구 제한 시 Plan B: 승마체험 + 아소 화산박물관", "[참고] 2월 아소산은 0~5°C → 방한 준비 필수!", "화구 상황 확인: aso.ne.jp/~volcano/"],
            }
          },
          { time: "14:30", desc: "버스로 하산 → 아소역", type: "move", sub: "약 26분 · ~600엔",
            detail: {
              name: "쿠사센리 → 아소역 (산교버스)",
              category: "교통",
              tip: "쿠사센리 버스 정류장에서 하행 버스 탑승",
              timetable: {
                _routeId: "aso_bus_down",
                station: "쿠사센리·아소산상 터미널",
                direction: "아소역앞 방면",
                trains: [
                  { time: "10:15", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "11:00", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "12:20", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "13:20", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "14:00", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: true },
                  { time: "14:40", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "15:05", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                ],
              },
              highlights: [
                "산교(産交)버스 운행 — JR패스 미적용",
                "[참고] 마지막 버스 놓치지 않도록 시간 체크!",
                "하산 후 아소 신사 방면으로 이동",
              ],
            }
          },
        ],
      },
      {
        title: "늦은 오후 · 아소 신사",
        items: [
          { time: "15:00", desc: "아소 신사 참배", type: "spot", sub: "약 45분",
            detail: {
              name: "아소 신사 (阿蘇神社)",
              category: "관광",
              address: "아소시 이치노미야마치",
              tip: "일본 전국 약 450개 아소 신사의 총본사",
              highlights: ["2016 지진 후 복원된 누문이 볼거리", "몬젠마치 상점가와 이어져 있음"],
            }
          },
          { time: "15:15", desc: "몬젠마치 상점가 산책", type: "shop",
            detail: {
              name: "몬젠마치 상점가",
              category: "쇼핑 · 간식",
              address: "아소 신사 앞 상점가",
              tip: "아소 신사 바로 앞 먹거리·기념품 거리",
              highlights: ["ASOMILK 소프트아이스크림 꼭 먹어보기 (아베목장 우유)", "아소 특산품·간식 구경하기 좋은 곳"],
            }
          },
          { time: "16:00", desc: "JR로 구마모토 복귀", type: "move", sub: "약 1시간 15분 · JR패스",
            detail: {
              name: "아소 → 구마모토 (JR 호히본선)",
              category: "교통",
              image: "/images/asoboi.jpeg",
              tip: "JR 북큐슈 5일권 커버 · 놓치면 다음 열차까지 대기 길어짐",
              timetable: {
                _routeId: "aso_kumamoto",
                station: "아소역",
                direction: "구마모토 방면 (호히본선)",
                trains: [
                  { time: "14:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분", picked: false },
                  { time: "15:46", name: "특급 あそぼーい!", dest: "구마모토", note: "약 1시간 15분 → 17:01착", picked: true },
                  { time: "16:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분 → 18:08착", picked: false },
                  { time: "17:39", name: "보통열차", dest: "구마모토", note: "약 1시간 40분", picked: false },
                ],
              },
              highlights: [
                "あそぼーい! 15:46발이 가장 빠름 (17:01 도착)",
                "놓칠 경우 16:28 보통열차 (18:08 도착)",
                "[참고] 열차 편수 적음 — 아소 신사에서 시간 조절 필요!",
              ],
            }
          },
        ],
      },
      {
        title: "저녁",
        items: [
          { time: "17:15", desc: "구마모토역 도착 → 숙소 휴식", type: "stay" },
          { time: "18:30", desc: "시모토리로 출발 (노면전차)", type: "move", sub: "15분 · 170엔",
            detail: {
              name: "노면전차 (구마모토역→시모토리)",
              category: "교통",
              tip: "구마모토역 전정에서 A계통 탑승",
              timetable: {
                _routeId: "kumamoto_tram",
                station: "구마모토역 전정",
                direction: "시모토리 방면",
                trains: [
                  { time: "매 6~8분", name: "A계통", dest: "시모토리", note: "170엔 · 약 15분", picked: true },
                ],
              },
              highlights: [
                "A계통 → 시모토리 하차",
                "배차 6~8분 간격",
              ],
            }
          },
          { time: "19:00", desc: "야츠다 — 숯불 야키토리", type: "food", sub: "1인 ~3,000엔",
            detail: {
              name: "야츠다 (炭火焼 やつ田)",
              category: "식사",
              address: "熊本市中央区下通 골목 안",
              hours: "~새벽 1:00",
              price: "1인 2,000~3,000엔",
              tip: "시모토리 골목 안 숯불 야키토리 이자카야",
              highlights: ["당일 도축 조비키도리(朝びき鶏) + 자가제 타레", "사이드: 바사시, 호르몬 니코미 등 구마모토 안주", "늦게까지 영업해서 여유롭게 즐기기 좋음"],
            }
          },
          { time: "20:30", desc: "편의점 들러 숙소 복귀", type: "stay" },
        ],
      },
    ],
    notes: "교통: JR패스 커버 + 아소 버스 ~600엔 / 점심 1,780엔 + 간식 ~500엔 + 저녁 ~3,000엔 ≈ 총 5,880엔 / 2월 아소산 0~5°C 방한 필수!",
  },
  {
    day: 4, date: "2/22 (일)", label: "구마모토 → 유후인",
    color: "#3E8E5B", icon: "compass", stay: "유후인 1박", booked: false,
    sections: [
      {
        title: "이동",
        items: [
          { time: "09:00", desc: "구마모토 호텔 체크아웃", type: "stay" },
          { time: "09:42", desc: "신칸센 탑승 (구마모토→쿠루메)", type: "move", sub: "약 20분 · JR패스",
            detail: {
              name: "구마모토 → 쿠루메 (신칸센)",
              category: "교통",
              tip: "JR 북큐슈 5일권 자유석 탑승 · 쿠루메역에서 큐다이본선 환승",
              timetable: {
                _routeId: "kumamoto_kurume",
                station: "구마모토역",
                direction: "쿠루메(하카타) 방면",
                trains: [
                  { time: "08:00", name: "さくら540", dest: "博多", note: "쿠루메 20분 · 하카타 33분", picked: false },
                  { time: "08:42", name: "つばめ310", dest: "博多", note: "쿠루메 약 30분", picked: false },
                  { time: "09:42", name: "さくら542", dest: "博多", note: "쿠루메 20분", picked: true },
                  { time: "10:42", name: "さくら544", dest: "博多", note: "쿠루메 20분", picked: false },
                  { time: "11:42", name: "さくら546", dest: "博多", note: "쿠루메 20분", picked: false },
                ],
              },
              highlights: [
                "JR 북큐슈 5일권 자유석 탑승 가능",
                "쿠루메역에서 JR큐다이본선 환승 → 유후인",
                "さくら가 빠름 (쿠루메까지 약 20분)",
              ],
            }
          },
          { time: "10:02", desc: "쿠루메역 도착 → 큐다이본선 환승", type: "move" },
          { time: "10:45", desc: "특급 유후인노모리 탑승", type: "move", sub: "약 1시간 40분 · JR패스(지정석)",
            detail: {
              name: "쿠루메 → 유후인 (JR 큐다이본선)",
              category: "교통",
              tip: "JR 북큐슈 5일권 커버 · 유후인노모리는 전석 지정석 (지정석 횟수 차감)",
              timetable: {
                _routeId: "kurume_yufuin",
                station: "쿠루메역",
                direction: "유후인·오이타 방면",
                trains: [
                  { time: "08:45", name: "특급 ゆふいんの森1호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석", picked: false },
                  { time: "10:45", name: "특급 ゆふいんの森3호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석", picked: true },
                  { time: "11:45", name: "특급 ゆふ3호", dest: "유후인·별부", note: "약 1시간 45분 · 자유석 있음", picked: false },
                  { time: "13:45", name: "특급 ゆふいんの森5호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석", picked: false },
                  { time: "16:45", name: "특급 ゆふ5호", dest: "유후인·별부", note: "약 1시간 45분 · 자유석 있음", picked: false },
                ],
              },
              highlights: [
                "ゆふいんの森: 전석 지정석 관광열차 (지정석 횟수 차감)",
                "ゆふ: 자유석 있음 (JR 북큐슈 5일권 자유석 탑승 가능)",
                "[참고] ゆふいんの森는 인기 많아 미리 예약 추천!",
                "차창 밖 큐슈 산간 풍경이 절경",
              ],
            }
          },
          { time: "12:25", desc: "유후인역 도착", type: "move",
            detail: {
              name: "유후인역",
              category: "교통",
              tip: "역 2층에 족탕 있음 (무료) · 유후다케 조망 포인트",
              highlights: ["역 앞에서 유후다케 전경 사진 촬영", "관광안내소에서 지도 수령", "메인거리(유노쓰보가도)까지 도보 5분"],
            }
          },
        ],
      },
      {
        title: "오후 · 저녁",
        items: [
          { time: "12:30", desc: "유후인 료칸 체크인 & 짐 맡기기", type: "stay" },
          { time: "13:00", desc: "유후인 유노쓰보 거리 산책", type: "shop",
            detail: {
              name: "유노쓰보가도 (湯の坪街道)",
              category: "쇼핑",
              address: "유후인역 → 긴린코 방면 메인거리",
              tip: "역에서 긴린코까지 약 800m, 왕복 1~2시간 여유있게",
              highlights: ["B-speak 롤케이크 (오전 매진 주의)", "금상 고로케 먹어보기", "플로럴 빌리지 (동화마을)", "밀히(Milch) 푸딩"],
            }
          },
          { time: "15:00", desc: "긴린코 호수 산책", type: "spot",
            detail: {
              name: "긴린코 (金鱗湖)",
              category: "관광",
              address: "유후인 메인거리 끝",
              tip: "겨울 아침에 물안개 피어오르는 포토스팟",
              highlights: ["메인거리 끝에 위치 (도보 15분)", "호수 주변 카페·갤러리 산책", "겨울 아침 물안개 포토 추천"],
            }
          },
          { time: "16:00", desc: "료칸 복귀 & 온천", type: "stay" },
          { time: "저녁", desc: "료칸 카이세키 요리", type: "food" },
        ],
      },
    ],
    notes: "구마모토→쿠루메(신칸센 20분)→유후인(특급 1시간 40분) / JR 5일권 커버 / 료칸 후보: 센도·바이엔·겟토안",
  },
  {
    day: 5, date: "2/23 (월)", label: "유후인 → 하카타",
    color: "#3A7DB5", icon: "shopping", stay: "하카타 1박", booked: false,
    sections: [
      {
        title: "오전",
        items: [
          { time: "09:00", desc: "킨린코 호수 아침 산책", type: "spot",
            detail: {
              name: "긴린코 아침 산책",
              category: "관광",
              address: "유후인 메인거리 끝",
              tip: "겨울 아침 물안개가 피어오르는 환상적인 풍경",
              highlights: ["아침 일찍 가면 물안개 볼 확률 높음", "료칸 조식 후 산책 추천"],
            }
          },
          { time: "10:00", desc: "료칸 체크아웃 & 유후인역 이동", type: "stay" },
        ],
      },
      {
        title: "이동",
        items: [
          { time: "11:18", desc: "특급 유후인노모리 탑승 → 하카타", type: "move", sub: "약 2시간 15분 · JR패스(지정석)",
            detail: {
              name: "유후인 → 하카타 (JR 특급)",
              category: "교통",
              tip: "JR 북큐슈 5일권 커버 · 유후인노모리는 전석 지정석",
              timetable: {
                _routeId: "yufuin_hakata",
                station: "유후인역",
                direction: "하카타 방면",
                trains: [
                  { time: "11:18", name: "특급 ゆふいんの森2호", dest: "博多", note: "약 2시간 15분", picked: true },
                  { time: "13:55", name: "특급 ゆふ4호", dest: "博多", note: "약 2시간 20분", picked: false },
                  { time: "15:38", name: "특급 ゆふいんの森4호", dest: "博多", note: "약 2시간 15분", picked: false },
                  { time: "16:45", name: "특급 ゆふいんの森6호", dest: "博多", note: "약 2시간 15분", picked: false },
                  { time: "17:06", name: "특급 ゆふ6호", dest: "博多", note: "약 2시간 20분", picked: false },
                ],
              },
              highlights: [
                "ゆふいんの森: 전석 지정석 관광열차",
                "ゆふ: 자유석 있음 (JR 북큐슈 5일권)",
                "[참고] ゆふいんの森는 인기 많아 미리 예약!",
                "차창 밖 큐슈 산간 풍경 감상",
              ],
            }
          },
          { time: "13:33", desc: "하카타역 도착", type: "move",
            detail: {
              name: "하카타역 도착",
              category: "교통",
              tip: "하카타역에서 숙소 체크인 후 쇼핑 시작",
              highlights: ["캐널시티까지 도보 10분", "텐진까지 지하철 5분"],
            }
          },
        ],
      },
      {
        title: "오후 · 저녁",
        items: [
          { time: "14:00", desc: "숙소 체크인 & 짐 맡기기", type: "stay" },
          { time: "14:30", desc: "캐널시티 / 텐진 쇼핑", type: "shop",
            detail: {
              name: "텐진·캐널시티 쇼핑",
              category: "쇼핑",
              tip: "텐진 지하상가 + 캐널시티 + 하카타역 주변",
              highlights: ["텐진 지하상가: 150개+ 매장, 비올 때 최적", "캐널시티: 분수 쇼 + 쇼핑", "면세 쇼핑은 여권 지참 필수"],
            }
          },
          { time: "19:00", desc: "나카스 포장마차 야타이 체험", type: "food",
            detail: {
              name: "나카스 야타이 (포장마차)",
              category: "식사",
              address: "福岡市博多区中洲 나카가와 강변",
              hours: "저녁 6시경~",
              price: "1인 2,000~3,000엔",
              tip: "강변 포장마차 줄에서 분위기 좋은 곳 골라 앉기",
              highlights: ["라멘, 교자, 오뎅, 야키토리 등 다양", "한 곳당 8~10석 소규모", "후쿠오카 여행의 하이라이트!"],
            }
          },
          { time: "21:00", desc: "숙소 복귀", type: "stay" },
        ],
      },
    ],
    notes: "유후인→하카타 JR 특급 약 2시간 15분 (5일권 커버) / 오후: 텐진·캐널시티 쇼핑",
  },
  {
    day: 6, date: "2/24 (화)", label: "하카타 → 인천",
    color: "#7161A5", icon: "navigation", stay: "귀국", booked: true,
    sections: [
      {
        title: "오전",
        items: [
          { time: "07:30", desc: "숙소 체크아웃", type: "stay" },
          { time: "08:00", desc: "하카타역 → 후쿠오카공항", type: "move", sub: "직행버스 20분 · 310엔",
            detail: {
              name: "하카타역 → 후쿠오카공항 국제선",
              category: "교통",
              tip: "출국 2시간 전 공항 도착 권장 — 8시 출발이면 여유",
              timetable: {
                _routeId: "hakata_fukuoka_airport",
                station: "하카타역",
                direction: "후쿠오카공항 국제선 방면",
                trains: [
                  { time: "매 15~20분", name: "직행버스 (니시테츠)", dest: "공항 국제선 터미널", note: "약 20분 · 310엔", picked: true },
                  { time: "매 5~8분", name: "지하철+셔틀", dest: "공항역 → 국제선 환승", note: "약 25~35분 · 260엔", picked: false },
                ],
              },
              highlights: [
                "직행버스: 하카타역 치쿠시구치 → 국제선 직행",
                "지하철: 하카타역 → 공항역(5분) → 무료셔틀로 국제선(10분)",
                "[참고] 국제선은 국내선과 별도 터미널!",
                "출국 2시간 전 공항 도착 권장",
              ],
            }
          },
          { time: "08:30", desc: "후쿠오카공항 도착 → 면세 쇼핑", type: "shop",
            detail: {
              name: "후쿠오카공항 면세 쇼핑",
              category: "쇼핑",
              tip: "출국 수속 후 면세 구역에서 쇼핑",
              highlights: ["면세점에서 위스키·화장품·과자류 구매", "못 산 기념품 마지막 찬스"],
            }
          },
          { time: "10:30", desc: "후쿠오카공항 출발 (KE788)", type: "move",
            detail: {
              name: "후쿠오카 → 인천 (KE788)",
              category: "교통",
              tip: "대한항공 KE788 · 후쿠오카 10:30 → 인천 12:00",
              highlights: ["대한항공 KE788", "비행시간 약 1시간 30분", "수하물 1pc (23kg)"],
            }
          },
          { time: "12:00", desc: "인천공항 도착", type: "move",
            detail: {
              name: "인천공항 도착",
              category: "교통",
              tip: "입국심사 + 수하물 수령 후 귀가",
              highlights: ["수하물 수령 → 세관 → 출구"],
            }
          },
        ],
      },
    ],
    notes: "대한항공 KE788 · 수하물 1pc · 출국 2시간 전 공항 도착 권장",
  },
];

const DAY_INFO = {
  1: {
    meals: {
      dinner: [
        { name: "캐널시티 라멘스타디움", time: "18:25", price: "~1,000엔", mapQuery: "キャナルシティ博多 ラーメンスタジアム", note: "전국 유명 라멘 8개 점포 푸드코트" },
        { name: "쿠라스시 나카스점", time: "20:20", price: "1인 1,500~2,500엔", mapQuery: "くら寿司 中洲店 福岡", note: "회전초밥, 터치패널 주문" },
      ],
    },
    stay: { name: "하카타 에어비앤비", address: "福岡市博多区住吉 2-13-13", mapQuery: "福岡市博多区住吉 2-13-13", checkin: "18:15", checkout: "Day2 10:00", note: "캐널시티 도보 3분 / 하카타역 도보 15분" },
  },
  2: {
    meals: {
      lunch: [
        { name: "코란테이 (紅蘭亭)", time: "12:10", price: "~1,200엔", mapQuery: "紅蘭亭 下通本店 熊本", note: "타이피엔 — 구마모토 향토 중화 당면 스프" },
      ],
      dinner: [
        { name: "스가노야 긴자도리점", time: "18:00", price: "코스 5,000~8,000엔", mapQuery: "菅乃屋 銀座通り店 熊本", note: "바사시(말고기) 코스 · [참고] 전일 예약 필수!" },
      ],
    },
    stay: { name: "구마모토 호텔", address: "구마모토역 근처", mapQuery: "熊本駅 ホテル", checkin: "16:35", checkout: "Day3 아침", note: "구마모토역에서 도보 이동" },
  },
  3: {
    meals: {
      lunch: [
        { name: "이마킨 식당 — 아카규동", time: "12:00", price: "1,780엔", mapQuery: "いまきん食堂 阿蘇", note: "100년 노포, 아카우시 덮밥 · 줄서는 곳" },
      ],
      dinner: [
        { name: "야츠다 — 숯불 야키토리", time: "19:00", price: "1인 ~3,000엔", mapQuery: "炭火焼やつ田 熊本 下通", note: "당일 도축 조비키도리 + 구마모토 안주" },
      ],
    },
    stay: { name: "구마모토 호텔", address: "구마모토역 근처", mapQuery: "熊本駅 ホテル", checkin: "17:15 (귀환)", checkout: "Day4 오전", note: "Day2와 동일 숙소" },
  },
  4: {
    meals: {
      dinner: [
        { name: "료칸 카이세키 요리", time: "저녁", price: "숙박 포함", mapQuery: "由布院 旅館", note: "료칸 내 일본 전통 코스 요리" },
      ],
    },
    stay: { name: "유후인 료칸", address: "유후인 온천 지역", mapQuery: "由布院温泉 旅館", checkin: "점심경", checkout: "Day5 오전", note: "료칸 후보: 센도·바이엔·겟토안 / 온천 포함" },
  },
  5: {
    meals: {
      dinner: [
        { name: "나카스 포장마차 야타이", time: "저녁", price: "1인 2,000~3,000엔", mapQuery: "中洲屋台 福岡", note: "강변 포장마차 — 라멘, 교자, 야키토리" },
      ],
    },
    stay: { name: "하카타 숙소", address: "하카타역 인근", mapQuery: "博多駅 ホテル", checkin: "오후", checkout: "Day6 오전", note: "캐널시티·텐진 접근 용이한 곳" },
  },
  6: {
    meals: {},
    stay: { name: "귀국", address: "후쿠오카 공항", mapQuery: "福岡空港 国際線", checkin: "-", checkout: "10:30 출발", note: "KE788 후쿠오카 10:30 → 인천 12:00" },
  },
};

function DayInfoDialog({ dayNum, tab, onClose, color }) {
  const [activeTab, setActiveTab] = useState(tab);
  const info = DAY_INFO[dayNum];
  if (!info) return null;

  const meals = info.meals || {};
  const mealSections = [];
  if (meals.breakfast) mealSections.push({ label: "조식", items: meals.breakfast });
  if (meals.lunch) mealSections.push({ label: "점심", items: meals.lunch });
  if (meals.dinner) mealSections.push({ label: "석식", items: meals.dinner });

  return (
    <BottomSheet onClose={onClose} maxHeight="75vh">
        {/* Header with tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid #EEECE6", flexShrink: 0,
        }}>
          {["meals", "stay"].map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: "14px 0", border: "none", background: "none",
              borderBottom: activeTab === t ? `2.5px solid ${color}` : "2.5px solid transparent",
              color: activeTab === t ? color : "#aaa",
              fontSize: "13px", fontWeight: activeTab === t ? 700 : 400,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            }}>
              {t === "meals" ? <><Icon name="fire" size={14} />식사</> : <><Icon name="home" size={14} />숙소</>}
            </button>
          ))}
          <button onClick={onClose} style={{
            position: "absolute", right: "24px", marginTop: "8px",
            border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}><Icon name="close" size={14} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>

          {/* 식사 탭 */}
          {activeTab === "meals" && (
            <>
              {mealSections.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: "13px" }}>
                  식사 정보가 없습니다
                </div>
              ) : (
                mealSections.map((section, si) => (
                  <div key={si} style={{ marginBottom: "16px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px",
                    }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: "20px",
                        fontSize: "11px", fontWeight: 700,
                        background: `${color}15`, color: color,
                      }}>
                        {section.label}
                      </span>
                      <div style={{ flex: 1, height: "1px", background: "#EEECE6" }} />
                    </div>
                    {section.items.map((meal, mi) => (
                      <div key={mi} style={{
                        padding: "12px 14px", background: "#FAFAF8",
                        borderRadius: "12px", border: "1px solid #EEECE6",
                        marginBottom: "8px",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#111" }}>{meal.name}</p>
                            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#666", lineHeight: 1.5 }}>{meal.note}</p>
                          </div>
                          <MapButton query={meal.mapQuery} />
                        </div>
                        <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "10px", color: "#888" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Icon name="clock" size={12} />{meal.time}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Icon name="pricetag" size={12} />{meal.price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          )}

          {/* 숙소 탭 */}
          {activeTab === "stay" && info.stay && (
            <div style={{
              padding: "16px", background: "#FAFAF8",
              borderRadius: "12px", border: "1px solid #EEECE6",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "10px" }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#111" }}>{info.stay.name}</p>
                <MapButton query={info.stay.mapQuery} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="pin" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>{info.stay.address}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="lock" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>체크인 {info.stay.checkin} / 체크아웃 {info.stay.checkout}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bulb" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>{info.stay.note}</span>
                </div>
              </div>
            </div>
          )}
        </div>
    </BottomSheet>
  );
}

const TYPE_CONFIG = {
  food: { icon: "fire", bg: "#FFF3EC", border: "#FDDCC8", text: "#C75D20" },
  spot: { icon: "pin", bg: "#EEF6FF", border: "#C8DFF5", text: "#2B6CB0" },
  shop: { icon: "shopping", bg: "#F3F0FF", border: "#D5CCF5", text: "#6B46C1" },
  move: { icon: "navigation", bg: "#F5F5F4", border: "#E0DFDC", text: "#6B6B67" },
  stay: { icon: "home", bg: "#F0FAF4", border: "#C6F0D5", text: "#2A7D4F" },
  info: { icon: "flash", bg: "#FFFDE8", border: "#F0EAAC", text: "#8A7E22" },
};

const CATEGORY_COLORS = {
  "식사": { bg: "#FFF3EC", color: "#C75D20", border: "#FDDCC8" },
  "관광": { bg: "#EEF6FF", color: "#2B6CB0", border: "#C8DFF5" },
  "쇼핑": { bg: "#F3F0FF", color: "#6B46C1", border: "#D5CCF5" },
  "쇼핑 · 간식": { bg: "#F3F0FF", color: "#6B46C1", border: "#D5CCF5" },
  "숙소": { bg: "#F0FAF4", color: "#2A7D4F", border: "#C6F0D5" },
  "교통": { bg: "#FFFDE8", color: "#8A7E22", border: "#F0EAAC" },
};

const GUIDE_DATA = [
  {
    region: "하카타",
    color: "#E8594F",
    chips: ["전체", "쇼핑", "먹거리", "구경거리"],
    items: [
      { chip: "쇼핑", name: "캐널시티 하카타", sub: "キャナルシティ博多", mapQuery: "キャナルシティ博多", desc: "복합 쇼핑몰. 쇼핑, 영화, 라멘스타디움까지", details: ["라멘스타디움 5층 — 전국 유명 라멘 8개점 집결", "무인양품, 유니클로, ABC마트 등", "매일 분수 쇼 (음악+조명)"], tip: "Day1 도착 후 저녁 겸 방문 추천" },
      { chip: "쇼핑", name: "돈키호테 나카스점", sub: "ドン・キホーテ 中洲店", mapQuery: "ドンキホーテ 中洲店 福岡", desc: "24시간 할인 잡화점. 면세 가능 (여권 필수)", details: ["의약품, 화장품, 위스키, 과자, 전자기기", "면세 카운터 별도 운영", "나카스 야타이 가기 전 들르기 좋음"], tip: "Day1 야타이 전 or Day6 새벽 쇼핑" },
      { chip: "쇼핑", name: "텐진 지하상가", sub: "天神地下街", mapQuery: "天神地下街 福岡", desc: "150개 이상 매장이 모인 대형 지하 쇼핑가", details: ["패션, 잡화, 카페, 드럭스토어", "비 올 때 쇼핑 동선으로 최적", "니시테츠 텐진역 직결"], tip: "Day6 오전 공항 가기 전 활용" },
      { chip: "먹거리", name: "하카타 라멘", sub: "博多ラーメン", mapQuery: "一蘭 中洲店 福岡", desc: "돈코츠 라멘의 본고장. 이치란, 잇푸도 등", details: ["이치란 나카스점 — 24시간, 칸막이석", "잇푸도 본점 — 하카타역 근처", "면 굵기·국물 농도 주문 가능"], tip: "캐널시티 라멘스타디움에서 비교 체험" },
      { chip: "먹거리", name: "나카스 야타이 (포장마차)", sub: "中洲屋台", mapQuery: "中洲屋台 福岡", desc: "나카가와 강변 포장마차 거리. 라멘, 꼬치 등", details: ["저녁 6시경부터 오픈", "한 곳당 8~10석 소규모", "라멘, 교자, 오뎅, 야키토리 등"], tip: "Day1 저녁 or Day6 전날 밤" },
      { chip: "먹거리", name: "쿠라스시 나카스점", sub: "くら寿司", mapQuery: "くら寿司 中洲店 福岡", desc: "가성비 회전초밥. 1접시 115엔~", details: ["터치패널 주문", "비쿠라 가챠 게임 (5접시마다)"], tip: "Day1 가볍게 초밥 저녁으로" },
      { chip: "구경거리", name: "나카스 강변 야경", sub: "中洲リバーサイド", mapQuery: "中洲 中央通り 福岡", desc: "나카가와 강변 네온 야경", details: ["야타이 포장마차 불빛 + 강 반영", "나카스~텐진 구간 산책 추천"], tip: "야타이 방문 전후 산책" },
    ],
  },
  {
    region: "구마모토",
    color: "#2A7D4F",
    chips: ["전체", "구경거리", "먹거리", "굿즈", "쇼핑스팟"],
    items: [
      { chip: "구경거리", name: "쿠마몬 스퀘어", sub: "くまモンスクエア", mapQuery: "くまモンスクエア 熊本", desc: "쓰루야 백화점 내 무료 체험 공간", details: ["360도 스테이지, 포토스팟, AR 게임", "BAZAAR — 100종류 이상 굿즈, 한정 레어 아이템", "카페: 데코폰 주스, 구마모토산 과일 디저트"], schedule: "공연 11:30 / 14:00 (매일) + 16:30 (주말)", tip: "Day2 시모토리 동선에서 쓰루야 백화점과 함께" },
      { chip: "구경거리", name: "쿠마몬 빌리지", sub: "くまモンビレッジ", mapQuery: "くまモンビレッジ サクラマチ熊本", desc: "사쿠라마치 쇼핑몰 2층 굿즈 전문매장", details: ["스퀘어보다 상품 종류 더 다양", "5,000엔 이상 면세 가능", "5층 옥상 자이언트 쿠마몬 + 일본식 정원", "같은 건물: 지브리숍, 가차숍, 버스터미널"], tip: "Day3 저녁 야츠다 가기 전 잠깐 들르기" },
      { chip: "구경거리", name: "원피스 루피 동상", sub: "ルフィ像", mapQuery: "ルフィ像 熊本県庁", desc: "구마모토현청 앞 부흥 프로젝트 동상", details: ["오다 에이이치로 출신지 → 2016년 대지진 부흥", "시내: 루피(현청), 쵸파(동식물원)", "동상 옆 QR코드 → 캐릭터 대사 재생"], tip: "Day2 스이젠지 공원 가는 길에 인증샷" },
      { chip: "구경거리", name: "가미토리 쿠마몬 조형물", sub: "上通りアーケード", mapQuery: "上通りアーケード 熊本", desc: "가미토리 상점가 중심부 대형 조형물", details: ["시모토리와 연결", "현대미술관·전통공예관 인접"], tip: "시모토리보다 한적, 여유롭게 인증샷" },
      { chip: "먹거리", name: "쿠리센리 (栗千里)", sub: null, mapQuery: "鶴屋百貨店 熊本", desc: "구마모토산 밤 구운 몽블랑. 전국 향토 간식 1위", details: ["개별포장 선물용 최적", "5개입 729엔 / 8개입 1,166엔"], tip: "쓰루야 백화점, JR구마모토역, 공항에서 구매" },
      { chip: "먹거리", name: "이키나리당고", sub: null, mapQuery: "大福堂 上通り 熊本", desc: "고구마+팥 향토 만두. 1개 100엔", details: ["구마모토 사투리로 '간단하게'라는 뜻"], tip: "다이후쿠도(가미토리 근처)에서 현지 체험" },
      { chip: "먹거리", name: "카라시렌콘", sub: null, mapQuery: "森からし蓮根 熊本", desc: "400년 역사. 연근에 겨자 채워 튀긴 명물", details: ["선물박스 있음"], tip: "모리 카라시렌콘, 쓰루야 백화점" },
      { chip: "먹거리", name: "후가롤 (ふがロール)", sub: null, mapQuery: "Hez 本店 熊本", desc: "바삭한 과자. 유통기한 10~11개월", details: ["843엔~ / 선물용 안심"], tip: "에즈 본점, 쓰루야 백화점, 공항" },
      { chip: "먹거리", name: "구마모토 라멘 (인스턴트)", sub: null, mapQuery: "ドンキホーテ 下通り 熊本", desc: "마늘기름+돈코츠 국물 포장라멘", details: ["선물용 인기 아이템"], tip: "돈키호테, 기념품점, 공항에서 구매" },
      { chip: "굿즈", name: "쿠마몬 굿즈", sub: null, mapQuery: "くまモンビレッジ サクラマチ熊本", desc: "머그컵, 에코백, 수건, 볼펜, 스트랩 등", details: ["쿠마몬 빌리지(사쿠라마치), 쿠마몬 스퀘어(쓰루야)"], tip: "두 매장 비교 후 구매 추천" },
      { chip: "굿즈", name: "쿠마몬 스퀘어 한정", sub: null, mapQuery: "くまモンスクエア 熊本", desc: "실사 쿠마몬 상품, 시즌 한정판 (여기서만)", details: ["BAZAAR 코너 only"], tip: "스퀘어 방문 시 꼭 체크" },
      { chip: "굿즈", name: "히고코마 (肥後こま)", sub: null, mapQuery: "熊本県伝統工芸館", desc: "에도시대 전통 팽이. 12종 모양, 행운 부적", details: ["오장육부 상징 컬러"], tip: "전통공예관, 기념품점" },
      { chip: "굿즈", name: "히고 상감 (肥後象嵌)", sub: null, mapQuery: "熊本県伝統工芸館", desc: "400년 전통 금속공예. 펜던트, 넥타이핀", details: ["일본 전통공예품 지정"], tip: "쓰루야 백화점, 전통공예관" },
      { chip: "쇼핑스팟", name: "시모토리 아케이드", sub: "下通り", mapQuery: "下通りアーケード 熊本", desc: "구마모토 최대 아케이드 (510m, 폭 15m)", details: ["돈키호테 시모토리점 — 면세 가능 (여권 필수)", "드럭스토어 — 코스모스, 마츠모토키요시", "각종 잡화점, 카페, 음식점"], tip: "Day2, Day3 저녁 동선에서 자연스럽게" },
      { chip: "쇼핑스팟", name: "쓰루야 백화점", sub: "鶴屋百貨店", mapQuery: "鶴屋百貨店 熊本", desc: "구마모토현 유일 백화점. 본관/별관/윙관", details: ["쿠마몬 스퀘어 (무료, 공연+굿즈+카페)", "지하 식품관 — 과자 기념품 집중 구매", "본관 1층 — 손수건, 양말, 우산", "별관 2층 — 명품 (면세 가능)"], tip: "시모토리에서 도보 연결" },
      { chip: "쇼핑스팟", name: "사쿠라마치 쇼핑몰", sub: "SAKURA MACHI", mapQuery: "SAKURA MACHI Kumamoto", desc: "쇼핑몰 + 호텔 + 버스터미널 복합시설", details: ["쿠마몬 빌리지 (2층) — 굿즈 최다", "지브리숍, 가차숍", "5층 옥상 — 자이언트 쿠마몬 + 정원"], tip: "시모토리에서 도보 5분" },
      { chip: "쇼핑스팟", name: "JR 구마모토역", sub: "히고요카몬 시장", mapQuery: "JR熊本駅 肥後よかモン市場", desc: "역 안 기념품 구역", details: ["쿠리센리 등 대표 과자 대부분 구비", "출발/도착 시 빠르게 사기 좋음"], tip: "Day2 도착, Day4 출발 시 활용" },
    ],
  },
  {
    region: "유후인",
    color: "#6B46C1",
    chips: ["전체", "구경거리", "먹거리", "쇼핑"],
    items: [
      { chip: "구경거리", name: "유후인 플로럴 빌리지", sub: "湯布院フローラルヴィレッジ", mapQuery: "湯布院フローラルヴィレッジ", desc: "영국 코츠월드풍 동화마을", details: ["지브리 굿즈숍, 고양이카페", "알프스 소녀 하이디, 피터래빗 숍", "포토스팟 다수 — 인증샷 필수"], tip: "유후인 메인거리 초입에 위치" },
      { chip: "구경거리", name: "긴린코 호수", sub: "金鱗湖", mapQuery: "金鱗湖 由布院", desc: "유후인 상징 호수. 아침 물안개가 명물", details: ["메인거리 끝에 위치 (도보 15분)", "호수 주변 카페·갤러리 산책", "겨울 아침 물안개 포토 추천"], tip: "유후인 산책 동선의 마지막 목적지" },
      { chip: "구경거리", name: "유후다케 조망", sub: "由布岳", mapQuery: "由布院駅 展望台", desc: "유후인역 앞에서 보는 유후다케 전경", details: ["역 2층 족탕에서 산 감상 가능", "맑은 날 사진 찍기 최적"], tip: "역 도착 직후 체크" },
      { chip: "먹거리", name: "유후인 롤케이크", sub: null, mapQuery: "Bスピーク 由布院", desc: "B-speak 롤케이크. 유후인 디저트 1위", details: ["오전에 매진되는 경우 많음", "P롤(하프) / B롤(풀) 선택"], tip: "역 도착 후 바로 예약/구매 추천" },
      { chip: "먹거리", name: "크로켓 (고로케)", sub: null, mapQuery: "湯布院 金賞コロッケ", desc: "메인거리 산책하며 먹는 간식", details: ["금상 수상 고로케 등 여러 가게", "1개 200~300엔"], tip: "메인거리 걸으면서 먹기" },
      { chip: "먹거리", name: "푸린 (푸딩)", sub: null, mapQuery: "由布院 ミルヒ", desc: "유후인 우유로 만든 진한 푸딩", details: ["밀히(Milch) 등 여러 전문점", "소프트아이스크림도 인기"], tip: "플로럴빌리지 근처 디저트 타임" },
      { chip: "쇼핑", name: "유후인 메인거리", sub: "湯の坪街道", mapQuery: "湯の坪街道 由布院", desc: "역~긴린코 약 800m 메인 쇼핑거리", details: ["잡화점, 기념품점, 갤러리 밀집", "유후인 한정 상품 다수", "족탕 카페, 디저트 가게"], tip: "왕복 1~2시간 여유있게 산책" },
      { chip: "쇼핑", name: "지브리 & 캐릭터숍", sub: null, mapQuery: "どんぐりの森 湯布院", desc: "도토리의 숲(どんぐりの森) 등 캐릭터 매장", details: ["토토로, 킥키 등 지브리 굿즈", "플로럴빌리지 내 위치"], tip: "지브리 팬이라면 필수 방문" },
    ],
  },
];

function MapButton({ query }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank");
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "4px 10px", border: "1px solid #D4E8D0", borderRadius: "8px",
        background: "#F0F8EE", color: "#2D7A3A", fontSize: "10px", fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      <Icon name="pin" size={10} />지도
    </button>
  );
}

function GuideCard({ item }) {
  return (
    <div style={{
      marginBottom: "10px", padding: "14px",
      background: "#FAFAF8", borderRadius: "12px",
      border: "1px solid #EEECE6",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#111" }}>{item.name}</p>
          {item.sub && <p style={{ margin: 0, fontSize: "9px", color: "#aaa", marginTop: "1px" }}>{item.sub}</p>}
        </div>
        <MapButton query={item.mapQuery} />
      </div>
      <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#666", lineHeight: 1.5 }}>{item.desc}</p>
      {item.schedule && (
        <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#C75D20", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}><Icon name="clock" size={12} />{item.schedule}</p>
      )}
      {item.details && item.details.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "8px" }}>
          {item.details.map((d, j) => (
            <div key={j} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "#ccc", fontSize: "8px", marginTop: "5px", flexShrink: 0 }}>●</span>
              <span style={{ fontSize: "11px", color: "#555", lineHeight: 1.5 }}>{d}</span>
            </div>
          ))}
        </div>
      )}
      {item.tip && (
        <div style={{
          padding: "6px 10px", background: "#FFF9E8", borderRadius: "8px",
          border: "1px solid #F0E8C8",
        }}>
          <span style={{ fontSize: "10px", color: "#8A7322", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: "4px" }}><Icon name="bulb" size={12} style={{ marginTop: "1px" }} /><span>{item.tip}</span></span>
        </div>
      )}
    </div>
  );
}

function ShoppingGuideDialog({ onClose }) {
  const [regionIdx, setRegionIdx] = useState(0);
  const [chipIdx, setChipIdx] = useState(0);
  const region = GUIDE_DATA[regionIdx];
  const filtered = chipIdx === 0 ? region.items : region.items.filter((it) => it.chip === region.chips[chipIdx]);

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
        {/* Header */}
        <div style={{
          padding: "6px 16px 0 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1c1b21", display: "flex", alignItems: "center", gap: "6px" }}>
            <Icon name="bookOpen" size={16} />여행 가이드
          </h3>
          <button onClick={onClose} style={{
            border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}><Icon name="close" size={14} /></button>
        </div>

        {/* Region Tabs */}
        <div style={{
          display: "flex", gap: 0, padding: "12px 20px 0",
          borderBottom: "1px solid #EEECE6",
        }}>
          {GUIDE_DATA.map((r, i) => (
            <button key={i} onClick={() => { setRegionIdx(i); setChipIdx(0); }} style={{
              flex: 1, padding: "9px 0", border: "none", background: "none",
              borderBottom: regionIdx === i ? `2.5px solid ${r.color}` : "2.5px solid transparent",
              color: regionIdx === i ? r.color : "#aaa",
              fontSize: "13px", fontWeight: regionIdx === i ? 700 : 400,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>
              {r.region}
            </button>
          ))}
        </div>

        {/* Category Chips */}
        <div style={{
          display: "flex", gap: "6px", padding: "12px 20px 0",
          overflowX: "auto", flexShrink: 0,
        }}>
          {region.chips.map((c, i) => (
            <button key={c} onClick={() => setChipIdx(i)} style={{
              flex: "none", padding: "5px 12px", borderRadius: "20px",
              border: chipIdx === i ? `1.5px solid ${region.color}` : "1.5px solid #E8E6E1",
              background: chipIdx === i ? region.color : "#fff",
              color: chipIdx === i ? "#fff" : "#777",
              fontSize: "11px", fontWeight: chipIdx === i ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              {c}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
          {filtered.map((item, i) => (
            <GuideCard key={`${regionIdx}-${chipIdx}-${i}`} item={item} />
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#bbb", fontSize: "13px" }}>
              항목이 없습니다
            </div>
          )}
        </div>
    </BottomSheet>
  );
}

function DocumentDialog({ onClose }) {
  const [tab, setTab] = useState(0);
  const [viewImage, setViewImage] = useState(null);
  const tabs = [
    { label: "항공권", icon: "navigation", image: "/images/ticket_departure.jpg", caption: "KE8795 인천→후쿠오카 / KE788 후쿠오카→인천" },
    { label: "JR패스", icon: "car", image: "/images/jrpass.jpg", caption: "JR 북큐슈 5일권 · 예약번호: FGY393247 (성인 2매)" },
  ];
  const current = tabs[tab];

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
        {/* Dialog header */}
        <div style={{
          padding: "6px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1c1b21", display: "flex", alignItems: "center", gap: "6px" }}>
            <Icon name="file" size={16} />여행 서류
          </h3>
          <button onClick={onClose} style={{
            border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}><Icon name="close" size={14} /></button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: "6px", padding: "14px 20px 0",
        }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              flex: 1, padding: "9px 0", border: "none", borderRadius: "10px",
              background: tab === i ? "#1a1a1a" : "#F2F1ED",
              color: tab === i ? "#fff" : "#777",
              fontSize: "12px", fontWeight: tab === i ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            }}>
              <Icon name={t.icon} size={12} style={tab === i ? { filter: "brightness(0) invert(1)" } : {}} />{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>
          {/* Caption */}
          <p style={{
            margin: "0 0 12px", fontSize: "11px", color: "#888",
            lineHeight: 1.5, textAlign: "center",
          }}>
            {current.caption}
          </p>

          {/* Image or placeholder */}
          {current.image ? (
            <div
              onClick={() => setViewImage(current.image)}
              style={{
                borderRadius: "12px", overflow: "hidden",
                border: "1px solid #EEECE6",
                background: "#F9F9F7",
                aspectRatio: "595 / 842",
                width: "100%",
                cursor: "zoom-in",
              }}
            >
              <img
                src={current.image}
                alt={current.label}
                style={{
                  width: "100%", height: "100%", display: "block",
                  objectFit: "contain",
                }}
              />
            </div>
          ) : (
            <div style={{
              borderRadius: "12px", border: "2px dashed #DDD8CB",
              padding: "40px 20px", textAlign: "center",
              background: "#FDFCF8",
            }}>
              <Icon name="pricetag" size={32} />
              <p style={{
                margin: "10px 0 4px", fontSize: "13px", fontWeight: 600, color: "#999",
              }}>
                이미지 준비 중
              </p>
              <p style={{
                margin: 0, fontSize: "11px", color: "#bbb", lineHeight: 1.5,
              }}>
                public/images/ 폴더에<br />JR패스 이미지를 추가해주세요
              </p>
            </div>
          )}

          {/* Extra info for JR pass tab */}
          {tab === 1 && (
            <div style={{
              marginTop: "14px", padding: "14px",
              background: "#FAFAF8", borderRadius: "12px",
              border: "1px solid #EEECE6",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="pricetag" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>JR 북큐슈 5일권 (17,000엔/인)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="calendar" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>Day2~6 커버 (2/20~2/24)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bookmark" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>예약번호: FGY393247 (성인 2매)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bulb" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>하카타역 みどりの窓口에서 바우처→실물 교환<br/>여권 + Klook 바우처 바코드 필요</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="car" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>신칸센 자유석 무제한 · 지정석 6회</span>
                </div>
              </div>
            </div>
          )}

          {/* Extra info for flight tab */}
          {tab === 0 && (
            <div style={{
              marginTop: "14px", padding: "14px",
              background: "#FAFAF8", borderRadius: "12px",
              border: "1px solid #EEECE6",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="navigation" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}><b>가는편</b> KE8795 · 인천 15:30 → 후쿠오카 17:10</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="navigation" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}><b>오는편</b> KE788 · 후쿠오카 10:30 → 인천 12:00</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="briefcase" size={14} /></div>
                  <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>수하물 1pc 포함</span>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Image Viewer */}
      <ImageViewer src={viewImage} alt={current.label} onClose={() => setViewImage(null)} />
    </BottomSheet>
  );
}

function ImageViewer({ src, alt, onClose }) {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.15s ease",
        cursor: "zoom-out",
      }}
    >
      <button onClick={onClose} style={{
        position: "absolute", top: "16px", right: "16px", zIndex: 2001,
        border: "none", background: "rgba(255,255,255,0.15)", borderRadius: "50%",
        width: "36px", height: "36px", cursor: "pointer",
        fontSize: "18px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "inherit", backdropFilter: "blur(4px)",
      }}><Icon name="close" size={14} /></button>
      <img
        src={src}
        alt={alt || ""}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "95vw", maxHeight: "90vh",
          objectFit: "contain", borderRadius: "4px",
          cursor: "default",
        }}
      />
    </div>
  );
}

function DetailDialog({ detail, onClose, dayColor }) {
  if (!detail) return null;
  const [viewImage, setViewImage] = useState(null);
  const cat = CATEGORY_COLORS[detail.category] || { bg: "#f5f5f5", color: "#555", border: "#ddd" };

  return (
    <BottomSheet onClose={onClose} maxHeight="80vh">
        {/* Header */}
        <div style={{
          padding: "6px 16px 12px 20px", flexShrink: 0,
          borderBottom: "1px solid #EEECE6",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{
              margin: 0, fontSize: "16px", fontWeight: 800,
              color: "#111", letterSpacing: "-0.3px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {detail.name}
            </h3>
            <span style={{
              flexShrink: 0, padding: "2px 9px", borderRadius: "20px",
              fontSize: "10px", fontWeight: 700,
              background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
              whiteSpace: "nowrap",
            }}>
              {detail.category}
            </span>
          </div>
          <button onClick={onClose} style={{
            border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}><Icon name="close" size={14} /></button>
        </div>

        {/* Image - top, outside scroll area for full bleed */}
        {detail.image && (
          <div
            onClick={() => setViewImage(detail.image)}
            style={{ flexShrink: 0, overflow: "hidden", cursor: "zoom-in" }}
          >
            <img
              src={detail.image}
              alt={detail.name}
              style={{
                width: "100%", display: "block",
                maxHeight: "200px", objectFit: "cover",
              }}
            />
          </div>
        )}

        {/* Image Viewer */}
        <ImageViewer src={viewImage} alt={detail.name} onClose={() => setViewImage(null)} />

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "14px 20px 20px" }}>

          {/* Info rows */}
          <div style={{
            display: "flex", flexDirection: "column", gap: "10px",
            padding: "14px", background: "#FAFAF8", borderRadius: "12px",
            border: "1px solid #EEECE6", marginBottom: "14px",
          }}>
            {detail.address && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="pin" size={14} /></div>
                <span style={{ flex: 1, fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>{detail.address}</span>
                <MapButton query={detail.address} />
              </div>
            )}
            {detail.hours && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="clock" size={14} /></div>
                <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>{detail.hours}</span>
              </div>
            )}
            {detail.price && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="pricetag" size={14} /></div>
                <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>{detail.price}</span>
              </div>
            )}
            {detail.tip && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bulb" size={14} /></div>
                <span style={{ fontSize: "12px", color: "#48464d", lineHeight: "18px" }}>{detail.tip}</span>
              </div>
            )}
          </div>

          {/* Timetable */}
          {detail.timetable && (
            <div style={{ marginBottom: "14px" }}>
              <p style={{
                margin: "0 0 8px", fontSize: "11px", fontWeight: 700,
                color: "#78767e", letterSpacing: "0.5px",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                <Icon name="car" size={14} />{detail.timetable.station} 발차 시간표 — {detail.timetable.direction}
              </p>
              <div style={{
                borderRadius: "12px", overflow: "hidden",
                border: "1px solid #E0DFDC",
              }}>
                {/* Table header */}
                <div style={{
                  display: "flex", padding: "8px 12px",
                  background: "#F5F5F4", borderBottom: "1px solid #E0DFDC",
                  fontSize: "10px", fontWeight: 700, color: "#888", letterSpacing: "0.3px",
                }}>
                  <span style={{ width: "52px", flexShrink: 0 }}>시각</span>
                  <span style={{ flex: 1 }}>열차명</span>
                  <span style={{ flex: 1, textAlign: "right" }}>행선 / 소요</span>
                </div>
                {/* Table rows */}
                {detail.timetable.trains.map((t, i) => (
                  <div key={i} style={{
                    display: "flex", flexDirection: "column",
                    padding: t.picked ? "8px 12px 9px" : "7px 12px",
                    background: t.picked ? "linear-gradient(90deg, #FFF9E0, #FFF4CC)" : (i % 2 === 0 ? "#fff" : "#FAFAF8"),
                    borderBottom: i < detail.timetable.trains.length - 1 ? "1px solid #F0EEEA" : "none",
                    borderLeft: t.picked ? "3px solid #E6B800" : "3px solid transparent",
                  }}>
                    {t.picked && (
                      <span style={{
                        alignSelf: "flex-start",
                        fontSize: "8px", fontWeight: 800, color: "#B8860B",
                        background: "#FFF0B3", padding: "1px 6px", borderRadius: "4px",
                        letterSpacing: "0.3px", marginBottom: "5px",
                      }}>
                        탑승 예정
                      </span>
                    )}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{
                        width: "52px", flexShrink: 0,
                        fontSize: t.picked ? "14px" : "12px",
                        fontWeight: t.picked ? 900 : 600,
                        color: t.picked ? "#8B6914" : "#555",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {t.time}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: t.picked ? "13px" : "11px",
                        fontWeight: t.picked ? 800 : 500,
                        color: t.picked ? "#6B4F00" : "#444",
                      }}>
                        {t.name}
                      </span>
                      <span style={{
                        flex: 1, textAlign: "right",
                        fontSize: "10px",
                        fontWeight: t.picked ? 700 : 400,
                        color: t.picked ? "#8B6914" : "#999",
                        lineHeight: 1.4,
                      }}>
                        <span style={{ display: "block" }}>{t.dest}</span>
                        <span style={{ fontSize: "9px", opacity: 0.8 }}>{t.note}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlights */}
          {detail.highlights && detail.highlights.length > 0 && (
            <div>
              <p style={{
                margin: "0 0 8px", fontSize: "11px", fontWeight: 700,
                color: "#999", letterSpacing: "0.5px",
              }}>
                포인트
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {detail.highlights.map((h, i) => (
                  <div key={i} style={{
                    display: "flex", gap: "8px", alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: "5px", height: "5px", borderRadius: "50%",
                      background: dayColor, flexShrink: 0, marginTop: "6px",
                    }} />
                    <span style={{ fontSize: "12px", color: "#444", lineHeight: 1.55 }}>
                      {h}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

    </BottomSheet>
  );
}

function EditItemDialog({ item, sectionIdx, itemIdx, dayIdx, onSave, onDelete, onClose, color, days }) {
  const isNew = !item;
  const [selectedDayIdx, setSelectedDayIdx] = useState(dayIdx);
  const [time, setTime] = useState(item?.time || "");
  const [desc, setDesc] = useState(item?.desc || "");
  const [type, setType] = useState(item?.type || "spot");
  const [sub, setSub] = useState(item?.sub || "");
  const [address, setAddress] = useState(item?.detail?.address || "");
  const [detailName, setDetailName] = useState(item?.detail?.name || "");
  const [detailTip, setDetailTip] = useState(item?.detail?.tip || "");
  const [detailPrice, setDetailPrice] = useState(item?.detail?.price || "");
  const [detailHours, setDetailHours] = useState(item?.detail?.hours || "");
  const [detailImage, setDetailImage] = useState(item?.detail?.image || "");

  // Timetable state
  const currentRouteId = item?.detail?.timetable?._routeId || "";
  const [selectedRoute, setSelectedRoute] = useState(currentRouteId);
  const [loadedTimetable, setLoadedTimetable] = useState(item?.detail?.timetable || null);

  const typeOptions = [
    { value: "food", label: "식사" },
    { value: "spot", label: "관광" },
    { value: "shop", label: "쇼핑" },
    { value: "move", label: "→ 이동" },
    { value: "stay", label: "숙소" },
    { value: "info", label: "정보" },
  ];

  const catMap = { food: "식사", spot: "관광", shop: "쇼핑", move: "교통", stay: "숙소", info: "교통" };

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
    const hasDetailContent = detailName.trim() || address.trim() || detailTip.trim() || detailImage.trim() || detailPrice.trim() || detailHours.trim();

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
      newItem.detail = {
        name: detailName.trim() || desc.trim(),
        category: catMap[type] || "관광",
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(detailTip.trim() ? { tip: detailTip.trim() } : {}),
        ...(detailPrice.trim() ? { price: detailPrice.trim() } : {}),
        ...(detailHours.trim() ? { hours: detailHours.trim() } : {}),
        ...(detailImage.trim() ? { image: detailImage.trim() } : {}),
        ...(timetable ? { timetable } : {}),
        ...(highlights ? { highlights } : {}),
      };
    }

    onSave(newItem, selectedDayIdx, sectionIdx, itemIdx);
  };

  const fieldStyle = {
    width: "100%", padding: "10px 12px", border: "1px solid #E0DFDC",
    borderRadius: "10px", fontSize: "13px", fontFamily: "inherit",
    background: "#FAFAF8", outline: "none", boxSizing: "border-box",
  };
  const selectStyle = {
    ...fieldStyle, cursor: "pointer", paddingRight: "36px",
    appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
    backgroundImage: `url("/icons/Arrow/Arrowhead/Down.svg")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
    backgroundSize: "14px",
  };
  const labelStyle = { margin: "0 0 6px", fontSize: "11px", fontWeight: 700, color: "#888" };

  return (
    <BottomSheet
      onClose={onClose}
      maxHeight="85vh"
    >
        {/* Header */}
        <div style={{
          padding: "6px 16px 12px 20px", flexShrink: 0,
          borderBottom: "1px solid #EEECE6",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1c1b21", display: "flex", alignItems: "center", gap: "6px" }}>
            {isNew ? <><Icon name="plus" size={16} />일정 추가</> : <><Icon name="edit" size={16} />일정 수정</>}
          </h3>
          <button onClick={onClose} style={{
            border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}><Icon name="close" size={14} /></button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Day selector (only for new items) */}
          {isNew && days && (
            <div>
              <p style={labelStyle}>추가할 날짜</p>
              <select value={selectedDayIdx} onChange={(e) => setSelectedDayIdx(Number(e.target.value))} style={selectStyle}>
                {days.map((d, i) => (
                  <option key={i} value={i}>Day {d.day} — {d.date} {d.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Time + Type row */}
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>시간 *</p>
              <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="예: 12:00" style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>유형</p>
              <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
                {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Desc */}
          <div>
            <p style={labelStyle}>일정명 *</p>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="예: 캐널시티 라멘스타디움" style={fieldStyle} />
          </div>

          {/* Sub */}
          <div>
            <p style={labelStyle}>부가 정보</p>
            <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="예: 도보 5분 · 1,000엔" style={fieldStyle} />
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #EEECE6", paddingTop: "10px" }}>
            <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#555" }}>상세 정보</p>
          </div>

          {/* Detail name */}
          <div>
            <p style={labelStyle}>장소명 (상세)</p>
            <input value={detailName} onChange={(e) => setDetailName(e.target.value)} placeholder="미입력 시 일정명 사용" style={fieldStyle} />
          </div>

          {/* Address */}
          <div>
            <p style={labelStyle}>주소</p>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="예: 福岡市博多区住吉1-2" style={fieldStyle} />
          </div>

          {/* Hours + Price */}
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>영업시간</p>
              <input value={detailHours} onChange={(e) => setDetailHours(e.target.value)} placeholder="11:00~23:00" style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>가격</p>
              <input value={detailPrice} onChange={(e) => setDetailPrice(e.target.value)} placeholder="~1,000엔" style={fieldStyle} />
            </div>
          </div>

          {/* Tip */}
          <div>
            <p style={labelStyle}>팁 / 메모</p>
            <textarea value={detailTip} onChange={(e) => setDetailTip(e.target.value)} placeholder="참고사항 입력" rows={2}
              style={{ ...fieldStyle, resize: "vertical" }} />
          </div>

          {/* Image URL */}
          <div>
            <p style={labelStyle}>이미지 경로</p>
            <input value={detailImage} onChange={(e) => setDetailImage(e.target.value)} placeholder="/images/filename.jpg" style={fieldStyle} />
          </div>

          {/* Timetable loader - only for move type */}
          {type === "move" && (
            <>
              <div style={{ borderTop: "1px solid #EEECE6", paddingTop: "10px" }}>
                <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#48464d", display: "flex", alignItems: "center", gap: "4px" }}><Icon name="car" size={14} />시간표 불러오기</p>
              </div>
              <div>
                <p style={labelStyle}>노선 선택</p>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">시간표 없음</option>
                  {TIMETABLE_DB.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleLoadTimetable(selectedRoute)}
                disabled={!selectedRoute}
                style={{
                  padding: "10px", border: "none", borderRadius: "10px",
                  background: selectedRoute ? "#EEF6FF" : "#F2F1ED",
                  color: selectedRoute ? "#2B6CB0" : "#bbb",
                  fontSize: "12px", fontWeight: 700, cursor: selectedRoute ? "pointer" : "default",
                  fontFamily: "inherit", transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                }}
              >
                <Icon name="sync" size={12} />{loadedTimetable ? "시간표 다시 불러오기" : "시간표 불러오기"}
                {time.trim() ? ` (${time.trim()} 기준)` : ""}
              </button>

              {/* Preview loaded timetable */}
              {loadedTimetable && loadedTimetable.trains && (
                <div style={{
                  background: "#FAFAF8", borderRadius: "10px", border: "1px solid #E8E6E1",
                  padding: "10px 12px", fontSize: "11px",
                }}>
                  <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, color: "#555" }}>
                    {loadedTimetable.station} → {loadedTimetable.direction}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {loadedTimetable.trains.map((t, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        padding: "4px 6px", borderRadius: "6px",
                        background: t.picked ? "#FFF9DB" : "transparent",
                        fontWeight: t.picked ? 700 : 400,
                      }}>
                        <span style={{ width: "38px", flexShrink: 0, color: t.picked ? "#B8860B" : "#777" }}>{t.time}</span>
                        <span style={{ flex: 1, color: t.picked ? "#333" : "#666" }}>{t.name}</span>
                        {t.picked && <span style={{
                          fontSize: "9px", background: "#FFE066", color: "#7C6A0A",
                          padding: "1px 5px", borderRadius: "4px", fontWeight: 700,
                        }}>탑승 예정</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: "0 20px 16px", display: "flex", gap: "8px", flexShrink: 0 }}>
          {!isNew && onDelete && (
            <button onClick={() => onDelete(dayIdx, sectionIdx, itemIdx)} style={{
              padding: "12px", border: "none", borderRadius: "12px",
              background: "#FFF0F0", color: "#D94F3B", fontSize: "13px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              삭제
            </button>
          )}
          <button onClick={handleSave} style={{
            flex: 1, padding: "12px", border: "none", borderRadius: "12px",
            background: color || "#1a1a1a", color: "#fff", fontSize: "13px", fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            opacity: (time.trim() && desc.trim()) ? 1 : 0.4,
          }}>
            {isNew ? "추가" : "저장"}
          </button>
        </div>
    </BottomSheet>
  );
}

function loadCustomData() {
  try {
    const saved = localStorage.getItem("travel_custom_data");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

const DAY_COLORS = ["#D94F3B", "#D97B2B", "#B8912A", "#3E8E5B", "#3A7DB5", "#7161A5", "#C75D78", "#5B8C6E", "#8B6E4F", "#4A6FA5"];

function mergeData(base, custom) {
  const merged = base.map((day, di) => {
    const dayCustom = custom[di];
    const overrides = custom._dayOverrides?.[di];
    let d = day;
    if (overrides) d = { ...d, ...overrides };
    if (!dayCustom) return d;
    const newSections = d.sections.map((sec, si) => {
      const secCustom = dayCustom.sections?.[si];
      if (!secCustom) return sec;
      return { ...sec, items: secCustom.items || sec.items };
    });
    if (dayCustom.extraItems) {
      const extraSection = { title: "추가 일정", items: dayCustom.extraItems };
      newSections.push(extraSection);
    }
    return { ...d, sections: newSections };
  });
  // Append custom-added days
  if (custom._extraDays) {
    custom._extraDays.forEach((d) => merged.push(d));
  }
  return merged;
}

export default function TravelPlanner() {
  const [customData, setCustomData] = useState(() => loadCustomData());
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeDetail, setActiveDetail] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dayInfoTab, setDayInfoTab] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [editingDayIdx, setEditingDayIdx] = useState(null);
  const [editDayLabel, setEditDayLabel] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm }
  const [showAddDay, setShowAddDay] = useState(false);

  useEffect(() => {
    localStorage.setItem("travel_custom_data", JSON.stringify(customData));
  }, [customData]);

  const DAYS = mergeData(BASE_DAYS, customData);
  const current = DAYS[selectedDay];

  const handleAddDay = useCallback((label, icon) => {
    setCustomData((prev) => {
      const next = { ...prev };
      const existingExtra = next._extraDays || [];
      const totalDays = BASE_DAYS.length + existingExtra.length;
      const newDay = {
        day: totalDays + 1,
        date: `Day ${totalDays + 1}`,
        label: label,
        color: DAY_COLORS[totalDays % DAY_COLORS.length],
        icon: icon || "pin",
        stay: "",
        booked: false,
        sections: [{ title: "종일", items: [] }],
        notes: "",
        _custom: true,
      };
      next._extraDays = [...existingExtra, newDay];
      return { ...next };
    });
    setShowAddDay(false);
    setTimeout(() => {
      setSelectedDay(BASE_DAYS.length + (customData._extraDays?.length || 0));
    }, 50);
  }, [customData]);

  const handleEditDayLabel = useCallback((dayIdx, newLabel) => {
    setCustomData((prev) => {
      const next = { ...prev };
      if (dayIdx < BASE_DAYS.length) {
        // Base day — store override
        if (!next._dayOverrides) next._dayOverrides = {};
        next._dayOverrides[dayIdx] = { ...(next._dayOverrides[dayIdx] || {}), label: newLabel };
      } else {
        // Extra day
        const extraIdx = dayIdx - BASE_DAYS.length;
        if (next._extraDays && next._extraDays[extraIdx]) {
          next._extraDays = [...next._extraDays];
          next._extraDays[extraIdx] = { ...next._extraDays[extraIdx], label: newLabel };
        }
      }
      return { ...next };
    });
    setEditingDayIdx(null);
  }, []);

  const handleDeleteDay = useCallback((dayIdx) => {
    if (dayIdx < BASE_DAYS.length) return;
    setConfirmDialog({
      title: "날짜 삭제",
      message: "이 날짜와 포함된 모든 일정이 삭제됩니다.\n정말 삭제하시겠습니까?",
      confirmLabel: "삭제",
      confirmColor: "#D94F3B",
      onConfirm: () => {
        setCustomData((prev) => {
          const next = { ...prev };
          const extraIdx = dayIdx - BASE_DAYS.length;
          if (next._extraDays) {
            next._extraDays = next._extraDays.filter((_, i) => i !== extraIdx);
            next._extraDays = next._extraDays.map((d, i) => ({
              ...d, day: BASE_DAYS.length + i + 1,
            }));
          }
          return { ...next };
        });
        setSelectedDay((prev) => Math.max(0, prev - 1));
        setConfirmDialog(null);
      },
    });
  }, []);

  const handleSaveItem = useCallback((newItem, dayIdx, sectionIdx, itemIdx) => {
    setCustomData((prev) => {
      const next = { ...prev };
      if (sectionIdx === -1) {
        // New item → add to extraItems
        if (!next[dayIdx]) next[dayIdx] = {};
        if (!next[dayIdx].extraItems) next[dayIdx].extraItems = [];
        next[dayIdx].extraItems.push(newItem);
      } else {
        // Edit existing
        if (!next[dayIdx]) next[dayIdx] = {};
        if (!next[dayIdx].sections) next[dayIdx].sections = {};
        if (!next[dayIdx].sections[sectionIdx]) {
          next[dayIdx].sections[sectionIdx] = { items: [...BASE_DAYS[dayIdx].sections[sectionIdx].items] };
        }
        if (itemIdx !== undefined && itemIdx !== null) {
          next[dayIdx].sections[sectionIdx].items[itemIdx] = newItem;
        }
      }
      return { ...next };
    });
    setEditTarget(null);
  }, []);

  const handleDeleteItem = useCallback((dayIdx, sectionIdx, itemIdx) => {
    setConfirmDialog({
      title: "일정 삭제",
      message: "이 일정을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      confirmColor: "#D94F3B",
      onConfirm: () => {
        setCustomData((prev) => {
          const next = { ...prev };
          if (sectionIdx === -1 && next[dayIdx]?.extraItems) {
            next[dayIdx].extraItems.splice(itemIdx, 1);
          } else {
            if (!next[dayIdx]) next[dayIdx] = {};
            if (!next[dayIdx].sections) next[dayIdx].sections = {};
            if (!next[dayIdx].sections[sectionIdx]) {
              next[dayIdx].sections[sectionIdx] = { items: [...BASE_DAYS[dayIdx].sections[sectionIdx].items] };
            }
            next[dayIdx].sections[sectionIdx].items.splice(itemIdx, 1);
          }
          return { ...next };
        });
        setEditTarget(null);
        setConfirmDialog(null);
      },
    });
  }, []);

  return (
    <div style={{
      width: "100%", height: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Noto Sans KR', sans-serif", background: "#F5F4F0", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "14px 20px", background: "#fff",
        borderBottom: "1px solid #E8E6E1",
        display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
      }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: "linear-gradient(135deg, #E8594F, #D97B2B)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
        }}>🇯🇵</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.5px" }}>
            후쿠오카 · 구마모토 · 유후인
          </h1>
          <p style={{ margin: 0, fontSize: "11px", color: "#999" }}>
            2026.02.19 — 02.24 · 5박 6일
          </p>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            border: "1px solid #E8E6E1", background: "#FAFAF8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: "16px", flexShrink: 0,
            transition: "background 0.15s",
          }}
          title="여행 가이드"
        >
          <Icon name="compass" size={18} />
        </button>
        <button
          onClick={() => setShowDocs(true)}
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            border: "1px solid #E8E6E1", background: "#FAFAF8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: "16px", flexShrink: 0,
            transition: "background 0.15s",
          }}
          title="여행 서류"
        >
          <Icon name="file" size={18} />
        </button>
      </div>

      {/* Day tabs */}
      <div style={{
        display: "flex", gap: 0, padding: "0 12px",
        background: "#fff", borderBottom: "1px solid #E8E6E1",
        flexShrink: 0, alignItems: "center",
      }}>
        <div style={{ display: "flex", flex: 1, overflowX: "auto", alignItems: "center", position: "relative", maskImage: "linear-gradient(to right, black calc(100% - 24px), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black calc(100% - 24px), transparent 100%)" }}>
          {DAYS.map((day, i) => {
            const active = selectedDay === i;
            return (
              <button key={i} onClick={() => setSelectedDay(i)} style={{
                flex: "none", padding: "12px 16px", border: "none",
                background: "none", cursor: "pointer",
                borderBottom: active ? `2.5px solid ${day.color}` : "2.5px solid transparent",
                color: active ? day.color : "#aaa",
                fontWeight: active ? 700 : 500,
                fontSize: "13px", fontFamily: "inherit",
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}>
                D{day.day}
              </button>
            );
          })}
          {/* Add Day button */}
          <button onClick={() => setShowAddDay(true)} style={{
            flex: "none", padding: "6px 8px", border: "none",
            background: "none", cursor: "pointer",
            borderBottom: "2.5px solid transparent",
            color: "#ccc", fontSize: "16px", fontWeight: 700,
            fontFamily: "inherit", transition: "color 0.15s",
            marginLeft: "2px",
          }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#888"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#ccc"}
            title="날짜 추가"
          >
            +
          </button>
        </div>

        {/* Gap + Schedule add button */}
        <div style={{ flexShrink: 0, marginLeft: "20px", paddingRight: "4px" }}>
          <button
            onClick={() => setEditTarget({ dayIdx: selectedDay, sectionIdx: -1, itemIdx: null, item: null })}
            style={{
              padding: "6px 12px", borderRadius: "8px",
              border: "1px solid #E8E6E1", background: "#FAFAF8",
              display: "flex", alignItems: "center", gap: "4px",
              cursor: "pointer", fontSize: "11px", fontWeight: 600,
              color: current.color, fontFamily: "inherit",
              whiteSpace: "nowrap", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = current.color + "15"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#FAFAF8"; }}
          >
            일정 추가 +
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>

        {/* Day title card */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          marginBottom: "16px", padding: "14px 16px",
          background: "#fff", borderRadius: "14px", border: "1px solid #E8E6E1",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "12px",
            background: current.color, display: "flex",
            alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Icon name={current.icon} size={20} style={{ filter: "brightness(0) invert(1)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h2
                  onClick={() => { setEditingDayIdx(selectedDay); setEditDayLabel(current.label); }}
                  style={{
                    margin: 0, fontSize: "16px", fontWeight: 800, color: "#1a1a1a",
                    letterSpacing: "-0.3px", cursor: "pointer",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  title="이름 수정"
                >
                  {current.label}
                </h2>
                <button
                  onClick={() => { setEditingDayIdx(selectedDay); setEditDayLabel(current.label); }}
                  style={{
                    border: "none", background: "none", cursor: "pointer",
                    fontSize: "10px", color: "#ccc", padding: "2px", flexShrink: 0,
                  }}
                ><Icon name="edit" size={14} /></button>
                {selectedDay >= BASE_DAYS.length && (
                  <button
                    onClick={() => handleDeleteDay(selectedDay)}
                    style={{
                      border: "none", background: "none", cursor: "pointer",
                      fontSize: "10px", color: "#dbb", padding: "2px", flexShrink: 0,
                    }}
                  ><Icon name="trash" size={14} /></button>
                )}
              </div>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#999" }}>
              {current.date} · {current.stay}
            </p>
          </div>
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button onClick={() => setDayInfoTab("meals")} style={{
              padding: "6px 10px", borderRadius: "10px",
              border: "1px solid #FDDCC8", background: "#FFF3EC",
              fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: "3px",
            }}>
              <Icon name="fire" size={12} /><span style={{ fontSize: "10px", fontWeight: 600, color: "#C75D20" }}>식사</span>
            </button>
            <button onClick={() => setDayInfoTab("stay")} style={{
              padding: "6px 10px", borderRadius: "10px",
              border: "1px solid #C6F0D5", background: "#F0FAF4",
              fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: "3px",
            }}>
              <Icon name="home" size={12} /><span style={{ fontSize: "10px", fontWeight: 600, color: "#2A7D4F" }}>숙소</span>
            </button>
          </div>
        </div>

        {/* Sections */}
        {current.sections.map((section, si) => (
          <div key={si} style={{ marginBottom: "12px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "0 4px", marginBottom: "8px",
            }}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%", background: current.color,
              }} />
              <span style={{
                fontSize: "11px", fontWeight: 700, color: current.color, letterSpacing: "0.5px",
              }}>
                {section.title}
              </span>
              <div style={{ flex: 1, height: "1px", background: `${current.color}20` }} />
            </div>

            <div style={{
              background: "#fff", borderRadius: "14px",
              border: "1px solid #E8E6E1", overflow: "hidden",
            }}>
              {section.items.map((item, ii) => {
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
                const isLast = ii === section.items.length - 1;
                const hasDetail = !!item.detail && !!(item.detail.image || item.detail.tip || item.detail.address || item.detail.timetable);
                const handleClick = () => {
                  if (hasDetail) {
                    setActiveDetail({ ...item.detail, _item: item, _si: si, _ii: ii, _di: selectedDay });
                  }
                };
                return (
                  <div
                    key={ii}
                    onClick={hasDetail ? handleClick : undefined}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "8px",
                      padding: "10px 14px",
                      borderBottom: isLast ? "none" : "1px solid #F2F1ED",
                      background: "transparent",
                      cursor: hasDetail ? "pointer" : "default",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (hasDetail) e.currentTarget.style.background = "#FAFAF8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{
                      width: "44px", flexShrink: 0, textAlign: "right",
                      fontSize: "11px", fontWeight: 700, color: cfg.text,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: "20px", whiteSpace: "nowrap",
                    }}>
                      {item.time}
                    </span>
                    <div style={{ width: "3px", flexShrink: 0, borderRadius: "2px", background: cfg.border, alignSelf: "stretch", minHeight: "20px" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minHeight: "20px" }}>
                        <p style={{
                          margin: 0, fontSize: "13px", fontWeight: 500, color: "#1c1b21", lineHeight: "20px",
                        }}>
                          {item.desc}
                        </p>
                        {hasDetail && (
                          <span style={{
                            fontSize: "10px", color: "#bbb", flexShrink: 0,
                          }}>›</span>
                        )}
                      </div>
                      {item.sub && (
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#78767e", lineHeight: 1.4 }}>
                          {item.sub}
                        </p>
                      )}
                    </div>
                    {item.detail && item.detail.address && (
                      <div style={{ flexShrink: 0, alignSelf: "center" }}>
                        <MapButton query={item.detail.address} />
                      </div>
                    )}
                    {/* Edit / Delete */}
                    <div style={{ display: "flex", gap: "4px", flexShrink: 0, alignSelf: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button onClick={() => setEditTarget({ item, sectionIdx: si, itemIdx: ii, dayIdx: selectedDay })} style={{
                        width: "24px", height: "24px", border: "none", borderRadius: "6px",
                        background: "#F2F1ED", cursor: "pointer", fontSize: "10px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}><Icon name="edit" size={14} /></button>
                      <button onClick={() => handleDeleteItem(selectedDay, si, ii)} style={{
                        width: "24px", height: "24px", border: "none", borderRadius: "6px",
                        background: "#FFF0F0", cursor: "pointer", fontSize: "10px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Notes */}
        {current.notes && (
          <div style={{
            marginTop: "4px", padding: "11px 14px",
            background: "#FDFCF8", borderRadius: "12px", border: "1px dashed #DDD8CB",
          }}>
            <p style={{ margin: 0, fontSize: "11px", color: "#78767e", lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: "6px" }}>
              <Icon name="pin" size={12} style={{ marginTop: "2px" }} /><span>{current.notes}</span>
            </p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <DetailDialog
        detail={activeDetail}
        onClose={() => setActiveDetail(null)}
        dayColor={current.color}
      />

      {/* Document Dialog */}
      {showDocs && <DocumentDialog onClose={() => setShowDocs(false)} />}

      {/* Shopping Guide Dialog */}
      {showGuide && <ShoppingGuideDialog onClose={() => setShowGuide(false)} />}

      {/* Day Info Dialog (식사/숙소) */}
      {dayInfoTab && <DayInfoDialog dayNum={current.day} tab={dayInfoTab} onClose={() => setDayInfoTab(null)} color={current.color} />}

      {/* Edit/Add Item Dialog */}
      {editTarget && (
        <EditItemDialog
          item={editTarget.item}
          sectionIdx={editTarget.sectionIdx}
          itemIdx={editTarget.itemIdx}
          dayIdx={editTarget.dayIdx}
          onSave={handleSaveItem}
          onDelete={editTarget.item?._custom ? handleDeleteItem : null}
          onClose={() => setEditTarget(null)}
          color={current.color}
          days={DAYS}
        />
      )}

      {/* Floating Map Button */}
      <button
        onClick={() => setShowMap(true)}
        style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 900,
          width: "52px", height: "52px", borderRadius: "50%",
          border: "none", background: "#1a1a1a", color: "#fff",
          fontSize: "22px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.35)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)"; }}
        title="여행 지도"
      >
        <Icon name="map" size={22} style={{ filter: "brightness(0) invert(1)" }} />
      </button>

      {/* Full Map Dialog */}
      {showMap && <FullMapDialog days={DAYS} onClose={() => setShowMap(false)} />}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmColor={confirmDialog.confirmColor}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Edit Day Name Dialog (Bottom Sheet) */}
      {editingDayIdx !== null && (
        <BottomSheet onClose={() => setEditingDayIdx(null)} maxHeight="auto" zIndex={3000}>
          <div style={{ padding: "8px 24px 24px" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 800, color: "#1a1a1a", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icon name="edit" size={16} />이름 수정
            </h3>
            <input
              value={editDayLabel}
              onChange={(e) => setEditDayLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editDayLabel.trim()) { handleEditDayLabel(editingDayIdx, editDayLabel); }
                if (e.key === "Escape") setEditingDayIdx(null);
              }}
              placeholder="이름을 입력하세요"
              style={{
                width: "100%", padding: "12px 14px",
                border: "1.5px solid #E8E6E1", borderRadius: "12px",
                fontSize: "14px", fontWeight: 600,
                fontFamily: "inherit", outline: "none",
                background: "#FAFAF8", boxSizing: "border-box",
                transition: "border-color 0.15s",
                marginBottom: "20px",
              }}
              onFocus={(e) => { e.target.style.borderColor = DAYS[editingDayIdx]?.color || "#8b7bff"; }}
              onBlur={(e) => { e.target.style.borderColor = "#E8E6E1"; }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setEditingDayIdx(null)} style={{
                flex: 1, padding: "14px", border: "1px solid #E8E6E1", background: "#fff",
                borderRadius: "12px", fontSize: "14px", fontWeight: 600, color: "#888",
                cursor: "pointer", fontFamily: "inherit",
              }}>취소</button>
              <button
                onClick={() => { if (editDayLabel.trim()) handleEditDayLabel(editingDayIdx, editDayLabel); }}
                style={{
                  flex: 1, padding: "14px", border: "none",
                  borderRadius: "12px", fontSize: "14px", fontWeight: 700,
                  background: editDayLabel.trim() ? (DAYS[editingDayIdx]?.color || "#8b7bff") : "#E8E6E1",
                  color: editDayLabel.trim() ? "#fff" : "#bbb",
                  cursor: editDayLabel.trim() ? "pointer" : "default",
                  fontFamily: "inherit", transition: "all 0.15s",
                }}
              >저장</button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Add Day Dialog */}
      {showAddDay && (
        <AddDayDialog
          onAdd={handleAddDay}
          onCancel={() => setShowAddDay(false)}
        />
      )}
    </div>
  );
}
