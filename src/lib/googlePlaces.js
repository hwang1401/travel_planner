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
        fields: ['displayName', 'formattedAddress', 'location', 'photos', 'rating', 'userRatingCount', 'openingHours', 'priceLevel'],
      });

      const loc = place.location;
      let photoUrl = null;
      if (place.photos?.length) {
        try {
          photoUrl = place.photos[0].getURI({ maxWidth: 800 });
        } catch { /* 사진 없을 수 있음 */ }
      }

      clearSessionToken(); // 디테일 fetch 후 세션 종료

      return {
        lat: loc ? loc.lat() : null,
        lon: loc ? loc.lng() : null,
        formatted_address: place.formattedAddress || '',
        name: place.displayName || place.formattedAddress || '',
        photoUrl: photoUrl || undefined,
        placeId,
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        hours: place.regularOpeningHours?.weekdayDescriptions?.join('; ') || null,
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
          resolve({
            lat: loc ? loc.lat() : null,
            lon: loc ? loc.lng() : null,
            formatted_address: place.formatted_address || '',
            name: place.name || place.formatted_address || '',
            photoUrl: photoUrl || undefined,
            placeId,
            rating: place.rating ?? null,
            reviewCount: place.user_ratings_total ?? null,
            hours: place.opening_hours?.weekday_text?.join('; ') || null,
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
