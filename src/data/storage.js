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

        // Fallback: append to first section with items, or first section
        if (bestSec === -1) {
          bestSec = newSections.findIndex((s) => s.items && s.items.length > 0);
          if (bestSec === -1) bestSec = 0;
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
