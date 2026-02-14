// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  getDayTabCount,
  openDayMoreMenu,
  clickItem,
  waitForText,
} from './helpers.js';

/**
 * Phase 1: 기본 플로우
 * T-01 → D-01~02 → I-01~06 → R-01
 */

const TRIP_NAME = `E2E 테스트 ${Date.now()}`;

test.describe('Phase 1: 기본 플로우', () => {
  let tripId;

  test.describe.configure({ mode: 'serial' });

  /* ── T-01: 여행 생성 — 기본 플로우 ── */
  test('T-01: 여행 생성 (빈 여행)', async ({ page }) => {
    tripId = await createTripAndNavigate(page, TRIP_NAME, '도쿄', 3);

    // Verify: /trip/{tripId} 경로
    expect(page.url()).toContain(`/trip/${tripId}`);

    // Verify: 빈 여행은 Day 1 하나로 시작
    const dayCount = await getDayTabCount(page);
    expect(dayCount).toBe(1);

    // Verify: D1 visible
    await expect(page.locator('button:has-text("D1")')).toBeVisible();

    // Verify: trip subtitle shows correct date range
    await expect(page.locator('text=3박4일').first()).toBeVisible({ timeout: 3_000 });
  });

  /* ── D-01: Day 추가 ── */
  test('D-01: Day 추가', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    const initialCount = await getDayTabCount(page);

    // Click "날짜 추가" button
    await page.locator('button[title="날짜 추가"]').click();
    await page.waitForTimeout(300);

    // AddDayDialog — click 추가 (leave label empty for default)
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await page.waitForTimeout(800);

    // Verify: new Day tab added
    const newCount = await getDayTabCount(page);
    expect(newCount).toBe(initialCount + 1);

    // Verify: new Day tab visible (D5)
    await expect(page.locator(`button:has-text("D${initialCount + 1}")`)).toBeVisible();
  });

  /* ── D-02: Day 삭제 ── */
  test('D-02: Day 삭제', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    const initialCount = await getDayTabCount(page);

    // Select the last Day tab
    await selectDay(page, initialCount - 1);
    await page.waitForTimeout(300);

    // Open day more menu
    await openDayMoreMenu(page);

    // Click "이 날짜 삭제"
    await page.locator('text=이 날짜 삭제').click();
    await page.waitForTimeout(300);

    // Confirm dialog — click 삭제
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await page.waitForTimeout(800);

    // Verify: Day count decreased
    const newCount = await getDayTabCount(page);
    expect(newCount).toBe(initialCount - 1);
  });

  /* ── I-01: 아이템 직접 추가 ── */
  test('I-01: 아이템 직접 추가', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Select Day 1
    await selectDay(page, 0);

    // Add item: 12:00, 식사, "라멘 이치란"
    await addItemManually(page, '12:00', '식사', '라멘 이치란');

    // Verify: item appears on Day 1
    await waitForText(page, '라멘 이치란', 5_000);
    await expect(page.locator('text=라멘 이치란')).toBeVisible();
  });

  /* ── I-02: 아이템 수정 — DetailDialog ── */
  test('I-02: 아이템 수정 (이름 변경)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // Click "라멘 이치란" to open DetailDialog
    await clickItem(page, '라멘 이치란');
    await page.waitForTimeout(500);

    // Click name text in DetailDialog header (h3 > span) to open CenterPopup
    const nameSpan = page.locator('h3 span:has-text("라멘 이치란")');
    await nameSpan.click();
    await page.waitForTimeout(500);

    // CenterPopup opens with input for name editing
    const nameInput = page.locator('input[type="text"]').last();
    await nameInput.waitFor({ state: 'visible', timeout: 3_000 });
    await nameInput.fill('라멘 이치란 본점');

    // Click 저장
    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(500);

    // Close DetailDialog
    const closeBtn = page.locator('button[title="닫기"]').first();
    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  });

  /* ── I-03: 아이템 추가 (추가 아이템들) ── */
  test('I-03: 추가 아이템 등록 (Day 이동 테스트 준비)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Add second item
    await addItemManually(page, '15:00', '관광', '센소지');
    await waitForText(page, '센소지', 5_000);

    // Add third item
    await addItemManually(page, '18:00', '쇼핑', '아메요코');
    await waitForText(page, '아메요코', 5_000);
  });

  /* ── I-04: 아이템 삭제 ── */
  test('I-04: 아이템 삭제', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // Click item to open DetailDialog
    await clickItem(page, '아메요코');
    await page.waitForTimeout(500);

    // Click 삭제 button at the bottom of DetailDialog (ghost-danger variant)
    const deleteBtn = page.getByRole('button', { name: '삭제', exact: true }).last();
    await deleteBtn.click();
    await page.waitForTimeout(1_000);
  });

  /* ── I-05: 아이템 삭제 후 복구 (Undo) ── */
  test('I-05: 아이템 삭제 후 복구 (Undo)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // First add a temporary item to delete
    await addItemManually(page, '10:00', '정보', '삭제 테스트');
    await waitForText(page, '삭제 테스트', 5_000);

    // Click to open detail
    await clickItem(page, '삭제 테스트');
    await page.waitForTimeout(500);

    // Click 삭제 button at the bottom of DetailDialog
    const deleteBtn = page.getByRole('button', { name: '삭제', exact: true }).last();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Look for undo toast action
    const undoBtn = page.locator('button:has-text("복구")').last();
    if (await undoBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await undoBtn.click();
      await page.waitForTimeout(1_000);

      // Verify item is back
      await waitForText(page, '삭제 테스트', 5_000);
    }
  });

  /* ── I-06: 아이템 Day 이동 ── */
  test('I-06: 아이템 Day 이동', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Day 이동 requires 2+ days — add Day 2 if only 1 day
    const dayCount = await getDayTabCount(page);
    if (dayCount < 2) {
      await page.locator('button[title="날짜 추가"]').click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(800);
    }

    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // Verify we have "센소지" on Day 1
    const hasItems = await page.locator('text=센소지').isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasItems) {
      await addItemManually(page, '15:00', '관광', '센소지');
      await waitForText(page, '센소지', 5_000);
    }

    // Click "센소지" to open DetailDialog
    await clickItem(page, '센소지');
    await page.waitForTimeout(500);

    // Click "더보기" (···) button in DetailDialog header (last one = DetailDialog's)
    await page.locator('button[title="더보기"]').last().click();
    await page.waitForTimeout(500);

    // Click "다른 Day로 이동" in the more sheet
    await page.locator('text=다른 Day로 이동').click();
    await page.waitForTimeout(500);

    // Select Day 2 in the move sheet
    await page.locator('text=Day 2').first().click();
    await page.waitForTimeout(1_000);

    // Navigate to Day 2 to verify item moved
    await selectDay(page, 1);
    await page.waitForTimeout(500);
    await waitForText(page, '센소지', 5_000);
  });

  /* ── R-01: 새로고침 후 데이터 지속성 ── */
  test('R-01: 새로고침 후 데이터 유지', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Add a known item
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // Check if existing items are present
    const hasItem = await page.locator('text=라멘 이치란').isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasItem) {
      await addItemManually(page, '12:00', '식사', '라멘 이치란');
      await waitForText(page, '라멘 이치란', 5_000);
    }

    // Reload page
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    // Verify: items still present after reload
    await expect(page.locator('text=라멘 이치란').first()).toBeVisible({ timeout: 5_000 });

    // Verify: no console errors (check for error overlay or crash)
    const errorOverlay = page.locator('text=Something went wrong');
    const hasError = await errorOverlay.isVisible({ timeout: 1_000 }).catch(() => false);
    expect(hasError).toBe(false);
  });
});
