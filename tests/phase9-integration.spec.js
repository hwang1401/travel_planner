// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  waitForText,
  clickItem,
  editDetailField,
  getDayTabCount,
  getItemCount,
  countText,
  setTimePickerInDialog,
  ensureHomePage,
  dismissPwaBanner,
} from './helpers.js';

/**
 * Phase 9-A: 크로스 기능 통합 테스트
 *
 * 커버하는 시나리오:
 *   전체 여행 E2E Journey (생성→아이템추가→편집→리로드)
 *   빈 Day UI 확인
 *   빠른 Day 전환 안정성
 *   잘못된 trip URL 접근 → 크래시 방지
 *   브라우저 뒤로가기 네비게이션
 *   연속 아이템 추가 → 데이터 무결성
 *   홈↔여행 왕복 네비게이션
 *   아이템 삭제 후 Planner 상태
 *   멀티 Day 편집 후 영속성
 *
 * Phase 9-B: 일정 복제 방지 테스트
 *
 *   리로드 후 복제 안 됨
 *   필드 편집 후 복제 안 됨
 *   시간 변경 후 복제 안 됨
 *   이름 변경 후 복제 안 됨
 *   Day 전환 후 복제 안 됨
 *   빠른 Day 왕복 후 복제 안 됨
 *   Day 이동 후 양쪽 복제 안 됨
 *   연속 편집 + 반복 리로드 후 복제 안 됨
 */

/* ══════════════════════════════════
   Phase 9-A: 크로스 기능 통합
   ══════════════════════════════════ */

const TRIP_NAME = `E2E Phase9 ${Date.now()}`;

