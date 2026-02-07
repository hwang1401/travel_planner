import { useState } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import ImageViewer from '../common/ImageViewer';
import MapButton from '../map/MapButton';
import { CATEGORY_COLORS } from '../../data/guides';

/* ── Detail Dialog ── */
export default function DetailDialog({ detail, onClose, dayColor }) {
  if (!detail) return null;
  const [viewImage, setViewImage] = useState(null);
  const cat = CATEGORY_COLORS[detail.category] || { bg: "var(--color-surface-container-low)", color: "var(--color-on-surface-variant)", border: "var(--color-outline-variant)" };

  return (
    <BottomSheet onClose={onClose} maxHeight="80vh">
        {/* Header */}
        <div style={{
          padding: "6px 16px 12px 20px", flexShrink: 0,
          borderBottom: "1px solid var(--color-outline-variant)",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{
              margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)",
              color: "var(--color-on-surface)", letterSpacing: "var(--typo-body-1-n---bold-letter-spacing)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {detail.name}
            </h3>
            <span style={{
              flexShrink: 0, padding: "2px 9px", borderRadius: "var(--radius-md, 8px)",
              fontSize: "var(--typo-caption-3-bold-size)", fontWeight: "var(--typo-caption-3-bold-weight)",
              background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
              whiteSpace: "nowrap",
            }}>
              {detail.category}
            </span>
          </div>
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} style={{ flexShrink: 0 }} />
        </div>

        {/* Image */}
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
            padding: "14px", background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px)",
            border: "1px solid var(--color-outline-variant)", marginBottom: "14px",
          }}>
            {detail.address && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="pin" size={14} /></div>
                <span style={{ flex: 1, fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>{detail.address}</span>
                <MapButton query={detail.address} />
              </div>
            )}
            {detail.hours && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="clock" size={14} /></div>
                <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>{detail.hours}</span>
              </div>
            )}
            {detail.price && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="pricetag" size={14} /></div>
                <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>{detail.price}</span>
              </div>
            )}
            {detail.tip && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bulb" size={14} /></div>
                <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>{detail.tip}</span>
              </div>
            )}
          </div>

          {/* Timetable */}
          {detail.timetable && (
            <div style={{ marginBottom: "14px" }}>
              <p style={{
                margin: "0 0 8px", fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)",
                color: "var(--color-on-surface-variant2)", letterSpacing: "var(--typo-caption-2-bold-letter-spacing)",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                <Icon name="car" size={14} />{detail.timetable.station} 발차 시간표 — {detail.timetable.direction}
              </p>
              <div style={{
                borderRadius: "var(--radius-md, 8px)", overflow: "hidden",
                border: "1px solid var(--color-outline-variant)",
              }}>
                {/* Table header */}
                <div style={{
                  display: "flex", padding: "8px 12px",
                  background: "var(--color-surface-container-low)", borderBottom: "1px solid var(--color-outline-variant)",
                  fontSize: "var(--typo-caption-3-bold-size)", fontWeight: "var(--typo-caption-3-bold-weight)", color: "var(--color-on-surface-variant)", letterSpacing: "var(--typo-caption-3-bold-letter-spacing)",
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
                    background: t.picked ? "var(--color-warning-container)" : (i % 2 === 0 ? "var(--color-surface-container-lowest)" : "var(--color-surface-container-low)"),
                    borderBottom: i < detail.timetable.trains.length - 1 ? "1px solid var(--color-outline-variant)" : "none",
                    borderLeft: t.picked ? "3px solid var(--color-warning)" : "3px solid transparent",
                  }}>
                    {t.picked && (
                      <span style={{
                        alignSelf: "flex-start",
                        fontSize: "var(--typo-caption-3-bold-size)", fontWeight: "var(--typo-caption-3-bold-weight)", color: "var(--color-on-warning-container)",
                        background: "var(--color-warning-container)", padding: "1px 6px", borderRadius: "4px",
                        letterSpacing: "0.3px", marginBottom: "5px",
                      }}>
                        탑승 예정
                      </span>
                    )}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{
                        width: "52px", flexShrink: 0,
                        fontSize: t.picked ? "var(--typo-label-1-n---bold-size)" : "var(--typo-caption-1-medium-size)",
                        fontWeight: t.picked ? "var(--typo-label-1-n---bold-weight)" : "var(--typo-caption-1-medium-weight)",
                        color: t.picked ? "var(--color-warning)" : "var(--color-on-surface-variant)",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {t.time}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: t.picked ? "var(--typo-label-2-bold-size)" : "var(--typo-caption-2-medium-size)",
                        fontWeight: t.picked ? "var(--typo-label-2-bold-weight)" : "var(--typo-caption-2-medium-weight)",
                        color: t.picked ? "var(--color-on-warning-container)" : "var(--color-on-surface)",
                      }}>
                        {t.name}
                      </span>
                      <span style={{
                        flex: 1, textAlign: "right",
                        fontSize: "var(--typo-caption-3-regular-size)",
                        fontWeight: t.picked ? "var(--typo-caption-3-bold-weight)" : "var(--typo-caption-3-regular-weight)",
                        color: t.picked ? "var(--color-warning)" : "var(--color-on-surface-variant2)",
                        lineHeight: 1.4,
                      }}>
                        <span style={{ display: "block" }}>{t.dest}</span>
                        <span style={{ fontSize: "var(--typo-caption-3-regular-size)", opacity: 0.8 }}>{t.note}</span>
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
                margin: "0 0 8px", fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)",
                color: "var(--color-on-surface-variant2)", letterSpacing: "var(--typo-caption-2-bold-letter-spacing)",
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
                    <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface)", lineHeight: 1.55 }}>
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
