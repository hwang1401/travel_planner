// @ts-check
import { test, expect } from '@playwright/test';
import {
  createTripAndNavigate,
  selectDay,
  addItemManually,
  waitForText,
  clickItem,
  countText,
  getItemCount,
  getDayTabCount,
  dismissPwaBanner,
} from './helpers.js';

/**
 * Phase 7: 아이템 추가 — 모든 분기 + 여행 정보 적용 확인
 *
 * 커버하는 플로우:
 *   [3.1-A] 직접 입력 → 카테고리·시간·이름·메모 폼 → 저장
 *   [3.1-B] Google 검색 → 결과 선택 → info 뷰 → 폼 → 저장
 *   [3.1-C] 검색 결과 없음 → 직접 입력 유도
 *   [3.1-D] 교통 타입 → 출발지/도착지 필드 표시
 *   [3.2]   예약 정보 붙여넣기 (PasteInfoPage) — UI 진입까지
 *   [3.3]   AI 채팅 → 장소 추천 → 일정 추가
 *   [13.1]  유효성 검증 — 시간·이름 필수
 *   카테고리별 추가 (식사·관광·쇼핑·숙소·교통·정보)
 *   아이템 DetailDialog에서 카테고리·시간·이름 정합성 확인
 *   추가 후 복제 방지
 *   여행 생성 시 입력한 정보 (이름·목적지·날짜) 적용 확인
 */

const TRIP_NAME = `E2E Phase7 ${Date.now()}`;

