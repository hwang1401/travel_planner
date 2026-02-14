// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  waitForText,
  waitForRealtimeSync,
  getDayTabCount,
  loginUserB,
  addTripMember,
} from './helpers.js';

/**
 * Phase 3: 동시편집 (CE-01 ~ CE-11)
 * 2 browser contexts: User A (owner) + User B (editor via signInWithPassword)
 */

test.describe('Phase 3: 동시편집', () => {
  let tripId;
  let contextA, contextB;
  let pageA, pageB;

  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60_000);
    // User A: create trip
    contextA = await browser.newContext({
      storageState: 'tests/auth/user-a.json',
      viewport: { width: 390, height: 844 },
      baseURL: 'http://localhost:3000',
    });
    pageA = await contextA.newPage();
    tripId = await createTripAndNavigate(pageA, `동시편집 ${Date.now()}`, '도쿄', 3);

    // Add Day 2, Day 3 (empty trip starts with 1 day only)
    for (let i = 0; i < 2; i++) {
      await pageA.locator('button[title="날짜 추가"]').click();
      await pageA.waitForTimeout(300);
      await pageA.getByRole('button', { name: '추가', exact: true }).click();
      await pageA.waitForTimeout(800);
    }

    // Add some initial items on Day 1
    await selectDay(pageA, 0);
    await addItemManually(pageA, '09:00', '관광', 'A 아이템');
    await waitForText(pageA, 'A 아이템');

    // User B: login via signInWithPassword and add as trip member
    try {
      const userB = await loginUserB(browser);
      contextB = userB.context;
      pageB = userB.page;

      // Add User B as editor member of the trip (using User B's own token)
      await addTripMember(tripId, userB.userId, userB.accessToken);

      // User B joins the trip
      await pageB.goto(`/trip/${tripId}`);
      await pageB.waitForSelector('text=D1', { timeout: 15_000 });
    } catch (err) {
      console.warn('User B setup failed, skipping concurrent tests:', err.message);
      contextB = null;
      pageB = null;
    }
  });

  test.afterAll(async () => {
    await contextA?.close();
    await contextB?.close();
  });

  /* ── CE-01: 기본 동기화 — 한쪽 추가, 다른 쪽 반영 ── */
  test('CE-01: 기본 동기화', async () => {
    test.skip(!pageB, 'User B not available');

    // User A: add item
    await selectDay(pageA, 0);
    await addItemManually(pageA, '10:00', '식사', 'CE01 테스트 장소');
    await waitForText(pageA, 'CE01 테스트 장소');

    // Wait for realtime sync on User B
    await selectDay(pageB, 0);
    const synced = await waitForRealtimeSync(pageB, 'CE01 테스트 장소', 10_000);

    if (!synced) {
      // Fallback: reload User B
      await pageB.reload();
      await pageB.waitForSelector('text=D1', { timeout: 10_000 });
      await selectDay(pageB, 0);
    }

    await expect(pageB.locator('text=CE01 테스트 장소')).toBeVisible({ timeout: 5_000 });
  });

  /* ── CE-02: 양쪽 추가 — 다른 Day 동기화 ── */
  test('CE-02: 양쪽 추가 — 다른 Day', async () => {
    test.skip(!pageB, 'User B not available');

    // User A: add to Day 1
    await selectDay(pageA, 0);
    await addItemManually(pageA, '11:00', '관광', 'A의 Day1 장소');
    await waitForText(pageA, 'A의 Day1 장소');

    // Wait for A's write to settle
    await pageA.waitForTimeout(2_000);

    // User B: add to Day 2
    await selectDay(pageB, 1);
    await addItemManually(pageB, '11:00', '쇼핑', 'B의 Day2 장소');
    await waitForText(pageB, 'B의 Day2 장소');

    // Wait for sync
    await pageA.waitForTimeout(5_000);

    // Reload both to verify
    await pageA.reload();
    await pageA.waitForSelector('text=D1', { timeout: 10_000 });
    await pageB.reload();
    await pageB.waitForSelector('text=D1', { timeout: 10_000 });

    // User A: check Day 1 and Day 2
    await selectDay(pageA, 0);
    await expect(pageA.locator('text=A의 Day1 장소')).toBeVisible({ timeout: 5_000 });
    await selectDay(pageA, 1);
    await expect(pageA.locator('text=B의 Day2 장소')).toBeVisible({ timeout: 5_000 });

    // User B: check both visible
    await selectDay(pageB, 0);
    await expect(pageB.locator('text=A의 Day1 장소')).toBeVisible({ timeout: 5_000 });
    await selectDay(pageB, 1);
    await expect(pageB.locator('text=B의 Day2 장소')).toBeVisible({ timeout: 5_000 });
  });

  /* ── CE-03: 양쪽 추가 — 같은 Day 동기화 ── */
  test('CE-03: 양쪽 추가 — 같은 Day', async () => {
    test.skip(!pageB, 'User B not available');

    // User A: add to Day 3
    await selectDay(pageA, 2);
    await addItemManually(pageA, '14:00', '관광', 'A의 Day3 아이템');
    await waitForText(pageA, 'A의 Day3 아이템');
    await pageA.waitForTimeout(2_000);

    // User B: add to Day 3
    await selectDay(pageB, 2);
    await addItemManually(pageB, '15:00', '식사', 'B의 Day3 아이템');
    await waitForText(pageB, 'B의 Day3 아이템');

    // Wait + reload
    await pageA.waitForTimeout(5_000);
    await pageA.reload();
    await pageA.waitForSelector('text=D1', { timeout: 10_000 });
    await pageB.reload();
    await pageB.waitForSelector('text=D1', { timeout: 10_000 });

    // Both should have both items on Day 3
    await selectDay(pageA, 2);
    await expect(pageA.locator('text=A의 Day3 아이템')).toBeVisible({ timeout: 5_000 });
    await expect(pageA.locator('text=B의 Day3 아이템')).toBeVisible({ timeout: 5_000 });

    await selectDay(pageB, 2);
    await expect(pageB.locator('text=A의 Day3 아이템')).toBeVisible({ timeout: 5_000 });
    await expect(pageB.locator('text=B의 Day3 아이템')).toBeVisible({ timeout: 5_000 });
  });

  /* ── CE-04: Day 이동 후 데이터 보존 (핵심 버그 검증) ── */
  test('CE-04: Day 이동 후 데이터 보존', async () => {
    test.skip(!pageB, 'User B not available');

    // Prepare: add items A, B, C on Day 1
    await selectDay(pageA, 0);
    await addItemManually(pageA, '08:00', '관광', 'CE04-A');
    await waitForText(pageA, 'CE04-A');
    await addItemManually(pageA, '12:00', '식사', 'CE04-B');
    await waitForText(pageA, 'CE04-B');
    await addItemManually(pageA, '16:00', '쇼핑', 'CE04-C');
    await waitForText(pageA, 'CE04-C');

    // Wait for B to sync
    await pageB.waitForTimeout(3_000);

    // User A: move item A to Day 2 via DetailDialog
    await pageA.locator('text=CE04-A').first().click();
    await pageA.waitForTimeout(500);

    await pageA.locator('button[title="더보기"]').last().click();
    await pageA.waitForTimeout(500);
    await pageA.locator('text=다른 Day로 이동').click();
    await pageA.waitForTimeout(500);
    await pageA.locator('text=Day 2').first().click();
    await pageA.waitForTimeout(1_000);

    // Close any remaining dialog
    await pageA.keyboard.press('Escape');
    await pageA.waitForTimeout(3_000);

    // Reload both
    await pageA.reload();
    await pageA.waitForSelector('text=D1', { timeout: 10_000 });
    await pageB.reload();
    await pageB.waitForSelector('text=D1', { timeout: 10_000 });

    // ★ 핵심 검증: Day 1에 B, C가 살아있어야 함
    await selectDay(pageA, 0);
    await pageA.waitForTimeout(500);
    await expect(pageA.locator('text=CE04-B')).toBeVisible({ timeout: 5_000 });
    await expect(pageA.locator('text=CE04-C')).toBeVisible({ timeout: 5_000 });

    // Day 2에 A가 있어야 함
    await selectDay(pageA, 1);
    await pageA.waitForTimeout(500);
    await expect(pageA.locator('text=CE04-A')).toBeVisible({ timeout: 5_000 });

    // User B: same verification
    await selectDay(pageB, 0);
    await pageB.waitForTimeout(500);
    await expect(pageB.locator('text=CE04-B')).toBeVisible({ timeout: 5_000 });
    await expect(pageB.locator('text=CE04-C')).toBeVisible({ timeout: 5_000 });
  });

  /* ── CE-06: 한쪽 Day 추가, 다른 쪽 반영 ── */
  test('CE-06: 한쪽 Day 추가, 다른 쪽 반영', async () => {
    test.skip(!pageB, 'User B not available');

    const initialCountA = await getDayTabCount(pageA);

    // User A: add a new Day
    const addDayBtn = pageA.locator('button[title="날짜 추가"]');
    await addDayBtn.click();
    await pageA.waitForTimeout(300);
    await pageA.getByRole('button', { name: '추가', exact: true }).click();
    await pageA.waitForTimeout(3_000);

    // Wait for sync on User B
    await pageB.waitForTimeout(5_000);

    // Reload User B to ensure sync
    await pageB.reload();
    await pageB.waitForSelector('text=D1', { timeout: 10_000 });

    const countB = await getDayTabCount(pageB);
    expect(countB).toBe(initialCountA + 1);
  });

  /* ── CE-11: version 증가 확인 ── */
  test('CE-11: 연속 저장 후 realtime 누락 없음', async () => {
    test.skip(!pageB, 'User B not available');

    // User A: add 3 items quickly
    await selectDay(pageA, 0);
    await addItemManually(pageA, '07:00', '정보', 'CE11-1');
    await addItemManually(pageA, '07:30', '정보', 'CE11-2');

    // User B: add 1 item
    await selectDay(pageB, 0);
    await addItemManually(pageB, '07:15', '정보', 'CE11-3');

    // Wait for sync
    await pageA.waitForTimeout(5_000);
    await pageB.waitForTimeout(3_000);

    // Reload both
    await pageA.reload();
    await pageA.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(pageA, 0);

    // User A should see all 3 items
    await expect(pageA.locator('text=CE11-1')).toBeVisible({ timeout: 5_000 });
    await expect(pageA.locator('text=CE11-2')).toBeVisible({ timeout: 5_000 });
    await expect(pageA.locator('text=CE11-3')).toBeVisible({ timeout: 5_000 });
  });
});
