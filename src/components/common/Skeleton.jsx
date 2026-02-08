/**
 * ── Skeleton ──
 * 로딩 시 플레이스홀더 블록. .skeleton 클래스와 함께 사용.
 * width, height, borderRadius 등은 style로 전달.
 */
export default function Skeleton({ style = {}, className = '', ...rest }) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={style}
      aria-hidden
      {...rest}
    />
  );
}
