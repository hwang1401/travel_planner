/**
 * ── TripListSkeleton ──
 * 여행 목록 로딩 시 카드 형태 스켈레톤.
 */
import Skeleton from './Skeleton';
import { SPACING } from '../../styles/tokens';

const CARD_COUNT = 3;

export default function TripListSkeleton() {
  return (
    <div style={{ padding: `0 ${SPACING.xxl} 100px` }}>
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <div key={i} style={{ marginBottom: SPACING.lg }}>
          <div
            style={{
              borderRadius: 'var(--radius-lg, 12px)',
              overflow: 'hidden',
              background: 'var(--color-surface-container-lowest)',
              border: '1px solid var(--color-outline-variant)',
            }}
          >
            <div style={{ padding: `${SPACING.lx} ${SPACING.xl}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.ms }}>
                <Skeleton style={{ height: '18px', flex: 1, maxWidth: '70%' }} />
                <Skeleton style={{ height: '20px', width: '48px', borderRadius: '100px' }} />
              </div>
              <Skeleton style={{ height: '14px', width: '85%' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