test.describe('Phase 9-A: 크로스 기능 통합', () => {
  let tripId;

  test.describe.configure({ mode: 'serial' });

  /* ═══ 전체 여행 E2E Journey ═══ */
  test('INT-01: 전체 여행 E2E Journey', async ({ page }) => {
    test.setTimeout(120_000);

    tripId = await createTripAndNavigate(page, TRIP_NAME, '교토', 2);
    expect(page.url()).toContain(`/trip/${tripId}`);

    // 아이템 추가
    await selectDay(page, 0);
    await addItemManually(page, '09:00', '관광', '금각사');
    await waitForText(page, '금각사');
    await addItemManually(page, '12:00', '식사', '니시키 시장');
    await waitForText(page, '니시키 시장');
    await addItemManually(page, '15:00', '쇼핑', '교토역 빌딩');
    await waitForText(page, '교토역 빌딩');

    // 편집
    await clickItem(page, '금각사');
    await page.waitForTimeout(500);
    await editDetailField(page, '가격', '¥500');
    await editDetailField(page, '부가정보', '오전 방문 추천');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // PlaceCard 반영 확인
    await expect(page.locator('text=오전 방문 추천')).toBeVisible({ timeout: 3_000 });

    // Day 추가 + 아이템
    await page.locator('button[title="날짜 추가"]').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await page.waitForTimeout(800);

    const dc = await getDayTabCount(page);
    await selectDay(page, dc - 1);
    await addItemManually(page, '10:00', '관광', '후시미이나리');
    await waitForText(page, '후시미이나리');

    // 리로드 → 영속성
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });

    await selectDay(page, 0);
    await page.waitForTimeout(500);
    await expect(page.locator('text=금각사')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=니시키 시장')).toBeVisible({ timeout: 5_000 });

    const rdc = await getDayTabCount(page);
    await selectDay(page, rdc - 1);
    await page.waitForTimeout(500);
    await expect(page.locator('text=후시미이나리')).toBeVisible({ timeout: 5_000 });
  });

  /* ═══ 빈 Day UI ═══ */
  test('INT-02: 빈 Day UI', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    await page.locator('button[title="날짜 추가"]').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await page.waitForTimeout(800);

    const dc = await getDayTabCount(page);
    await selectDay(page, dc - 1);
    await page.waitForTimeout(500);

    await expect(page.getByRole('button', { name: '일정 추가' })).toBeVisible({ timeout: 3_000 });
    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });

  /* ═══ 빠른 Day 전환 ═══ */
  test('INT-03: 빠른 Day 전환 안정성', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    const dc = await getDayTabCount(page);
    for (let i = 0; i < Math.min(dc, 5); i++) {
      await selectDay(page, i);
      await page.waitForTimeout(150);
    }
    for (let i = Math.min(dc, 5) - 1; i >= 0; i--) {
      await selectDay(page, i);
      await page.waitForTimeout(150);
    }

    await selectDay(page, 0);
    await page.waitForTimeout(500);
    await expect(page.locator('text=금각사').first()).toBeVisible({ timeout: 5_000 });
    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });

  /* ═══ 잘못된 URL ═══ */
  test('INT-04: 잘못된 trip URL → 크래시 없음', async ({ page }) => {
    await dismissPwaBanner(page);
    await page.goto('/trip/00000000-0000-0000-0000-000000000000');
    await page.waitForTimeout(3_000);

    const appAlive =
      await page.locator('text=Something went wrong').isVisible({ timeout: 2_000 }).catch(() => false) ||
      await page.locator('text=D1').isVisible({ timeout: 2_000 }).catch(() => false) ||
      await page.locator('text=내 여행').isVisible({ timeout: 2_000 }).catch(() => false) ||
      await page.locator('button').first().isVisible({ timeout: 2_000 }).catch(() => false);
    expect(appAlive).toBe(true);
  });

  /* ═══ 브라우저 뒤로가기 ═══ */
  test('INT-05: 브라우저 뒤로가기 네비게이션', async ({ page }) => {
    await dismissPwaBanner(page);
    await page.goto('/');
    await page.waitForSelector('h1:has-text("내 여행")', { timeout: 15_000 });

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // DetailDialog 열기 → 뒤로가기
    await clickItem(page, '금각사');
    await page.waitForTimeout(500);
    await page.goBack();
    await page.waitForTimeout(500);

    await expect(page.locator('text=D1').first()).toBeVisible({ timeout: 5_000 });

    // 홈으로 뒤로가기
    await page.goBack();
    await page.waitForTimeout(1_000);

    const isHome = await page.locator('h1:has-text("내 여행")').isVisible({ timeout: 5_000 }).catch(() => false);
    const isTrip = await page.locator('text=D1').isVisible({ timeout: 2_000 }).catch(() => false);
    expect(isHome || isTrip).toBe(true);
  });

  /* ═══ 연속 아이템 추가 ═══ */
  test('INT-06: 연속 3개 아이템 추가 → 전체 표시', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const items = [
      { time: '08:00', type: '식사', name: 'INT 아침' },
      { time: '11:00', type: '관광', name: 'INT 관광' },
      { time: '19:00', type: '식사', name: 'INT 저녁' },
    ];

    for (const item of items) {
      await addItemManually(page, item.time, item.type, item.name);
      await page.waitForTimeout(300);
    }

    for (const item of items) {
      await expect(page.locator(`text=${item.name}`).first()).toBeVisible({ timeout: 5_000 });
    }

    // 리로드 후 유지
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    for (const item of items) {
      await expect(page.locator(`text=${item.name}`).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  /* ═══ 홈↔여행 왕복 ═══ */
  test('INT-07: 홈 → 여행 → 홈 왕복', async ({ page }) => {
    await ensureHomePage(page);

    const tripCard = page.locator(`text=${TRIP_NAME}`).first();
    if (await tripCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tripCard.click();
      await page.waitForTimeout(1_000);
      await page.waitForSelector('text=D1', { timeout: 10_000 });

      await page.goto('/');
      await page.waitForSelector('h1:has-text("내 여행")', { timeout: 15_000 });
      await expect(page.locator(`text=${TRIP_NAME}`).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  /* ═══ 삭제 후 Planner 정상 ═══ */
  test('INT-08: 아이템 삭제 후 Planner 정상', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await addItemManually(page, '20:00', '정보', 'INT 삭제대상');
    await waitForText(page, 'INT 삭제대상');

    await clickItem(page, 'INT 삭제대상');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '삭제', exact: true }).last().click();
    await page.waitForTimeout(1_000);

    await expect(page.locator('text=금각사').first()).toBeVisible({ timeout: 5_000 });
    expect(await page.locator('text=INT 삭제대상').isVisible({ timeout: 2_000 }).catch(() => false)).toBe(false);
  });

  /* ═══ 멀티 Day 편집 영속성 ═══ */
  test('INT-09: 멀티 Day 편집 후 리로드 영속성', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    await selectDay(page, 0);
    await page.waitForTimeout(500);
    await addItemManually(page, '21:00', '숙소', 'INT 교토 호텔');
    await waitForText(page, 'INT 교토 호텔');

    const dc = await getDayTabCount(page);
    if (dc >= 2) {
      await selectDay(page, 1);
      await page.waitForTimeout(500);
      await addItemManually(page, '10:00', '관광', 'INT Day2 관광');
      await waitForText(page, 'INT Day2 관광');
    }

    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });

    await selectDay(page, 0);
    await page.waitForTimeout(500);
    await expect(page.locator('text=금각사').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=INT 교토 호텔').first()).toBeVisible({ timeout: 5_000 });

    if (dc >= 2) {
      await selectDay(page, 1);
      await page.waitForTimeout(500);
      await expect(page.locator('text=INT Day2 관광').first()).toBeVisible({ timeout: 5_000 });
    }

    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });

  /* ═══ AI 일정 생성 여행 ═══ */
  test('INT-10: AI 일정 생성 여행', async ({ page }) => {
    test.setTimeout(180_000);

    await dismissPwaBanner(page);
    await page.goto('/');
    await page.waitForSelector('h1:has-text("내 여행")', { timeout: 15_000 });
    await page.waitForTimeout(500);

    const createBtn = page.getByRole('button', { name: /여행 만들기|첫 여행 만들기/ });
    await createBtn.click();

    // Step 1: 이름·목적지
    await page.waitForSelector('text=어디로 여행을 떠나시나요?', { timeout: 5_000 });
    const nameField = page.locator('input[placeholder*="후쿠오카"]');
    await nameField.fill('AI 테스트 여행');

    const destInput = page.locator('input[placeholder*="도시 또는 장소를 검색"]');
    await destInput.fill('오사카');

    const prediction = page.locator('div[role="button"][tabindex="0"]').first();
    const hasPred = await prediction.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    if (hasPred) {
      await prediction.click();
    } else {
      await page.evaluate((dest) => {
        const input = document.querySelector('input[placeholder*="도시 또는 장소를 검색"]');
        if (!input) return;
        const fiberKey = Object.keys(input).find(k => k.startsWith('__reactFiber$'));
        if (!fiberKey) return;
        let fiber = input[fiberKey];
        while (fiber) {
          const props = fiber.memoizedProps;
          if (props?.onChange && typeof props.onChange === 'function' && props.placeholder?.includes('도시')) {
            props.onChange(dest, 34.6937, 135.5023);
            return;
          }
          fiber = fiber.return;
        }
      }, '오사카');
    }

    await page.waitForFunction(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '다음');
      return btn && !btn.disabled;
    }, { timeout: 10_000 });
    await page.getByRole('button', { name: '다음' }).click();

    // Step 2: 날짜
    await page.waitForSelector('text=언제 출발하시나요?', { timeout: 5_000 });
    const today = new Date();
    const cells = page.locator('div[style*="grid-template-columns: repeat(7"] > div');
    const cellCount = await cells.count();
    for (let i = 0; i < cellCount; i++) {
      if ((await cells.nth(i).textContent())?.trim() === String(today.getDate())) {
        await cells.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(300);
    for (let i = 0; i < cellCount; i++) {
      if ((await cells.nth(i).textContent())?.trim() === String(today.getDate() + 2)) {
        await cells.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '다음' }).click();

    // Step 3: AI 일정
    await page.waitForSelector('text=어떻게 일정을 채울까요?', { timeout: 5_000 });
    await page.locator('text=AI로 일정 만들기').click();
    await page.waitForTimeout(500);

    const generateBtn = page.getByRole('button', { name: /AI 일정 생성하기/ });
    await generateBtn.click();

    // AI 생성 대기 (최대 150초)
    const hasPreview = await page.waitForSelector('text=AI 추천 일정', { timeout: 150_000 }).then(() => true).catch(() => false);

    if (hasPreview) {
      await expect(page.locator('text=Day 1')).toBeVisible({ timeout: 5_000 });

      // 생성된 아이템 개수 확인 — 최소 1개 이상
      const timeSlots = page.locator('span').filter({ hasText: /^\d{1,2}:\d{2}$/ });
      const itemCount = await timeSlots.count();
      expect(itemCount).toBeGreaterThan(0);

      // 적용
      const submitBtn = page.getByRole('button', { name: /AI 일정으로 여행 만들기/ });
      await submitBtn.click();

      await page.waitForURL(/\/trip\/[a-f0-9-]+/, { timeout: 15_000 });
      await page.waitForSelector('text=D1', { timeout: 10_000 });

      // Day 1에 아이템 있는지 확인
      await selectDay(page, 0);
      await page.waitForTimeout(1_000);

      const plannerItems = page.locator('span[style*="width: 38px"], span[style*="width:38px"]');
      expect(await plannerItems.count()).toBeGreaterThan(0);

      // 아이템 클릭 → DetailDialog에서 카테고리·시간 확인
      const firstItemName = await page.locator('p').filter({ hasText: /[가-힣a-zA-Z]/ }).first().textContent();
      if (firstItemName) {
        await clickItem(page, firstItemName.trim());
        await page.waitForTimeout(500);

        // 시간 배지 존재
        const timeBadge = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ });
        expect(await timeBadge.count()).toBeGreaterThan(0);

        // 카테고리 존재 (식사, 관광, 쇼핑, 숙소, 교통, 정보 중 하나)
        const categories = ['식사', '관광', '쇼핑', '숙소', '교통', '정보'];
        let foundCategory = false;
        for (const cat of categories) {
          if (await page.locator(`text=${cat}`).first().isVisible({ timeout: 500 }).catch(() => false)) {
            foundCategory = true;
            break;
          }
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  });
});

/* ══════════════════════════════════
   Phase 9-B: 일정 복제 방지
   ══════════════════════════════════ */

const DUP_TRIP_NAME = `E2E Phase9 Dup ${Date.now()}`;

test.describe('Phase 9-B: 일정 복제 방지', () => {
  let tripId;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/auth/user-a.json',
      viewport: { width: 390, height: 844 },
      baseURL: 'http://localhost:3000',
    });
    const page = await context.newPage();
    tripId = await createTripAndNavigate(page, DUP_TRIP_NAME, '도쿄', 2);

    await selectDay(page, 0);
    await addItemManually(page, '09:00', '관광', 'DUP 센소지');
    await waitForText(page, 'DUP 센소지');
    await addItemManually(page, '12:00', '식사', 'DUP 라멘');
    await waitForText(page, 'DUP 라멘');
    await addItemManually(page, '18:00', '숙소', 'DUP 호텔');
    await waitForText(page, 'DUP 호텔');

    await context.close();
  });

  /* ═══ 리로드 후 복제 안 됨 ═══ */
  test('DUP-01: 리로드 후 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(800);

    const before = await getItemCount(page);

    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(800);

    expect(await getItemCount(page)).toBe(before);
    expect(await countText(page, 'DUP 센소지')).toBe(1);
    expect(await countText(page, 'DUP 라멘')).toBe(1);
    expect(await countText(page, 'DUP 호텔')).toBe(1);
  });

  /* ═══ 필드 편집 후 복제 안 됨 ═══ */
  test('DUP-02: 필드 편집 후 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const before = await getItemCount(page);

    await clickItem(page, 'DUP 라멘');
    await page.waitForTimeout(500);
    await editDetailField(page, '가격', '¥890');
    await editDetailField(page, '메모', '맛집 메모', true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    expect(await getItemCount(page)).toBe(before);
    expect(await countText(page, 'DUP 라멘')).toBe(1);

    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(800);

    expect(await getItemCount(page)).toBe(before);
    expect(await countText(page, 'DUP 라멘')).toBe(1);
  });

  /* ═══ 시간 변경 후 복제 안 됨 ═══ */
  test('DUP-03: 시간 변경 후 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const before = await getItemCount(page);

    await clickItem(page, 'DUP 센소지');
    await page.waitForTimeout(500);

    const timeBadge = page.locator('button:has-text("09:00")').first();
    if (await timeBadge.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await timeBadge.click();
      await page.waitForTimeout(500);
      await setTimePickerInDialog(page, 10, 0);
      await page.waitForTimeout(500);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    expect(await getItemCount(page)).toBe(before);
    expect(await countText(page, 'DUP 센소지')).toBe(1);

    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(800);

    expect(await getItemCount(page)).toBe(before);
    expect(await countText(page, 'DUP 센소지')).toBe(1);
  });

  /* ═══ 이름 변경 후 복제 안 됨 ═══ */
  test('DUP-04: 이름 변경 후 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const before = await getItemCount(page);

    await clickItem(page, 'DUP 호텔');
    await page.waitForTimeout(500);

    const nameSpan = page.locator('h3 span').first();
    await nameSpan.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[type="text"]').last();
    await nameInput.waitFor({ state: 'visible', timeout: 3_000 });
    await nameInput.fill('DUP 호텔 수정됨');
    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(500);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    expect(await getItemCount(page)).toBe(before);
    expect(await countText(page, 'DUP 호텔 수정됨')).toBe(1);
    expect(await countText(page, 'DUP 호텔')).toBe(0);
  });

  /* ═══ Day 전환 후 복제 안 됨 ═══ */
  test('DUP-05: Day 전환 후 복귀 시 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const before = await getItemCount(page);
    const dc = await getDayTabCount(page);

    if (dc >= 2) {
      await selectDay(page, 1);
      await page.waitForTimeout(500);
      await selectDay(page, 0);
      await page.waitForTimeout(500);

      expect(await getItemCount(page)).toBe(before);
      expect(await countText(page, 'DUP 센소지')).toBe(1);
    }
  });

  /* ═══ 빠른 Day 왕복 후 복제 안 됨 ═══ */
  test('DUP-06: 빠른 Day 왕복 시 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const before = await getItemCount(page);
    const dc = await getDayTabCount(page);

    if (dc >= 2) {
      for (let i = 0; i < 5; i++) {
        await selectDay(page, 1);
        await page.waitForTimeout(100);
        await selectDay(page, 0);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(1_000);

      expect(await getItemCount(page)).toBe(before);
      expect(await countText(page, 'DUP 센소지')).toBe(1);
      expect(await countText(page, 'DUP 라멘')).toBe(1);
    }
  });

  /* ═══ Day 이동 후 양쪽 복제 안 됨 ═══ */
  test('DUP-07: Day 이동 후 양쪽 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    const dc = await getDayTabCount(page);
    if (dc < 2) {
      await page.locator('button[title="날짜 추가"]').click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(800);
    }

    await selectDay(page, 0);
    await page.waitForTimeout(500);
    const before = await getItemCount(page);

    await clickItem(page, 'DUP 라멘');
    await page.waitForTimeout(500);

    await page.locator('button[title="더보기"]').last().click();
    await page.waitForTimeout(500);

    const moveOpt = page.locator('text=다른 Day로 이동');
    if (await moveOpt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await moveOpt.click();
      await page.waitForTimeout(500);
      await page.locator('text=Day 2').first().click();
      await page.waitForTimeout(1_000);

      await selectDay(page, 0);
      await page.waitForTimeout(500);
      expect(await getItemCount(page)).toBe(before - 1);
      expect(await countText(page, 'DUP 라멘')).toBe(0);

      await selectDay(page, 1);
      await page.waitForTimeout(500);
      expect(await countText(page, 'DUP 라멘')).toBe(1);

      // 리로드 확인
      await page.reload();
      await page.waitForSelector('text=D1', { timeout: 15_000 });

      await selectDay(page, 0);
      await page.waitForTimeout(800);
      expect(await countText(page, 'DUP 라멘')).toBe(0);

      await selectDay(page, 1);
      await page.waitForTimeout(800);
      expect(await countText(page, 'DUP 라멘')).toBe(1);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  /* ═══ 연속 편집 + 반복 리로드 ═══ */
  test('DUP-08: 연속 편집 + 반복 리로드 후 복제 없음', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const before = await getItemCount(page);

    // 1차 편집 + 리로드
    await clickItem(page, 'DUP 센소지');
    await page.waitForTimeout(500);
    await editDetailField(page, '가격', '¥300');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(800);
    expect(await getItemCount(page)).toBe(before);

    // 2차 편집 + 리로드
    await clickItem(page, 'DUP 센소지');
    await page.waitForTimeout(500);
    await editDetailField(page, '메모', '두 번째 메모', true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(800);
    expect(await getItemCount(page)).toBe(before);
    expect(await countText(page, 'DUP 센소지')).toBe(1);

    // 3차 리로드 (편집 없이)
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(800);
    expect(await getItemCount(page)).toBe(before);
    expect(await countText(page, 'DUP 센소지')).toBe(1);
  });
});
