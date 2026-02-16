/**
 * Google Places API (New) — AutocompleteSuggestion + Place.fetchFields
 * 2025-03 이후 신규 고객은 기존 PlacesService 사용 불가 → 새 Place API 사용.
 */

import { loadGoogleMapsScript } from './googleMaps.js';

/* ── Session token: 자동완성 세션 비용 최적화 ── */
let _sessionToken = null;
let _sessionAge = 0;
const SESSION_MAX_MS = 3 * 60 * 1000; // 3분

function getSessionToken() {
  const google = window.google;
  const now = Date.now();
  if (!_sessionToken || now - _sessionAge > SESSION_MAX_MS) {
    _sessionToken = new google.maps.places.AutocompleteSessionToken();
    _sessionAge = now;
  }
  return _sessionToken;
}

function clearSessionToken() {
  _sessionToken = null;
  _sessionAge = 0;
}

/** 제안 목록: { placeId, description }[] */
export async function getPlacePredictions(input, limit = 8) {
  if (!input || String(input).trim().length < 2) return [];
  await loadGoogleMapsScript();
  const google = window.google;

  // 새 API 사용 가능 여부 확인
  if (google?.maps?.places?.AutocompleteSuggestion) {
    try {
      const request = {
        input: String(input).trim(),
        language: 'ko',
        sessionToken: getSessionToken(),
      };
      const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      if (!suggestions?.length) return [];
      return suggestions.slice(0, limit)
        .filter((s) => s.placePrediction)
        .map((s) => ({
          placeId: s.placePrediction.placeId,
          description: s.placePrediction.text?.text || '',
        }));
    } catch (e) {
      console.warn('[Places] AutocompleteSuggestion failed, trying legacy', e);
    }
  }

  // 레거시 폴백
  if (google?.maps?.places?.AutocompleteService) {
    return new Promise((resolve) => {
      const service = new google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        { input: String(input).trim(), types: ['establishment', 'geocode'], language: 'ko' },
        (predictions, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            resolve([]);
            return;
          }
          resolve(predictions.slice(0, limit).map((p) => ({
            placeId: p.place_id,
            description: p.description,
          })));
        }
      );
    });
  }

  return [];
}

/* ── periods → "요일: HH:MM – HH:MM" 문자열 변환 ── */
const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function formatPeriodsToHours(periods) {
  if (!periods?.length) return null;
  const byDay = {};
  for (const p of periods) {
    const openDay = p.open?.day;
    if (openDay == null) continue;
    // 24시간 영업: close가 없거나 open과 동일한 시간
    if (!p.close || (p.close.day === openDay && p.close.hour === 0 && p.close.minute === 0 && p.open.hour === 0 && p.open.minute === 0)) {
      byDay[openDay] = '24시간 영업';
      continue;
    }
    const pad = (n) => String(n).padStart(2, '0');
    const openHour = p.open?.hour ?? 0;
    const openMin = p.open?.minute ?? 0;
    const closeHour = p.close?.hour ?? 0;
    const closeMin = p.close?.minute ?? 0;
    const timeStr = `${pad(openHour)}:${pad(openMin)} – ${pad(closeHour)}:${pad(closeMin)}`;
    byDay[openDay] = timeStr;
  }
  const parts = [];
  for (let d = 0; d < 7; d++) {
    if (byDay[d]) parts.push(`${DAY_NAMES[d]}: ${byDay[d]}`);
    else parts.push(`${DAY_NAMES[d]}: 휴무`);
  }
  return parts.join('; ');
}

/* ── 영어 weekdayDescriptions → 한국어 변환 (safety net) ── */
const EN_DAY_MAP = { Monday: '월요일', Tuesday: '화요일', Wednesday: '수요일', Thursday: '목요일', Friday: '금요일', Saturday: '토요일', Sunday: '일요일' };

