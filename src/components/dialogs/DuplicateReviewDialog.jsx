import { useState } from "react";
import BottomSheet from "../common/BottomSheet";
import Button from "../common/Button";
import Icon from "../common/Icon";
import { SPACING } from "../../styles/tokens";

/**
 * AI 파싱 / 일괄 추가 시 중복 아이템을 리뷰하는 다이얼로그.
 *
 * Props:
 *   cleanItems: 중복 아닌 아이템 (자동 추가됨)
 *   duplicateItems: 중복 아이템 (사용자가 포함/제외 선택)
 *   onConfirm(selectedItems): 최종 추가할 아이템 배열
 *   onClose: 취소
 */
export default function DuplicateReviewDialog({
  cleanItems = [],
  duplicateItems = [],
  onConfirm,
  onClose,
}) {
  const [checked, setChecked] = useState(() => new Set());

  const toggleItem = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedDuplicates = duplicateItems.filter((it) => checked.has(it._id));
    onConfirm([...cleanItems, ...selectedDuplicates]);
  };

  const totalClean = cleanItems.length;
  const totalDup = duplicateItems.length;

  return (
    <BottomSheet onClose={onClose} title="중복 일정 확인">
      <div style={{ padding: `0 ${SPACING.xl} ${SPACING.lg}` }}>
        <p style={{
          fontSize: "var(--typo-body-2-regular-size)",
          color: "var(--color-on-surface-variant)",
          margin: `0 0 ${SPACING.md}`,
          lineHeight: 1.5,
        }}>
          {totalClean}개 일정은 바로 추가되고,{" "}
          <strong style={{ color: "var(--color-on-surface)" }}>{totalDup}개</strong>는
          이미 같은 시간·이름의 일정이 있어요.
          {"\n"}추가할 항목을 선택해주세요.
        </p>

        <div style={{
          display: "flex", flexDirection: "column", gap: SPACING.sm,
          maxHeight: "40vh", overflowY: "auto",
        }}>
          {duplicateItems.map((item) => {
            const id = item._id || `${item.time}|${item.desc}`;
            const isChecked = checked.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleItem(id)}
                style={{
                  display: "flex", alignItems: "center", gap: SPACING.ms,
                  padding: `${SPACING.ms} ${SPACING.md}`,
                  border: `1px solid ${isChecked ? "var(--color-primary)" : "var(--color-outline-variant)"}`,
                  borderRadius: 12,
                  background: isChecked ? "var(--color-primary-container)" : "var(--color-surface-container-low)",
                  cursor: "pointer", textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${isChecked ? "var(--color-primary)" : "var(--color-outline)"}`,
                  background: isChecked ? "var(--color-primary)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isChecked && <Icon name="check" size={12} style={{ filter: "brightness(0) invert(1)" }} />}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "var(--typo-body-2-medium-size)",
                    fontWeight: 500,
                    color: "var(--color-on-surface)",
                  }}>
                    {item.time && <span style={{ color: "var(--color-primary)", marginRight: SPACING.xs }}>{item.time}</span>}
                    {item.desc}
                  </div>
                </div>

                <span style={{
                  fontSize: "var(--typo-caption-1-regular-size)",
                  color: "var(--color-warning, #E67E22)",
                  flexShrink: 0,
                }}>
                  중복
                </span>
              </button>
            );
          })}
        </div>

        <div style={{
          display: "flex", gap: SPACING.sm,
          marginTop: SPACING.lg,
        }}>
          <Button
            variant="ghost-neutral"
            size="lg"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            취소
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirm}
            style={{ flex: 1 }}
          >
            {totalClean + checked.size}개 추가
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
