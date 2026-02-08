/**
 * Schedule File Parser
 *
 * Supported formats:
 *
 * Lines with time (HH:MM) → schedule items (shown on timetable)
 * Lines without time following a timed item → detail info of that item
 *
 * Example:
 *   10:30 food 아카규동 | 아카우시 덮밥 1,780엔
 *   레어 구이 아카우시 + 온천 달걀 + 특제 소스
 *   아소시 우치노마키 290
 *   영업시간: 11:00~15:00 / 수요일 휴무
 *   ⚠ 화산활동에 따라 화구 접근 제한 가능
 *
 * Result: 1 schedule item with desc="아카규동", sub="아카우시 덮밥 1,780엔"
 *         detail.tip = combined detail lines
 *         detail.address detected from address-like lines
 *         detail.timetable detected from 영업시간 lines
 *
 * Format: HH:MM [type] description [| sub]
 * Types: food, spot, shop, move, stay, info (default: info)
 *
 * Lines starting with # are section headers (ignored as items).
 * Empty lines and --- separators are ignored.
 * Markdown tables (| ... |) are ignored.
 */

const VALID_TYPES = new Set(["food", "spot", "shop", "move", "flight", "stay", "info"]);

const TYPE_LABELS = {
  food: "식사", spot: "관광", shop: "쇼핑",
  move: "이동", flight: "항공", stay: "숙소", info: "정보",
};

export { TYPE_LABELS };

/* ── Detect if a line is a time-prefixed schedule item ── */
const TIME_RE = /^(\d{1,2}:\d{2})\s+(.+)$/;

/* ── Detect special detail types ── */
function classifyDetailLine(line) {
  const trimmed = line.trim();

  // Address patterns: contains numbers + location suffixes
  if (/^\d+[-\d]*$/.test(trimmed)) return "address"; // pure number address
  if (/[시군구동읍면리로길번지]\s*\d/.test(trimmed)) return "address";
  if (/마키|마치|쵸메|초메|丁目|番/.test(trimmed) && /\d/.test(trimmed)) return "address";

  // Business hours
  if (/영업시간|운영시간|오픈|open/i.test(trimmed)) return "timetable";
  if (/^\d{1,2}:\d{2}\s*[~～\-]\s*\d{1,2}:\d{2}/.test(trimmed)) return "timetable";

  // Warning / caution
  if (/^[⚠️⚠]/.test(trimmed)) return "tip";

  // General detail/tip
  return "tip";
}

/**
 * Parse a timed line into the core schedule item fields.
 */
function parseTimedLine(line) {
  const trimmed = line.trim();
  const timeMatch = trimmed.match(TIME_RE);
  if (!timeMatch) return null;

  const time = timeMatch[1].padStart(5, "0");
  let rest = timeMatch[2];

  // Check if first word is a valid type
  let type = "info";
  const firstWord = rest.split(/\s+/)[0]?.toLowerCase();
  if (VALID_TYPES.has(firstWord)) {
    type = firstWord;
    rest = rest.slice(firstWord.length).trim();
  }

  // Split by | for desc | sub
  const parts = rest.split("|").map((s) => s.trim());
  const desc = parts[0] || "";
  const sub = parts[1] || "";

  return { time, type, desc, sub };
}

/**
 * Check if a line should be skipped entirely.
 */
function shouldSkip(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed === "---") return true;
  if (trimmed.startsWith("#")) return true;           // markdown headers
  if (trimmed.startsWith(">")) return true;            // blockquotes
  if (trimmed.startsWith("```")) return true;          // code fences
  if (/^\|.*\|.*\|/.test(trimmed)) return true;        // markdown tables
  if (/^\[[ x]\]/.test(trimmed)) return true;           // checklists
  if (/^\*\*[^*]+\*\*$/.test(trimmed)) return true;    // bold-only lines (section titles)
  return false;
}

/**
 * Clean a line: strip markdown prefixes.
 */
function cleanLine(line) {
  return line
    .replace(/^\s*[-*•]\s*/, "")   // list markers
    .replace(/\*\*/g, "")          // bold markers
    .replace(/^\s*💡\s*팁:\s*/i, "")  // tip prefix
    .trim();
}

/**
 * Parse file content into an array of schedule items with hierarchical detail.
 * Lines with HH:MM → schedule items
 * Lines without time → detail of previous item
 *
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
  let currentItem = null;

  lines.forEach((rawLine, idx) => {
    if (shouldSkip(rawLine)) return;

    const cleaned = cleanLine(rawLine);
    if (!cleaned) return;

    // Try to parse as a timed schedule item
    const timed = parseTimedLine(cleaned);

    if (timed) {
      // Finalize previous item
      if (currentItem) {
        items.push(finalizeItem(currentItem));
      }
      // Start new item
      currentItem = {
        ...timed,
        detailLines: [],
        _extra: true,
        _custom: true,
      };
    } else if (currentItem) {
      // No time → detail of current item
      currentItem.detailLines.push(cleaned);
    } else {
      // No current item and no time → standalone line, create as info
      // Only if it looks meaningful (not just formatting)
      if (cleaned.length > 2) {
        currentItem = {
          time: "",
          type: "info",
          desc: cleaned,
          sub: "",
          detailLines: [],
          _extra: true,
          _custom: true,
        };
      }
    }
  });

  // Finalize last item
  if (currentItem) {
    items.push(finalizeItem(currentItem));
  }

  return { items, errors };
}

/**
 * Convert a raw parsed item (with detailLines) into the final item format.
 */
function finalizeItem(raw) {
  const item = {
    time: raw.time,
    type: raw.type,
    desc: raw.desc,
    sub: raw.sub,
    _extra: true,
    _custom: true,
  };

  if (raw.detailLines.length > 0) {
    const detail = {};
    const tips = [];

    raw.detailLines.forEach((line) => {
      const type = classifyDetailLine(line);
      if (type === "address" && !detail.address) {
        detail.address = line;
      } else if (type === "timetable" && !detail.timetable) {
        detail.timetable = line;
      } else {
        tips.push(line);
      }
    });

    if (tips.length > 0) {
      detail.tip = tips.join("\n");
    }

    if (Object.keys(detail).length > 0) {
      item.detail = detail;
    }
  }

  return item;
}

/**
 * Detect conflicts: duplicate times within items and against existing day items.
 * @param {Array} newItems - parsed items from file
 * @param {object} currentDay - current day data (with sections)
 * @returns {{ internal: Array, external: Array }}
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
      (sec.items || []).filter(Boolean).forEach((item) => {
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
