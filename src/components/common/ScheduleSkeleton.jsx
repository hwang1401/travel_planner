/**
 * ── ScheduleSkeleton ──
 * 일정(TravelPlanner) 로딩 시 헤더 + 리스트 형태 스켈레톤.
 */
import Skeleton from './Skeleton';
import { SPACING } from '../../styles/tokens';

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
          padding: `${SPACING.lg} ${SPACING.xl} ${SPACING.lg} ${SPACING.md}`,
          background: 'var(--color-surface-container-lowest)',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          flexShrink: 0,
        }}
      >
        <Skeleton style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)' }} />
        <Skeleton style={{ height: '20px', flex: 1, maxWidth: '180px' }} />
      </div>

      {/* Day tabs area */}
      <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, display: 'flex', gap: SPACING.md, flexShrink: 0 }}>
        <Skeleton style={{ height: '36px', width: '72px', borderRadius: 'var(--radius-md)' }} />
        <Skeleton style={{ height: '36px', width: '72px', borderRadius: 'var(--radius-md)' }} />
        <Skeleton style={{ height: '36px', width: '72px', borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* List */}
      <div style={{ flex: 1, padding: SPACING.xl, display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', gap: SPACING.lg, alignItems: 'flex-start' }}>
            <Skeleton style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Skeleton style={{ height: '16px', width: '60%', marginBottom: SPACING.ms }} />
              <Skeleton style={{ height: '12px', width: '85%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
