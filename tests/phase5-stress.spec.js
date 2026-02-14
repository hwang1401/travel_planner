// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  waitForText,
  getDayTabCount,
} from './helpers.js';

/**
 * Phase 5: 스트레스 테스트
 * E-02 (긴 일정), E-04 (빠른 연속), R-02 (네트워크 끊김)
 * T-02 (AI 일정 생성) — timeout 150초
 */

test.describe('Phase 5: 스트레스 테스트', () => {

  /* ── E-02: 긴 일정 (Day 10+) ── */
  test('E-02: Day 10개 + 아이템 다수', async ({ page }) => {
    test.setTimeout(120_000);

    const tripId = await createTripAndNavigate(page, `긴일정 ${Date.now()}`, '파리', 1);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Add 9 more days (empty trip starts with 1 day only)
    for (let i = 0; i < 9; i++) {
      const addDayBtn = page.locator('button[title="날짜 추가"]');
      await addDayBtn.click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(500);
    }

    const dayCount = await getDayTabCount(page);
    expect(dayCount).toBeGreaterThanOrEqual(10);

    // Add 3 items to Day 1
    await selectDay(page, 0);
    await addItemManually(page, '09:00', '관광', '에펠탑');
    await addItemManually(page, '12:00', '식사', '르 쥘 베른');
    await addItemManually(page, '15:00', '쇼핑', '갤러리 라파예트');

    // Add 2 items to Day 10
    await selectDay(page, 9);
    await addItemManually(page, '10:00', '관광', '베르사유 궁전');
    await addItemManually(page, '14:00', '식사', '마지막 점심');

    // Reload and verify
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });

    // Check Day 1
    await selectDay(page, 0);
    await page.waitForTimeout(500);
    await expect(page.locator('text=에펠탑')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=르 쥘 베른')).toBeVisible({ timeout: 5_000 });

    // Check Day 10
    await selectDay(page, 9);
    await page.waitForTimeout(500);
    await expect(page.locator('text=베르사유 궁전')).toBeVisible({ timeout: 5_000 });

    // Verify all days still accessible
    const finalCount = await getDayTabCount(page);
    expect(finalCount).toBeGreaterThanOrEqual(10);
  });

  /* ── R-02: 네트워크 끊김 시뮬레이션 후 재연결 ── */
  test('R-02: 네트워크 끊김 → 재연결', async ({ page }) => {
    test.setTimeout(60_000);

    const tripId = await createTripAndNavigate(page, `네트워크 ${Date.now()}`, '런던', 1);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // Add item while online
    await addItemManually(page, '09:00', '관광', '빅벤');
    await waitForText(page, '빅벤');

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(1_000);

    // Try to add item while offline — may fail silently
    try {
      await addItemManually(page, '12:00', '식사', '오프라인 추가');
    } catch {
      // Expected: might timeout or fail
    }

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(3_000);

    // Reload and verify
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    // "빅벤" (added while online) should still be there
    await expect(page.locator('text=빅벤')).toBeVisible({ timeout: 5_000 });

    // No crash
    const errorOverlay = page.locator('text=Something went wrong');
    expect(await errorOverlay.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });

  /* ── T-02: AI 일정 생성 (long timeout) ── */
  test('T-02: 여행 생성 — AI 일정 생성', async ({ page }) => {
    test.setTimeout(180_000); // 3분 timeout

    await page.goto('/');
    await page.waitForSelector('h1:has-text("내 여행")', { timeout: 15_000 });
    await page.waitForTimeout(500);

    // Click "여행 만들기"
    const createBtn = page.getByRole('button', { name: /여행 만들기|첫 여행 만들기/ });
    await createBtn.click();

    // Step 1
    await page.waitForSelector('text=어디로 여행을 떠나시나요?', { timeout: 5_000 });
    const nameField = page.locator('input[placeholder*="후쿠오카"]');
    await nameField.fill('AI 테스트 여행');

    const destInput = page.locator('input[placeholder*="도시 또는 장소를 검색"]');
    await destInput.fill('오사카');

    // Wait for Google Places autocomplete predictions
    const prediction = page.locator('div[role="button"][tabindex="0"]').first();
    const hasPredictions = await prediction.waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true).catch(() => false);
    if (hasPredictions) {
      await prediction.click();
    } else {
      // Fallback: directly invoke AddressSearch onChange via React fiber
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

    // Wait for "다음" button to become enabled
    await page.waitForFunction(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '다음');
      return btn && !btn.disabled;
    }, { timeout: 10_000 });
    await page.getByRole('button', { name: '다음' }).click();

    // Step 2: pick 2 nights
    await page.waitForSelector('text=언제 출발하시나요?', { timeout: 5_000 });
    const today = new Date();
    const cells = page.locator('div[style*="grid-template-columns: repeat(7"] > div');
    const cellCount = await cells.count();
    // Find today's date
    for (let i = 0; i < cellCount; i++) {
      const text = await cells.nth(i).textContent();
      if (text?.trim() === String(today.getDate())) {
        await cells.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(300);
    // Find today + 2
    const endDay = today.getDate() + 2;
    for (let i = 0; i < cellCount; i++) {
      const text = await cells.nth(i).textContent();
      if (text?.trim() === String(endDay)) {
        await cells.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '다음' }).click();

    // Step 3: Choose "AI로 일정 만들기"
    await page.waitForSelector('text=어떻게 일정을 채울까요?', { timeout: 5_000 });
    await page.locator('text=AI로 일정 만들기').click();
    await page.waitForTimeout(500);

    // AI mode — click "AI 일정 생성하기"
    await page.waitForSelector('text=AI로 일정 만들기', { timeout: 5_000 });
    const generateBtn = page.getByRole('button', { name: /AI 일정 생성하기/ });
    await generateBtn.click();

    // Wait for generation (up to 150s)
    // Look for preview to appear
    await page.waitForSelector('text=AI 추천 일정', { timeout: 150_000 });

    // Preview appeared — verify days exist
    await expect(page.locator('text=Day 1')).toBeVisible({ timeout: 5_000 });

    // Submit with AI schedule
    const submitBtn = page.getByRole('button', { name: /AI 일정으로 여행 만들기/ });
    await submitBtn.click();

    // Wait for navigation to trip planner
    await page.waitForURL(/\/trip\/[a-f0-9-]+/, { timeout: 15_000 });
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Verify: items exist on Day 1
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    // Should have at least one item with a time
    const timeSlots = page.locator('span[style*="width"]').filter({ hasText: /\d{1,2}:\d{2}/ });
    const itemCount = await timeSlots.count();
    expect(itemCount).toBeGreaterThan(0);
  });
});
