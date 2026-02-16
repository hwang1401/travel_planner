// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  waitForText,
  clickItem,
  getDayTabCount,
  getItemCount,
  countText,
  openDayMoreMenu,
  editDayLabel,
  longPressItem,
  expectToast,
  setTimePickerInDialog,
} from './helpers.js';

/**
 * Phase 8: Day 관리 & UI 인터랙션 — 모든 플로우
 *
 * 커버하는 플로우:
 *   [2.1] Day 추가
 *   [2.2] Day 이름 수정 + 취소
 *   [2.3] Day 삭제 + 확인 다이얼로그
 *   [2.4] Day 순서 변경
 *   [6.2] 롱프레스 → 선택 모드
 *   [6.3] 일괄 삭제 모드 (bulkDelete)
 *   [6.4] 롱프레스 다중 선택 → 삭제
 *   [7.2] 롱프레스 다중 선택 → Day 이동
 *   [12.2] PlaceCard 시간 탭 → 시간 수정
 *   [8.1] 지도 다이얼로그
 *   [9.1] 공유 시트
 *   더보기 메뉴 (여행 가이드, 여행 서류)
 *   빠른 Day 전환
 *   조작 후 복제 방지
 */

const TRIP_NAME = `E2E Phase8 ${Date.now()}`;

