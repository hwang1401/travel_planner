import { useState } from "react";
import { createPortal } from "react-dom";
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
  onReplace,      // replace entire day
  onAppend,       // append to existing
  onCancel,
}) {
  const hasConflicts = conflicts.internal.length > 0 || conflicts.external.length > 0;
  const [expandedIndex, setExpandedIndex] = useState(null);

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
              AI 일정 분석 결과
            </h3>
            <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onCancel} />
          </div>
          <p style={{
            margin: `${SPACING.sm} 0 0`, fontSize: "var(--typo-caption-2-regular-size)",
            color: "var(--color-on-surface-variant2)",
          }}>
            {dayLabel} · {items.length}개 일정 인식
            {existingCount > 0 && ` · 기존 ${existingCount}개`}
          </p>
        </div>

        {/* Warnings */}
        {hasConflicts && (
          <div style={{ padding: `${SPACING.lg} ${SPACING.xxl} 0` }}>
            {conflicts.internal.length > 0 && (
              <div style={{
                padding: `${SPACING.ml} ${SPACING.lg}`, marginBottom: SPACING.md,
                background: "var(--color-warning-container)",
                borderRadius: RADIUS.md,
                border: "1px solid var(--color-warning-container)",
              }}>
                <p style={{
                  margin: 0, fontSize: "var(--typo-caption-2-regular-size)",
                  color: "var(--color-on-warning-container)",
                  display: "flex", alignItems: "flex-start", gap: SPACING.ms,
                }}>
                  <Icon name="flash" size={12} style={{ marginTop: SPACING.xs, flexShrink: 0 }} />
                  <span>
                    파일 내 중복 시간: {conflicts.internal.map((c) => c.time).join(", ")}
                  </span>
                </p>
              </div>
            )}
            {conflicts.external.length > 0 && (
              <div style={{
                padding: `${SPACING.ml} ${SPACING.lg}`, marginBottom: SPACING.md,
                background: "var(--color-error-container)",
                borderRadius: RADIUS.md,
                border: "1px solid var(--color-error)",
              }}>
                <p style={{
                  margin: 0, fontSize: "var(--typo-caption-2-regular-size)",
                  color: "var(--color-on-error-container)",
                  display: "flex", alignItems: "flex-start", gap: SPACING.ms,
                }}>
                  <Icon name="flash" size={12} style={{ marginTop: SPACING.xs, flexShrink: 0 }} />
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
              const hasExternalConflict = conflicts.external.some((c) => c.time === item.time && c.newDesc === item.desc);
              const hasDetail = item.detail && (item.detail.address || item.detail.tip || item.detail.timetable);
              const isExpanded = expandedIndex === i;
              return (
                <div
                  key={i}
                  style={{
                    borderBottom: isLast ? "none" : "1px solid var(--color-surface-dim)",
                    background: hasExternalConflict ? "var(--color-error-container)" : "transparent",
                  }}
                >
                  <div
                    style={{
                      display: "flex", alignItems: "flex-start", gap: SPACING.md,
                      padding: `${SPACING.md} ${SPACING.lg}`,
                    }}
                  >
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
                        paddingLeft: `calc(36px + ${SPACING.md} + ${SPACING.lg})`,
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
          {existingCount > 0 && (
            <Button
              variant="neutral" size="lg"
              onClick={onAppend}
              style={{ flex: 1, borderColor: "var(--color-outline-variant)" }}
            >
              추가
            </Button>
          )}
          <Button
            variant="primary" size="lg"
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
