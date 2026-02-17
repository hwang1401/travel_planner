import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Icon from './common/Icon';
import Button from './common/Button';
import EmptyState from './common/EmptyState';
import Toast from './common/Toast';
import ConfirmDialog from './common/ConfirmDialog';
import CreateTripDialog from './dialogs/CreateTripDialog';
import CreateTripWizard from './trip/CreateTripWizard';
import TripListSkeleton from './common/TripListSkeleton';
import { loadTrips, createTrip, updateTrip, deleteTrip, duplicateTrip, getShareCode, formatDateRange } from '../services/tripService';
import { getShareLink } from '../services/memberService';
import BottomSheet from './common/BottomSheet';
import PullToRefresh from './common/PullToRefresh';
import { COLOR, SPACING, RADIUS } from '../styles/tokens';

const MIN_SPLASH_MS = 400;

/* ── Trip Card Component ── */
function TripCard({ title, subtitle, destinations, coverColor, coverImage, badge, members, onClick, onMore }) {
  const destSummary = destinations?.length > 0
    ? destinations.length === 1
      ? destinations[0]
      : `${destinations[0]} 외 ${destinations.length - 1}곳`
    : null;

  const hasCover = coverImage || coverColor;

  return (
    <div style={{ position: 'relative', marginBottom: SPACING.lg }}>
      <div
        onClick={onClick}
        style={{
          borderRadius: 'var(--radius-lg, 12px)', overflow: 'hidden',
          cursor: 'pointer', transition: 'background var(--transition-fast)',
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-outline-variant)',
        }}
      >
        {/* Cover: image > coverColor gradient > none */}
        <div style={{
          height: coverImage ? '100px' : coverColor ? '60px' : '0',
          position: 'relative', overflow: 'hidden',
          background: !coverImage && coverColor ? coverColor : undefined,
        }}>
          {coverImage && (
            <img
              src={coverImage}
              alt=""
              loading="lazy"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
        </div>

        {/* Info area */}
        <div style={{ padding: `${SPACING.lx} ${SPACING.xl}` }}>
          {/* Title + Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.ms }}>
            <p style={{
              margin: 0,
              fontSize: 'var(--typo-label-1-n---bold-size)',
              fontWeight: 'var(--typo-label-1-n---bold-weight)',
              color: 'var(--color-on-surface)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {title}
            </p>
            {badge && (
              <span style={{
                padding: `${SPACING.xs} ${SPACING.md}`, borderRadius: '100px',
                background: 'var(--color-surface-container)',
                fontSize: 'var(--typo-caption-3-bold-size)',
                fontWeight: 'var(--typo-caption-3-bold-weight)',
                color: 'var(--color-on-surface-variant2)',
                flexShrink: 0,
              }}>
                {badge}
              </span>
            )}
          </div>

          {/* Meta rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
            {/* Row 1: 여행지 */}
            {destSummary && (
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.ms }}>
                <Icon name="pin" size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                <span style={{
                  fontSize: 'var(--typo-caption-2-regular-size)',
                  color: 'var(--color-on-surface-variant2)',
                }}>
                  {destSummary}
                </span>
              </div>
            )}
            {/* Row 2: 날짜 + 멤버 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.ms }}>
              <Icon name="calendar" size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
              <span style={{
                fontSize: 'var(--typo-caption-2-regular-size)',
                color: 'var(--color-on-surface-variant2)',
                flex: 1,
              }}>
                {subtitle}
              </span>
              {members?.length > 1 && (() => {
                const show = members.slice(0, 3);
                const extra = members.length - 3;
                const sz = 24;
                const overlap = 8;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', position: 'relative', width: sz + (show.length - 1) * (sz - overlap) + (extra > 0 ? sz - overlap : 0), height: sz }}>
                      {show.map((m, i) => (
                        <div key={m.id || i} style={{
                          position: 'absolute', left: i * (sz - overlap),
                          width: sz, height: sz, borderRadius: '50%',
                          border: '1.5px solid var(--color-surface-container-lowest)',
                          background: 'var(--color-surface-container)',
                          overflow: 'hidden',
                          zIndex: show.length - i,
                        }}>
                          {m.avatarUrl
                            ? <img src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>{(m.name || '?')[0]}</span>
                          }
                        </div>
                      ))}
                      {extra > 0 && (
                        <div style={{
                          position: 'absolute', left: show.length * (sz - overlap),
                          width: sz, height: sz, borderRadius: '50%',
                          border: '1.5px solid var(--color-surface-container-lowest)',
                          background: 'var(--color-surface-container-high)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 0,
                        }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>+{extra}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* More button (top-right) */}
      <div
        style={{
          position: 'absolute', top: hasCover ? '8px' : '10px', right: '8px',
        }}
        {...(hasCover && { 'data-cover': 'true' })}
      >
        <Button
          variant="ghost-neutral"
          size="lg"
          iconOnly="moreHorizontal"
          title="더보기"
          onClick={(e) => { e.stopPropagation(); onMore(); }}
          style={
            hasCover
              ? { background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }
              : undefined
          }
        />
      </div>
    </div>
  );
}

