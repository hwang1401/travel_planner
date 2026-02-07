import { useState, useMemo } from 'react';
import Field from '../common/Field';
import BottomSheet from '../common/BottomSheet';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';

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
      onAdd(label.trim(), "pin", parseInt(dayNum, 10));
    }
  };

  const handleOverwriteConfirm = () => {
    setShowOverwrite(false);
    onAdd(label.trim(), "pin", parseInt(dayNum, 10), true /* overwrite */);
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
