/**
 * 스케줄 데이터 병합 및 요약 유틸리티.
 * (storage.js에서 이동 — localStorage 의존 코드 제거)
 */

/* ── Helper: parse "HH:MM" to minutes for sorting ── */
function timeToMin(t) {
  if (!t) return 9999;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/* ── Helper: apply customData (section overrides + extraItems) to a day ── */
function applyDayCustom(day, dayCustom, overrides) {
  let d = day;
  if (overrides) d = { ...d, ...overrides };
  if (!dayCustom) return d;

  const newSections = d.sections.map((sec, si) => {
    const secCustom = dayCustom.sections?.[si];
    if (!secCustom) return { ...sec, items: (sec.items || []).filter(Boolean) };
    // overlay가 있으면 항상 overlay items 사용 (수정 반영 보장; 빈 배열이어도 base로 되돌리지 않음)
    const items = Array.isArray(secCustom.items) ? secCustom.items.filter(Boolean) : (sec.items || []).filter(Boolean);
    return { ...sec, items };
  });

  // Merge extra items into existing sections by timestamp
  if (dayCustom.extraItems && dayCustom.extraItems.length > 0) {
    const extras = [...dayCustom.extraItems];

    // Auto-expand single "종일" section into 오전/오후/저녁 when importing multiple items
    if (newSections.length === 1 && (!newSections[0].items || newSections[0].items.length === 0) && extras.length > 1) {
      const title = newSections[0].title || "";
      if (title === "종일" || title === "일정") {
        newSections.splice(0, 1,
          { title: "오전", items: [] },
          { title: "오후", items: [] },
          { title: "저녁", items: [] },
        );
      }
    }

    // Check if ALL sections are empty — use time-based assignment
    const allEmpty = newSections.every((s) => !s.items || s.items.length === 0);

    extras.forEach((extraItem) => {
      const extraMin = timeToMin(extraItem.time);
      let bestSec = -1;
      let bestPos = -1;

      if (allEmpty && newSections.length > 1) {
        // Time-based section assignment by title keywords
        const SECTION_RANGES = {
          "오전": [0, 720],       // 00:00 – 11:59
          "오후": [720, 1080],    // 12:00 – 17:59
          "저녁": [1080, 1440],   // 18:00 – 23:59
        };
        for (let si = 0; si < newSections.length; si++) {
          const title = newSections[si].title || "";
          const range = SECTION_RANGES[title];
          if (range && extraMin >= range[0] && extraMin < range[1]) {
            bestSec = si;
            break;
          }
        }
        // If no title match, infer by position (first=morning, mid=afternoon, last=evening)
        if (bestSec === -1) {
          if (newSections.length === 3) {
            if (extraMin < 720) bestSec = 0;
            else if (extraMin < 1080) bestSec = 1;
            else bestSec = 2;
          } else if (newSections.length === 2) {
            bestSec = extraMin < 720 ? 0 : 1;
          }
        }
        if (bestSec >= 0) {
          // Insert in time order within the section
          const items = newSections[bestSec].items || [];
          bestPos = items.length;
          for (let ii = 0; ii < items.length; ii++) {
            if (timeToMin(items[ii].time) > extraMin) {
              bestPos = ii;
              break;
            }
          }
        }
      } else {
        // Find the best section and position by comparing with existing items
        for (let si = 0; si < newSections.length; si++) {
          const items = newSections[si].items;
          if (!items || items.length === 0) continue;

          const firstMin = timeToMin(items[0]?.time);
          const lastMin = timeToMin(items[items.length - 1]?.time);

          if (extraMin >= firstMin && extraMin <= lastMin + 30) {
            let pos = items.length;
            for (let ii = 0; ii < items.length; ii++) {
              if (timeToMin(items[ii].time) > extraMin) {
                pos = ii;
                break;
              }
            }
            bestSec = si;
            bestPos = pos;
            break;
          }

          if (si === 0 && extraMin < firstMin) {
            bestSec = 0;
            bestPos = 0;
            break;
          }
        }

        if (bestSec === -1) {
          for (let si = newSections.length - 1; si >= 0; si--) {
            const items = newSections[si].items;
            if (!items || items.length === 0) continue;
            const lastMin = timeToMin(items[items.length - 1]?.time);
            if (lastMin <= extraMin) {
              bestSec = si;
              bestPos = items.length;
              break;
            }
          }
        }
      }

      // Fallback: append to last section (or first if all empty)
      if (bestSec === -1) {
        bestSec = newSections.length - 1;
        if (bestSec < 0) bestSec = 0;
        bestPos = newSections[bestSec]?.items?.length || 0;
      }

      const sec = newSections[bestSec];
      if (sec) {
        const newItems = [...(sec.items || [])];
        newItems.splice(bestPos, 0, { ...extraItem, _extra: true });
        newSections[bestSec] = { ...sec, items: newItems };
      }
    });
  }
  return { ...d, sections: newSections };
}

export function mergeData(base, custom) {
  const merged = base.map((day, di) => {
    return applyDayCustom(day, custom[di], custom._dayOverrides?.[di]);
  });

  // Append custom-added days (also apply per-day customizations)
  if (custom._extraDays) {
    custom._extraDays.forEach((d, i) => {
      const dayIdx = base.length + i;
      const dayCustom = custom[dayIdx];
      const overrides = custom._dayOverrides?.[dayIdx];
      merged.push(applyDayCustom(d, dayCustom, overrides));
    });
  }

  // Apply day reorder if present (MD-3: out-of-range 인덱스 검증 추가)
  if (custom._dayOrder && custom._dayOrder.length === merged.length) {
    if (custom._dayOrder.every((idx) => idx >= 0 && idx < merged.length)) {
      return custom._dayOrder.map((origIdx) => merged[origIdx]);
    }
  }
  return merged;
}

/* ── Helper: extract yen amount from a string ── */
function parseYen(str) {
  if (!str) return 0;
  // Remove commas, then find patterns like "1,000엔", "~500엔", "1,500~2,500엔"
  const cleaned = str.replace(/,/g, "");
  // Match range: "1500~2500엔" → take lower bound
  const range = cleaned.match(/(\d+)\s*[~～]\s*(\d+)\s*엔/);
  if (range) return parseInt(range[1], 10);
  // Match single: "800엔", "~1000엔"
  const single = cleaned.match(/~?\s*(\d+)\s*엔/);
  if (single) return parseInt(single[1], 10);
  return 0;
}

/**
 * Auto-generate a day summary from its items.
 * Returns a string like "식사 2 · 관광 1 | 교통 ~700엔 · 식비 ~2,200엔"
 */
export function generateDaySummary(day) {
  if (!day || !day.sections) return "";

  const allItems = day.sections.flatMap((sec) => (sec.items || []).filter(Boolean));
  if (allItems.length === 0) return "";

  // 1) Count by type (only show food, spot, shop)
  const typeLabels = { food: "식사", spot: "관광", shop: "쇼핑" };
  const counts = {};
  allItems.forEach((item) => {
    if (typeLabels[item.type]) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
  });

  const countParts = Object.entries(counts)
    .map(([type, count]) => `${typeLabels[type]} ${count}`)
    .filter(Boolean);

  // 2) Parse costs by category
  const costCategories = { food: 0, move: 0, flight: 0, other: 0 };

  allItems.forEach((item) => {
    let cost = 0;
    if (item.detail?.price) {
      cost = parseYen(item.detail.price);
    }
    if (item.sub) {
      const subCost = parseYen(item.sub);
      if (subCost > 0 && cost === 0) cost = subCost;
      if ((item.type === "move" || item.type === "flight") && subCost > 0) cost = subCost;
    }

    if (cost > 0) {
      if (item.type === "food") costCategories.food += cost;
      else if (item.type === "move") costCategories.move += cost;
      else if (item.type === "flight") costCategories.flight += cost;
      else costCategories.other += cost;
    }
  });

  const costParts = [];
  if (costCategories.move > 0) costParts.push(`교통 ~${costCategories.move.toLocaleString()}엔`);
  if (costCategories.flight > 0) costParts.push(`항공 ~${costCategories.flight.toLocaleString()}엔`);
  if (costCategories.food > 0) costParts.push(`식비 ~${costCategories.food.toLocaleString()}엔`);
  if (costCategories.other > 0) costParts.push(`입장/쇼핑 ~${costCategories.other.toLocaleString()}엔`);

  // 3) Build summary
  const parts = [];
  if (countParts.length > 0) parts.push(countParts.join(" · "));
  if (costParts.length > 0) parts.push(costParts.join(" · "));

  return parts.join(" | ");
}
