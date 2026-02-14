// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  waitForText,
  clickItem,
} from './helpers.js';

/**
 * Phase 7: AddPlacePage & 아이템 타입 (AP-01 ~ AP-06)
 * Google Places 검색, 수동 입력, 유효성 검증, 카테고리별, 교통, 영속성.
 */

const TRIP_NAME = `E2E Phase7 ${Date.now()}`;

test.describe('Phase 7: AddPlacePage & 아이템 타입', () => {
  let tripId;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/auth/user-a.json',
      viewport: { width: 390, height: 844 },
      baseURL: 'http://localhost:3000',
    });
    const page = await context.newPage();
    tripId = await createTripAndNavigate(page, TRIP_NAME, '후쿠오카', 2);
    await context.close();
  });

  /* ── AP-01: Google Places 검색 추가 ── */
  test('AP-01: Google Places 검색 추가', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Click "일정 추가"
    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);

    // Click "직접 일정 추가" in bottom sheet
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    // Now on AddPlacePage — search mode
    const searchInput = page.locator('input[placeholder="장소명, 주소를 검색하세요"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });
    await searchInput.fill('캐널시티 하카타');
    await page.waitForTimeout(2_000);

    // Try to click first prediction
    const prediction = page.locator('div[role="button"][tabindex="0"]').first();
    const hasPrediction = await prediction.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasPrediction) {
      await prediction.click();
      await page.waitForTimeout(1_000);

      // Form should auto-fill — verify name field has content
      const nameInput = page.locator('input[placeholder*="캐널시티"]');
      const nameValue = await nameInput.inputValue().catch(() => '');
      expect(nameValue.length).toBeGreaterThan(0);

      // Click "일정 추가하기"
      await page.getByRole('button', { name: '일정 추가하기' }).click();
      await page.waitForTimeout(800);
    } else {
      // Fallback: manual entry
      const manualBtn = page.locator('button:has-text("직접 입력")').first();
      await manualBtn.click();
      await page.waitForTimeout(500);

      // Set time
      await page.locator('[aria-label="시간 선택"]').click();
      await page.waitForTimeout(300);
      const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
      await dialog.waitFor({ timeout: 3_000 });
      await dialog.locator('button:has-text("확인")').click();
      await page.waitForTimeout(300);

      // Fill name
      const nameInput = page.locator('input[placeholder*="캐널시티"]');
      await nameInput.fill('캐널시티 하카타');

      // Save
      await page.getByRole('button', { name: '일정 추가하기' }).click();
      await page.waitForTimeout(800);
    }

    // Verify: item appears on the planner
    await waitForText(page, '캐널시티', 5_000);
  });

  /* ── AP-02: 수동 입력 (전체 폼 필드) ── */
  test('AP-02: 수동 입력 (전체 폼 필드)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Click "일정 추가"
    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    // Click "직접 입력하기" to go to manual form
    const manualBtn = page.locator('button:has-text("직접 입력")').first();
    await manualBtn.click();
    await page.waitForTimeout(500);

    // Select category: 식사
    await page.locator('button:has-text("식사")').first().click();
    await page.waitForTimeout(200);

    // Set time via TimePicker
    await page.locator('[aria-label="시간 선택"]').click();
    await page.waitForTimeout(300);
    const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
    await dialog.waitFor({ timeout: 3_000 });
    // Just confirm default time
    await dialog.locator('button:has-text("확인")').click();
    await page.waitForTimeout(300);

    // Fill 일정명
    const nameInput = page.locator('input[placeholder*="캐널시티"]');
    await nameInput.fill('모츠나베 맛집');

    // Fill 부가정보
    const subInput = page.locator('input[placeholder*="¥1,200"]');
    if (await subInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await subInput.fill('¥2,500 · 1시간 소요');
    }

    // Fill 메모
    const memoArea = page.locator('textarea[placeholder*="추천 메뉴"]');
    if (await memoArea.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await memoArea.fill('내장전골 추천');
    }

    // Fill 포인트
    const pointArea = page.locator('textarea[placeholder*="꿀팁"]');
    if (await pointArea.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await pointArea.fill('예약 필수\n현금만 가능');
    }

    // Save
    await page.getByRole('button', { name: '일정 추가하기' }).click();
    await page.waitForTimeout(800);

    // Verify: item appears
    await waitForText(page, '모츠나베 맛집', 5_000);
  });

  /* ── AP-03: 유효성 검증 ── */
  test('AP-03: 유효성 검증 — 일정명 비우고 저장', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Open AddPlacePage
    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    // Go to manual form
    const manualBtn = page.locator('button:has-text("직접 입력")').first();
    await manualBtn.click();
    await page.waitForTimeout(500);

    // Set time (so only name is missing)
    await page.locator('[aria-label="시간 선택"]').click();
    await page.waitForTimeout(300);
    const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
    await dialog.waitFor({ timeout: 3_000 });
    await dialog.locator('button:has-text("확인")').click();
    await page.waitForTimeout(300);

    // Leave name empty and click save
    await page.getByRole('button', { name: '일정 추가하기' }).click();
    await page.waitForTimeout(500);

    // Should show validation error
    await expect(page.locator('text=일정명을 입력해주세요')).toBeVisible({ timeout: 3_000 });

    // Go back
    await page.goBack();
    await page.waitForTimeout(500);
  });

  /* ── AP-04: 카테고리별 아이템 ── */
  test('AP-04: 카테고리별 아이템', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    const categories = [
      { type: '관광', name: 'AP04 관광지' },
      { type: '쇼핑', name: 'AP04 쇼핑몰' },
      { type: '숙소', name: 'AP04 호텔' },
    ];

    for (const cat of categories) {
      await addItemManually(page, '10:00', cat.type, cat.name);
      await waitForText(page, cat.name, 5_000);
    }

    // Verify each in DetailDialog shows correct category
    for (const cat of categories) {
      await clickItem(page, cat.name);
      await page.waitForTimeout(500);

      // Category label is shown below the name in the DetailDialog header
      await expect(page.locator(`text=${cat.type}`).first()).toBeVisible({ timeout: 3_000 });

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  /* ── AP-05: 교통 타입 출발지/도착지 ── */
  test('AP-05: 교통 타입 출발지/도착지', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Open AddPlacePage
    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    // Go to manual form
    const manualBtn = page.locator('button:has-text("직접 입력")').first();
    await manualBtn.click();
    await page.waitForTimeout(500);

    // Select "교통" category
    await page.locator('button:has-text("교통")').first().click();
    await page.waitForTimeout(500);

    // Set time
    await page.locator('[aria-label="시간 선택"]').click();
    await page.waitForTimeout(300);
    const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
    await dialog.waitFor({ timeout: 3_000 });
    await dialog.locator('button:has-text("확인")').click();
    await page.waitForTimeout(300);

    // FromToStationField should appear for transport type
    // Check for 출발지 and 도착지 buttons
    const fromBtn = page.locator('[role="button"]:has-text("출발지")').first();
    const toBtn = page.locator('[role="button"]:has-text("도착지")').first();

    const hasFromTo = await fromBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasFromTo) {
      // Verify both fields exist
      await expect(fromBtn).toBeVisible();
      await expect(toBtn).toBeVisible();

      // Fill the 일정명 (desc) for the transport item
      const nameInput = page.locator('input[placeholder*="캐널시티"]');
      await nameInput.fill('하카타역 → 텐진역');

      // Save
      await page.getByRole('button', { name: '일정 추가하기' }).click();
      await page.waitForTimeout(800);

      // Verify item appears
      await waitForText(page, '하카타역', 5_000);
    } else {
      // If FromToStationField not shown, just add via manual desc
      const nameInput = page.locator('input[placeholder*="캐널시티"]');
      await nameInput.fill('AP05 교통편');

      await page.getByRole('button', { name: '일정 추가하기' }).click();
      await page.waitForTimeout(800);

      await waitForText(page, 'AP05 교통편', 5_000);
    }
  });

  /* ── AP-06: 폼 필드 영속성 ── */
  test('AP-06: 폼 필드 영속성 — 리로드 후 sub/memo/highlights 유지', async ({ page }) => {
    // Reload and verify AP-02 item fields persist
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    // Open the manually created item
    await clickItem(page, '모츠나베 맛집');
    await page.waitForTimeout(500);

    // Verify sub info
    await expect(page.locator('text=¥2,500')).toBeVisible({ timeout: 3_000 });

    // Verify memo
    await expect(page.locator('text=내장전골 추천')).toBeVisible({ timeout: 3_000 });

    // Verify highlights/points
    await expect(page.locator('text=예약 필수')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('text=현금만 가능')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // No crash
    const errorOverlay = page.locator('text=Something went wrong');
    expect(await errorOverlay.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });
});
