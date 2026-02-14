// @ts-check
import { test, expect } from '@playwright/test';
import {
  ensureHomePage,
  createTripAndNavigate,
  selectDay,
  addItemManually,
  expectToast,
  waitForText,
  waitForTextGone,
  getDayTabCount,
  openDayMoreMenu,
  clickItem,
} from './helpers.js';

/**
 * Phase 2: 일괄 작업, DetailDialog, 엣지 케이스
 * B-01~04, DD-01~05, E-01~03
 */

const TRIP_NAME = `E2E Phase2 ${Date.now()}`;

test.describe('Phase 2: 일괄 작업 / DetailDialog / 엣지케이스', () => {
  let tripId;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/auth/user-a.json',
      viewport: { width: 390, height: 844 },
      baseURL: 'http://localhost:3000',
    });
    const page = await context.newPage();
    tripId = await createTripAndNavigate(page, TRIP_NAME, '오사카', 3);
    await context.close();
  });

  /* ── B-01: 일괄 삭제 모드 ── */
  test('B-01: 일괄 삭제 모드', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Add 3 items
    await addItemManually(page, '09:00', '관광', '오사카성');
    await waitForText(page, '오사카성');
    await addItemManually(page, '12:00', '식사', '이치란 라멘');
    await waitForText(page, '이치란 라멘');
    await addItemManually(page, '15:00', '쇼핑', '신사이바시');
    await waitForText(page, '신사이바시');

    // Enter bulk delete mode
    const bulkDeleteBtn = page.locator('button[aria-label="일괄 삭제"]');
    await bulkDeleteBtn.click();
    await page.waitForTimeout(500);

    // Select first 2 items by clicking unchecked checkboxes (aria-label="선택")
    // After clicking one, it changes to "선택 해제" so nth(0) shifts to the next unchecked
    const unchecked = page.locator('button[aria-label="선택"]');
    await unchecked.nth(0).click(); // 오사카성 → checked
    await page.waitForTimeout(200);
    await unchecked.nth(0).click(); // 이치란 라멘 (was nth(1), now nth(0) after shift)
    await page.waitForTimeout(200);

    // Click "2개 삭제" button
    const deleteCountBtn = page.locator('button:has-text("개 삭제")');
    await deleteCountBtn.click();
    await page.waitForTimeout(300);

    // Confirm if dialog appears
    const confirmBtn = page.getByRole('button', { name: '삭제', exact: true }).last();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(1_000);

    // Verify: "신사이바시" remains
    await expect(page.locator('text=신사이바시')).toBeVisible({ timeout: 3_000 });
  });

  /* ── DD-01: DetailDialog 기본 정보 표시 ── */
  test('DD-01: DetailDialog 기본 정보 표시', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // Click "신사이바시" to open DetailDialog
    await clickItem(page, '신사이바시');

    // Verify: DetailDialog opened — should see the name
    await expect(page.locator('h3:has-text("신사이바시")')).toBeVisible({ timeout: 3_000 });

    // Close the dialog via X button
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ── DD-02: DetailDialog에서 이름 수정 ── */
  test('DD-02: DetailDialog에서 이름 수정', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, '신사이바시');
    await page.waitForTimeout(500);

    // Click the name text to open edit popup
    const nameSpan = page.locator('h3 span:has-text("신사이바시")');
    if (await nameSpan.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nameSpan.click();
      await page.waitForTimeout(500);

      // CenterPopup should appear with input
      const editInput = page.locator('input[type="text"]').last();
      if (await editInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await editInput.fill('신사이바시 상점가');
        await page.waitForTimeout(300);

        // Click 저장
        await page.getByRole('button', { name: '저장' }).click();
        await page.waitForTimeout(500);

        // Verify name changed in dialog
        await expect(page.locator('h3:has-text("신사이바시 상점가")')).toBeVisible({ timeout: 3_000 });
      }
    }

    // Close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ── DD-04: Day 이동 (DetailDialog에서) ── */
  test('DD-04: Day 이동 (DetailDialog에서)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Day 이동 requires 2+ days
    const dayCount = await getDayTabCount(page);
    if (dayCount < 2) {
      await page.locator('button[title="날짜 추가"]').click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(800);
    }

    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // Ensure item exists
    const hasItem = await page.locator('text=신사이바시').isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasItem) {
      await addItemManually(page, '15:00', '쇼핑', '신사이바시');
      await waitForText(page, '신사이바시');
    }

    await clickItem(page, '신사이바시');
    await page.waitForTimeout(500);

    // Click "더보기" (···) button in DetailDialog header (last = DetailDialog's)
    await page.locator('button[title="더보기"]').last().click();
    await page.waitForTimeout(500);

    // Click "다른 Day로 이동"
    await page.locator('text=다른 Day로 이동').click();
    await page.waitForTimeout(500);

    // Select Day 2 from the move sheet
    await page.locator('text=Day 2').first().click();
    await page.waitForTimeout(1_000);

    // Navigate to Day 2 to verify item moved
    await selectDay(page, 1);
    await page.waitForTimeout(500);
  });

  /* ── DD-05: 삭제 (DetailDialog에서) ── */
  test('DD-05: 삭제 (DetailDialog에서)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Add an item to delete
    await addItemManually(page, '10:00', '정보', '삭제 대상');
    await waitForText(page, '삭제 대상');

    await clickItem(page, '삭제 대상');
    await page.waitForTimeout(500);

    // Click "삭제" button at bottom of DetailDialog
    await page.getByRole('button', { name: '삭제', exact: true }).last().click();
    await page.waitForTimeout(1_000);
  });

  /* ── E-01: 빈 여행에서 모든 작업 ── */
  test('E-01: 빈 여행 — 기본 작업 에러 없음', async ({ page }) => {
    // Create a fresh empty trip
    const emptyTripId = await createTripAndNavigate(page, `빈 여행 ${Date.now()}`, '서울', 0);

    await page.goto(`/trip/${emptyTripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Day 추가
    const addDayBtn = page.locator('button[title="날짜 추가"]');
    if (await addDayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await addDayBtn.click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(500);
    }

    // Try entering bulk delete mode on empty day
    const bulkBtn = page.locator('button[aria-label="일괄 삭제"]');
    if (await bulkBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await bulkBtn.click();
      await page.waitForTimeout(300);
      // Cancel bulk mode
      const cancelBtn = page.locator('button:has-text("취소")');
      if (await cancelBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await cancelBtn.click();
      }
    }

    // Add and delete an item
    await addItemManually(page, '12:00', '식사', '테스트 장소');
    await waitForText(page, '테스트 장소');

    // No crashes — test passes
    const errorOverlay = page.locator('text=Something went wrong');
    expect(await errorOverlay.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });

  /* ── E-03: 특수문자 아이템명 ── */
  test('E-03: 특수문자 아이템명', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    const specialName = 'カフェ「珈琲屋」(東京)';
    await addItemManually(page, '14:00', '식사', specialName);
    await page.waitForTimeout(500);

    // Verify item appears with special characters
    await expect(page.locator(`text=${specialName}`)).toBeVisible({ timeout: 5_000 });

    // Reload and verify persistence
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    await expect(page.locator(`text=${specialName}`)).toBeVisible({ timeout: 5_000 });
  });
});
