export function loadCustomData() {
  try {
    const saved = localStorage.getItem("travel_custom_data");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

/* ── Helper: parse "HH:MM" to minutes for sorting ── */
function timeToMin(t) {
  if (!t) return 9999;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/* smartTimeMin removed — 새벽 시간은 해당 일자의 시작으로 처리 */

export function mergeData(base, custom) {
  const merged = base.map((day, di) => {
    const dayCustom = custom[di];
    const overrides = custom._dayOverrides?.[di];
    let d = day;
    if (overrides) d = { ...d, ...overrides };
    if (!dayCustom) return d;
    const newSections = d.sections.map((sec, si) => {
      const secCustom = dayCustom.sections?.[si];
      if (!secCustom) return sec;
      return { ...sec, items: secCustom.items || sec.items };
    });
    // Merge extra items into existing sections by timestamp
    if (dayCustom.extraItems && dayCustom.extraItems.length > 0) {
      const extras = [...dayCustom.extraItems];
      extras.forEach((extraItem) => {
        const extraMin = timeToMin(extraItem.time);
        let bestSec = -1;
        let bestPos = -1;

        // Find the best section and position for this item
        for (let si = 0; si < newSections.length; si++) {
          const items = newSections[si].items;
          if (!items || items.length === 0) continue;

          const firstMin = timeToMin(items[0]?.time);
          const lastMin = timeToMin(items[items.length - 1]?.time);

          // If extra item time falls within this section's range (or close)
          if (extraMin >= firstMin && extraMin <= lastMin + 30) {
            // Find exact insertion position
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

          // If extra item time is before first section item
          if (si === 0 && extraMin < firstMin) {
            bestSec = 0;
            bestPos = 0;
            break;
          }
        }

        // If no good fit, find the closest section by checking gaps between sections
        if (bestSec === -1) {
          // Default: find the last section whose last item time is <= extraMin
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

        // Fallback: append to last section
        if (bestSec === -1) {
          bestSec = newSections.length - 1;
          bestPos = newSections[bestSec]?.items?.length || 0;
        }

        // Insert the item (mark as _extra for identification)
        const sec = newSections[bestSec];
        const newItems = [...(sec.items || [])];
        newItems.splice(bestPos, 0, { ...extraItem, _extra: true });
        newSections[bestSec] = { ...sec, items: newItems };
      });
    }
    return { ...d, sections: newSections };
  });
  // Append custom-added days
  if (custom._extraDays) {
    custom._extraDays.forEach((d) => merged.push(d));
  }
  // Apply day reorder if present
  if (custom._dayOrder && custom._dayOrder.length === merged.length) {
    return custom._dayOrder.map((origIdx) => merged[origIdx]);
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

  const allItems = day.sections.flatMap((sec) => sec.items || []);
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
  const costCategories = { food: 0, move: 0, other: 0 }; // food→식비, move→교통, spot/shop→기타

  allItems.forEach((item) => {
    let cost = 0;
    // Try detail.price first
    if (item.detail?.price) {
      cost = parseYen(item.detail.price);
    }
    // Also check sub for transport costs (e.g. "170엔", "310엔")
    if (item.sub) {
      const subCost = parseYen(item.sub);
      if (subCost > 0 && cost === 0) cost = subCost;
      // For move type, sub often has the cost
      if (item.type === "move" && subCost > 0) cost = subCost;
    }

    if (cost > 0) {
      if (item.type === "food") costCategories.food += cost;
      else if (item.type === "move") costCategories.move += cost;
      else costCategories.other += cost;
    }
  });

  const costParts = [];
  if (costCategories.move > 0) costParts.push(`교통 ~${costCategories.move.toLocaleString()}엔`);
  if (costCategories.food > 0) costParts.push(`식비 ~${costCategories.food.toLocaleString()}엔`);
  if (costCategories.other > 0) costParts.push(`입장/쇼핑 ~${costCategories.other.toLocaleString()}엔`);

  // 3) Build summary
  const parts = [];
  if (countParts.length > 0) parts.push(countParts.join(" · "));
  if (costParts.length > 0) parts.push(costParts.join(" · "));

  return parts.join(" | ");
}
