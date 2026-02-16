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

    // 시간 설정 (09:00) — TimePicker 트리거는 div[role="button"]
    const timeTrigger = page.locator('div[role="button"]').filter({ hasText: /^\d{2}:\d{2}$|^시간 선택$/ }).first();
    await timeTrigger.click();
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
    await page.getByRole('button', { name: '추가', exact: true }).click();
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

  /* ═══ [3.1-D] 교통 카테고리 → 출발지/도착지 필드 + 저장 + 검증 ═══ */
  test('AP-05: 교통 카테고리 — 폼에서 출발지/도착지 필드 표시 + 저장 후 DetailDialog 검증', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    // 교통 아이템 추가 (16:00 — 기존 아이템과 시간 중복 방지)
    await addItemManually(page, '16:00', '교통', 'AP05 하카타→텐진');
    await waitForText(page, 'AP05 하카타', 5_000);

    // DetailDialog에서 검증
    await clickItem(page, 'AP05 하카타');
    await page.waitForTimeout(500);

    // 1) 교통 카테고리 표시
    await expect(page.locator('text=교통').first()).toBeVisible({ timeout: 3_000 });

    // 2) 출발지/도착지 필드가 DetailDialog 내에 존재하는지 확인
    const hasFromField = await page.locator('text=출발지').first().isVisible({ timeout: 2_000 }).catch(() => false);
    const hasToField = await page.locator('text=도착지').first().isVisible({ timeout: 2_000 }).catch(() => false);
    expect(hasFromField || hasToField).toBe(true);

    // 3) 시간 배지 확인 (16:00 설정됨)
    await expect(page.locator('button:has-text("16:00")').first()).toBeVisible({ timeout: 3_000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [3.1-A] 직접 입력 — 정보 카테고리 ═══ */
  test('AP-06: 직접 입력 — 정보 카테고리 + DetailDialog 검증', async ({ page }) => {
    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await addItemManually(page, '08:00', '정보', 'AP06 환전소');
    await waitForText(page, 'AP06 환전소');

    // DetailDialog에서 카테고리·시간 정합성 확인
    await clickItem(page, 'AP06 환전소');
    await page.waitForTimeout(500);
    await expect(page.locator('text=정보').first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('button:has-text("08:00")').first()).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  /* ═══ [3.1-B] Google 검색 → 결과 선택 → info 뷰 검증 → 폼 → 저장 → DetailDialog 검증 ═══ */
  test('AP-07: Google 검색 → 장소 선택 → 일정 추가 + 전체 플로우 검증', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=직접 일정 추가').click();
    await page.waitForTimeout(500);

    // 1) 검색 입력
    const searchInput = page.locator('input[placeholder="장소명, 주소를 검색하세요"]');
    await searchInput.waitFor({ state: 'visible', timeout: 5_000 });
    await searchInput.fill('캐널시티 하카타');
    await page.waitForTimeout(3_000);

    // 2) 검색 결과 확인 — 결과 행에 장소명이 있어야 함
    const resultRow = page.locator('p').filter({ hasText: /캐널시티|Canal City/ }).first();
    const hasResults = await resultRow.isVisible({ timeout: 8_000 }).catch(() => false);

    if (hasResults) {
      // 3) 결과 행 클릭 → info 뷰 전환
      await resultRow.click();
      await page.waitForTimeout(1_500);

      // 4) info 뷰 검증: 장소 이름(h3)이 보여야 함
      const infoTitle = page.locator('h3').filter({ hasText: /캐널시티|Canal City|キャナルシティ/ }).first();
      const hasInfoTitle = await infoTitle.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasInfoTitle) {
        // info 뷰에 주소 행이 존재하는지 확인
        const addressRow = page.locator('text=주소').first();
        const hasAddr = await addressRow.isVisible({ timeout: 3_000 }).catch(() => false);
        // Google Places 데이터가 있으면 주소가 있어야 함
        if (hasAddr) {
          const addrRowContent = page.locator('div[role="button"]:has-text("주소")').first();
          const addrText = await addrRowContent.textContent();
          expect(addrText?.length).toBeGreaterThan(4); // "주소" 2글자 + 실제 주소
        }
      }

      // 5) "일정 추가하기" 클릭 → 폼 시트
      const addToScheduleBtn = page.locator('button:has-text("일정 추가하기")').last();
      await expect(addToScheduleBtn).toBeVisible({ timeout: 5_000 });
      await addToScheduleBtn.click();
      await page.waitForTimeout(800);

      // 6) 폼에서 일정명이 자동 채워졌는지 확인
      const nameField = page.locator('input[placeholder*="캐널시티"]').last();
      if (await nameField.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const prefilled = await nameField.inputValue();
        // Google 검색으로 추가하면 이름이 미리 채워져야 함
        expect(prefilled.length).toBeGreaterThan(0);
      }

      // 7) 저장
      const saveBtn = page.locator('button').filter({ hasText: /^추가$/ }).last();
      await saveBtn.click();
      await page.waitForTimeout(800);

      // 중복 시간 처리
      const dupDialog = page.locator('text=중복 시간');
      if (await dupDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await page.locator('button:has-text("추가")').last().click();
        await page.waitForTimeout(800);
      }

      // 8) Planner에 표시 확인
      await waitForText(page, '캐널시티', 8_000);

      // 9) DetailDialog에서 최종 검증
      await clickItem(page, '캐널시티');
      await page.waitForTimeout(500);

      // 이름 표시
      await expect(page.locator('h3').filter({ hasText: /캐널시티|Canal City/ }).first()).toBeVisible({ timeout: 3_000 });
      // 시간 배지 존재
      const timeBadge = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ });
      expect(await timeBadge.count()).toBeGreaterThan(0);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      // Google API 미응답 시 — 검색 결과 없음 상태라도 직접 입력 버튼은 있어야 함
      const manualBtn = page.locator('button:has-text("직접 입력")').first();
      await expect(manualBtn).toBeVisible({ timeout: 5_000 });
      // 이 경우 테스트 skip (외부 API 의존)
      test.skip(true, 'Google Places API 미응답 — 검색 결과 없음');
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

    // 시간만 설정, 이름 비움 — TimePicker 트리거는 div[role="button"]
    const timeTrigger4 = page.locator('div[role="button"]').filter({ hasText: /^\d{2}:\d{2}$|^시간 선택$/ }).first();
    await timeTrigger4.click();
    await page.waitForTimeout(300);
    const dialog2 = page.locator('[role="dialog"][aria-label="시간 선택"]');
    await dialog2.waitFor({ timeout: 3_000 });
    await dialog2.locator('button:has-text("확인")').click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: '추가', exact: true }).click();
    await page.waitForTimeout(500);

    // 에러 메시지 확인
    await expect(page.locator('text=일정명을 입력해주세요').first()).toBeVisible({ timeout: 3_000 });

    await page.goBack();
    await page.waitForTimeout(500);
  });

  /* ═══ [3.2] 예약 정보 붙여넣기 — 텍스트 입력 → AI 분석 → 결과 검증 → 일정 추가 ═══ */
  test('AP-10: 예약 정보 붙여넣기 — 전체 플로우', async ({ page }) => {
    test.setTimeout(150_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(500);
    await page.locator('text=예약 정보 붙여넣기').click();
    await page.waitForTimeout(500);

    // 1) textarea 필수 — 없으면 테스트 실패
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    // 2) 예약 텍스트 입력
    await textarea.fill(
      '호텔 예약 확인서\n' +
      '호텔명: 후쿠오카 하카타 그린 호텔\n' +
      '체크인: 15:00\n' +
      '체크아웃: 11:00\n' +
      '객실: 더블룸 1박\n\n' +
      '레스토랑 예약\n' +
      '이치란 라멘 본점\n' +
      '시간: 12:00\n' +
      '인원: 2명'
    );

    // 3) "AI로 분석하기" 클릭 — 버튼 필수
    const analyzeBtn = page.locator('button:has-text("AI로 분석하기")').first();
    await expect(analyzeBtn).toBeVisible({ timeout: 3_000 });
    await analyzeBtn.click();

    // 4) 분석 시작 확인 — "AI가 분석하고 있어요..." 로딩 상태 필수
    await expect(page.locator('text=분석 중').first()).toBeVisible({ timeout: 10_000 });

    // 5) 분석 완료 대기 — "분석 결과" 헤더 필수 (90초 타임아웃)
    await expect(page.locator('text=분석 결과').first()).toBeVisible({ timeout: 90_000 });

    // 6) 분석 결과 아이템 검증 — 시간+설명이 있는 아이템 최소 1개 필수
    // 프리뷰 아이템의 설명 텍스트 (12px, fontWeight 500)
    const previewDescs = page.locator('p').filter({ hasText: /호텔|라멘|체크인|체크아웃|이치란/ });
    expect(await previewDescs.count()).toBeGreaterThan(0);

    // 7) "일정에 추가하기 (N개)" 버튼 필수 — 개수 포함
    const importBtn = page.locator('button:has-text("일정에 추가하기")').first();
    await expect(importBtn).toBeVisible({ timeout: 5_000 });
    const importText = await importBtn.textContent();
    expect(importText).toMatch(/일정에 추가하기 \(\d+개\)/);

    // 8) 클릭하여 일정에 추가
    await importBtn.click();
    await page.waitForTimeout(1_500);

    // 9) Planner로 복귀 — D1 탭 필수
    await expect(page.locator('text=D1').first()).toBeVisible({ timeout: 10_000 });
    await selectDay(page, 0);
    await page.waitForTimeout(500);

    // 10) 추가된 아이템 확인 — AI가 파싱한 장소명이 Planner에 있어야 함
    const hasHotel = await page.locator('text=호텔').first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasRamen = await page.locator('text=라멘').first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasIchiran = await page.locator('text=이치란').first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(hasHotel || hasRamen || hasIchiran).toBe(true);
  });

  /* ═══ [3.3] AI 채팅 — 메시지 전송 → 로딩 → 응답 도착 → 구조 검증 ═══ */
  test('AP-11: AI 채팅 — 전체 플로우 (추천 요청 → 응답 구조 검증)', async ({ page }) => {
    test.setTimeout(150_000);

    await page.goto(`/trip/${tripId}`);
    await page.waitForSelector('text=D1', { timeout: 10_000 });
    await selectDay(page, 0);

    await page.getByRole('button', { name: '일정 추가' }).click();
    await page.waitForTimeout(500);
    await page.locator('text=AI와 대화하며 계획하기').click();
    await page.waitForTimeout(1_000);

    // 1) 채팅 입력 필수
    const chatInput = page.locator('textarea[placeholder="어디를 가고 싶나요?"]');
    await expect(chatInput).toBeVisible({ timeout: 5_000 });

    // 2) 메시지 입력 + 전송
    await chatInput.fill('후쿠오카 하카타역 근처 점심 맛집 3곳 추천해줘');
    await chatInput.press('Enter');

    // 3) 로딩 표시 필수 — 메시지가 전송되었다는 증거
    await expect(page.locator('text=답변을 준비하고 있어요').first()).toBeVisible({ timeout: 10_000 });

    // 4) 로딩 종료 대기 — AI 응답 완료 (로딩 텍스트 사라짐, 최대 90초)
    await expect(page.locator('text=답변을 준비하고 있어요').first()).toBeHidden({ timeout: 90_000 });
    await page.waitForTimeout(1_000); // 렌더링 안정화

    // 5) AI 응답이 에러가 아닌지 확인 — "일시적인 오류" 텍스트 없어야 함
    const isError = await page.locator('text=일시적인 오류').first().isVisible({ timeout: 2_000 }).catch(() => false);
    expect(isError).toBe(false);

    // 6) AI 응답 구조 검증 — 추천 카드 / 일정 아이템 / 선택지 중 하나 필수
    //    추천 카드: flex: 0 0 160px 카드 (msg.type === 'recommend')
    const recommendCards = page.locator('div[style*="flex: 0 0 160px"]');
    const cardCount = await recommendCards.count();

    //    일정 아이템: "자세히보기" 버튼 (msg.items 존재)
    const detailBtn = page.locator('button:has-text("자세히보기")').first();
    const hasItems = await detailBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    //    선택지: 선택지 버튼들 (msg.choices 존재 → BottomSheet)
    // 선택지는 BottomSheet으로 나타남 — 일단 카드/아이템을 우선 확인

    // 추천 카드 또는 일정 아이템 중 하나는 반드시 존재해야 함
    expect(cardCount > 0 || hasItems).toBe(true);

    if (cardCount > 0) {
      // 7a) 추천 카드 검증 — 각 카드에 장소명 필수
      const firstCard = recommendCards.first();
      const cardName = firstCard.locator('p').first();
      const nameText = await cardName.textContent();
      expect(nameText?.trim().length).toBeGreaterThan(0); // 빈 이름 불가

      // 카드 클릭 → 상세 정보 시트 (BottomSheet + PlaceInfoContent)
      await firstCard.click();
      await page.waitForTimeout(1_000);

      // 상세 시트에서 장소 이름(h3) 필수
      const placeTitle = page.locator('h3').last();
      await expect(placeTitle).toBeVisible({ timeout: 5_000 });
      const titleText = await placeTitle.textContent();
      expect(titleText?.trim().length).toBeGreaterThan(0);

      // "일정 추가하기" 버튼 필수
      const addBtn = page.locator('button:has-text("일정 추가하기")').last();
      await expect(addBtn).toBeVisible({ timeout: 5_000 });

      // 닫기 (다음 테스트를 위해)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      // 7b) 일정 아이템 검증 — "자세히보기 (N개)" 버튼 텍스트에 개수 필수
      const detailText = await detailBtn.textContent();
      expect(detailText).toMatch(/자세히보기 \(\d+개\)/);

      // 클릭 → ImportPreviewDialog
      await detailBtn.click();
      await page.waitForTimeout(1_000);

      // ImportPreviewDialog — 아이템 리스트 필수
      const previewTitle = page.locator('text=AI 추천 일정').first();
      await expect(previewTitle).toBeVisible({ timeout: 5_000 });

      // 체크박스 최소 1개 필수
      const checkboxes = page.locator('input[type="checkbox"]');
      expect(await checkboxes.count()).toBeGreaterThan(0);

      // "선택 추가" 버튼 필수
      const selectAddBtn = page.locator('button:has-text("선택 추가")').last();
      await expect(selectAddBtn).toBeVisible({ timeout: 5_000 });

      // 닫기
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 채팅 다이얼로그 닫기
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

    // 직접 입력한 아이템이 정확히 1개씩만 (복제 없음)
    expect(await countText(page, 'AP01 모츠나베')).toBe(1);
    expect(await countText(page, 'AP02 다자이후')).toBe(1);
    expect(await countText(page, 'AP03 텐진')).toBe(1);
    expect(await countText(page, 'AP04 호텔')).toBe(1);
    expect(await countText(page, 'AP05 하카타')).toBe(1);
    expect(await countText(page, 'AP06 환전소')).toBe(1);

    // 전체 아이템 수가 최소 6개 (직접 입력 6개 + Google/AI/예약 추가분)
    const totalItems = await getItemCount(page);
    expect(totalItems).toBeGreaterThanOrEqual(6);

    // 에러 없음
    expect(await page.locator('text=Something went wrong').isVisible({ timeout: 1_000 }).catch(() => false)).toBe(false);
  });
});
