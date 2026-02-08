/**
 * ── ScheduleSkeleton ──
 * 일정(TravelPlanner) 로딩 시 헤더 + 리스트 형태 스켈레톤.
 */
import Skeleton from './Skeleton';

export default function ScheduleSkeleton() {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px 12px 8px',
          background: 'var(--color-surface-container-lowest)',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <Skeleton style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)' }} />
        <Skeleton style={{ height: '20px', flex: 1, maxWidth: '180px' }} />
      </div>

      {/* Day tabs area */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <Skeleton style={{ height: '36px', width: '72px', borderRadius: 'var(--radius-md)' }} />
        <Skeleton style={{ height: '36px', width: '72px', borderRadius: 'var(--radius-md)' }} />
        <Skeleton style={{ height: '36px', width: '72px', borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* List */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Skeleton style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Skeleton style={{ height: '16px', width: '60%', marginBottom: '6px' }} />
              <Skeleton style={{ height: '12px', width: '85%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
