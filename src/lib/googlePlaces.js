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
        fields: ['displayName', 'formattedAddress', 'location', 'photos'],
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
        { placeId, fields: ['geometry', 'formatted_address', 'name', 'photos'] },
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
          });
        }
      );
    });
  }

  return null;
}

/**
 * Get place_id from lat/lon via Geocoder, then fetch Place Details with photo.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string|null>} photoUrl or null
 */
export async function getPlacePhotoFromLocation(lat, lon) {
  if (lat == null || lon == null || typeof lat !== 'number' || typeof lon !== 'number') return null;
  await loadGoogleMapsScript();
  const google = window.google;
  if (!google?.maps?.Geocoder) return null;

  const geocoder = new google.maps.Geocoder();
  const result = await new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng: lon } }, (results, status) => {
      if (status !== google.maps.GeocoderStatus.OK || !results?.[0]?.place_id) {
        resolve(null);
        return;
      }
      resolve(results[0].place_id);
    });
  });
  if (!result) return null;
  const details = await getPlaceDetails(result);
  return details?.photoUrl ?? null;
}

/**
 * Get place photo URL for an item (detail.name, address, lat/lon).
 * 1) Name → autocomplete → details
 * 2) lat/lon → reverse geocode → details
 * 3) address → geocode → details
 */
export async function getPlacePhotoForItem(item) {
  if (!item?.detail) return null;
  const { name, lat, lon, address } = item.detail;

  // 1) Name-based search
  const searchName = (name && typeof name === 'string' && name.trim()) ? name.trim().slice(0, 60) : null;
  if (searchName) {
    try {
      const predictions = await getPlacePredictions(searchName, 5);
      if (predictions?.[0]?.placeId) {
        const details = await getPlaceDetails(predictions[0].placeId);
        if (details?.photoUrl) return details.photoUrl;
      }
    } catch { /* fallback */ }
  }

  // 2) Lat/lon → reverse geocode
  if (lat != null && lon != null) {
    return getPlacePhotoFromLocation(Number(lat), Number(lon));
  }

  // 3) Address → geocode
  if (!address || typeof address !== 'string' || !address.trim()) return null;
  await loadGoogleMapsScript();
  const google = window.google;
  if (!google?.maps?.Geocoder) return null;

  const geocoder = new google.maps.Geocoder();
  const placeId = await new Promise((resolve) => {
    geocoder.geocode({ address: address.trim() }, (results, status) => {
      if (status !== google.maps.GeocoderStatus.OK || !results?.[0]?.place_id) {
        resolve(null);
        return;
      }
      resolve(results[0].place_id);
    });
  });
  if (!placeId) return null;
  const details = await getPlaceDetails(placeId);
  return details?.photoUrl ?? null;
}
