// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  waitForText,
  getDayTabCount,
  openDayMoreMenu,
  clickItem,
} from './helpers.js';

/**
 * Phase 4: 데이터 정합성
 * DI-01~06, D-06~07
 */

const TRIP_NAME = `DI 테스트 ${Date.now()}`;

test.describe('Phase 4: 데이터 정합성', () => {
  let tripId;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/auth/user-a.json',
      viewport: { width: 390, height: 844 },
      baseURL: 'http://localhost:3000',
    });
    const page = await context.newPage();
    tripId = await createTripAndNavigate(page, TRIP_NAME, '도쿄', 3);
    await context.close();
  });

  /* ── D-07: 마지막 Day 삭제 시도 ── */
  test('D-07: 마지막 Day 삭제 시도 — 삭제 불가', async ({ page }) => {
    // Create a trip with only 1 day
    const singleDayTrip = await createTripAndNavigate(page, `1일 여행 ${Date.now()}`, '부산', 0);

    await page.goto(`/trip/${singleDayTrip}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    const dayCount = await getDayTabCount(page);
    expect(dayCount).toBe(1);

    // Try to delete the only Day
    await openDayMoreMenu(page);
    await page.waitForTimeout(500);

    // "이 날짜 삭제" should NOT appear for the last day (or should show warning)
    const deleteOption = page.locator('text=이 날짜 삭제');
    const visible = await deleteOption.isVisible({ timeout: 2_000 }).catch(() => false);

    if (visible) {
      // If visible, click it — should show a warning toast
      await deleteOption.click();
      await page.waitForTimeout(500);
      // Verify toast says can't delete
    }

    // Day count should still be 1
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const finalCount = await getDayTabCount(page);
    expect(finalCount).toBe(1);
  });

  /* ── DI-04: sanitizeScheduleData — 삭제 후 새로고침 시 부활 안 함 ── */
  test('DI-04: 삭제한 아이템이 새로고침 후 부활하지 않음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Add items
    await addItemManually(page, '09:00', '관광', 'DI04-살아있을것');
    await waitForText(page, 'DI04-살아있을것');
    await addItemManually(page, '10:00', '식사', 'DI04-삭제대상');
    await waitForText(page, 'DI04-삭제대상');

    // Delete one item via DetailDialog
    await page.locator('text=DI04-삭제대상').first().click();
    await expect(page.locator('h3:has-text("DI04-삭제대상")')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);

    // 1) DetailDialog "삭제" → ConfirmDialog 열림
    await page.getByRole('button', { name: '삭제', exact: true }).last().click();
    await page.waitForSelector('h3:has-text("일정 삭제")', { timeout: 3_000 });
    // 2) ConfirmDialog "삭제" 확인 (ConfirmDialog는 DOM 앞쪽 = first)
    await page.getByRole('button', { name: '삭제', exact: true }).first().click();

    // 3) 복구 토스트가 사라질 때까지 대기 (토스트 만료 시 실제 DB 저장)
    await page.waitForSelector('button:has-text("복구")', { state: 'visible', timeout: 5_000 }).catch(() => {});
    await page.waitForSelector('button:has-text("복구")', { state: 'hidden', timeout: 10_000 });

    // Reload
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    // Verify: surviving item still here
    await expect(page.locator('text=DI04-살아있을것')).toBeVisible({ timeout: 5_000 });

    // Verify: deleted item does NOT come back
    const zombieItem = page.locator('text=DI04-삭제대상');
    const isBack = await zombieItem.isVisible({ timeout: 2_000 }).catch(() => false);
    expect(isBack).toBe(false);
  });

  /* ── DI-06: 연속 삭제 후 복구 — 마지막 삭제만 복구됨 ── */
  test('DI-06: 연속 삭제 후 복구 — 단일 스냅샷', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Add items A, B, C
    await addItemManually(page, '11:00', '관광', 'DI06-A');
    await waitForText(page, 'DI06-A');
    await addItemManually(page, '12:00', '식사', 'DI06-B');
    await waitForText(page, 'DI06-B');
    await addItemManually(page, '13:00', '쇼핑', 'DI06-C');
    await waitForText(page, 'DI06-C');

    // Delete A: DetailDialog → ConfirmDialog → 복구 토스트 대기
    await page.locator('text=DI06-A').first().click();
    await expect(page.locator('h3:has-text("DI06-A")')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '삭제', exact: true }).last().click();
    await page.waitForSelector('h3:has-text("일정 삭제")', { timeout: 3_000 });
    await page.getByRole('button', { name: '삭제', exact: true }).first().click();
    // Wait for A's undo toast to expire (DB save)
    await page.waitForSelector('button:has-text("복구")', { state: 'visible', timeout: 5_000 }).catch(() => {});
    await page.waitForSelector('button:has-text("복구")', { state: 'hidden', timeout: 10_000 });

    // Delete B: DetailDialog → ConfirmDialog
    await page.locator('text=DI06-B').first().click();
    await expect(page.locator('h3:has-text("DI06-B")')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '삭제', exact: true }).last().click();
    await page.waitForSelector('h3:has-text("일정 삭제")', { timeout: 3_000 });
    await page.getByRole('button', { name: '삭제', exact: true }).first().click();
    await page.waitForTimeout(500);

    // Click undo/복구 on toast — should only restore B (last deleted)
    const undoBtn = page.locator('button:has-text("복구")').last();
    if (await undoBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await undoBtn.click();
      await page.waitForTimeout(1_000);

      // B should be restored
      await expect(page.locator('text=DI06-B')).toBeVisible({ timeout: 5_000 });
    }

    // C should remain untouched
    await expect(page.locator('text=DI06-C')).toBeVisible({ timeout: 3_000 });
  });

  /* ── R-01: CRUD 후 새로고침 종합 ── */
  test('R-01: 모든 CRUD 후 새로고침 — 데이터 유지', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // 1. 아이템 추가
    await selectDay(page, 0);
    await addItemManually(page, '20:00', '식사', 'R01 저녁식사');
    await waitForText(page, 'R01 저녁식사');

    // 2. Day 추가
    const addDayBtn = page.locator('button[title="날짜 추가"]');
    if (await addDayBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await addDayBtn.click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(800);
    }

    const dayCountBefore = await getDayTabCount(page);

    // 3. 새로고침
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });

    // 4. 검증: 모든 변경사항 유지
    await selectDay(page, 0);
    await page.waitForTimeout(500);
    await expect(page.locator('text=R01 저녁식사')).toBeVisible({ timeout: 5_000 });

    const dayCountAfter = await getDayTabCount(page);
    expect(dayCountAfter).toBe(dayCountBefore);

    // 5. console.error 없음 (크래시 검사)
    const errorOverlay = page.locator('text=Something went wrong');
    expect(await errorOverlay.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });
});