function localizeHoursText(text) {
  if (!text || typeof text !== 'string') return text;
  let s = text;
  // 영어 요일 → 한국어
  for (const [en, ko] of Object.entries(EN_DAY_MAP)) {
    s = s.replace(new RegExp(en, 'gi'), ko);
  }
  // "Closed" → "휴무"
  s = s.replace(/\bClosed\b/gi, '휴무');
  // "Open 24 hours" → "24시간 영업"
  s = s.replace(/\bOpen 24 hours\b/gi, '24시간 영업');
  // AM/PM → 24시간 (예: "11:00 AM" → "11:00", "2:30 PM" → "14:30")
  s = s.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi, (_, h, m, ap) => {
    let hour = parseInt(h, 10);
    if (ap.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ap.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${m}`;
  });
  return s;
}

/** Place 상세: { lat, lon, formatted_address, name, photoUrl? } */
export async function getPlaceDetails(placeId) {
  if (!placeId) return null;
  await loadGoogleMapsScript();
  const google = window.google;

  // 새 API
  if (google?.maps?.places?.Place) {
    try {
      const place = new google.maps.places.Place({ id: placeId });
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'photos', 'rating', 'userRatingCount', 'regularOpeningHours', 'priceLevel'],
      });

      const loc = place.location;
      let photoUrl = null;
      if (place.photos?.length) {
        try {
          photoUrl = place.photos[0].getURI({ maxWidth: 800 });
        } catch { /* 사진 없을 수 있음 */ }
      }

      clearSessionToken();

      // periods로 실제 영업시간 구성, 없으면 weekdayDescriptions 사용 (localizeHoursText로 안전 번역)
      const oh = place.regularOpeningHours;
      const hours = formatPeriodsToHours(oh?.periods) || localizeHoursText(oh?.weekdayDescriptions?.join('; ')) || null;

      return {
        lat: loc ? loc.lat() : null,
        lon: loc ? loc.lng() : null,
        formatted_address: place.formattedAddress || '',
        name: place.displayName || place.formattedAddress || '',
        photoUrl: photoUrl || undefined,
        placeId,
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        hours,
        priceLevel: place.priceLevel ?? null,
      };
    } catch (e) {
      console.warn('[Places] Place.fetchFields failed, trying legacy', e);
    }
  }

  // 레거시 폴백
  if (google?.maps?.places?.PlacesService) {
    return new Promise((resolve) => {
      const div = document.createElement('div');
      const service = new google.maps.places.PlacesService(div);
      service.getDetails(
        { placeId, fields: ['geometry', 'formatted_address', 'name', 'photos', 'rating', 'user_ratings_total', 'opening_hours', 'price_level'] },
        (place, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
            resolve(null);
            return;
          }
          const loc = place.geometry?.location;
          const photoUrl = place.photos?.[0]?.getUrl?.({ maxWidth: 800 }) ?? null;
          // periods로 실제 영업시간 구성, 없으면 weekday_text 사용 (localizeHoursText로 안전 번역)
          const oh = place.opening_hours;
          const hours = formatPeriodsToHours(oh?.periods) || localizeHoursText(oh?.weekday_text?.join('; ')) || null;
          resolve({
            lat: loc ? loc.lat() : null,
            lon: loc ? loc.lng() : null,
            formatted_address: place.formatted_address || '',
            name: place.name || place.formatted_address || '',
            photoUrl: photoUrl || undefined,
            placeId,
            rating: place.rating ?? null,
            reviewCount: place.user_ratings_total ?? null,
            hours,
            priceLevel: place.price_level ?? null,
          });
        }
      );
    });
  }

  return null;
}

/**
 * placeId로 사진 URL 최대 maxCount개 가져오기.
 * @returns {Promise<string[]>} 사진 URL 배열 (빈 배열 가능)
 */
export async function getPlacePhotos(placeId, maxCount = 3) {
  if (!placeId) return [];
  await loadGoogleMapsScript();
  const google = window.google;

  // 새 API
  if (google?.maps?.places?.Place) {
    try {
      const place = new google.maps.places.Place({ id: placeId });
      await place.fetchFields({ fields: ['photos'] });
      if (!place.photos?.length) return [];
      return place.photos.slice(0, maxCount).map((photo) => {
        try { return photo.getURI({ maxWidth: 800 }); }
        catch { return null; }
      }).filter(Boolean);
    } catch (e) {
      console.warn('[Places] getPlacePhotos failed, trying legacy', e);
    }
  }

  // 레거시 폴백
  if (google?.maps?.places?.PlacesService) {
    return new Promise((resolve) => {
      const div = document.createElement('div');
      const service = new google.maps.places.PlacesService(div);
      service.getDetails(
        { placeId, fields: ['photos'] },
        (place, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.photos) {
            resolve([]);
            return;
          }
          resolve(
            place.photos.slice(0, maxCount)
              .map((p) => p.getUrl?.({ maxWidth: 800 }))
              .filter(Boolean)
          );
        }
      );
    });
  }

  return [];
}
