import { useState } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Tab from '../common/Tab';
import BottomSheet from '../common/BottomSheet';
import MapButton from '../map/MapButton';
import { GUIDE_DATA, getGuidesForDestinations } from '../../data/guides';

/* ── Guide Card ── */
function GuideCard({ item }) {
  return (
    <div style={{
      marginBottom: "10px", padding: "14px",
      background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px)",
      border: "1px solid var(--color-outline-variant)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "var(--typo-label-2-bold-size)", fontWeight: "var(--typo-label-2-bold-weight)", color: "var(--color-on-surface)" }}>{item.name}</p>
          {item.sub && <p style={{ margin: 0, fontSize: "var(--typo-caption-3-regular-size)", color: "var(--color-on-surface-variant2)", marginTop: "1px" }}>{item.sub}</p>}
        </div>
        <MapButton query={item.mapQuery} />
      </div>
      <p style={{ margin: "0 0 8px", fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "var(--typo-caption-2-regular-line-height)" }}>{item.desc}</p>
      {item.schedule && (
        <p style={{ margin: "0 0 8px", fontSize: "var(--typo-caption-2-medium-size)", color: "var(--color-on-surface-variant)", fontWeight: "var(--typo-caption-2-medium-weight)", display: "flex", alignItems: "center", gap: "4px" }}><Icon name="clock" size={12} />{item.schedule}</p>
      )}
      {item.details && item.details.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "8px" }}>
          {item.details.map((d, j) => (
            <div key={j} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "var(--color-on-surface-variant2)", fontSize: "var(--typo-caption-3-regular-size)", marginTop: "5px", flexShrink: 0 }}>●</span>
              <span style={{ fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "var(--typo-caption-2-regular-line-height)" }}>{d}</span>
            </div>
          ))}
        </div>
      )}
      {item.tip && (
        <div style={{
          padding: "6px 10px", background: "var(--color-warning-container)", borderRadius: "var(--radius-md, 8px)",
          border: "1px solid var(--color-warning-container)",
        }}>
          <span style={{ fontSize: "var(--typo-caption-3-regular-size)", color: "var(--color-on-warning-container)", lineHeight: "var(--typo-caption-3-regular-line-height)", display: "flex", alignItems: "flex-start", gap: "4px" }}><Icon name="bulb" size={12} style={{ marginTop: "1px" }} /><span>{item.tip}</span></span>
        </div>
      )}
    </div>
  );
}

/* ── Shopping Guide Dialog ── */
export default function ShoppingGuideDialog({ onClose, destinations }) {
  // Filter guides based on trip destinations
  const guides = destinations ? getGuidesForDestinations(destinations) : GUIDE_DATA;
  const [regionIdx, setRegionIdx] = useState(0);
  const [chipIdx, setChipIdx] = useState(0);
  const region = guides[regionIdx];
  const filtered = region ? (chipIdx === 0 ? region.items : region.items.filter((it) => it.chip === region.chips[chipIdx])) : [];

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh" minHeight="70vh">
        {/* Header */}
        <div style={{
          padding: "6px 16px 0 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
            여행 가이드
          </h3>
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
        </div>

        {guides.length === 0 ? (
          /* ── Empty: no guide for this destination ── */
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "60px 20px", textAlign: "center",
          }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "var(--color-surface-container-low)", display: "flex",
              alignItems: "center", justifyContent: "center", marginBottom: "16px",
            }}>
              <Icon name="compass" size={24} style={{ opacity: 0.4 }} />
            </div>
            <p style={{
              margin: 0, fontSize: "var(--typo-body-1-n---bold-size)",
              fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)",
            }}>
              아직 가이드가 없습니다
            </p>
            <p style={{
              margin: "8px 0 0", fontSize: "var(--typo-caption-1-regular-size)",
              color: "var(--color-on-surface-variant2)", lineHeight: 1.5,
            }}>
              이 여행지에 대한 가이드는{"\n"}준비 중입니다
            </p>
          </div>
        ) : (
          <>
            {/* Region Tabs */}
            <div style={{ padding: "0 20px" }}>
              <Tab
                items={guides.map((r, i) => ({ label: r.region, value: i }))}
                value={regionIdx}
                onChange={(v) => { setRegionIdx(v); setChipIdx(0); }}
                size="md"
                fullWidth
              />
            </div>

            {/* Category Chips */}
            <div style={{ padding: "12px 20px 0" }}>
              <Tab
                items={region.chips.map((c, i) => ({ label: c, value: i }))}
                value={chipIdx}
                onChange={setChipIdx}
                variant="pill"
                size="sm"
              />
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
              {filtered.map((item, i) => (
                <GuideCard key={`${regionIdx}-${chipIdx}-${i}`} item={item} />
              ))}
              {filtered.length === 0 && (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "48px 20px", textAlign: "center",
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: "var(--color-surface-container-low)", display: "flex",
                    alignItems: "center", justifyContent: "center", marginBottom: "12px",
                  }}>
                    <Icon name="search" size={20} style={{ opacity: 0.4 }} />
                  </div>
                  <p style={{ margin: 0, fontSize: "var(--typo-label-2-medium-size)", color: "var(--color-on-surface-variant2)" }}>
                    해당 카테고리에 항목이 없습니다
                  </p>
                </div>
              )}
            </div>
          </>
        )}
    </BottomSheet>
  );
}
