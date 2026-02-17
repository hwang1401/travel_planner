import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Tab from '../common/Tab';
import DetailDialog from '../dialogs/DetailDialog';
import AddRAGPlaceSheet from '../dialogs/AddRAGPlaceSheet';
import { getItemCoords } from '../../data/locations';
import { getNearbyPlaces } from '../../services/ragService';
import { TYPE_CONFIG, TYPE_LABELS, SPACING } from '../../styles/tokens';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useBackClose } from '../../hooks/useBackClose';

/* ── Map helper: create numbered day icon ── */
function createDayIcon(color, label) {
  const text = String(label);
  const isMulti = text.includes("·");
  const w = isMulti ? 40 : 28;
  return L.divIcon({
    className: "",
    html: `<div style="
      min-width:${w}px;height:28px;border-radius:14px;padding:0 ${isMulti ? 6 : 0}px;
      background:${color};color:var(--color-surface-container-lowest);font-size:${isMulti ? 10 : 11}px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      border:2.5px solid var(--color-surface-container-lowest);box-shadow:var(--shadow-strong);
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      white-space:nowrap;
    ">${text}</div>`,
    iconSize: [w, 28],
    iconAnchor: [w / 2, 14],
    popupAnchor: [0, -16],
  });
}

/* ── FitBounds helper ── */
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

/* ── FlyToPoint helper ── */
function FlyToPoint({ coords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, zoom || 14, { duration: 0.8 });
  }, [coords, zoom, map]);
  return null;
}

/* ── Small icon for nearby (secondary) pins ── */
function createNearbyIcon(type) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const color = cfg?.text || 'var(--color-type-move-text)';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:${color};border:2px solid var(--color-surface-container-lowest);
      box-shadow:var(--shadow-normal);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