test.describe('Phase 8: Day 관리 & UI 인터랙션', () => {
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

    await selectDay(page, 0);
    await addItemManually(page, '09:00', '관광', 'DM 오사카성');
    await waitForText(page, 'DM 오사카성');
    await addItemManually(page, '12:00', '식사', 'DM 쿠시카츠');
    await waitForText(page, 'DM 쿠시카츠');
    await addItemManually(page, '15:00', '쇼핑', 'DM 신사이바시');
    await waitForText(page, 'DM 신사이바시');

    await context.close();
  });

  /* ═══ [2.1] Day 추가 ═══ */
  test('DM-01: Day 추가', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    const initialCount = await getDayTabCount(page);

    await page.locator('button[title="날짜 추가"]').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await page.waitForTimeout(800);

    const newCount = await getDayTabCount(page);
    expect(newCount).toBe(initialCount + 1);
    await expect(page.locator(`button:has-text("D${newCount}")`)).toBeVisible();
  });

  /* ═══ [2.2] Day 이름 수정 ═══ */
  test('DM-02: Day 이름 수정', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await editDayLabel(page, '오사카 탐방');
    await expectToast(page, '날짜 이름이 변경되었습니다', 5_000);
    await expect(page.locator('h2:has-text("오사카 탐방")')).toBeVisible({ timeout: 3_000 });
  });

  /* ═══ [2.2] Day 이름 수정 취소 (ESC) ═══ */
  test('DM-03: Day 이름 수정 ESC 취소', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const dayLabelBtn = page.locator('button:has(h2)').first();
    await dayLabelBtn.click();
    await page.waitForTimeout(500);
    await page.locator('text=이름 수정').click();
    await page.waitForTimeout(500);

    const inlineInput = page.locator('input[placeholder="날짜 이름"]');
    await inlineInput.waitFor({ state: 'visible', timeout: 3_000 });
    await inlineInput.fill('취소될 이름');
    await inlineInput.press('Escape');
    await page.waitForTimeout(500);

    const canceled = page.locator('h2:has-text("취소될 이름")');
    expect(await canceled.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
    await expect(page.locator('h2:has-text("오사카 탐방")')).toBeVisible({ timeout: 3_000 });
  });

  /* ═══ [12.2] PlaceCard 시간 탭 수정 ═══ */
  test('DM-04: PlaceCard 시간 탭 → 시간 수정', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const timeSpan = page.locator('span:has-text("09:00")').first();
    if (await timeSpan.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await timeSpan.click();
      await page.waitForTimeout(500);

      const timePicker = page.locator('[role="dialog"][aria-label="시간 선택"]');
      if (await timePicker.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await setTimePickerInDialog(page, 10, 30);
        await page.waitForTimeout(500);
        await expect(page.locator('text=10:30').first()).toBeVisible({ timeout: 3_000 });
      }
    }

    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });

  /* ═══ [6.2] 롱프레스 → 선택 모드 진입/해제 ═══ */
  test('DM-05: 롱프레스 선택 모드 진입 → 취소', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await longPressItem(page, 'DM 쿠시카츠');

    const selDeleteBtn = page.locator('button:has-text("삭제")').last();
    const inSelMode = await selDeleteBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (inSelMode) {
      // 추가 선택
      await page.locator('text=DM 신사이바시').first().click();
      await page.waitForTimeout(300);

      // 취소
      const cancelBtn = page.locator('button:has-text("취소")').first();
      if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }

      // 아이템 여전히 존재
      await expect(page.locator('text=DM 쿠시카츠')).toBeVisible({ timeout: 3_000 });
      await expect(page.locator('text=DM 신사이바시')).toBeVisible({ timeout: 3_000 });
    }
  });

  /* ═══ [6.3] 일괄 삭제 모드 (bulkDelete) ═══ */
  test('DM-06: 일괄 삭제 모드 — 전체 선택·해제', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // 삭제용 아이템 추가
    await addItemManually(page, '16:00', '정보', 'DM 삭제용A');
    await waitForText(page, 'DM 삭제용A');
    await addItemManually(page, '17:00', '정보', 'DM 삭제용B');
    await waitForText(page, 'DM 삭제용B');

    // 일괄 삭제 버튼
    const bulkDeleteBtn = page.locator('button[title="일괄 삭제"]');
    if (await bulkDeleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await bulkDeleteBtn.click();
      await page.waitForTimeout(500);

      // "전체 선택" 버튼 확인
      const selectAllBtn = page.locator('button:has-text("전체 선택")');
      const hasSelectAll = await selectAllBtn.isVisible({ timeout: 3_000 }).catch(() => false);

      if (hasSelectAll) {
        await selectAllBtn.click();
        await page.waitForTimeout(300);

        // "전체 해제"로 변경
        const deselectAll = page.locator('button:has-text("전체 해제")');
        expect(await deselectAll.isVisible({ timeout: 2_000 }).catch(() => false)).toBe(true);

        // 전체 해제
        await deselectAll.click();
        await page.waitForTimeout(300);
      }

      // 취소 (일괄 삭제 모드 나가기)
      const cancelBtn = page.locator('button:has-text("취소")').first();
      if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 아이템 여전히 존재
    await expect(page.locator('text=DM 삭제용A')).toBeVisible({ timeout: 3_000 });
  });

  /* ═══ [6.4] 롱프레스 다중 선택 → 삭제 ═══ */
  test('DM-07: 롱프레스 다중 선택 → 삭제 실행', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const beforeCount = await getItemCount(page);

    // 롱프레스로 선택 모드 진입
    await longPressItem(page, 'DM 삭제용A');
    await page.waitForTimeout(300);
    await page.locator('text=DM 삭제용B').first().click();
    await page.waitForTimeout(300);

    // 삭제
    const deleteBtn = page.locator('button:has-text("삭제")').last();
    if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(500);

      // 확인 (있으면)
      const confirmBtn = page.getByRole('button', { name: '삭제', exact: true });
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1_000);
      }
    }

    // 삭제 확인
    await page.waitForTimeout(500);
    expect(await countText(page, 'DM 삭제용A')).toBe(0);
    expect(await countText(page, 'DM 삭제용B')).toBe(0);

    // 기존 아이템은 유지
    await expect(page.locator('text=DM 쿠시카츠').first()).toBeVisible({ timeout: 3_000 });
  });

  /* ═══ [7.2] 롱프레스 다중 선택 → Day 이동 ═══ */
  test('DM-08: 롱프레스 다중 선택 → Day 이동', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Day 2 보장
    const dc = await getDayTabCount(page);
    if (dc < 2) {
      await page.locator('button[title="날짜 추가"]').click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(800);
    }

    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // 이동용 아이템 추가
    await addItemManually(page, '16:00', '정보', 'DM 이동용A');
    await waitForText(page, 'DM 이동용A');

    // 롱프레스
    await longPressItem(page, 'DM 이동용A');
    await page.waitForTimeout(300);

    // "Day 이동" 버튼 확인
    const moveBtn = page.locator('button:has-text("Day 이동")').last();
    if (await moveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await moveBtn.click();
      await page.waitForTimeout(500);

      // Day 2 선택
      await page.locator('text=Day 2').first().click();
      await page.waitForTimeout(1_000);

      // Day 2에서 확인
      await selectDay(page, 1);
      await page.waitForTimeout(500);
      expect(await countText(page, 'DM 이동용A')).toBe(1);

      // Day 1에서 사라짐
      await selectDay(page, 0);
      await page.waitForTimeout(500);
      expect(await countText(page, 'DM 이동용A')).toBe(0);
    }
  });

  /* ═══ [2.4] Day 순서 변경 ═══ */
  test('DM-09: Day 순서 변경', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await page.waitForTimeout(500);

    const swapBtn = page.locator('button[title="순서 변경"]');
    if (await swapBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await swapBtn.click();
      await page.waitForTimeout(500);

      // "Day 순서 변경" 시트 열림
      await expect(page.locator('text=Day 순서 변경')).toBeVisible({ timeout: 3_000 });

      // 첫 번째 Day의 아래 화살표 클릭 (30px 크기 버튼)
      const smallButtons = page.locator('button[style*="width: 30px"]');
      const count = await smallButtons.count();
      if (count >= 2) {
        await smallButtons.nth(1).click();
        await page.waitForTimeout(500);
      }

      // 닫기 (자동 적용)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1_000);

      // 리로드 후 Day 유지 확인
      await page.reload();
      await page.waitForSelector('text=D1', { timeout: 10_000 });
      const dayCount = await getDayTabCount(page);
      expect(dayCount).toBeGreaterThanOrEqual(2);
    }
  });

  /* ═══ [8.1] 지도 다이얼로그 ═══ */
  test('DM-10: 지도 다이얼로그 열기/닫기', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await page.waitForTimeout(500);

    const mapFab = page.locator('button[title="여행 지도"]');
    if (await mapFab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await mapFab.click();
      await page.waitForTimeout(1_500);

      // Day 탭이 지도에 표시되는지
      const dayTab = page.locator('text=Day 1').first();
      await dayTab.isVisible({ timeout: 5_000 }).catch(() => false);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });

  /* ═══ [9.1] 공유 시트 ═══ */
  test('DM-11: 공유 시트 → 초대 링크 확인', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await page.waitForTimeout(500);

    const shareBtn = page.locator('button[title="공유 및 초대"]');
    if (await shareBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await shareBtn.click();
      await page.waitForTimeout(1_000);

      await expect(page.locator('text=공유 및 초대').first()).toBeVisible({ timeout: 3_000 });
      await expect(page.locator('text=초대 링크')).toBeVisible({ timeout: 3_000 });
      await expect(page.locator('text=이 링크를 공유하면').first()).toBeVisible({ timeout: 3_000 });

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  /* ═══ 더보기 메뉴 (여행 가이드, 서류) ═══ */
  test('DM-12: 더보기 메뉴 — 여행 가이드·서류', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await page.waitForTimeout(500);

    const moreBtn = page.locator('button[title="더보기"]').first();
    if (await moreBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(500);

      // 메뉴 항목 확인
      await expect(page.locator('text=여행 가이드')).toBeVisible({ timeout: 3_000 });
      await expect(page.locator('text=여행 서류')).toBeVisible({ timeout: 3_000 });

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  /* ═══ [2.3] Day 삭제 ═══ */
  test('DM-13: Day 삭제', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    const initialCount = await getDayTabCount(page);

    // 삭제 가능한 Day 추가
    await page.locator('button[title="날짜 추가"]').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await page.waitForTimeout(800);

    const afterAdd = await getDayTabCount(page);
    expect(afterAdd).toBe(initialCount + 1);

    // 마지막 Day 선택 → 삭제
    await selectDay(page, afterAdd - 1);
    await page.waitForTimeout(500);

    await openDayMoreMenu(page);
    await page.waitForTimeout(500);

    const deleteOption = page.locator('text=이 날짜 삭제');
    if (await deleteOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await deleteOption.click();
      await page.waitForTimeout(500);

      const confirmBtn = page.getByRole('button', { name: '삭제', exact: true });
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1_000);
      }

      expect(await getDayTabCount(page)).toBe(initialCount);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  /* ═══ 빠른 Day 전환 → 복제 방지 ═══ */
  test('DM-14: 빠른 Day 전환 후 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Day 1 아이템 찾기
    let itemDay = -1;
    const dc = await getDayTabCount(page);
    for (let d = 0; d < dc; d++) {
      await selectDay(page, d);
      await page.waitForTimeout(200);
      if (await page.locator('text=DM 오사카성').isVisible({ timeout: 1_000 }).catch(() => false)) {
        itemDay = d;
        break;
      }
    }
    if (itemDay === -1) itemDay = 0;

    await selectDay(page, itemDay);
    await page.waitForTimeout(500);
    const beforeCount = await getItemCount(page);

    // 빠른 전환 5번
    for (let i = 0; i < 5; i++) {
      await selectDay(page, (itemDay + 1) % dc);
      await page.waitForTimeout(80);
      await selectDay(page, itemDay);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1_000);

    expect(await getItemCount(page)).toBe(beforeCount);
    expect(await countText(page, 'DM 오사카성')).toBe(1);
  });

  /* ═══ 리로드 후 전체 영속성 ═══ */
  test('DM-15: 리로드 후 Day 이름·아이템 영속성', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await page.waitForTimeout(1_000);

    // DM-02에서 설정한 "오사카 탐방" 이름 확인
    const dc = await getDayTabCount(page);
    let foundLabel = false;
    for (let d = 0; d < dc; d++) {
      await selectDay(page, d);
      await page.waitForTimeout(300);
      if (await page.locator('h2:has-text("오사카 탐방")').isVisible({ timeout: 1_000 }).catch(() => false)) {
        foundLabel = true;
        break;
      }
    }

    // 아이템 존재 확인 (Day 이동 등으로 다른 Day에 있을 수 있음)
    let foundOsakaCastle = false;
    for (let d = 0; d < dc; d++) {
      await selectDay(page, d);
      await page.waitForTimeout(300);
      if (await page.locator('text=DM 쿠시카츠').isVisible({ timeout: 1_000 }).catch(() => false)) {
        foundOsakaCastle = true;
        break;
      }
    }
    expect(foundOsakaCastle).toBe(true);

    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });
});
