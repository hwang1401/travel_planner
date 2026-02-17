/**
 * 아이템/detail 빌더 유틸리티
 *
 * 장소 데이터(RAG, Google, AI 등)를 표준 detail 객체로 변환하고,
 * 스케줄 아이템을 일관된 형태로 생성한다.
 */

import { TYPE_LABELS } from '../styles/tokens.js';

const VALID_TYPES = ['food', 'spot', 'shop', 'move', 'flight', 'stay', 'info'];

/**
 * 어떤 소스든 표준 detail 객체로 변환.
 * RAG 필드명(name_ko, image_url, google_place_id, opening_hours, review_count)과
 * 앱 내부 필드명(name, image, placeId, hours, reviewCount)을 모두 처리한다.
 *
 * @param {Object} source - 장소 데이터 (RAG row, Google result, enriched place, AI detail 등)
 * @param {Object} [opts] - 추가 옵션
 * @param {string} [opts.category] - 카테고리 라벨 (없으면 source.type으로 자동 결정)
 * @param {string} [opts.tip] - 소개/팁 (별도 지정 시 source.tip 대신 사용)
 * @param {Object} [opts.timetable] - 시간표 객체
 * @returns {Object} 표준 detail 객체 (null 필드 제외)
 */
export function buildPlaceDetail(source, opts = {}) {
  if (!source) return { name: '', category: '정보' };

  const name = source.name || source.name_ko || source.desc || '';
  const category = opts.category || source.category || TYPE_LABELS[source.type] || '정보';
  const address = source.address || null;
  const rawLat = source.lat != null ? Number(source.lat) : null;
  const rawLon = source.lon != null ? Number(source.lon) : null;
  const lat = rawLat != null && !Number.isNaN(rawLat) ? rawLat : null;
  const lon = rawLon != null && !Number.isNaN(rawLon) ? rawLon : null;
  const image = source.image || source.image_url || null;
  const placeId = source.placeId || source.google_place_id || null;
  const rating = source.rating != null ? source.rating : null;
  const reviewCount = source.reviewCount ?? source.review_count ?? null;
  const hours = source.hours || source.opening_hours || null;
  const priceLevel = source.priceLevel != null ? source.priceLevel : null;
  const tip = opts.tip ?? source.tip ?? null;
  const timetable = opts.timetable || null;

  const detail = { name, category };
  if (address?.trim()) detail.address = address.trim();
  if (lat != null && lon != null) { detail.lat = lat; detail.lon = lon; }
  if (image) detail.image = image;
  if (placeId) detail.placeId = placeId;
  if (rating != null) detail.rating = rating;
  if (reviewCount != null) detail.reviewCount = reviewCount;
  if (hours) detail.hours = hours;
  if (priceLevel != null) detail.priceLevel = priceLevel;
  if (tip?.trim()) detail.tip = tip.trim();
  if (timetable) detail.timetable = timetable;

  return detail;
}

/**
 * 스케줄 아이템 생성. _id, time 포맷, _custom 등을 표준화.
 *
 * @param {Object} params
 * @param {string} params.desc - 일정명
 * @param {string} params.type - 아이템 타입 (food, spot, ...)
 * @param {string} params.time - 시간 (HH:MM)
 * @param {Object} [params.detail] - detail 객체 (buildPlaceDetail 결과)
 * @param {string} [params.sub] - 부제
 * @param {string} [params.moveFrom] - 출발지 (move 타입)
 * @param {string} [params.moveTo] - 도착지 (move 타입)
 * @param {string} [params.ragId] - RAG ID (AI 응답에서 온 경우)
 * @returns {Object} 표준 스케줄 아이템
 */
export function buildScheduleItem({ desc, type, time, detail, sub, moveFrom, moveTo, ragId }) {
  const typeVal = VALID_TYPES.includes(type) ? type : 'info';
  const timeStr = (time || '').padStart(time?.includes(':') ? 5 : 0, '0');

  return {
    _id: crypto.randomUUID(),
    time: timeStr,
    type: typeVal,
    desc: desc || '',
    ...(sub?.trim() ? { sub: sub.trim() } : {}),
    ...(typeVal === 'move' && moveFrom ? { moveFrom } : {}),
    ...(typeVal === 'move' && moveTo ? { moveTo } : {}),
    ...(ragId != null ? { _ragId: ragId } : {}),
    ...(detail ? { detail } : {}),
    _custom: true,
  };
}

/**
 * RAG 검증/주입 시 item.detail이 없으면 최소 detail을 생성하는 헬퍼.
 * injectRAGData, verifyAndApplyUnmatchedPlaces에서 사용.
 */
export function ensureDetail(item) {
  if (!item.detail) {
    item.detail = { name: item.desc || '', category: TYPE_LABELS[item.type] || '정보' };
  }
  return item.detail;
}
