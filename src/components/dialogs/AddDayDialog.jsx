import { useState, useMemo } from 'react';
import Field from '../common/Field';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';

/* ── Add Day Dialog (Bottom Sheet) ── */
export default function AddDayDialog({ onAdd, onCancel, existingDays = [] }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("pin");
  const [dayNum, setDayNum] = useState("");
  const [showOverwrite, setShowOverwrite] = useState(false);
  const icons = ["pin", "navigation", "car", "compass", "shopping", "flag", "home", "fire", "star", "bookmark"];

  const existingNums = useMemo(() => existingDays.map((d) => d.day), [existingDays]);

  /* Default to next available day */
  useState(() => {
    const maxDay = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    setDayNum(String(maxDay + 1));
  });

  /* Build 1~50 options */
  const dayOptions = useMemo(() => {
    const opts = [];
    for (let i = 1; i <= 50; i++) {
      const exists = existingNums.includes(i);
      opts.push({ value: String(i), label: `Day ${i}${exists ? " (존재)" : ""}` });
    }
    return opts;
  }, [existingNums]);

  const isDuplicate = existingNums.includes(parseInt(dayNum, 10));
  const canSubmit = label.trim() && dayNum;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (isDuplicate) {
      setShowOverwrite(true);
    } else {
      onAdd(label.trim(), icon, parseInt(dayNum, 10));
    }
  };

  const handleOverwriteConfirm = () => {
    setShowOverwrite(false);
    onAdd(label.trim(), icon, parseInt(dayNum, 10), true /* overwrite */);
  };

  return (
    <>
      <BottomSheet onClose={onCancel} maxHeight="auto" zIndex={3000}>
        <div style={{ padding: "8px 24px 24px" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
            날짜 추가
          </h3>

          {/* Day number dropdown */}
          <div style={{ marginBottom: "16px" }}>
            <Field as="select" label="날짜 번호" required size="lg" variant="outlined"
              value={dayNum}
              onChange={(e) => setDayNum(e.target.value)}>
              {dayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Field>
          </div>

          {/* Icon picker */}
          <div style={{ marginBottom: "16px" }}>
            <p style={{ margin: "0 0 8px", fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)", color: "var(--color-on-surface-variant)" }}>아이콘</p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {icons.map((ic) => (
                <Button key={ic} variant={icon === ic ? "neutral" : "ghost-neutral"} size="xlg" iconOnly={ic}
                  onClick={() => setIcon(ic)}
                  style={{
                    width: "40px", height: "40px", borderRadius: "var(--radius-md, 8px)",
                    border: icon === ic ? "2px solid var(--color-on-surface)" : "1px solid var(--color-outline-variant)",
                    background: icon === ic ? "var(--color-surface-container-low)" : "var(--color-surface-container-lowest)",
                  }} />
              ))}
            </div>
          </div>

          {/* Day name */}
          <div style={{ marginBottom: "20px" }}>
            <Field label="날짜 이름" required size="lg" variant="outlined"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleSubmit(); }}
              placeholder="예: 후쿠오카 자유시간" />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px" }}>
            <Button variant="neutral" size="lg" onClick={onCancel} style={{ flex: 1 }}>취소</Button>
            <Button variant="primary" size="lg" onClick={handleSubmit}
              disabled={!canSubmit} style={{ flex: 1 }}>
              {isDuplicate ? "덮어쓰기" : "추가"}
            </Button>
          </div>
        </div>
      </BottomSheet>

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
