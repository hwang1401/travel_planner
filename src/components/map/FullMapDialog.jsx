import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Tab from '../common/Tab';
import DetailDialog from '../dialogs/DetailDialog';
import { getItemCoords } from '../../data/locations';

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

/* ── Full Map Dialog ── */
export default function FullMapDialog({ days, onClose }) {
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
          if (coordKey !== lastCoordKey) {
            const hasDetail = item.detail && (item.detail.image || item.detail.tip || item.detail.address || item.detail.timetable);
            dayPins.push({
              coords: loc.coords,
              label: loc.label,
              desc: item.desc,
              time: item.time,
              color: "var(--color-primary)",
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

  // Merge overlapping pins
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

  // Build timeline items
  const timelineItems = [];
  const shownPinOrders = new Set();
  let pinCursor = 0;
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
          if (coordKey !== lastCoordKey && pinCursor < dayPins.length) {
            pinOrder = dayPins[pinCursor].order;
            pinCursor++;
            hasPin = true;
          } else if (coordKey === lastCoordKey) {
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
    const mp = mapPins.find((p) => p.orders.includes(item.pinOrder));
    if (mp) {
      setFlyTarget({ coords: mp.coords, ts: Date.now() });
      setSelectedPin(mp);
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
      background: "var(--color-surface-container-lowest)", display: "flex", flexDirection: "column",
      animation: "fadeIn 0.2s ease",
      paddingTop: "env(safe-area-inset-top, 0px)",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px", background: "var(--color-surface-container-lowest)",
        borderBottom: "1px solid var(--color-outline-variant)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <h3 style={{ margin: 0, fontSize: "var(--typo-body-2-n---bold-size)", fontWeight: "var(--typo-body-2-n---bold-weight)", color: "var(--color-on-surface)" }}>여행 지도</h3>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
      </div>

      {/* Day tabs — same size as main day tabs (md) */}
      <div style={{ background: "var(--color-surface-container-lowest)", flexShrink: 0 }}>
        <Tab
          items={days.map((d, i) => ({ label: `D${d.day}`, value: i }))}
          value={selectedDay}
          onChange={(v) => { setSelectedDay(v); setSelectedPin(null); setFlyTarget(null); }}
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
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positions.length > 0 && !flyTarget && <FitBounds positions={positions} />}
          {flyTarget && <FlyToPoint coords={flyTarget.coords} zoom={14} key={flyTarget.ts} />}
          {dayPins.length > 1 && (
            <Polyline positions={dayPins.map((p) => p.coords)} color="var(--color-primary)" weight={3} opacity={0.5} dashArray="8,6" />
          )}
          {mapPins.map((pin, pi) => {
            const coordKey = pin.coords[0] + "," + pin.coords[1];
            return (
            <Marker
              key={pi}
              ref={(ref) => { if (ref) markerRefs.current[coordKey] = ref; }}
              position={pin.coords}
              icon={createDayIcon(
                selectedPin && pin.orders.includes(selectedPin.order) ? "var(--color-on-surface)" : "var(--color-primary)",
                pin.mapLabel
              )}
              eventHandlers={{ click: () => handlePinClick(pin) }}
            >
              <Popup>
                <div style={{ fontSize: "var(--typo-caption-1-regular-size)", fontFamily: "var(--font-family-base)", minWidth: "140px" }}>
                  <strong style={{ fontSize: "var(--typo-label-2-bold-size)" }}>{pin.label}</strong>
                  {pin.descs.map((d, di) => (
                    <div key={di} style={{ color: "var(--color-on-surface-variant)", marginTop: "3px" }}>
                      <span style={{ color: "var(--color-on-surface-variant2)" }}>{d.time}</span> {d.desc}
                    </div>
                  ))}
                    {pin._detail && (
                    <Button variant="neutral" size="sm" onClick={(e) => { e.stopPropagation(); setMapDetail(pin._detail); }}
                      fullWidth
                      style={{ marginTop: "8px" }}>
                      상세보기
                    </Button>
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
            <DetailDialog detail={mapDetail} onClose={() => setMapDetail(null)} dayColor="var(--color-primary)" />
          </div>
        )}
      </div>

      {/* Bottom itinerary card */}
      <div style={{
        background: "var(--color-surface-container-lowest)", borderTop: "1px solid var(--color-outline-variant)", flexShrink: 0,
        maxHeight: cardExpanded ? "35vh" : "44px", transition: "max-height 0.25s ease",
        overflow: "hidden", display: "flex", flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {/* Card header */}
        <button onClick={() => setCardExpanded(!cardExpanded)}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            padding: "12px 16px", border: "none", borderRadius: 0,
            background: "none", cursor: "pointer", gap: "8px",
          }}>
          <span style={{
            flex: 1, textAlign: "left",
            fontSize: "var(--typo-caption-1-bold-size)", fontWeight: "var(--typo-caption-1-bold-weight)",
            color: "var(--color-primary)",
          }}>
            Day {day?.day} — {day?.label}
          </span>
          <span style={{
            fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)",
            flexShrink: 0,
          }}>
            {dayPins.length}곳
          </span>
          <Icon name={cardExpanded ? "chevronDown" : "chevronUp"} size={16}
            style={{ flexShrink: 0, opacity: 0.5 }} />
        </button>

        {/* Timeline list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
          {timelineItems.map((item, i) => (
            <div
              key={i}
              onClick={() => handleTimelineClick(item)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "7px 8px", borderRadius: "var(--radius-md, 8px)",
                cursor: item.hasPin ? "pointer" : "default",
                background: selectedPin && selectedPin.orders && selectedPin.orders.includes(item.pinOrder) ? "var(--color-primary-container)" : "transparent",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (item.hasPin) e.currentTarget.style.background = "var(--color-surface-container-low)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = selectedPin && selectedPin.orders && selectedPin.orders.includes(item.pinOrder) ? "var(--color-primary-container)" : "transparent"; }}
            >
              {item.showNumber ? (
                <div style={{
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: "var(--typo-caption-3-bold-size)", fontWeight: "var(--typo-caption-3-bold-weight)",
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
                    background: item.hasPin ? "var(--color-primary-fixed-dim)" : "var(--color-outline-variant)",
                  }} />
                </div>
              )}
              <span style={{
                fontSize: "var(--typo-caption-3-medium-size)", fontWeight: "var(--typo-caption-3-medium-weight)", color: "var(--color-on-surface-variant2)",
                width: "36px", flexShrink: 0, textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}>{item.time}</span>
              <span style={{
                fontSize: "var(--typo-caption-2-medium-size)", color: item.hasPin ? "var(--color-on-surface)" : "var(--color-on-surface-variant2)",
                fontWeight: item.hasPin ? "var(--typo-caption-2-medium-weight)" : "var(--typo-caption-2-regular-weight)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
