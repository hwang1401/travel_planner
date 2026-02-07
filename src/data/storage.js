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

/**
 * Smart time: treats 00:00~05:59 as late night (24:00~29:59)
 * when the day's schedule is mainly afternoon/evening.
 */
function smartTimeMin(t, dayLatestMin) {
  const raw = timeToMin(t);
  // If time is 00:00~05:59 and day has items past noon → treat as next-day late night
  if (raw < 360 && dayLatestMin >= 720) {
    return raw + 1440;
  }
  return raw;
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
      // Find the latest time across all sections to detect afternoon/evening days
      let dayLatestMin = 0;
      newSections.forEach((sec) => {
        (sec.items || []).forEach((it) => {
          const m = timeToMin(it.time);
          if (m > dayLatestMin) dayLatestMin = m;
        });
      });

      const extras = [...dayCustom.extraItems];
      extras.forEach((extraItem) => {
        const extraMin = smartTimeMin(extraItem.time, dayLatestMin);
        let bestSec = -1;
        let bestPos = -1;

        // Find the best section and position for this item
        for (let si = 0; si < newSections.length; si++) {
          const items = newSections[si].items;
          if (!items || items.length === 0) continue;

          const firstMin = smartTimeMin(items[0]?.time, dayLatestMin);
          const lastMin = smartTimeMin(items[items.length - 1]?.time, dayLatestMin);

          // If extra item time falls within this section's range (or close)
          if (extraMin >= firstMin && extraMin <= lastMin + 30) {
            // Find exact insertion position
            let pos = items.length;
            for (let ii = 0; ii < items.length; ii++) {
              if (smartTimeMin(items[ii].time, dayLatestMin) > extraMin) {
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
            const lastMin = smartTimeMin(items[items.length - 1]?.time, dayLatestMin);
            if (lastMin <= extraMin) {
              bestSec = si;
              bestPos = items.length;
              break;
            }
          }
        }

        // Fallback: append to last section (late night goes at the end)
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
