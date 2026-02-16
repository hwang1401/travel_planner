// @ts-check
import { expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/* ── Supabase config ── */
const SUPABASE_URL = 'https://rjjfcnstdzwiwpblrxtz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqamZjbnN0ZHp3aXdwYmxyeHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NjMwODEsImV4cCI6MjA4NjAzOTA4MX0.GEByX_BKfSXEVOyuAehrqa9qez_ZI4kDs4SqK0X9sL4';

/* ── User B credentials ── */
const USER_B_EMAIL = 'test01@travelunu.test';
const USER_B_PASSWORD = 'test123';

/**
 * Wait for the app to finish loading (splash screen gone, content visible).
 */
export async function waitForAppReady(page) {
  // Wait for either "내 여행" heading or trip planner to appear
  await page.waitForSelector('h1, h2', { timeout: 15_000 });
}

/**
 * Dismiss the PWA install banner by setting sessionStorage before page load.
 */
export async function dismissPwaBanner(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('pwa-install-dismissed', '1');
  });
}

/**
 * Ensure we're on the home page with trip list loaded.
 */
export async function ensureHomePage(page) {
  // Dismiss PWA install banner to prevent it from intercepting clicks
  await dismissPwaBanner(page);
  await page.goto('/');
  // Wait for "내 여행" heading
  await page.waitForSelector('h1:has-text("내 여행")', { timeout: 15_000 });
  // Wait for loading skeleton to disappear (trip list loaded)
  await page.waitForFunction(() => {
    return !document.querySelector('[style*="shimmer"]');
  }, { timeout: 10_000 }).catch(() => {});
  // Small extra settle time
  await page.waitForTimeout(500);
}

/**
 * Create a trip via the CreateTripWizard and navigate to the planner.
 * @param {import('@playwright/test').Page} page
 * @param {string} name - Trip name
 * @param {string} destination - Destination city
 * @param {number} nights - Number of nights (days = nights + 1)
 * @returns {Promise<string>} tripId
 */
export async function createTripAndNavigate(page, name, destination, nights = 3) {
  await ensureHomePage(page);

  // Click "여행 만들기" FAB or empty state button
  const createBtn = page.getByRole('button', { name: /여행 만들기|첫 여행 만들기/ });
  await createBtn.click();

  // Step 1: Name and destination
  await page.waitForSelector('text=어디로 여행을 떠나시나요?', { timeout: 5_000 });

  // Fill trip name
  const nameField = page.locator('input[placeholder*="후쿠오카"]');
  await nameField.fill(name);

  // Add destination via AddressSearch — type and pick first autocomplete prediction
  const destInput = page.locator('input[placeholder*="도시 또는 장소를 검색"]');
  await destInput.fill(destination);

  // Wait for Google Places autocomplete predictions (400ms debounce + API call)
  // Predictions render as div[role="button"][tabindex="0"] inside the dropdown
  const prediction = page.locator('div[role="button"][tabindex="0"]').first();
  const hasPredictions = await prediction.waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (hasPredictions) {
    await prediction.click();
  } else {
    // Fallback: if Google Places API didn't return results,
    // directly invoke the AddressSearch onChange via React fiber
    await page.evaluate((dest) => {
      const input = document.querySelector('input[placeholder*="도시 또는 장소를 검색"]');
      if (!input) return;
      const fiberKey = Object.keys(input).find(k => k.startsWith('__reactFiber$'));
      if (!fiberKey) return;
      let fiber = input[fiberKey];
      while (fiber) {
        const props = fiber.memoizedProps;
        if (props?.onChange && typeof props.onChange === 'function' && props.placeholder?.includes('도시')) {
          props.onChange(dest, 35.6762, 139.6503);
          return;
        }
        fiber = fiber.return;
      }
    }, destination);
  }

  // Wait for "다음" button to become enabled (canStep1 = name && destinations.length > 0)
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '다음');
    return btn && !btn.disabled;
  }, { timeout: 10_000 });

  // Click 다음
  await page.getByRole('button', { name: '다음' }).click();

  // Step 2: Date selection — pick dates (today + nights)
  await page.waitForSelector('text=언제 출발하시나요?', { timeout: 5_000 });

  // Select start date (today)
  const today = new Date();
  const todayDay = today.getDate();
  // Click today's date cell in the calendar
  await pickCalendarDate(page, todayDay);
  await page.waitForTimeout(300);

  // Select end date
  const endDay = todayDay + nights;
  const endDate = new Date(today);
  endDate.setDate(endDay);
  // If end date is in next month, navigate forward
  if (endDate.getMonth() !== today.getMonth()) {
    await page.locator('button:has(svg)').last().click(); // Next month arrow
    await page.waitForTimeout(300);
    await pickCalendarDate(page, endDate.getDate());
  } else {
    await pickCalendarDate(page, endDay);
  }
  await page.waitForTimeout(300);

  // Click 다음
  await page.getByRole('button', { name: '다음' }).click();

  // Step 3: Skip — "직접 만들기 (빈 여행)"
  await page.waitForSelector('text=어떻게 일정을 채울까요?', { timeout: 5_000 });
  await page.getByRole('button', { name: /직접 만들기/ }).click();

  // Wait for navigation to /trip/{tripId}
  await page.waitForURL(/\/trip\/[a-f0-9-]+/, { timeout: 15_000 });
  const tripId = page.url().split('/trip/')[1];

  // Wait for planner to load
  await page.waitForSelector('text=D1', { timeout: 10_000 });

  return tripId;
}

