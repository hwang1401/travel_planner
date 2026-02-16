import { useState } from "react";
import { createPortal } from "react-dom";
import { useBackClose } from '../../hooks/useBackClose';
import Icon from "../common/Icon";
import Button from "../common/Button";
import { getTypeConfig, SPACING, RADIUS } from "../../styles/tokens";
import { TYPE_LABELS } from "../../utils/scheduleParser";

/* ── Import Preview Dialog ── */
export default function ImportPreviewDialog({
  items,          // parsed items
  errors,         // parse errors
  conflicts,      // { internal, external }
  dayLabel,       // e.g. "Day 1"
  existingCount,  // number of existing items in the day
  onAppend,       // append selected items
  onCancel,
}) {
  useBackClose(true, onCancel);
  const [selected, setSelected] = useState(() => new Set(items.map((_, i) => i)));
  const [expandedIndex, setExpandedIndex] = useState(null);

  const allSelected = selected.size === items.length;

  const toggleItem = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((_, i) => i)));
  };

  const handleAppend = () => {
    const selectedItems = items.filter((_, i) => selected.has(i));
    if (selectedItems.length > 0) onAppend(selectedItems);
  };

  // Build a map: item index → external conflict info
  const externalConflictMap = new Map();
  for (const c of conflicts.external) {
    const idx = items.findIndex((it) => it.time === c.time && it.desc === c.newDesc);
    if (idx >= 0) externalConflictMap.set(idx, c);
  }

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: SPACING.xxl,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "420px", maxHeight: "80vh",
          background: "var(--color-surface-container-lowest)",
          borderRadius: RADIUS.lg,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "var(--shadow-heavy)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: `${SPACING.xxl} ${SPACING.xxl} ${SPACING.lg}`,
          borderBottom: "1px solid var(--color-outline-variant)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{
              margin: 0, fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)",
              color: "var(--color-on-surface)",
            }}>
              AI 추천 일정
            </h3>
            <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onCancel} />
          </div>
          <div style={{
            margin: `${SPACING.sm} 0 0`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <p style={{
              margin: 0, fontSize: "var(--typo-caption-2-regular-size)",
              color: "var(--color-on-surface-variant2)",
            }}>
              {dayLabel} · {items.length}개 일정 인식
              {existingCount > 0 && ` · 기존 ${existingCount}개`}
            </p>
            <label style={{
              display: "flex", alignItems: "center", gap: SPACING.ms,
              fontSize: "var(--typo-caption-2-regular-size)",
              color: "var(--color-on-surface-variant2)",
              cursor: "pointer", userSelect: "none",
            }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                style={{
                  width: 16, height: 16, margin: 0, cursor: "pointer",
                  accentColor: "var(--color-primary)",
                }}
              />
              전체 선택
            </label>
          </div>
        </div>

        {/* Parse errors */}
        {errors.length > 0 && (
          <div style={{ padding: `${SPACING.md} ${SPACING.xxl} 0` }}>
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
          flex: 1, overflowY: "auto", padding: `${SPACING.lg} ${SPACING.xxl}`,
        }}>
          <div style={{
            borderRadius: RADIUS.md,
            border: "1px solid var(--color-outline-variant)",
            overflow: "hidden",
          }}>
            {items.map((item, i) => {
              const cfg = getTypeConfig(item.type);
              const isLast = i === items.length - 1;
              const isChecked = selected.has(i);
              const conflictInfo = externalConflictMap.get(i);
              const hasDetail = item.detail && (item.detail.address || item.detail.tip || item.detail.timetable);
              const isExpanded = expandedIndex === i;
              return (
                <div
                  key={i}
                  style={{
                    borderBottom: isLast ? "none" : "1px solid var(--color-surface-dim)",
                    background: conflictInfo ? "var(--color-error-container)" : "transparent",
                    opacity: isChecked ? 1 : 0.4,
                    transition: "opacity 0.15s",
                    ...(conflictInfo ? { borderLeft: "3px solid var(--color-error)" } : {}),
                  }}
                >
                  <div
                    style={{
                      display: "flex", alignItems: "flex-start", gap: SPACING.md,
                      padding: `${SPACING.md} ${SPACING.lg}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(i)}
                      style={{
                        width: 16, height: 16, margin: 0, marginTop: 2,
                        cursor: "pointer", flexShrink: 0,
                        accentColor: "var(--color-primary)",
                      }}
                    />
                    <span style={{
                      width: "36px", flexShrink: 0, textAlign: "right",
                      fontSize: "var(--typo-caption-2-bold-size)",
                      fontWeight: "var(--typo-caption-2-bold-weight)",
                      color: "var(--color-on-surface-variant2)",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: "var(--typo-caption-2-bold-line-height, 1.25)",
                      paddingTop: "2px",
                    }}>
                      {item.time || "--:--"}
                    </span>
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
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExpandedIndex(isExpanded ? null : i); }}
                              style={{
                                margin: 0, padding: 0, border: "none", background: "none",
                                color: "var(--color-primary)", cursor: "pointer",
                                fontSize: "inherit", fontFamily: "inherit",
                                textDecoration: "underline",
                                textUnderlineOffset: "2px",
                              }}
                            >
                              {[
                                item.detail.address && "주소",
                                item.detail.timetable && "영업시간",
                                item.detail.tip && "상세정보",
                              ].filter(Boolean).join(" · ")}
                            </button>
                          )}
                        </p>
                      )}
                      {conflictInfo && (
                        <p style={{
                          margin: `${SPACING.xs} 0 0`, fontSize: "var(--typo-caption-3-regular-size)",
                          color: "var(--color-error)",
                          display: "flex", alignItems: "center", gap: "3px",
                        }}>
                          <span>⚡</span>
                          <span>기존 '{conflictInfo.existingDescs[0]}' ({conflictInfo.time})과 시간 겹침</span>
                        </p>
                      )}
                    </div>
                    <span style={{
                      fontSize: "var(--typo-caption-3-regular-size)",
                      color: cfg.text, flexShrink: 0,
                      lineHeight: "var(--typo-caption-2-regular-line-height, 1.25)",
                      paddingTop: "2px",
                    }}>
                      {TYPE_LABELS[item.type] || "정보"}
                    </span>
                  </div>
                  {hasDetail && isExpanded && (
                    <div
                      style={{
                        padding: `${SPACING.sm} ${SPACING.lg} ${SPACING.md}`,
                        paddingLeft: `calc(16px + 36px + ${SPACING.md} * 2 + ${SPACING.lg})`,
                        background: "var(--color-surface-container-low)",
                        borderTop: "1px solid var(--color-outline-variant)",
                        fontSize: "var(--typo-caption-2-regular-size)",
                        color: "var(--color-on-surface-variant2)",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.detail.address && (
                        <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--color-on-surface)" }}>주소</p>
                      )}
                      {item.detail.address && (
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.detail.address}</p>
                      )}
                      {item.detail.tip && (
                        <>
                          <p style={{ margin: "10px 0 6px", fontWeight: 600, color: "var(--color-on-surface)" }}>상세정보</p>
                          <p style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.detail.tip}</p>
                        </>
                      )}
                      {item.detail.timetable && (() => {
                        const t = item.detail.timetable;
                        const text = typeof t === "string" ? t : (t.summary || (t.trains?.length ? `열차 ${t.trains.length}편` : null));
                        if (!text) return null;
                        return (
                          <>
                            <p style={{ margin: "10px 0 6px", fontWeight: 600, color: "var(--color-on-surface)" }}>영업시간</p>
                            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: `${SPACING.lg} ${SPACING.xxl} ${SPACING.xxl}`,
          borderTop: "1px solid var(--color-outline-variant)",
          display: "flex", gap: SPACING.md,
        }}>
          <Button
            variant="neutral" size="lg"
            onClick={onCancel}
            style={{ flex: 1, borderColor: "var(--color-outline-variant)" }}
          >
            취소
          </Button>
          <Button
            variant="primary" size="lg"
            onClick={handleAppend}
            disabled={selected.size === 0}
            style={{ flex: 1 }}
          >
            {existingCount > 0
              ? `선택 추가 (${selected.size}개)`
              : `일정 추가 (${selected.size}개)`}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
