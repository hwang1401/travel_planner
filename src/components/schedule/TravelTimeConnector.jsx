/**
 * ── TravelTimeConnector ──
 * 타임테이블 아이템 사이의 미니멀한 간격.
 *
 * 이전: 거리/시간 pill ("차량 5분") 표시 → 타임테이블 맥락에서 노이즈.
 * 현재: 아이템 간 시각적 연결만 담당. PlaceCard의 border-bottom이 구분선 역할을 하므로
 *       별도의 렌더링 요소 없이 최소한의 간격(4px)만 제공.
 *
 * 거리/시간 정보가 필요하면 DetailDialog나 FullMapDialog에서 확인할 수 있음.
 */
export default function TravelTimeConnector() {
  // 타임테이블에서는 아이템 간 구분이 border-bottom으로 충분.
  // 추가 시각 요소 없이 미세 간격만 제공.
  return null;
}