/**
 * Pick a specific day number in the visible calendar month.
 */
async function pickCalendarDate(page, dayNumber) {
  // Calendar grid cells contain just the day number
  const cells = page.locator('div[style*="grid-template-columns: repeat(7"]  > div');
  const count = await cells.count();
  for (let i = 0; i < count; i++) {
    const text = await cells.nth(i).textContent();
    if (text?.trim() === String(dayNumber)) {
      await cells.nth(i).click();
      return;
    }
  }
  throw new Error(`Calendar day ${dayNumber} not found`);
}

/**
 * Select a Day tab by its display index (0-based).
 */
export async function selectDay(page, dayIndex) {
  const tabButton = page.locator(`button:has-text("D${dayIndex + 1}")`).first();
  await tabButton.click();
  await page.waitForTimeout(300);
}

/**
 * Add an item manually via the AddPlacePage flow.
 * @param {import('@playwright/test').Page} page
 * @param {string} time - "HH:mm" format
 * @param {string} typeLabel - Korean type label like "식사", "관광", "쇼핑", "숙소", "교통"
 * @param {string} name - Item name/description
 */
export async function addItemManually(page, time, typeLabel, name) {
  // Click "일정 추가"
  await page.getByRole('button', { name: '일정 추가' }).click();
  await page.waitForTimeout(300);

  // Click "직접 일정 추가" in the bottom sheet
  await page.locator('text=직접 일정 추가').click();
  await page.waitForTimeout(500);

  // Now in AddPlacePage search mode — click "검색 없이 직접 입력" or "직접 입력하기"
  const manualBtn = page.locator('button:has-text("직접 입력")').first();
  await manualBtn.click();
  await page.waitForTimeout(500);

  // Now in form mode
  // Select type/category
  if (typeLabel) {
    await page.locator(`button:has-text("${typeLabel}")`).first().click();
  }

  // Set time via TimePicker — the trigger is a role="button" div showing default "09:00" or "시간 선택"
  const timeTrigger = page.locator('div[role="button"]').filter({ hasText: /^\d{2}:\d{2}$|^시간 선택$/ }).first();
  await timeTrigger.click();
  await page.waitForTimeout(300);

  // TimePickerDialog wheel — set hour and minute
  const [hour, minute] = time.split(':');
  await setTimePickerValue(page, parseInt(hour), parseInt(minute));

  // Fill item name (일정명)
  const descField = page.locator('input[placeholder*="캐널시티"]');
  await descField.fill(name);

  // Click "추가" button (form submit)
  const addBtn = page.locator('button').filter({ hasText: /^추가$/ }).first();
  await addBtn.click();

  // Wait for AddPlacePage to close (back to planner)
  await page.waitForTimeout(800);
}

