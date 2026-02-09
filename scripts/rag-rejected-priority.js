/**
 * 리젝트된 RAG 후보 중 "핵심/유명" 장소로 보이는 항목만 추려서 목록 출력.
 * 이 목록을 기준으로 우선 재검증(매칭 완화)할 수 있음.
 *
 * Usage: node scripts/rag-rejected-priority.js [--json]
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const outputDir = join(process.cwd(), 'scripts', 'output');
if (!existsSync(outputDir)) {
  console.log('scripts/output not found');
  process.exit(0);
}

// 유명 브랜드/랜드마크 키워드 (한글·일본어·영문) — 하나라도 포함되면 "우선 후보"
const PRIORITY_KEYWORDS = [
  '이치란', '一蘭', 'ichiran',
  '캐널시티', 'キャナルシティ', 'canal city',
  '파르코', 'パルコ', 'parco',
  '파블로', 'パブロ', 'pablo',
  '그램', 'グラム', 'gram',
  '리쿠로', 'りくろー', 'rikuro',
  '도톤보리', '道頓堀', 'dotonbori',
  '왕장', '王将', '오쇼',
  '나카스', '中洲', 'nakasu',
  '잇소우', '一双', 'isso',
  '신신', 'ShinShin', 'shinshin',
  '돈키호테', 'ドンキホーテ', 'don quijote',
  '고토켄', '五島軒', 'gotoken',
  '스나플스', 'スナッフルス', 'snaffles',
  '메이지칸', '明治館', 'meijikan',
  '이쓰쿠시마', '厳島', 'itsukushima', '미야지마',
  '겐로쿠엔', '兼六園', 'kenrokuen',
  '가네모리', '金森', 'kanemori',
  '하코다테', '函館', 'hakodate',
  'JR博多', 'JR 하카타', 'jr hakata',
  '키테', 'KITTE', 'kitte',
  '무지', '無印', 'muji',
  '로프트', 'ロフト', 'loft',
  'ヨドバシ', '요도바시', 'yodobashi',
  '큐슈', '九州', 'kyushu',
  '삿포로ビール', '삿포로 맥주', 'sapporo beer',
  '시로야마', '城山', 'shiroyama',
  '그랜드 하이어트', 'Grand Hyatt', 'hyatt',
  'B-speak', '비스피크', '비스피크',
  'SNOOPY', '스누피', '스누픽',
  '지브리', 'ジブリ', 'ghibli', 'どんぐり',
  '라멘', 'らーめん', '라면',
  '후쿠짱', 'ふくちゃん',
  '稚加榮', '치카에',
  '오오야마', 'おおやま', '모츠나베',
];

function hasPriorityKeyword(nameKo, nameJa) {
  const combined = `${(nameKo || '')} ${(nameJa || '')}`.toLowerCase();
  return PRIORITY_KEYWORDS.some((kw) =>
    combined.includes(kw.toLowerCase()) || (nameJa && nameJa.includes(kw))
  );
}

const files = readdirSync(outputDir)
  .filter((f) => f.startsWith('rag-rejected-') && f.endsWith('.json'));

const allPriority = [];
const byRegion = {};

for (const file of files) {
  const raw = readFileSync(join(outputDir, file), 'utf8');
  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    continue;
  }
  const match = file.match(/rag-rejected-(\w+)-(\w+)\.json/);
  if (!match) continue;
  const [, region, type] = match;
  const nameMismatch = list.filter((x) => x.reject_reason === 'name_mismatch');
  const priority = nameMismatch.filter((x) => hasPriorityKeyword(x.name_ko, x.name_ja));
  if (priority.length === 0) continue;
  const key = `${region}/${type}`;
  byRegion[key] = (byRegion[key] || 0) + priority.length;
  for (const p of priority) {
    allPriority.push({ region, type, ...p });
  }
}

const jsonOut = process.argv.includes('--json');
if (jsonOut) {
  console.log(JSON.stringify(allPriority, null, 2));
  process.exit(0);
}

console.log('=== 리젝트된 항목 중 "핵심/유명" 키워드 포함 (우선 재검증 후보) ===\n');
console.log(`총 ${allPriority.length}건 (전체 name_mismatch 중 일부)\n`);

const sorted = Object.entries(byRegion).sort((a, b) => b[1] - a[1]);
console.log('region/type별 건수:');
sorted.forEach(([k, n]) => console.log(`  ${k}: ${n}건`));

console.log('\n--- 샘플 (최대 50건) ---');
allPriority.slice(0, 50).forEach((p, i) => {
  console.log(`${i + 1}. [${p.region}/${p.type}] ${p.name_ko} (${p.name_ja || '-'})`);
});

if (allPriority.length > 50) {
  console.log(`\n... 외 ${allPriority.length - 50}건. 전체 목록은 --json 으로 출력.`);
}