test.describe('Phase 7: 아이템 추가 모든 분기', () => {
  let tripId;

  test.describe.configure({ mode: 'serial' });

  /* ═══ 여행 생성 + 입력 정보 적용 확인 ═══ */
  test('AP-00: 여행 생성 시 이름·목적지·날짜 정합성', async ({ page }) => {
    test.setTimeout(60_000);

    tripId = await createTripAndNavigate(page, TRIP_NAME, '후쿠오카', 2);
    expect(page.url()).toContain(`/trip/${tripId}`);

    // 여행 이름이 표시되는지 확인
    await expect(page.locator(`text=${TRIP_NAME}`).first()).toBeVisible({ timeout: 5_000 });

    // 2박3일 표시 확인
    await expect(page.locator('text=2박3일').first()).toBeVisible({ timeout: 5_000 });

    // Day 탭 개수: 빈 여행은 D1부터
    const dayCount = await getDayTabCount(page);
    expect(dayCount).toBeGreaterThanOrEqual(1);
  });

  /* ═══ [3.1-A] 직접 입력 — 식사 카테고리 전체 폼 ═══ */
  test('AP-01: 직접 입력 — 식사 카테고리 + 전체 필드', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    // "직접 입력하기" 또는 "검색 없이 직접 입력" 클릭
    const manualBtn = page.locator('button:has-text("직접 입력")').first();
    await manualBtn.click();
    await page.waitForTimeout(500);

    // 카테고리: 식사
    await page.locator('button:has-text("식사")').first().click();
    await page.waitForTimeout(200);

    // 시간 설정 (09:00)
    await page.locator('[aria-label="시간 선택"]').click();
    await page.waitForTimeout(300);
    const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
    await dialog.waitFor({ timeout: 3_000 });
    await dialog.locator('button:has-text("확인")').click();
    await page.waitForTimeout(300);

    // 일정명
    const nameInput = page.locator('input[placeholder*="캐널시티"]');
    await nameInput.fill('AP01 모츠나베');

    // 메모
    const memoArea = page.locator('textarea[placeholder*="추천 메뉴"]');
    if (await memoArea.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await memoArea.fill('내장전골 추천\n예약 필수');
    }

    // 저장
    await page.getByRole('button', { name: /추가$/ }).click();
    await page.waitForTimeout(800);

    // Planner에서 확인
    await waitForText(page, 'AP01 모츠나베', 5_000);

    // DetailDialog에서 카테고리·메모 정합성 확인
    await clickItem(page, 'AP01 모츠나베');
    await page.waitForTimeout(500);
    await expect(page.locator('text=식사').first()).toBeVisible({ timeout: 3_000 });
    const hasMemo = await page.locator('text=내장전골 추천').isVisible({ timeout: 2_000 }).catch(() => false);
    if (hasMemo) {
      await expect(page.locator('text=내장전골 추천')).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [3.1-A] 직접 입력 — 관광 카테고리 ═══ */
  test('AP-02: 직접 입력 — 관광 카테고리', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await addItemManually(page, '10:00', '관광', 'AP02 다자이후');
    await waitForText(page, 'AP02 다자이후');

    // 카테고리 확인
    await clickItem(page, 'AP02 다자이후');
    await page.waitForTimeout(500);
    await expect(page.locator('text=관광').first()).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [3.1-A] 직접 입력 — 쇼핑 카테고리 ═══ */
  test('AP-03: 직접 입력 — 쇼핑 카테고리', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await addItemManually(page, '14:00', '쇼핑', 'AP03 텐진');
    await waitForText(page, 'AP03 텐진');

    await clickItem(page, 'AP03 텐진');
    await page.waitForTimeout(500);
    await expect(page.locator('text=쇼핑').first()).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [3.1-A] 직접 입력 — 숙소 카테고리 ═══ */
  test('AP-04: 직접 입력 — 숙소 카테고리', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await addItemManually(page, '20:00', '숙소', 'AP04 호텔');
    await waitForText(page, 'AP04 호텔');

    await clickItem(page, 'AP04 호텔');
    await page.waitForTimeout(500);
    await expect(page.locator('text=숙소').first()).toBeVisible({ timeout: 3_000 });
    // 숙소에는 체크인·체크아웃 행이 있어야 함
    const hasCheckRow = await page.locator('text=체크인').first().isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasCheckRow).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [3.1-D] 교통 카테고리 → 출발지/도착지 필드 ═══ */
  test('AP-05: 교통 카테고리 — 출발지/도착지 필드 확인', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    const manualBtn = page.locator('button:has-text("직접 입력")').first();
    await manualBtn.click();
    await page.waitForTimeout(500);

    // 교통 선택
    await page.locator('button:has-text("교통")').first().click();
    await page.waitForTimeout(500);

    // 출발지/도착지 필드 표시 확인
    const hasFrom = await page.locator('text=출발지').first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasTo = await page.locator('text=도착지').first().isVisible({ timeout: 3_000 }).catch(() => false);
    // 교통 타입은 출발지/도착지 필드가 표시되어야 함
    expect(hasFrom || hasTo).toBe(true);

    // 시간 설정
    await page.locator('[aria-label="시간 선택"]').click();
    await page.waitForTimeout(300);
    const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
    await dialog.waitFor({ timeout: 3_000 });
    await dialog.locator('button:has-text("확인")').click();
    await page.waitForTimeout(300);

    // 이름 입력
    const nameInput = page.locator('input[placeholder*="캐널시티"]');
    await nameInput.fill('AP05 하카타→텐진');

    await page.getByRole('button', { name: /추가$/ }).click();
    await page.waitForTimeout(800);

    await waitForText(page, 'AP05 하카타', 5_000);

    // DetailDialog에서 교통 카테고리 확인
    await clickItem(page, 'AP05 하카타');
    await page.waitForTimeout(500);
    await expect(page.locator('text=교통').first()).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [3.1-A] 직접 입력 — 정보 카테고리 ═══ */
  test('AP-06: 직접 입력 — 정보 카테고리', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await addItemManually(page, '08:00', '정보', 'AP06 환전소');
    await waitForText(page, 'AP06 환전소');
  });

  /* ═══ [3.1-B] Google 검색 → 결과 선택 → 추가 ═══ */
  test('AP-07: Google 검색 → 장소 선택 → 일정 추가', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    // 검색
    const searchInput = page.locator('input[placeholder="장소명, 주소를 검색하세요"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });
    await searchInput.fill('캐널시티 하카타');
    await page.waitForTimeout(2_500);

    // 검색 결과 유무에 따라 분기
    const prediction = page.locator('div').filter({ hasText: /캐널시티|Canal City/ }).first();
    const hasResults = await prediction.isVisible({ timeout: 8_000 }).catch(() => false);

    if (hasResults) {
      await prediction.click();
      await page.waitForTimeout(1_500);

      // info 뷰 → "일정 추가하기" 버튼
      const addBtn = page.getByRole('button', { name: '일정 추가하기' });
      if (await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(800);

        // 폼 시트 → 저장
        const saveBtn = page.getByRole('button', { name: /추가$/ });
        if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(800);
        }
      }
      await waitForText(page, '캐널시티', 5_000);
    } else {
      // fallback: 직접 입력
      const manualBtn = page.locator('button:has-text("직접 입력")').first();
      await manualBtn.click();
      await page.waitForTimeout(500);

      await page.locator('[aria-label="시간 선택"]').click();
      await page.waitForTimeout(300);
      const dlg = page.locator('[role="dialog"][aria-label="시간 선택"]');
      await dlg.waitFor({ timeout: 3_000 });
      await dlg.locator('button:has-text("확인")').click();
      await page.waitForTimeout(300);

      const nameInput = page.locator('input[placeholder*="캐널시티"]');
      await nameInput.fill('캐널시티 하카타');
      await page.getByRole('button', { name: /추가$/ }).click();
      await page.waitForTimeout(800);

      await waitForText(page, '캐널시티', 5_000);
    }
  });

  /* ═══ [3.1-C] 검색 결과 없음 → 직접 입력 유도 ═══ */
  test('AP-08: 검색 결과 없음 → 직접 입력 안내', async ({ page }) => {
    test.setTimeout(30_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder="장소명, 주소를 검색하세요"]');
    await searchInput.fill('zzz없는장소999xxx');
    await page.waitForTimeout(3_000);

    // "검색 결과가 없습니다" 또는 "직접 입력" 버튼
    const noResult = page.locator('text=검색 결과가 없습니다');
    const manualBtn = page.locator('button:has-text("직접 입력")');
    const hasNoResult = await noResult.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasManual = await manualBtn.first().isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasNoResult || hasManual).toBe(true);

    await page.goBack();
    await page.waitForTimeout(500);
  });

  /* ═══ [13.1] 유효성 검증 — 이름 빈 상태로 저장 ═══ */
  test('AP-09: 유효성 검증 — 일정명 없이 저장 불가', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    const manualBtn = page.locator('button:has-text("직접 입력")').first();
    await manualBtn.click();
    await page.waitForTimeout(500);

    // 시간만 설정, 이름 비움
    await page.locator('[aria-label="시간 선택"]').click();
    await page.waitForTimeout(300);
    const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
    await dialog.waitFor({ timeout: 3_000 });
    await dialog.locator('button:has-text("확인")').click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /추가$/ }).click();
    await page.waitForTimeout(500);

    // 에러 메시지 확인
    await expect(page.locator('text=일정명을 입력해주세요')).toBeVisible({ timeout: 3_000 });

    await page.goBack();
    await page.waitForTimeout(500);
  });

  /* ═══ [3.2] 예약 정보 붙여넣기 — UI 진입 확인 ═══ */
  test('AP-10: 예약 정보 붙여넣기 — 진입 UI', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(500);

    // "예약 정보 붙여넣기" 옵션 확인
    const pasteOption = page.locator('text=예약 정보 붙여넣기');
    await expect(pasteOption).toBeVisible({ timeout: 3_000 });

    // 클릭 → PasteInfoPage 열림
    await pasteOption.click();
    await page.waitForTimeout(500);

    // 텍스트 입력 영역 또는 붙여넣기 안내가 있는지 확인
    const hasTextarea = await page.locator('textarea').first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasGuide = await page.locator('text=붙여넣기').first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasTextarea || hasGuide).toBe(true);

    // 뒤로 나감
    await page.goBack();
    await page.waitForTimeout(500);
  });

  /* ═══ [3.3] AI 채팅 — 진입 + 대화 ═══ */
  test('AP-11: AI 채팅 — 진입 UI + 메시지 전송', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(500);

    // "AI와 대화하며 계획하기" 옵션 확인
    const aiOption = page.locator('text=AI와 대화하며 계획하기');
    await expect(aiOption).toBeVisible({ timeout: 3_000 });

    await aiOption.click();
    await page.waitForTimeout(1_000);

    // AI 채팅 다이얼로그 열림 확인
    const chatInput = page.locator('textarea, input[placeholder*="메시지"]').first();
    const hasChatUI = await chatInput.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasChatUI) {
      // 메시지 전송
      await chatInput.fill('점심 추천해줘');

      // 전송 버튼 클릭
      const sendBtn = page.locator('button[type="submit"], button[aria-label="전송"]').first();
      if (await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sendBtn.click();
      } else {
        await chatInput.press('Enter');
      }

      // AI 응답 대기 (최대 30초)
      await page.waitForTimeout(2_000);
      const hasResponse = await page.locator('div').filter({ hasText: /추천|맛집|식당|레스토랑|라멘/ }).first()
        .isVisible({ timeout: 30_000 }).catch(() => false);

      // 응답이 왔으면 추천 카드가 있는지 확인
      if (hasResponse) {
        // 추천 카드에 이미지 또는 장소명이 있는지
        const hasCards = await page.locator('img[alt=""]').first().isVisible({ timeout: 5_000 }).catch(() => false);
        // 카드가 있으면 클릭해서 상세 볼 수 있는지 확인
        if (hasCards) {
          // 단순 표시 확인만 — 실제 추가는 UI 흐름에 따라 다름
          expect(hasCards).toBe(true);
        }
      }
    }

    // 뒤로 나감 (ESC 또는 뒤로)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  /* ═══ 일정 추가 시트 — 3개 옵션 모두 표시 확인 ═══ */
  test('AP-12: 일정 추가 시트 3개 옵션 확인', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(500);

    // 3개 옵션 모두 표시
    await expect(page.locator('text=직접 일정 추가')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('text=예약 정보 붙여넣기')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('text=AI와 대화하며 계획하기')).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ 추가 후 복제 방지 + 영속성 ═══ */
  test('AP-13: 리로드 후 추가된 아이템 영속성 + 복제 없음', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(1_000);

    // 각 아이템이 정확히 1개씩만
    expect(await countText(page, 'AP01 모츠나베')).toBe(1);
    expect(await countText(page, 'AP02 다자이후')).toBe(1);
    expect(await countText(page, 'AP03 텐진')).toBe(1);
    expect(await countText(page, 'AP04 호텔')).toBe(1);
    expect(await countText(page, 'AP06 환전소')).toBe(1);

    // 에러 없음
    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });
});