/**
 * Set time in the TimePickerDialog scroll wheels.
 * The dialog uses scrollTop-based positioning: each row is 44px.
 * Minutes use step=5: [0,5,10,...,55] so minuteIndex = minute/5.
 */
async function setTimePickerValue(page, hour, minute) {
  const ROW_HEIGHT = 44;
  const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Wait for the time picker dialog
  const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
  await dialog.waitFor({ timeout: 3_000 });

  // Round minute to nearest valid option
  const closestMinute = MINUTE_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - minute) < Math.abs(prev - minute) ? curr : prev
  );
  const minuteIndex = MINUTE_OPTIONS.indexOf(closestMinute);

  // Scroll the hour and minute wheels via JS
  await page.evaluate(({ hourIdx, minIdx, rowH }) => {
    // The dialog has two scroll containers (overflowY: auto) for hours and minutes
    const dlg = document.querySelector('[role="dialog"][aria-label="시간 선택"]');
    if (!dlg) return;
    const scrollers = dlg.querySelectorAll('[style*="overflow"]');
    const scrollContainers = [];
    scrollers.forEach((el) => {
      const style = el.style || window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainers.push(el);
      }
    });
    if (scrollContainers.length >= 2) {
      scrollContainers[0].scrollTop = hourIdx * rowH;
      scrollContainers[1].scrollTop = minIdx * rowH;
      // Trigger scroll events
      scrollContainers[0].dispatchEvent(new Event('scroll'));
      scrollContainers[1].dispatchEvent(new Event('scroll'));
    }
  }, { hourIdx: hour, minIdx: minuteIndex, rowH: ROW_HEIGHT });

  await page.waitForTimeout(300);
  // Click "확인" to confirm time
  const confirmBtn = dialog.locator('button:has-text("확인")');
  await confirmBtn.click();
  await page.waitForTimeout(300);
}

/**
 * Wait for toast to appear with given text (partial match).
 */
export async function expectToast(page, text, timeout = 5_000) {
  // Toast is a fixed-position div at bottom with the message text
  const toast = page.locator(`text=${text}`).first();
  await expect(toast).toBeVisible({ timeout });
}

/**
 * Wait for toast with action button and optionally click it.
 * @returns action button locator
 */
export async function waitForToastAction(page, actionLabel, timeout = 5_000) {
  const actionBtn = page.locator(`button:has-text("${actionLabel}")`).last();
  await expect(actionBtn).toBeVisible({ timeout });
  return actionBtn;
}

/**
 * Get the share code/link for the current trip.
 * Clicks the share button, gets the link from clipboard.
 * @returns {Promise<string>} share code
 */
export async function getShareCode(page) {
  // Click share/invite button in trip header
  await page.locator('button[title="공유 및 초대"]').click();
  await page.waitForTimeout(500);

  // In the share sheet, look for share code or copy link
  // The share flow copies to clipboard — intercept it
  const clipboardText = await page.evaluate(async () => {
    // Read from clipboard (needs permission)
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  });

  // Extract share code from URL
  const match = clipboardText.match(/\/invite\/([a-zA-Z0-9]+)/);
  return match?.[1] || '';
}

/**
 * Get item texts for the currently selected day.
 * @returns {Promise<string[]>} array of item names
 */
export async function getItemTexts(page) {
  await page.waitForTimeout(300);
  // PlaceCard items have desc text in a <p> tag
  const items = page.locator('[style*="gap"] > div > div > p').allTextContents();
  return items;
}