/* ── Full Map Dialog ── */
export default function FullMapDialog({ days, onClose, onAddItem, initialDay = 0 }) {
  useScrollLock();
  useBackClose(true, onClose);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [flyTarget, setFlyTarget] = useState(null);
  const [selectedItemIdx, setSelectedItemIdx] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addNearbyPlace, setAddNearbyPlace] = useState(null);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [cardExpanded, setCardExpanded] = useState(true);
  const markerRefs = useRef({});
  const timelineRef = useRef(null);

  const day = days[selectedDay];

  // ── Build allItems: every item with coords/detail (with section indices for payloads) ──
  const allItems = [];
  if (day) {
    let orderNum = 1;
    const seenCoords = new Set();
    day.sections.forEach((sec, si) => {
      (sec.items || []).filter(Boolean).forEach((item, ii) => {
        const loc = getItemCoords(item, selectedDay);
        const coords = loc ? loc.coords : null;
        const coordKey = coords ? `${coords[0]},${coords[1]}` : null;
        const isNewCoord = coordKey && !seenCoords.has(coordKey);
        if (isNewCoord) seenCoords.add(coordKey);
        const order = coords ? (isNewCoord ? orderNum++ : orderNum - 1) : null;
        const detail = item.detail || {};
        const hasDetail = !!(detail.image || detail.images?.length || detail.tip || detail.address || detail.timetable || detail.hours || detail.price);
        const enrichedDetail = hasDetail ? {
          ...detail,
          name: detail.name || item.desc,
          category: detail.category || TYPE_LABELS[item.type] || "정보",
        } : { name: item.desc, category: TYPE_LABELS[item.type] || "정보" };

        allItems.push({
          item,
          coords,
          coordKey,
          order,
          isNewCoord,
          detail: enrichedDetail,
          hasDetail,
          time: item.time,
          desc: item.desc,
          type: item.type,
          label: loc?.label || item.desc,
          sectionIdx: si,
          itemIdxInSection: ii,
        });
      });
    });
  }

  // ── Detail payloads for swipe/dots (same shape as TravelPlanner) ──
  const allDetailPayloads = allItems.map((entry, idx) => ({
    ...(entry.detail || {}),
    name: entry.detail?.name ?? entry.desc,
    category: entry.detail?.category || TYPE_LABELS[entry.type] || "정보",
    timetable: entry.detail?.timetable,
    _item: entry.item,
    _si: entry.sectionIdx,
    _ii: entry.itemIdxInSection,
    _di: selectedDay,
    _index: idx,
  }));

  // ── Build mapPins: group by coords for map markers ──
  const mapPins = [];
  allItems.forEach((entry, idx) => {
    if (!entry.coords) return;
    const existing = mapPins.find((p) => p.coordKey === entry.coordKey);
    if (existing) {
      if (!existing.orders.includes(entry.order)) {
        existing.orders.push(entry.order);
        existing.mapLabel = existing.orders.join("·");
      }
      existing.items.push({ ...entry, itemIdx: idx });
    } else {
      mapPins.push({
        coords: entry.coords,
        coordKey: entry.coordKey,
        color: "var(--color-primary)",
        orders: [entry.order],
        mapLabel: String(entry.order),
        label: entry.label,
        items: [{ ...entry, itemIdx: idx }],
      });
    }
  });

  // Unique coords for polyline / fitBounds (preserve order)
  const uniquePositions = [];
  const seenKeys = new Set();
  allItems.forEach((e) => {
    if (e.coords && !seenKeys.has(e.coordKey)) {
      seenKeys.add(e.coordKey);
      uniquePositions.push(e.coords);
    }
  });

  // ── Handlers ──
  const handlePinClick = (pin) => {
    setFlyTarget({ coords: pin.coords, ts: Date.now() });
    // Select first item at this pin
    if (pin.items.length > 0) {
      setSelectedItemIdx(pin.items[0].itemIdx);
    }
  };

  const handleTimelineClick = (entry, idx) => {
    setSelectedItemIdx(idx);
    if (entry.coords) {
      setFlyTarget({ coords: entry.coords, ts: Date.now() });
      // Open popup on map — DetailDialog is only opened from popup's "상세" link
      setTimeout(() => {
        const marker = markerRefs.current[entry.coordKey];
        if (marker) marker.openPopup();
      }, 400);
    }
  };

  const handlePopupDetailClick = (entry, e) => {
    e.stopPropagation();
    setSelectedItemIdx(entry.itemIdx);
    setDetailOpen(true);
  };

  const handleDetailNavigateToIndex = (index) => {
    if (index >= 0 && index < allItems.length) {
      setSelectedItemIdx(index);
      const entry = allItems[index];
      if (entry?.coords) setFlyTarget({ coords: entry.coords, ts: Date.now() });
    }
  };

  // ── Load nearby places when a pin is selected and detail is open ──
  useEffect(() => {
    if (!detailOpen || selectedItemIdx == null || !day) {
      setNearbyPlaces([]);
      return;
    }
    const flat = [];
    day.sections.forEach((sec) => {
      (sec.items || []).filter(Boolean).forEach((item) => flat.push(item));
    });
    const entry = flat[selectedItemIdx];
    if (!entry) {
      setNearbyPlaces([]);
      return;
    }
    const loc = getItemCoords(entry, selectedDay);
    const coords = loc?.coords;
    if (!coords || coords.length < 2) {
      setNearbyPlaces([]);
      return;
    }
    const lat = coords[0];
    const lon = coords[1];
    const excludeName = entry.detail?.name || entry.desc || '';
    getNearbyPlaces({ lat, lon, excludeName }).then((byType) => {
      const list = [...(byType.food || []), ...(byType.spot || []), ...(byType.shop || [])];
      setNearbyPlaces(list);
    }).catch(() => setNearbyPlaces([]));
  }, [detailOpen, selectedItemIdx, day, selectedDay]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: "var(--z-dialog)",
      background: "var(--color-surface-container-lowest)", display: "flex", flexDirection: "column",
      animation: "fadeIn 0.2s ease",
      paddingTop: "env(safe-area-inset-top, 0px)",
    }}>
      {/* Header */}
      <div style={{
        padding: `${SPACING.ml} ${SPACING.xl}`, background: "var(--color-surface-container-lowest)",
        borderBottom: "1px solid var(--color-outline-variant)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <h3 style={{ margin: 0, fontSize: "var(--typo-body-2-n---bold-size)", fontWeight: "var(--typo-body-2-n---bold-weight)", color: "var(--color-on-surface)" }}>여행 지도</h3>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
      </div>

      {/* Day tabs */}
      <div style={{ background: "var(--color-surface-container-lowest)", flexShrink: 0 }}>
        <Tab
          items={days.map((d, i) => ({ label: `D${i + 1}`, value: i }))}
          value={selectedDay}
          onChange={(v) => { setSelectedDay(v); setSelectedItemIdx(null); setDetailOpen(false); setFlyTarget(null); }}
          size="md"
        />
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={[33.0, 131.0]}
          zoom={10}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          className="map-pins-light"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {uniquePositions.length > 0 && !flyTarget && <FitBounds positions={uniquePositions} />}
          {flyTarget && <FlyToPoint coords={flyTarget.coords} zoom={14} key={flyTarget.ts} />}
          {uniquePositions.length > 1 && (
            <Polyline positions={uniquePositions} color="var(--color-primary)" weight={3} opacity={0.5} dashArray="8,6" />
          )}
          {mapPins.map((pin, pi) => {
            const isSelected = selectedItemIdx != null && pin.items.some((it) => it.itemIdx === selectedItemIdx);
            return (
              <Marker
                key={pi}
                ref={(ref) => { if (ref) markerRefs.current[pin.coordKey] = ref; }}
                position={pin.coords}
                icon={createDayIcon(
                  isSelected ? "var(--color-on-surface)" : "var(--color-primary)",
                  pin.mapLabel
                )}
                eventHandlers={{ click: () => handlePinClick(pin) }}
              >
                <Popup>
                  <div style={{
                    fontSize: "var(--typo-caption-1-regular-size)",
                    fontFamily: "var(--font-family-base)",
                    minWidth: "160px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}>
                    <strong style={{ fontSize: "var(--typo-label-2-bold-size)", display: "block", marginBottom: SPACING.ms }}>
                      {pin.label}
                    </strong>
                    {pin.items.map((entry, di) => (
                      <div key={di} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: `${SPACING.sm} 0`,
                        borderBottom: di < pin.items.length - 1 ? "1px solid var(--color-surface-dim)" : "none",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: "var(--color-on-surface-variant2)", fontSize: "var(--typo-caption-2-regular-size)" }}>
                            {entry.time}
                          </span>
                          {" "}
                          <span style={{ color: "var(--color-on-surface)", fontSize: "var(--typo-caption-2-medium-size)", fontWeight: 500 }}>
                            {entry.desc}
                          </span>
                        </div>
                        {entry.hasDetail && (
                          <span
                            onClick={(e) => handlePopupDetailClick(entry, e)}
                            style={{
                              flexShrink: 0, marginLeft: SPACING.md,
                              fontSize: "var(--typo-caption-2-medium-size)",
                              color: "var(--color-primary)", cursor: "pointer", fontWeight: 500,
                            }}
                          >
                            상세
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {/* Nearby (secondary) pins when a main pin is selected */}
          {nearbyPlaces.map((p) => {
            if (p.lat == null || p.lon == null) return null;
            return (
              <Marker
                key={p.id || `${p.name_ko}-${p.lat}-${p.lon}`}
                position={[Number(p.lat), Number(p.lon)]}
                icon={createNearbyIcon(p.type)}
              >
                <Popup>
                  <div style={{
                    fontSize: 'var(--typo-caption-1-regular-size)',
                    fontFamily: 'var(--font-family-base)',
                    minWidth: '140px',
                    maxWidth: '200px',
                  }}>
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt=""
                        style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: SPACING.sm, display: 'block' }}
                      />
                    )}
                    <strong style={{ display: 'block', marginBottom: SPACING.xs, fontSize: 'var(--typo-label-2-bold-size)' }}>
                      {p.name_ko || '장소'}
                    </strong>
                    {onAddItem && (
                      <Button
                        variant="ghost-primary"
                        size="sm"
                        iconLeft="plus"
                        onClick={() => setAddNearbyPlace(p)}
                        style={{ marginTop: SPACING.sm }}
                      >
                        일정추가
                      </Button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* RAG 장소 일정추가 시트 (프리필 폼, 시간만 선택 후 저장) */}
        {addNearbyPlace && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1200 }}>
            <AddRAGPlaceSheet
              place={addNearbyPlace}
              onConfirm={(item, dayIdx) => {
                onAddItem(dayIdx ?? selectedDay, item, -1);
                setAddNearbyPlace(null);
              }}
              onClose={() => setAddNearbyPlace(null)}
              allDays={days}
              selectedDayIdx={selectedDay}
            />
          </div>
        )}

        {/* DetailDialog for map (swipe between same-day items) */}
        {detailOpen && selectedItemIdx != null && allDetailPayloads[selectedItemIdx] && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100 }}>
            <DetailDialog
              detail={allDetailPayloads[selectedItemIdx]}
              onClose={() => setDetailOpen(false)}
              dayColor="var(--color-primary)"
              allDetailPayloads={allDetailPayloads}
              currentDetailIndex={selectedItemIdx}
              onNavigateToIndex={allDetailPayloads.length > 1 ? handleDetailNavigateToIndex : undefined}
              onAddToSchedule={onAddItem ? (place) => setAddNearbyPlace(place) : undefined}
            />
          </div>
        )}
      </div>

      {/* Bottom itinerary card */}
      <div style={{
        background: "var(--color-surface-container-lowest)", borderTop: "1px solid var(--color-outline-variant)", flexShrink: 0,
        maxHeight: cardExpanded ? "35vh" : "44px", transition: "max-height var(--transition-normal)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        paddingBottom: "var(--safe-area-bottom, 0px)",
      }}>
        {/* Card header */}
        <button onClick={() => setCardExpanded(!cardExpanded)}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            padding: `${SPACING.lg} ${SPACING.xl}`, border: "none", borderRadius: 0,
            background: "none", cursor: "pointer", gap: SPACING.md,
            fontFamily: "inherit",
          }}>
          <span style={{
            flex: 1, textAlign: "left",
            fontSize: "var(--typo-caption-1-bold-size)", fontWeight: "var(--typo-caption-1-bold-weight)",
            color: "var(--color-primary)",
          }}>
            Day {selectedDay + 1} — {day?.label}
          </span>
          <span style={{
            fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)",
            flexShrink: 0,
          }}>
            {mapPins.length}곳
          </span>
          <Icon name={cardExpanded ? "chevronDown" : "chevronUp"} size={16}
            style={{ flexShrink: 0, opacity: 0.5 }} />
        </button>

        {/* Timeline list — timetable style: time / colorbar / title */}
        <div ref={timelineRef} style={{ flex: 1, overflowY: "auto", padding: `0 ${SPACING.sm} ${SPACING.lg}` }}>
          {allItems.map((entry, i) => {
            const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.info;
            const isActive = selectedItemIdx === i;
            return (
              <div
                key={i}
                onClick={() => handleTimelineClick(entry, i)}
                style={{
                  display: "flex", alignItems: "flex-start",
                  gap: "var(--spacing-sp80)",
                  padding: `${SPACING.md} ${SPACING.sm}`,
                  borderRadius: "var(--radius-sm)",
                  cursor: entry.coords ? "pointer" : "default",
                  background: isActive ? "var(--color-primary-container)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {/* Time: 32px right-aligned */}
                <span style={{
                  width: "32px", flexShrink: 0, textAlign: "right",
                  fontSize: "var(--typo-caption-2-bold-size)",
                  fontWeight: "var(--typo-caption-2-bold-weight)",
                  color: isActive ? "var(--color-primary)" : "var(--color-on-surface-variant)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: "18px",
                }}>
                  {entry.time}
                </span>

                {/* Color bar: 3px */}
                <div style={{
                  width: "3px", flexShrink: 0,
                  borderRadius: "var(--radius-xsm)",
                  background: cfg.text,
                  opacity: entry.coords ? 0.7 : 0.3,
                  alignSelf: "stretch", minHeight: "18px",
                }} />

                {/* Title */}
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: "var(--typo-caption-2-medium-size)",
                  fontWeight: entry.coords ? 500 : 400,
                  color: entry.coords ? "var(--color-on-surface)" : "var(--color-on-surface-variant2)",
                  lineHeight: "18px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {entry.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
