import { useState } from 'react';
import Icon from '../common/Icon';
import Button from '../common/Button';
import Tab from '../common/Tab';
import BottomSheet from '../common/BottomSheet';
import MapButton from '../map/MapButton';
import { DAY_INFO } from '../../data/days';
import { SPACING } from '../../styles/tokens';

/* ── Day Info Dialog (식사/숙소) ── */
export default function DayInfoDialog({ dayNum, tab, onClose, color }) {
  const [activeTab, setActiveTab] = useState(tab);
  const info = DAY_INFO[dayNum];
  if (!info) return null;

  const meals = info.meals || {};
  const mealSections = [];
  if (meals.breakfast) mealSections.push({ label: "조식", items: meals.breakfast });
  if (meals.lunch) mealSections.push({ label: "점심", items: meals.lunch });
  if (meals.dinner) mealSections.push({ label: "석식", items: meals.dinner });

  return (
    <BottomSheet onClose={onClose} maxHeight="75vh">
        {/* Header with tabs */}
        <div style={{ flexShrink: 0, position: "relative" }}>
          <Tab
            items={[
              { label: "식사", value: "meals", icon: "fire" },
              { label: "숙소", value: "stay", icon: "home" },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            size="md"
            fullWidth
          />
          <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose}
            style={{ position: "absolute", right: "24px", top: "8px" }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: `${SPACING.xl} ${SPACING.xxl} ${SPACING.xxl}` }}>
          {/* 식사 탭 */}
          {activeTab === "meals" && (
            <>
              {mealSections.length === 0 ? (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: `40px ${SPACING.xxl}`, textAlign: "center",
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: "var(--color-surface-container-lowest)", display: "flex",
                    alignItems: "center", justifyContent: "center", marginBottom: SPACING.lg,
                  }}>
                    <Icon name="fire" size={20} style={{ opacity: 0.4 }} />
                  </div>
                  <p style={{ margin: 0, fontSize: "var(--typo-label-2-medium-size)", color: "var(--color-on-surface-variant2)" }}>
                    식사 정보가 없습니다
                  </p>
                </div>
              ) : (
                mealSections.map((section, si) => (
                  <div key={si} style={{ marginBottom: SPACING.xl }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.ml,
                    }}>
                      <span style={{
                        padding: `3px ${SPACING.ml}`, borderRadius: "var(--radius-md, 8px)",
                        fontSize: "var(--typo-caption-2-bold-size)", fontWeight: "var(--typo-caption-2-bold-weight)",
                        background: "var(--color-primary-container)", color: "var(--color-on-primary-container)",
                      }}>
                        {section.label}
                      </span>
                      <div style={{ flex: 1, height: "1px", background: "var(--color-surface-dim)" }} />
                    </div>
                    {section.items.map((meal, mi) => (
                      <div key={mi} style={{
                        padding: `${SPACING.lg} ${SPACING.lx}`, background: "var(--color-surface-container-lowest)",
                        borderRadius: "var(--radius-md, 8px)", border: "1px solid var(--color-outline-variant)",
                        marginBottom: SPACING.md,
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.md }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "var(--typo-label-2-bold-size)", fontWeight: "var(--typo-label-2-bold-weight)", color: "var(--color-on-surface)" }}>{meal.name}</p>
                            <p style={{ margin: `${SPACING.sm} 0 0`, fontSize: "var(--typo-caption-2-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "var(--typo-caption-2-regular-line-height)" }}>{meal.note}</p>
                          </div>
                          <MapButton query={meal.mapQuery} />
                        </div>
                        <div style={{ display: "flex", gap: SPACING.lg, marginTop: SPACING.md, fontSize: "var(--typo-caption-3-regular-size)", color: "var(--color-on-surface-variant)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: SPACING.sm }}><Icon name="clock" size={12} />{meal.time}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: SPACING.sm }}><Icon name="pricetag" size={12} />{meal.price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          )}

          {/* 숙소 탭 */}
          {activeTab === "stay" && !info.stay && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: `40px ${SPACING.xxl}`, textAlign: "center",
            }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "var(--color-surface-container-lowest)", display: "flex",
                alignItems: "center", justifyContent: "center", marginBottom: SPACING.lg,
              }}>
                <Icon name="home" size={20} style={{ opacity: 0.4 }} />
              </div>
              <p style={{ margin: 0, fontSize: "var(--typo-label-2-medium-size)", color: "var(--color-on-surface-variant2)" }}>
                숙소 정보가 없습니다
              </p>
            </div>
          )}
          {activeTab === "stay" && info.stay && (
            <div style={{
              padding: SPACING.xl, background: "var(--color-surface-container-lowest)",
              borderRadius: "var(--radius-md, 8px)", border: "1px solid var(--color-outline-variant)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.md, marginBottom: SPACING.ml }}>
                <p style={{ margin: 0, fontSize: "var(--typo-body-2-n---bold-size)", fontWeight: "var(--typo-body-2-n---bold-weight)", color: "var(--color-on-surface)" }}>{info.stay.name}</p>
                <MapButton query={info.stay.mapQuery} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: SPACING.ml }}>
                <div style={{ display: "flex", gap: SPACING.md, alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="pin" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>{info.stay.address}</span>
                </div>
                <div style={{ display: "flex", gap: SPACING.md, alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="lock" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>체크인 {info.stay.checkin} / 체크아웃 {info.stay.checkout}</span>
                </div>
                <div style={{ display: "flex", gap: SPACING.md, alignItems: "flex-start" }}>
                  <div style={{ width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="bulb" size={14} /></div>
                  <span style={{ fontSize: "var(--typo-caption-1-regular-size)", color: "var(--color-on-surface-variant)", lineHeight: "18px" }}>{info.stay.note}</span>
                </div>
              </div>
            </div>
          )}
        </div>
    </BottomSheet>
  );
}