/**
 * Get the count of schedule items on the current day.
 */
export async function getItemCount(page) {
  await page.waitForTimeout(300);
  // Each PlaceCard has a time display + name
  const cards = page.locator('span[style*="width: 38px"], span[style*="width:38px"]');
  return cards.count();
}

/**
 * Count how many times a specific text appears on the page.
 * Useful for duplication detection — expected count is usually 1.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 * @returns {Promise<number>}
 */
export async function countText(page, text) {
  await page.waitForTimeout(300);
  return page.locator(`text=${text}`).count();
}

/**
 * Wait for a specific text to appear on page (realtime sync).
 */
export async function waitForText(page, text, timeout = 8_000) {
  await page.waitForSelector(`text=${text}`, { timeout });
}

/**
 * Wait for text to disappear from page.
 */
export async function waitForTextGone(page, text, timeout = 8_000) {
  await page.waitForSelector(`text=${text}`, { state: 'detached', timeout }).catch(() => {});
}

/**
 * Login User B via Supabase signInWithPassword and create a browser context.
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page}>}
 */
export async function loginUserB(browser) {
  // Sign in via Supabase REST API
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });

  if (error) throw new Error(`User B login failed: ${error.message}`);

  const session = data.session;
  if (!session) throw new Error('User B login returned no session');

  // Build storageState with the session token in localStorage
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:3000',
        localStorage: [
          {
            name: 'pwa-install-dismissed',
            value: '1',
          },
          {
            name: `sb-rjjfcnstdzwiwpblrxtz-auth-token`,
            value: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in,
              expires_at: session.expires_at,
              token_type: session.token_type,
              user: session.user,
            }),
          },
        ],
      },
    ],
  };

  const context = await browser.newContext({
    storageState,
    viewport: { width: 390, height: 844 },
    baseURL: 'http://localhost:3000',
  });
  const page = await context.newPage();

  return { context, page, userId: session.user.id, accessToken: session.access_token };
}

/**
 * Add a user as a trip member via Supabase REST API.
 */
