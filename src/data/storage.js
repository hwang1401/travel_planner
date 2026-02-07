export function loadCustomData() {
  try {
    const saved = localStorage.getItem("travel_custom_data");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
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
    if (dayCustom.extraItems) {
      const extraSection = { title: "추가 일정", items: dayCustom.extraItems, _isExtra: true };
      newSections.push(extraSection);
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
