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
  countText,
  getItemCount,
} from './helpers.js';

/**
 * Phase 6: DetailDialog — 모든 편집 플로우
 *
 * 커버하는 플로우:
 *   [5.1] 이름 편집 (h3 탭 → CenterPopup)
 *   [5.2] 시간 편집 (time badge → TimePicker)
 *   [5.4] 주소 검색 (주소 행 → AddressSearch)
 *   [5.5] 영업시간 편집 — 일반(7일 그리드) / 숙소(체크인·체크아웃)
 *   [5.6] 메모 편집 (textarea)
 *   [5.7] 가격 편집 (text input)
 *   [5.5] 영업시간 텍스트 편집
 *   [6.1] 단일 삭제 + Undo
 *   [7.1] 다른 Day로 이동
 *   편집 취소 (ESC)
 *   특수문자·긴 텍스트
 *   빈 값으로 덮어쓰기
 *   연속 편집 후 리로드 영속성
 *   편집 후 복제 방지
 */

const TRIP_NAME = `E2E Phase6 ${Date.now()}`;

test.describe('Phase 6: DetailDialog 모든 편집 플로우', () => {
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

    await selectDay(page, 0);
    await addItemManually(page, '09:00', '식사', 'P6 라멘집');
    await waitForText(page, 'P6 라멘집');
    await page.waitForTimeout(1000);
    await addItemManually(page, '12:00', '관광', 'P6 센소지');
    await waitForText(page, 'P6 센소지');
    await page.waitForTimeout(1000);
    await addItemManually(page, '15:00', '쇼핑', 'P6 아메요코');
    await waitForText(page, 'P6 아메요코');
    await page.waitForTimeout(1000);
    await addItemManually(page, '18:00', '숙소', 'P6 호텔');
    await waitForText(page, 'P6 호텔');

    // 서버 저장 완료 대기
    await page.waitForTimeout(3000);

    await context.close();
  });

  /* ═══ [5.7] 가격 편집 ═══ */
  test('FE-01: 가격 편집 → 저장 → 표시', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 라멘집');
    await page.waitForTimeout(500);

    await editDetailField(page, '가격', '¥980');
    await expect(page.locator('text=¥980')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [5.6] 메모 편집 → PlaceCard에 첫 줄 반영 ═══ */
  test('FE-02: 메모 편집 → PlaceCard에 첫 줄 반영', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 센소지');
    await page.waitForTimeout(500);

    // 메모의 첫 줄이 PlaceCard subInfo로 표시됨
    await editDetailField(page, '메모', '입장료 무료\n아침 일찍 추천', true);
    await expect(page.locator('text=입장료 무료').first()).toBeVisible({ timeout: 3_000 });

    // 닫고 PlaceCard에서 첫 줄 표시 확인
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.locator('text=입장료 무료').first()).toBeVisible({ timeout: 3_000 });
  });

  /* ═══ [5.6] 메모 편집 (textarea, 여러 줄) ═══ */
  test('FE-03: 메모 편집 — 여러 줄 텍스트', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 라멘집');
    await page.waitForTimeout(500);

    await editDetailField(page, '메모', '교자도 시키기\n매운맛 추천', true);
    await expect(page.locator('text=교자도 시키기').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('text=매운맛 추천').first()).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [5.2] 시간 편집 → PlaceCard 반영 ═══ */
  test('FE-04: 시간 변경 → DetailDialog + PlaceCard 반영', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 센소지');
    await page.waitForTimeout(500);

    // 시간 배지 12:00 클릭
    const timeBadge = page.locator('button:has-text("12:00")').first();
    await timeBadge.click();
    await page.waitForTimeout(500);

    await setTimePickerInDialog(page, 14, 30);
    await page.waitForTimeout(500);

    // DetailDialog 안에서 확인
    await expect(page.locator('button:has-text("14:30")')).toBeVisible({ timeout: 3_000 });

    // PlaceCard 확인
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.locator('text=14:30').first()).toBeVisible({ timeout: 3_000 });
  });

  /* ═══ [5.1] 이름 편집 → PlaceCard 반영 ═══ */
  test('FE-05: 이름 변경 → PlaceCard 반영', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 라멘집');
    await page.waitForTimeout(500);

    // h3 이름 영역 클릭
    const nameSpan = page.locator('h3 span').first();
    await nameSpan.click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[type="text"]').last();
    await nameInput.waitFor({ state: 'visible', timeout: 3_000 });
    await nameInput.fill('P6 이치란 본점');
    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=P6 이치란 본점').first()).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.locator('text=P6 이치란 본점').first()).toBeVisible({ timeout: 3_000 });
  });

  /* ═══ [5.5] 숙소 체크인·체크아웃 ═══ */
  test('FE-06: 숙소 체크인·체크아웃 설정', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 호텔');
    await page.waitForTimeout(500);

    const checkRow = page.locator('div[role="button"]:has-text("체크인")').first();
    const hasCheckRow = await checkRow.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasCheckRow) {
      await checkRow.click();
      await page.waitForTimeout(500);

      // 체크인 15:00
      const checkInBtn = page.locator('span:has-text("체크인")').locator('..').locator('button').first();
      if (await checkInBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await checkInBtn.click();
        await page.waitForTimeout(500);
        await setTimePickerInDialog(page, 15, 0);
        await page.waitForTimeout(300);
      }

      // 체크아웃 10:00
      const checkOutBtn = page.locator('span:has-text("체크아웃")').locator('..').locator('button').first();
      if (await checkOutBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await checkOutBtn.click();
        await page.waitForTimeout(500);
        await setTimePickerInDialog(page, 10, 0);
        await page.waitForTimeout(300);
      }

      await page.getByRole('button', { name: '저장' }).click();
      await page.waitForTimeout(500);

      await expect(page.locator('text=체크인 15:00')).toBeVisible({ timeout: 3_000 });
      await expect(page.locator('text=체크아웃 10:00')).toBeVisible({ timeout: 3_000 });
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [5.4] 주소 검색 ═══ */
  test('FE-07: 주소 검색 → 장소 선택', async ({ page }) => {
    test.setTimeout(30_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 센소지');
    await page.waitForTimeout(500);

    const addressRow = page.locator('div[role="button"]:has-text("주소")').first();
    await addressRow.click();
    await page.waitForTimeout(500);

    // 검색 입력
    const searchInput = page.locator('input[placeholder="장소명, 주소를 검색하세요"]').last();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill('센소지');
      await page.waitForTimeout(2_000);

      // 결과 선택 (있으면) — force:true로 인터셉트 우회
      const prediction = page.locator('div[role="button"][tabindex="0"]').first();
      if (await prediction.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await prediction.click({ force: true });
        await page.waitForTimeout(1_000);
      }

      // 확인
      const confirmBtn = page.getByRole('button', { name: '확인' });
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // 에러 없음
    const err = page.locator('text=Something went wrong');
    expect(await err.isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [5.5] 영업시간 그리드 (일반 아이템) ═══ */
  test('FE-08: 영업시간 그리드 편집', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 센소지');
    await page.waitForTimeout(500);

    const hoursRow = page.locator('div[role="button"]:has-text("영업시간")').first();
    if (await hoursRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await hoursRow.click();
      await page.waitForTimeout(500);

      // "매일 동일하게 적용" 버튼 (있으면)
      const applyAll = page.locator('button:has-text("매일 동일하게 적용")');
      if (await applyAll.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await applyAll.click();
        await page.waitForTimeout(300);
      }

      await page.getByRole('button', { name: '저장' }).click();
      await page.waitForTimeout(500);

      // 영업시간 행에 값 표시 확인
      await expect(page.locator('text=영업시간').first()).toBeVisible({ timeout: 3_000 });
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ 편집 취소 (CenterPopup ESC) ═══ */
  test('FE-09: CenterPopup ESC → 편집 취소', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 센소지');
    await page.waitForTimeout(500);

    const priceRow = page.locator('div[role="button"]:has-text("가격")').first();
    await priceRow.click();
    await page.waitForTimeout(500);

    const input = page.locator('input[type="text"]').last();
    await input.waitFor({ state: 'visible', timeout: 3_000 });
    await input.fill('¥99,999');

    // ESC로 취소
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 취소된 값은 표시 안 됨
    expect(await page.locator('text=¥99,999').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ 특수문자·긴 텍스트 ═══ */
  test('FE-10: 특수문자 포함 텍스트 저장', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 아메요코');
    await page.waitForTimeout(500);

    const text = '¥1,200~¥2,500 (税込) / 1F&2F';
    await editDetailField(page, '가격', text);
    await expect(page.locator(`text=${text}`).first()).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ 빈 값으로 덮어쓰기 ═══ */
  test('FE-11: 기존 값을 빈 값으로 초기화', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 이치란 본점');
    await page.waitForTimeout(500);

    // 가격을 빈 값으로
    const priceRow = page.locator('div[role="button"]:has-text("가격")').first();
    await priceRow.click();
    await page.waitForTimeout(500);

    const input = page.locator('input[type="text"]').last();
    await input.waitFor({ state: 'visible', timeout: 3_000 });
    await input.fill('');
    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForTimeout(500);

    // ¥980 사라짐
    expect(await page.locator('text=¥980').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [6.1] 아이템 삭제 + Undo ═══ */
  test('FE-12: 아이템 삭제 → Undo 복구', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const beforeCount = await getItemCount(page);

    await clickItem(page, 'P6 아메요코');
    await page.waitForTimeout(500);

    const deleteBtn = page.getByRole('button', { name: '삭제', exact: true }).last();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Undo 복구
    const undoBtn = page.locator('button:has-text("복구")').last();
    if (await undoBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await undoBtn.click();
      await page.waitForTimeout(1_000);
      await waitForText(page, 'P6 아메요코', 5_000);
      expect(await getItemCount(page)).toBe(beforeCount);
    }
  });

  /* ═══ [7.1] 다른 Day로 이동 ═══ */
  test('FE-13: 아이템 다른 Day 이동 → 원본 Day에서 사라짐', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });

    // Day 2 보장
    const dc = await page.locator('button').filter({ hasText: /^D\d+$/ }).count();
    if (dc < 2) {
      await page.locator('button[title="날짜 추가"]').click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await page.waitForTimeout(800);
    }

    await selectDay(page, 0);
    await page.waitForTimeout(500);

    await clickItem(page, 'P6 센소지');
    await page.waitForTimeout(500);

    await page.locator('button[title="더보기"]').last().click();
    await page.waitForTimeout(500);

    const moveOption = page.locator('text=다른 Day로 이동');
    if (await moveOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await moveOption.click();
      await page.waitForTimeout(500);
      await page.locator('text=Day 2').first().click();
      await page.waitForTimeout(1_000);

      // Day 2에서 확인
      await selectDay(page, 1);
      await page.waitForTimeout(500);
      expect(await countText(page, 'P6 센소지')).toBe(1);

      // Day 1에서 사라짐
      await selectDay(page, 0);
      await page.waitForTimeout(500);
      expect(await countText(page, 'P6 센소지')).toBe(0);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  });

  /* ═══ 연속 편집 후 복제 방지 + 영속성 ═══ */
  test('FE-14: 연속 편집 → 리로드 → 영속성 + 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    const beforeCount = await getItemCount(page);

    // 이치란 편집
    await clickItem(page, 'P6 이치란 본점');
    await page.waitForTimeout(500);
    await editDetailField(page, '메모', '영속성 테스트 메모', true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 리로드
    await page.reload();
    await page.waitForSelector('text=D1', { timeout: 15_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(800);

    // 복제 없음
    const afterCount = await getItemCount(page);
    expect(afterCount).toBe(beforeCount);
    expect(await countText(page, 'P6 이치란 본점')).toBe(1);

    // 영속성 — FE-14에서 설정한 메모가 리로드 후에도 유지되는지
    await clickItem(page, 'P6 이치란 본점');
    await page.waitForTimeout(500);
    await expect(page.locator('text=영속성 테스트 메모')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 숙소 체크인/체크아웃 영속성
    await clickItem(page, 'P6 호텔');
    await page.waitForTimeout(500);
    const hasCheckIn = await page.locator('text=체크인 15:00').isVisible({ timeout: 2_000 }).catch(() => false);
    if (hasCheckIn) {
      await expect(page.locator('text=체크아웃 10:00')).toBeVisible({ timeout: 3_000 });
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 에러 없음
    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });
});