export async function addTripMember(tripId, userId, accessToken, role = 'editor') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trip_members`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ trip_id: tripId, user_id: userId, role }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`addTripMember failed: ${res.status} ${text}`);
  }
}

/**
 * Delete a trip via Supabase API (for cleanup in afterAll).
 */
export async function deleteTripViaAPI(tripId, accessToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/trips?id=eq.${tripId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Poll until a condition is true.
 * @param {() => Promise<boolean>} checkFn
 * @param {number} timeout
 * @param {number} interval
 */
export async function pollUntil(checkFn, timeout = 8_000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checkFn()) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

/**
 * Wait for realtime sync — poll until text appears on the page.
 */
export async function waitForRealtimeSync(page, text, timeout = 8_000) {
  return pollUntil(
    async () => {
      const el = await page.$(`text=${text}`);
      return !!el;
    },
    timeout,
    500,
  );
}

/**
 * Get current Day tab count.
 */
export async function getDayTabCount(page) {
  // Day tabs are buttons with text D1, D2, D3, etc.
  const tabs = page.locator('button').filter({ hasText: /^D\d+$/ });
  return tabs.count();
}

/**
 * Open the day more menu (click day label area to open bottom sheet).
 */
export async function openDayMoreMenu(page) {
  // Click the day label button (has edit icon)
  const dayLabel = page.locator('button:has(h2)').first();
  await dayLabel.click();
  await page.waitForTimeout(300);
}

/**
 * Click an item card by name to open DetailDialog.
 */
export async function clickItem(page, itemName) {
  await page.locator(`text=${itemName}`).first().click();
  await page.waitForTimeout(500);
}

/**
 * Edit a DetailDialog info‑row field via CenterPopup.
 * Opens the row by label text → fills the CenterPopup input/textarea → clicks 저장.
 * @param {import('@playwright/test').Page} page
 * @param {string} fieldLabel  — e.g. "가격", "부가정보", "메모"
 * @param {string} value       — value to fill
 * @param {boolean} isTextarea — true for multiline fields (e.g. "메모")
 */
export async function editDetailField(page, fieldLabel, value, isTextarea = false) {
  // Click the info‑row with the matching label (role="button" divs rendered by DetailDialog)
  const row = page.locator(`div[role="button"]:has-text("${fieldLabel}")`).first();
  await row.click();
  await page.waitForTimeout(500);

  if (isTextarea) {
    const textarea = page.locator('textarea').last();
    await textarea.waitFor({ state: 'visible', timeout: 3_000 });
    await textarea.fill(value);
  } else {
    const input = page.locator('input[type="text"]').last();
    await input.waitFor({ state: 'visible', timeout: 3_000 });
    await input.fill(value);
  }

  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForTimeout(500);
}

/**
 * Set hour and minute in an already‑opened TimePickerDialog.
 * Uses scrollTop‑based positioning (each row = 44px, minute step = 5).
 * @param {import('@playwright/test').Page} page
 * @param {number} hour   — 0‑23
 * @param {number} minute — 0‑55 (rounded to nearest 5)
 */
export async function setTimePickerInDialog(page, hour, minute) {
  const ROW_HEIGHT = 44;
  const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const dialog = page.locator('[role="dialog"][aria-label="시간 선택"]');
  await dialog.waitFor({ timeout: 3_000 });

  const closestMinute = MINUTE_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - minute) < Math.abs(prev - minute) ? curr : prev
  );
  const minuteIndex = MINUTE_OPTIONS.indexOf(closestMinute);

  await page.evaluate(({ hourIdx, minIdx, rowH }) => {
    const dlg = document.querySelector('[role="dialog"][aria-label="시간 선택"]');
    if (!dlg) return;
    const scrollers = dlg.querySelectorAll('[style*="overflow"]');
    const scrollContainers = [];
    scrollers.forEach((el) => {
      const style = el.style || window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainers.push(el);
      }
    });
    if (scrollContainers.length >= 2) {
      scrollContainers[0].scrollTop = hourIdx * rowH;
      scrollContainers[1].scrollTop = minIdx * rowH;
      scrollContainers[0].dispatchEvent(new Event('scroll'));
      scrollContainers[1].dispatchEvent(new Event('scroll'));
    }
  }, { hourIdx: hour, minIdx: minuteIndex, rowH: ROW_HEIGHT });

  await page.waitForTimeout(300);
  const confirmBtn = dialog.locator('button:has-text("확인")');
  await confirmBtn.click();
  await page.waitForTimeout(300);
}

/**
 * Edit the Day label via BottomSheet → inline input → Enter.
 * Assumes planner page is loaded with the target day selected.
 * @param {import('@playwright/test').Page} page
 * @param {string} newLabel — new day name
 */
export async function editDayLabel(page, newLabel) {
  // Click the day label button (has <h2>) to open the day‑more BottomSheet
  const dayLabelBtn = page.locator('button:has(h2)').first();
  await dayLabelBtn.click();
  await page.waitForTimeout(500);

  // Click "이름 수정" in the BottomSheet
  await page.locator('text=이름 수정').click();
  await page.waitForTimeout(500);

  // Fill the inline input
  const inlineInput = page.locator('input[placeholder="날짜 이름"]');
  await inlineInput.waitFor({ state: 'visible', timeout: 3_000 });
  await inlineInput.fill(newLabel);
  await inlineInput.press('Enter');
  await page.waitForTimeout(500);
}

/**
 * Simulate a long‑press (600ms mousedown) on a PlaceCard by item name.
 * @param {import('@playwright/test').Page} page
 * @param {string} itemName — text of the item
 */
export async function longPressItem(page, itemName) {
  const item = page.locator(`text=${itemName}`).first();
  const box = await item.boundingBox();
  if (!box) throw new Error(`Item "${itemName}" not found`);

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(300);
}
