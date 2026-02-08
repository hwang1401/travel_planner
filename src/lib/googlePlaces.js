/**
 * Google Places API — Autocomplete(제안) + Place Details(좌표/주소)
 * loadGoogleMapsScript() 완료 후 사용
 */

import { loadGoogleMapsScript } from './googleMaps.js';

/** 제안 목록: { placeId, description }[] */
export async function getPlacePredictions(input, limit = 8) {
  if (!input || String(input).trim().length < 2) return [];
  await loadGoogleMapsScript();
  const google = window.google;
  if (!google?.maps?.places?.AutocompleteService) return [];

  return new Promise((resolve) => {
    const service = new google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      {
        input: String(input).trim(),
        types: ['establishment', 'geocode'],
        language: 'ko',
      },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          resolve([]);
          return;
        }
        const list = predictions.slice(0, limit).map((p) => ({
          placeId: p.place_id,
          description: p.description,
        }));
        resolve(list);
      }
    );
  });
}

/** Place 상세: { lat, lon, formatted_address, name } */
export async function getPlaceDetails(placeId) {
  if (!placeId) return null;
  await loadGoogleMapsScript();
  const google = window.google;
  if (!google?.maps?.places?.PlacesService) return null;

  return new Promise((resolve) => {
    const div = document.createElement('div');
    const service = new google.maps.places.PlacesService(div);
    service.getDetails(
      {
        placeId,
        fields: ['geometry', 'formatted_address', 'name'],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          resolve(null);
          return;
        }
        const loc = place.geometry?.location;
        resolve({
          lat: loc ? loc.lat() : null,
          lon: loc ? loc.lng() : null,
          formatted_address: place.formatted_address || '',
          name: place.name || place.formatted_address || '',
        });
      }
    );
  });
}
