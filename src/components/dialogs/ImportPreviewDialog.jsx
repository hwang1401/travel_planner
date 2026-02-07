import { createPortal } from "react-dom";
import Icon from "../common/Icon";
import Button from "../common/Button";
import { TYPE_CONFIG } from "../../data/guides";
import { TYPE_LABELS } from "../../utils/scheduleParser";

/* ── Import Preview Dialog ── */
export default function ImportPreviewDialog({
  items,          // parsed items
  errors,         // parse errors
  conflicts,      // { internal, external }
  dayLabel,       // e.g. "Day 1"
  existingCount,  // number of existing items in the day
  onReplace,      // replace entire day
  onAppend,       // append to existing
  onCancel,
}) {
  const hasConflicts = conflicts.internal.length > 0 || conflicts.external.length > 0;

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "420px", maxHeight: "80vh",
          background: "var(--color-surface-container-lowest)",
          borderRadius: "var(--radius-lg, 12px)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "var(--shadow-heavy)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 20px 12px",
          borderBottom: "1px solid var(--color-outline-variant)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{
              margin: 0, fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)",
              color: "var(--color-on-surface)",
            }}>
              일정 파일 가져오기
            </h3>
            <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onCancel} />
          </div>
          <p style={{
            margin: "4px 0 0", fontSize: "var(--typo-caption-2-regular-size)",
            color: "var(--color-on-surface-variant2)",
          }}>
            {dayLabel} · {items.length}개 일정 인식
            {existingCount > 0 && ` · 기존 ${existingCount}개`}
          </p>
        </div>

        {/* Warnings */}
        {hasConflicts && (
          <div style={{ padding: "12px 20px 0" }}>
            {conflicts.internal.length > 0 && (
              <div style={{
                padding: "10px 12px", marginBottom: "8px",
                background: "var(--color-warning-container)",
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid var(--color-warning-container)",
              }}>
                <p style={{
                  margin: 0, fontSize: "var(--typo-caption-2-regular-size)",
                  color: "var(--color-on-warning-container)",
                  display: "flex", alignItems: "flex-start", gap: "6px",
                }}>
                  <Icon name="flash" size={12} style={{ marginTop: "2px", flexShrink: 0 }} />
                  <span>
                    파일 내 중복 시간: {conflicts.internal.map((c) => c.time).join(", ")}
                  </span>
                </p>
              </div>
            )}
            {conflicts.external.length > 0 && (
              <div style={{
                padding: "10px 12px", marginBottom: "8px",
                background: "#FFF0F0",
                borderRadius: "var(--radius-md, 8px)",
                border: "1px solid #FECACA",
              }}>
                <p style={{
                  margin: 0, fontSize: "var(--typo-caption-2-regular-size)",
                  color: "#B91C1C",
                  display: "flex", alignItems: "flex-start", gap: "6px",
                }}>
                  <Icon name="flash" size={12} style={{ marginTop: "2px", flexShrink: 0 }} />
                  <span>
                    기존 일정과 시간 충돌: {conflicts.external.map((c) => `${c.time} (${c.existingDescs[0]})`).join(", ")}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Parse errors */}
        {errors.length > 0 && (
          <div style={{ padding: "8px 20px 0" }}>
            <p style={{
              margin: 0, fontSize: "var(--typo-caption-3-regular-size)",
              color: "var(--color-on-surface-variant2)",
            }}>
              {errors.length}개 줄 무시됨: {errors.slice(0, 2).join(", ")}
              {errors.length > 2 && ` 외 ${errors.length - 2}개`}
            </p>
          </div>
        )}

        {/* Item list preview */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "12px 20px",
        }}>
          <div style={{
            borderRadius: "var(--radius-md, 8px)",
            border: "1px solid var(--color-outline-variant)",
            overflow: "hidden",
          }}>
            {items.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
              const isLast = i === items.length - 1;
              const hasExternalConflict = conflicts.external.some((c) => c.time === item.time && c.newDesc === item.desc);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px",
                    borderBottom: isLast ? "none" : "1px solid var(--color-surface-dim)",
                    background: hasExternalConflict ? "#FFF8F8" : "transparent",
                  }}
                >
                  <span style={{
                    width: "36px", flexShrink: 0, textAlign: "right",
                    fontSize: "var(--typo-caption-2-bold-size)",
                    fontWeight: "var(--typo-caption-2-bold-weight)",
                    color: "var(--color-on-surface-variant2)",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {item.time || "--:--"}
                  </span>
                  <div style={{
                    width: "20px", height: "20px", borderRadius: "var(--radius-sm, 4px)",
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon name={cfg.icon} size={10} style={{ color: cfg.text }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: "var(--typo-caption-2-regular-size)",
                      fontWeight: "var(--typo-caption-2-bold-weight)",
                      color: "var(--color-on-surface)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.desc}
                    </p>
                    {(item.sub || item.detail) && (
                      <p style={{
                        margin: 0, fontSize: "var(--typo-caption-3-regular-size)",
                        color: "var(--color-on-surface-variant2)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {item.sub}
                        {item.sub && item.detail ? " · " : ""}
                        {item.detail && (
                          <span style={{ color: "var(--color-primary)", opacity: 0.7 }}>
                            {[
                              item.detail.address && "주소",
                              item.detail.timetable && "영업시간",
                              item.detail.tip && "상세정보",
                            ].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <span style={{
                    fontSize: "var(--typo-caption-3-regular-size)",
                    color: cfg.text, flexShrink: 0,
                  }}>
                    {TYPE_LABELS[item.type] || "정보"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "12px 20px 20px",
          borderTop: "1px solid var(--color-outline-variant)",
          display: "flex", gap: "8px",
        }}>
          <Button
            variant="neutral" size="md"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            취소
          </Button>
          {existingCount > 0 && (
            <Button
              variant="neutral" size="md"
              onClick={onAppend}
              style={{ flex: 1 }}
            >
              추가
            </Button>
          )}
          <Button
            variant="primary" size="md"
            onClick={onReplace}
            style={{ flex: 1 }}
          >
            {existingCount > 0 ? "전체 교체" : "일정 생성"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
