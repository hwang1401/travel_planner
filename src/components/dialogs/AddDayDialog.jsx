import { useState, useMemo, useEffect } from 'react';
import Field from '../common/Field';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import Icon from '../common/Icon';
import ConfirmDialog from '../common/ConfirmDialog';
import { SPACING } from '../../styles/tokens';

/* ── Add Day Dialog (Bottom Sheet) ── */
export default function AddDayDialog({ onAdd, onCancel, existingDays = [] }) {
  const [label, setLabel] = useState("");
  const [dayNum, setDayNum] = useState("");
  const [showOverwrite, setShowOverwrite] = useState(false);

  const existingNums = useMemo(() => existingDays.map((d) => d.day), [existingDays]);

  /* Default to next available day */
  useState(() => {
    const maxDay = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    setDayNum(String(maxDay + 1));
  });

  const isDuplicate = existingNums.includes(parseInt(dayNum, 10));
  const canSubmit = label.trim() && dayNum;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (isDuplicate) {
      setShowOverwrite(true);
    } else {
      onAdd(label.trim(), "pin", parseInt(dayNum, 10));
    }
  };

  const handleOverwriteConfirm = () => {
    setShowOverwrite(false);
    onAdd(label.trim(), "pin", parseInt(dayNum, 10), true /* overwrite */);
  };

  /* Visible range: show a reasonable set around the default */
  const maxDay = existingNums.length > 0 ? Math.max(...existingNums) : 0;
  const rangeEnd = Math.max(maxDay + 5, 15);

  const [viewportRect, setViewportRect] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportRect({ top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  const sheetWrapperStyle = {
    position: 'fixed',
    ...(viewportRect != null ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height } : { inset: 0 }),
    zIndex: 3000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  };

  return (
    <>
      <div style={sheetWrapperStyle}>
        <BottomSheet onClose={onCancel} maxHeight="auto" zIndex={3000} title="날짜 추가">
        <div style={{ padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.xxxl}` }}>

          {/* Day number — inline horizontal chip selector (no nested BottomSheet) */}
          <div style={{ marginBottom: SPACING.xl }}>
            <div style={{
              display: "flex", alignItems: "center", gap: SPACING.sm,
              paddingBottom: SPACING.ms,
            }}>
              <span style={{
                fontSize: "var(--typo-caption-2-bold-size)",
                fontWeight: "var(--typo-caption-2-bold-weight)",
                color: "var(--color-on-surface-variant)",
              }}>
                날짜 번호
              </span>
            </div>
            <div style={{
              display: "flex", gap: SPACING.ms, flexWrap: "wrap",
            }}>
              {Array.from({ length: rangeEnd }, (_, i) => i + 1).map((num) => {
                const exists = existingNums.includes(num);
                const selected = String(num) === dayNum;
                return (
                  <button
                    key={num}
                    onClick={() => setDayNum(String(num))}
                    style={{
                      minWidth: "44px", height: "36px",
                      borderRadius: "8px",
                      border: selected
                        ? "1.5px solid var(--color-primary)"
                        : "1px solid var(--color-outline-variant)",
                      background: selected
                        ? "var(--color-primary)"
                        : exists ? "var(--color-surface-container-lowest)" : "transparent",
                      color: selected
                        ? "#fff"
                        : exists ? "var(--color-on-surface-variant2)" : "var(--color-on-surface)",
                      fontSize: "var(--typo-label-2-medium-size)",
                      fontWeight: selected ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: SPACING.xs,
                      padding: `0 ${SPACING.ms}`,
                      fontFamily: "inherit",
                    }}
                  >
                    {num}
                    {exists && !selected && (
                      <span style={{ fontSize: "9px", opacity: 0.5 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day name */}
          <div style={{ marginBottom: SPACING.xxl }}>
            <Field label="날짜 이름" size="lg" variant="outlined"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
              placeholder="예: 후쿠오카 자유시간" />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: SPACING.ml }}>
            <Button variant="neutral" size="lg" onClick={onCancel} style={{ flex: 1, borderColor: "var(--color-outline-variant)" }}>취소</Button>
            <Button variant="primary" size="lg" onClick={handleSubmit}
              disabled={!canSubmit} style={{ flex: 1 }}>
              {isDuplicate ? "덮어쓰기" : "추가"}
            </Button>
          </div>
        </div>
      </BottomSheet>
      </div>

      {/* Overwrite confirmation */}
      {showOverwrite && (
        <ConfirmDialog
          title="날짜 덮어쓰기"
          message={`Day ${dayNum}이(가) 이미 존재합니다.\n기존 날짜를 덮어쓰시겠습니까?`}
          confirmLabel="덮어쓰기"
          onConfirm={handleOverwriteConfirm}
          onCancel={() => setShowOverwrite(false)}
        />
      )}
    </>
  );
}
