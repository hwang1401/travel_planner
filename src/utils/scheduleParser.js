/**
 * Schedule File Parser
 *
 * Supported formats:
 *
 * Basic (per line):
 *   09:00 food 하카타 라멘 | 이치란 본점
 *   10:30 spot 캐널시티 | 쇼핑몰 구경
 *   14:00 move 지하철 | 하카타역→텐진역 | 170엔
 *
 * Format: HH:MM [type] description [| sub] [| detail...]
 * Types: food, spot, shop, move, stay, info (default: info)
 *
 * Lines starting with # are ignored (comments).
 * Empty lines are ignored.
 * If type is omitted, defaults to "info".
 */

const VALID_TYPES = new Set(["food", "spot", "shop", "move", "stay", "info"]);

const TYPE_LABELS = {
  food: "식사", spot: "관광", shop: "쇼핑",
  move: "이동", stay: "숙소", info: "정보",
};

export { TYPE_LABELS };

/**
 * Parse a single line into a schedule item.
 * Returns null if the line is empty or a comment.
 */
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  // Match time at start: HH:MM or H:MM
  const timeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
  if (!timeMatch) {
    // No time — treat entire line as description with no time
    const parts = trimmed.split("|").map((s) => s.trim());
    return {
      time: "",
      type: "info",
      desc: parts[0] || trimmed,
      sub: parts[1] || "",
      _extra: true,
      _custom: true,
    };
  }

  const time = timeMatch[1].padStart(5, "0"); // "9:00" → "09:00"
  let rest = timeMatch[2];

  // Check if first word is a valid type
  let type = "info";
  const firstWord = rest.split(/\s+/)[0]?.toLowerCase();
  if (VALID_TYPES.has(firstWord)) {
    type = firstWord;
    rest = rest.slice(firstWord.length).trim();
  }

  // Split by | for desc | sub | extra details
  const parts = rest.split("|").map((s) => s.trim());
  const desc = parts[0] || "";
  const sub = parts[1] || "";

  // Build detail object from remaining parts
  const detail = {};
  if (parts[2]) detail.tip = parts[2];

  const item = {
    time,
    type,
    desc,
    sub,
    _extra: true,
    _custom: true,
  };

  if (Object.keys(detail).length > 0) {
    item.detail = detail;
  }

  return item;
}

/**
 * Parse file content into an array of schedule items.
 * @param {string} content - file content (text or markdown)
 * @returns {{ items: Array, errors: string[] }}
 */
export function parseScheduleFile(content) {
  if (!content || typeof content !== "string") {
    return { items: [], errors: ["파일 내용이 비어있습니다"] };
  }

  const lines = content.split(/\r?\n/);
  const items = [];
  const errors = [];

  lines.forEach((line, idx) => {
    // Strip markdown list prefix (-, *, •)
    const cleaned = line.replace(/^\s*[-*•]\s*/, "");
    const item = parseLine(cleaned);
    if (item) {
      if (!item.desc) {
        errors.push(`${idx + 1}번째 줄: 설명이 비어있습니다`);
      } else {
        items.push(item);
      }
    }
  });

  return { items, errors };
}

/**
 * Detect conflicts: duplicate times within items and against existing day items.
 * @param {Array} newItems - parsed items from file
 * @param {object} currentDay - current day data (with sections)
 * @returns {{ internal: Array, external: Array }}
 *   internal: [{time, items: [desc1, desc2]}] - duplicates within the file
 *   external: [{time, newDesc, existingDesc}] - conflicts with existing schedule
 */
export function detectConflicts(newItems, currentDay) {
  const internal = [];
  const external = [];

  // 1) Internal: duplicate times within the file
  const timeMap = {};
  newItems.forEach((item) => {
    if (!item.time) return;
    if (!timeMap[item.time]) timeMap[item.time] = [];
    timeMap[item.time].push(item.desc);
  });
  Object.entries(timeMap).forEach(([time, descs]) => {
    if (descs.length > 1) {
      internal.push({ time, items: descs });
    }
  });

  // 2) External: conflicts with existing day items
  if (currentDay?.sections) {
    const existingTimes = {};
    currentDay.sections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        if (item.time) {
          if (!existingTimes[item.time]) existingTimes[item.time] = [];
          existingTimes[item.time].push(item.desc);
        }
      });
    });

    newItems.forEach((item) => {
      if (!item.time) return;
      if (existingTimes[item.time]) {
        external.push({
          time: item.time,
          newDesc: item.desc,
          existingDescs: existingTimes[item.time],
        });
      }
    });
  }

  return { internal, external };
}

/**
 * Read a File object and return its text content.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다"));
    reader.readAsText(file, "UTF-8");
  });
}
