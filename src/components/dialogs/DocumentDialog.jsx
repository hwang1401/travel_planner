import { useState } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import BottomSheet from '../common/BottomSheet';
import ImageViewer from '../common/ImageViewer';

/* ── Document Dialog ── */
export default function DocumentDialog({ onClose }) {
  const [tab, setTab] = useState(0);
  const [viewImage, setViewImage] = useState(null);
  const tabs = [
    { label: "항공권", icon: "navigation", image: "/images/ticket_departure.jpg", caption: "KE8795 인천→후쿠오카 / KE788 후쿠오카→인천" },
    { label: "JR패스", icon: "car", image: "/images/jrpass.jpg", caption: "JR 북큐슈 5일권 · 예약번호: FGY393247 (성인 2매)" },
  ];
  const current = tabs[tab];

  return (
    <BottomSheet onClose={onClose} maxHeight="85vh">
        {/* Dialog header */}
        <div style={{
          padding: "6px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "var(--typo-body-1-n---bold-size)", fontWeight: "var(--typo-body-1-n---bold-weight)", color: "var(--color-on-surface)" }}>
            여행 서류
          </h3>
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: "6px", padding: "14px 20px 0",
        }}>
          {tabs.map((t, i) => (
            <Button key={i} variant={tab === i ? "primary" : "neutral"} size="md"
              iconLeft={t.icon}
              onClick={() => setTab(i)}
              style={{ flex: 1 }}>
              {t.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>
          <p style={{
            margin: "0 0 12px", fontSize: "var(--typo-caption-2-regular-size)", fontWeight: "var(--typo-caption-2-regular-weight)", color: "var(--color-on-surface-variant)",
            lineHeight: "var(--typo-caption-2-regular-line-height)", textAlign: "center",
          }}>
            {current.caption}
          </p>

          {current.image ? (
            <div
              onClick={() => setViewImage(current.image)}
              style={{
                borderRadius: "var(--radius-md, 8px)", overflow: "hidden",
                border: "1px solid var(--color-outline-variant)",
                background: "var(--color-surface-container-low)",
                aspectRatio: "595 / 842",
                width: "100%",
                cursor: "zoom-in",
              }}
            >
              <img
                src={current.image}
                alt={current.label}
                style={{
                  width: "100%", height: "100%", display: "block",
                  objectFit: "contain",
                }}
              />
            </div>
          ) : (
            <div style={{
              borderRadius: "var(--radius-md, 8px)", border: "2px dashed var(--color-outline-variant)",
              padding: "40px 20px", textAlign: "center",
              background: "var(--color-surface-container-low)",
            }}>
              <Icon name="pricetag" size={32} />
              <p style={{
                margin: "10px 0 4px", fontSize: "var(--typo-label-2-bold-size)", fontWeight: "var(--typo-label-2-bold-weight)", color: "var(--color-on-surface-variant2)",
              }}>
                이미지 준비 중
              </p>
              <p style={{
                margin: 0, fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant2)", lineHeight: "var(--typo-caption-2-regular-line-height)",
              }}>
                public/images/ 폴더에<br />JR패스 이미지를 추가해주세요
              </p>
            </div>
          )}

          {/* Extra info for JR pass tab */}
          {tab === 1 && (
            <div style={{
              marginTop: "14px", padding: "14px",
              background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px)",
              border: "1px solid var(--color-outline-variant)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="pricetag" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>JR 북큐슈 5일권 (17,000엔/인)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="calendar" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>Day2~6 커버 (2/20~2/24)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bookmark" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>예약번호: FGY393247 (성인 2매)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bulb" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>하카타역 みどりの窓口에서 바우처→실물 교환<br/>여권 + Klook 바우처 바코드 필요</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="car" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>신칸센 자유석 무제한 · 지정석 6회</span>
                </div>
              </div>
            </div>
          )}

          {/* Extra info for flight tab */}
          {tab === 0 && (
            <div style={{
              marginTop: "14px", padding: "14px",
              background: "var(--color-surface-container-lowest)", borderRadius: "var(--radius-md, 8px)",
              border: "1px solid var(--color-outline-variant)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="navigation" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}><b>가는편</b> KE8795 · 인천 15:30 → 후쿠오카 17:10</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="navigation" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}><b>오는편</b> KE788 · 후쿠오카 10:30 → 인천 12:00</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="briefcase" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>수하물 1pc 포함</span>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Image Viewer */}
      <ImageViewer src={viewImage} alt={current.label} onClose={() => setViewImage(null)} />
    </BottomSheet>
  );
}