/* ── Home Page ── */
export default function HomePage() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTrip, setEditTrip] = useState(null); // trip object for edit mode
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [moreMenu, setMoreMenu] = useState(null);
  const splashStartRef = useRef(null);

  const totalTrips = trips.length;

  /* ── Load trips from Supabase (최소 스플래시 시간 적용으로 깜빡임 방지) ── */
  const fetchTrips = useCallback(async () => {
    splashStartRef.current = Date.now();
    try {
      const data = await loadTrips();
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trips:', err);
      setToast({ message: '여행 목록을 불러오지 못했습니다', icon: 'info' });
    } finally {
      const elapsed = Date.now() - (splashStartRef.current || 0);
      const delay = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => setLoading(false), delay);
    }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  /* ── Create trip ── */
  const handleCreate = useCallback(async (data) => {
    try {
      const newTrip = await createTrip({
        ...data,
        coverImage: data.coverImage,
        scheduleData: data.scheduleData || null,
      });
      setShowCreate(false);
      const aiMsg = data.scheduleData ? ' (AI 일정 포함)' : '';
      setToast({ message: `"${newTrip.name}" 여행이 생성되었습니다${aiMsg}`, icon: 'check' });
      await fetchTrips();
      navigate(`/trip/${newTrip.id}`);
    } catch (err) {
      console.error('Failed to create trip:', err);
      setToast({ message: '여행 생성에 실패했습니다', icon: 'info' });
    }
  }, [fetchTrips, navigate]);

  /* ── Edit trip ── */
  const handleEdit = useCallback(async (data) => {
    try {
      await updateTrip(data.tripId, {
        name: data.name,
        destinations: data.destinations,
        start_date: data.startDate || null,
        end_date: data.endDate || data.startDate || null,
        cover_image: data.coverImage || '',
      });
      setEditTrip(null);
      setToast({ message: '여행이 수정되었습니다', icon: 'check' });
      await fetchTrips();
    } catch (err) {
      console.error('Failed to edit trip:', err);
      setToast({ message: '여행 수정에 실패했습니다', icon: 'info' });
    }
  }, [fetchTrips]);

  /* ── Delete trip ── */
  const handleDelete = useCallback((trip) => {
    setConfirmDialog({
      title: '여행 삭제',
      message: `"${trip.name}" 여행을 삭제하시겠습니까?\n모든 일정 데이터가 함께 삭제됩니다.`,
      confirmLabel: '삭제',
      onConfirm: async () => {
        try {
          await deleteTrip(trip.id);
          setConfirmDialog(null);
          setToast({ message: '여행이 삭제되었습니다', icon: 'trash' });
          await fetchTrips();
        } catch (err) {
          console.error('Failed to delete trip:', err);
          setConfirmDialog(null);
          setToast({ message: '여행 삭제에 실패했습니다', icon: 'info' });
        }
      },
    });
  }, [fetchTrips]);

  /* ── Duplicate Supabase trip ── */
  const handleDuplicateTrip = useCallback(async (trip) => {
    setMoreMenu(null);
    try {
      const newTrip = await duplicateTrip({
        name: `${trip.name} (복제)`,
        destinations: trip.destinations,
        startDate: trip.startDate,
        endDate: trip.endDate,
        sourceTripId: trip.id,
      });
      setToast({ message: '여행이 복제되었습니다', icon: 'check' });
      await fetchTrips();
    } catch (err) {
      console.error('Failed to duplicate trip:', err);
      setToast({ message: '복제에 실패했습니다', icon: 'info' });
    }
  }, [fetchTrips]);

  /* ── Share trip (system share or clipboard) ── */
  const handleShareTrip = useCallback(async (trip) => {
    setMoreMenu(null);
    try {
      const code = await getShareCode(trip.id);
      if (!code) { setToast({ message: '공유 코드를 찾을 수 없습니다', icon: 'info' }); return; }
      const link = getShareLink(code);

      // Use native share API if available (mobile)
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: trip.name,
            text: `"${trip.name}" 여행에 참여해보세요!`,
            url: link,
          });
          return; // User shared or cancelled — no toast needed
        } catch {
          // User cancelled or share failed — fall through to clipboard
        }
      }

      // Fallback: copy to clipboard
      try { await navigator.clipboard.writeText(link); } catch {
        const ta = document.createElement('textarea'); ta.value = link;
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      setToast({ message: '공유 링크가 복사되었습니다', icon: 'check' });
    } catch (err) {
      console.error('Failed to share trip:', err);
      setToast({ message: '공유에 실패했습니다', icon: 'info' });
    }
  }, []);

  /* ── Navigation ── */
  const handleOpenTrip = useCallback((trip) => navigate(`/trip/${trip.id}`), [navigate]);

  /* ── Sign out ── */
  const handleSignOut = useCallback(() => {
    setConfirmDialog({
      title: '로그아웃', message: '로그아웃 하시겠습니까?', confirmLabel: '로그아웃',
      onConfirm: async () => { await signOut(); setConfirmDialog(null); },
    });
  }, [signOut]);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-surface)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      overflow: 'hidden',
    }}>
      {/* 전체 스크롤 + 당겨서 새로고침 (헤더 포함 한 영역) — 뷰포트 내부 스크롤로 앱에서 위로 스크롤 정상 동작 */}
      <PullToRefresh onRefresh={fetchTrips} disabled={loading}>
        <>
          {/* Header */}
          <div style={{ padding: `${SPACING.xxl} ${SPACING.xxl} 0`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
              <h1 style={{
                margin: 0, fontSize: 'var(--typo-heading-2-bold-size, 22px)',
                fontWeight: 'var(--typo-heading-2-bold-weight, 700)',
                color: 'var(--color-on-surface)',
                letterSpacing: 'var(--typo-heading-2-bold-letter-spacing)',
              }}>
                내 여행
              </h1>
              {profile && (
                <div
                  onClick={() => navigate('/settings')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: SPACING.ms,
                    padding: `${SPACING.sm} ${SPACING.ml} ${SPACING.sm} ${SPACING.sm}`, borderRadius: '20px',
                    background: 'var(--color-surface-container-lowest)',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-container)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-container-lowest)'; }}
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt=""
                      style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: 'var(--color-on-primary)',
                    }}>
                      {(profile.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{
                    fontSize: 'var(--typo-caption-1-bold-size)',
                    fontWeight: 'var(--typo-caption-1-bold-weight)',
                    color: 'var(--color-on-surface)',
                  }}>
                    {profile.name || '사용자'}
                  </span>
                </div>
              )}
            </div>
            <p style={{
              margin: `0 0 ${SPACING.xxl}`, fontSize: 'var(--typo-caption-1-regular-size)',
              fontWeight: 'var(--typo-caption-1-regular-weight)',
              color: 'var(--color-on-surface-variant2)',
            }}>
              여행을 계획하고 함께하는 사람들과 공유하세요
            </p>
          </div>

          {/* Content */}
          <div style={{ padding: loading ? 0 : '0 20px 100px', minHeight: '100%' }}>
          {loading && (
            <TripListSkeleton />
          )}

          {!loading && (
            <div style={{ animation: 'fadeIn 0.35s ease' }}>
              {trips.map((trip) => (
                <TripCard
                  key={trip.id}
                  title={trip.name}
                  subtitle={formatDateRange(trip)}
                  destinations={trip.destinations}
                  coverColor={trip.coverColor}
                  coverImage={trip.coverImage}
                  members={trip.members || []}
                  onClick={() => handleOpenTrip(trip)}
                  onMore={() => setMoreMenu({ trip })}
                />
              ))}

              {totalTrips === 0 && (
                <div style={{ marginTop: SPACING.xxxl }}>
                  <EmptyState
                    icon="navigation"
                    title="새로운 여행을 계획해보세요"
                    description={"버튼을 눌러 여행을 만들고\n함께할 사람들을 초대할 수 있습니다"}
                    actions={{ label: "첫 여행 만들기", variant: "primary", iconLeft: "plus", onClick: () => setShowCreate(true) }}
                  />
                </div>
              )}
            </div>
          )}
          </div>
        </>
      </PullToRefresh>

      {/* FAB: Create Trip (hide if empty state already has button) */}
      {totalTrips > 0 && (
        <div style={{
          position: 'fixed', bottom: 'calc(24px + var(--safe-area-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
        }}>
          <Button variant="primary" size="xlg" iconLeft="plus"
            onClick={() => setShowCreate(true)}
            style={{
              borderRadius: '24px', padding: `0 ${SPACING.xxxl}`, height: '48px',
              boxShadow: 'var(--shadow-strong)',
            }}>
            여행 만들기
          </Button>
        </div>
      )}

      {/* Create Trip Wizard (full-screen step wizard) */}
      <CreateTripWizard open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />

      {/* Edit Trip Dialog */}
      {editTrip && (
        <CreateTripDialog onClose={() => setEditTrip(null)} onCreate={handleEdit} editTrip={editTrip} />
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title} message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* More Menu Bottom Sheet — 구분선 있는 버전으로 통일 */}
      {moreMenu && (
        <BottomSheet onClose={() => setMoreMenu(null)} maxHeight="auto" zIndex={3000} title="">
          <div style={{ padding: `${SPACING.md} ${SPACING.xxl} ${SPACING.xxxl}`, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{
              margin: `0 0 ${SPACING.md}`,
              fontSize: 'var(--typo-body-1-n---bold-size)',
              fontWeight: 'var(--typo-body-1-n---bold-weight)',
              color: 'var(--color-on-surface)',
            }}>
              {moreMenu.trip?.name}
            </h3>
            {[
              moreMenu.trip && { icon: 'edit', label: '여행 수정', onClick: () => { setEditTrip(moreMenu.trip); setMoreMenu(null); } },
              moreMenu.trip && { icon: 'share', label: '여행 공유', onClick: () => handleShareTrip(moreMenu.trip) },
              { icon: 'copy', label: '여행 복제', onClick: () => handleDuplicateTrip(moreMenu.trip) },
              { icon: 'trash', label: '여행 삭제', danger: true, onClick: () => { setMoreMenu(null); handleDelete(moreMenu.trip); } },
            ].filter(Boolean).map((item, idx) => (
              <MoreMenuItem key={item.label} showDivider={idx > 0} {...item} />
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} icon={toast.icon} onDone={() => setToast(null)} />
      )}
    </div>
  );
}

/* ── More Menu Item (구분선 있는 통일 스타일) ── */
function MoreMenuItem({ icon, label, onClick, danger = false, showDivider = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACING.md,
        width: '100%', padding: `${SPACING.lg} ${SPACING.xl}`,
        border: 'none', borderTop: showDivider ? '1px solid var(--color-outline-variant)' : 'none',
        borderRadius: 0, background: 'transparent',
        color: danger ? 'var(--color-error)' : 'var(--color-on-surface)',
        fontSize: 'var(--typo-label-2-medium-size)',
        fontWeight: 'var(--typo-label-2-medium-weight)', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <Icon name={icon} size={20} style={{ opacity: 0.7, flexShrink: 0, ...(danger ? { color: 'var(--color-error)' } : {}) }} />
      <span>{label}</span>
    </button>
  );
}
