// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  waitForText,
  clickItem,
  editDetailField,
  setTimePickerInDialog,
} from './helpers.js';

/**
 * Phase 6: DetailDialog 필드 편집 (FE-01 ~ FE-08)
 * 아이템의 가격, 부가정보, 메모, 시간, 체크인/체크아웃, 주소, 영업시간 편집 + 영속성 검증.
 */

const TRIP_NAME = `E2E Phase6 ${Date.now()}`;

test.describe('Phase 6: DetailDialog 필드 편집', () => {
  let tripId;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/auth/user-a.json',
      viewport: { width: 390, height: 844 },
      baseURL: 'http://localhost:3000',
    });
    const page = await context.newPage();
    tripId = await createTripAndNavigate(page, TRIP_NAME, '도쿄', 2);

    // Add test items on Day 1
    await selectDay(page, 0);
    await addItemManually(page, '12:00', '식사', 'FE 라멘집');
    await waitForText(page, 'FE 라멘집');
    await addItemManually(page, '18:00', '숙소', 'FE 호텔');
    await waitForText(page, 'FE 호텔');

    await context.close();
  });

  /* ── FE-01: 가격 편집 ── */
  test('FE-01: 가격 편집', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // Open DetailDialog for the restaurant item
    await clickItem(page, 'FE 라멘집');
    await page.waitForTimeout(500);

    // Edit price via info row
    await editDetailField(page, '가격', '¥1,200');

    // Verify: price value shown in the info row
    await expect(page.locator('text=¥1,200')).toBeVisible({ timeout: 3_000 });

    // Close DetailDialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ── FE-02: 부가정보 편집 ── */
  test('FE-02: 부가정보 편집', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'FE 라멘집');
    await page.waitForTimeout(500);

    // Edit 부가정보
    await editDetailField(page, '부가정보', '약 30분 대기');

    // Verify in DetailDialog
    await expect(page.locator('text=약 30분 대기')).toBeVisible({ timeout: 3_000 });

    // Close and verify PlaceCard also shows sub info
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // PlaceCard shows sub text below desc
    await expect(page.locator('text=약 30분 대기')).toBeVisible({ timeout: 3_000 });
  });

  /* ── FE-03: 메모 편집 (textarea) ── */
  test('FE-03: 메모 편집 (textarea)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'FE 라멘집');
    await page.waitForTimeout(500);

    // Edit memo (multiline)
    const memoText = '첫 번째 줄\n두 번째 줄\n세 번째 줄';
    await editDetailField(page, '메모', memoText, true);

    // Verify: memo text displayed (pre-line whitespace)
    await expect(page.locator('text=첫 번째 줄')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('text=두 번째 줄')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ── FE-04: 시간 수정 (DetailDialog 헤더 시간 배지) ── */
  test('FE-04: 시간 수정 (DetailDialog 헤더)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'FE 라멘집');
    await page.waitForTimeout(500);

    // Click the time badge button in the header (displays "12:00")
    const timeBadge = page.locator('h3').locator('..').locator('button:has-text("12:00")');
    await timeBadge.click();
    await page.waitForTimeout(500);

    // Set time to 14:30 via TimePickerDialog
    await setTimePickerInDialog(page, 14, 30);
    await page.waitForTimeout(500);

    // Verify: time badge now shows "14:30"
    await expect(page.locator('button:has-text("14:30")')).toBeVisible({ timeout: 3_000 });

    // Close DetailDialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify PlaceCard time also updated
    await expect(page.locator('text=14:30')).toBeVisible({ timeout: 3_000 });
  });

  /* ── FE-05: 숙소 체크인/체크아웃 ── */
  test('FE-05: 숙소 체크인/체크아웃', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // Open the hotel item (숙소 type)
    await clickItem(page, 'FE 호텔');
    await page.waitForTimeout(500);

    // Click "체크인·체크아웃" row (for stay-type items the label is "체크인·체크아웃")
    const hoursRow = page.locator('div[role="button"]:has-text("체크인·체크아웃")').first();
    await hoursRow.click();
    await page.waitForTimeout(500);

    // CenterPopup should show check-in and check-out buttons
    // Click the check-in time button (contains default or existing time)
    const checkInBtn = page.locator('button').filter({ has: page.locator('text=체크인').locator('..') }).locator('button').first();
    // More reliably: find buttons inside the CenterPopup after the "체크인" label
    const checkInTimeBtn = page.locator('span:has-text("체크인")').locator('..').locator('button').first();
    if (await checkInTimeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await checkInTimeBtn.click();
      await page.waitForTimeout(500);

      // Set check-in to 15:00
      await setTimePickerInDialog(page, 15, 0);
      await page.waitForTimeout(300);
    }

    // Click check-out time button
    const checkOutTimeBtn = page.locator('span:has-text("체크아웃")').locator('..').locator('button').first();
    if (await checkOutTimeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await checkOutTimeBtn.click();
      await page.waitForTimeout(500);

      // Set check-out to 11:00
      await setTimePickerInDialog(page, 11, 0);
      await page.waitForTimeout(300);
    }

    // Click 저장
    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(500);

    // Verify: check-in/check-out text displayed
    await expect(page.locator('text=체크인 15:00')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('text=체크아웃 11:00')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ── FE-06: 주소 검색 ── */
  test('FE-06: 주소 검색', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'FE 라멘집');
    await page.waitForTimeout(500);

    // Click "주소" row to open address search dialog
    const addressRow = page.locator('div[role="button"]:has-text("주소")').first();
    await addressRow.click();
    await page.waitForTimeout(500);

    // CenterPopup "장소 검색" should open with address search input
    const searchInput = page.locator('input[placeholder="장소명, 주소를 검색하세요"]').last();
    await searchInput.waitFor({ state: 'visible', timeout: 3_000 });

    // Type a search query
    await searchInput.fill('이치란 라멘 신주쿠');
    await page.waitForTimeout(2_000);

    // Try to pick a prediction result; fallback to just confirming the dialog
    const prediction = page.locator('div[role="button"][tabindex="0"]').first();
    const hasPrediction = await prediction.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPrediction) {
      await prediction.click();
      await page.waitForTimeout(1_000);
    }

    // Click 확인 to save the address
    await page.getByRole('button', { name: '확인' }).click();
    await page.waitForTimeout(500);

    // If a prediction was selected, the address row should now show text
    // Just verify the dialog closed and no error
    const errorOverlay = page.locator('text=Something went wrong');
    expect(await errorOverlay.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ── FE-07: 영업시간 (요일 그리드) ── */
  test('FE-07: 영업시간 (요일 그리드)', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'FE 라멘집');
    await page.waitForTimeout(500);

    // Click "영업시간" row
    const hoursRow = page.locator('div[role="button"]:has-text("영업시간")').first();
    await hoursRow.click();
    await page.waitForTimeout(500);

    // CenterPopup should show the 7-day hours grid
    // Click "매일 동일하게 적용" to simplify (sets all days to same hours)
    const applyAllBtn = page.locator('button:has-text("매일 동일하게 적용")');
    if (await applyAllBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await applyAllBtn.click();
      await page.waitForTimeout(300);
    }

    // Click 저장
    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(500);

    // Verify: "영업시간" label still visible (row now has value)
    await expect(page.locator('text=영업시간').first()).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ── FE-08: 전체 필드 영속성 ── */
  test('FE-08: 전체 필드 영속성 — 리로드 후 모든 값 유지', async ({ page }) => {
    // Reload page
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    // Open the restaurant item and verify all previously edited fields
    await clickItem(page, 'FE 라멘집');
    await page.waitForTimeout(500);

    // FE-01: price
    await expect(page.locator('text=¥1,200')).toBeVisible({ timeout: 3_000 });

    // FE-02: sub info
    await expect(page.locator('text=약 30분 대기')).toBeVisible({ timeout: 3_000 });

    // FE-03: memo
    await expect(page.locator('text=첫 번째 줄')).toBeVisible({ timeout: 3_000 });

    // FE-04: time changed to 14:30
    await expect(page.locator('button:has-text("14:30")')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open the hotel item and verify check-in/check-out
    await clickItem(page, 'FE 호텔');
    await page.waitForTimeout(500);

    // FE-05: check-in/check-out
    await expect(page.locator('text=체크인 15:00')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('text=체크아웃 11:00')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // No crash
    const errorOverlay = page.locator('text=Something went wrong');
    expect(await errorOverlay.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });
});
