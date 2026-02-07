import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Icon from './common/Icon';
import Button from './common/Button';
import Toast from './common/Toast';
import ConfirmDialog from './common/ConfirmDialog';
import CreateTripDialog from './dialogs/CreateTripDialog';
import { loadTrips, createTrip, updateTrip, deleteTrip, duplicateTrip, getShareCode, formatDateRange } from '../services/tripService';
import { getShareLink } from '../services/memberService';
import { loadCustomData } from '../data/storage';
import BottomSheet from './common/BottomSheet';

/* ── Shared card styles ── */
const cardStyle = {
  borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden',
  cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
  background: 'var(--color-surface-container-lowest)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};

/* ── Trip Card Component ── */
function TripCard({ title, subtitle, destinations, coverColor, coverImage, badge, memberCount, onClick, onMore }) {
  return (
    <div style={{ position: 'relative', marginBottom: '16px' }}>
      <div
        onClick={onClick}
        style={cardStyle}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'; }}
      >
        {/* Cover: image or gradient */}
        <div style={{
          height: '88px',
          background: coverImage ? 'none' : (coverColor || 'linear-gradient(135deg, #3A7DB5, #5BAEE6)'),
          position: 'relative', padding: '0 16px',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          paddingBottom: '12px', overflow: 'hidden',
        }}>
          {coverImage && (
            <>
              <img
                src={coverImage}
                alt=""
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover',
                }}
              />
              {/* Gradient overlay for chip readability */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 60%)',
              }} />
            </>
          )}
          {/* Destination chips */}
          {destinations?.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              {destinations.map((d, i) => (
                <span key={i} style={{
                  padding: '3px 10px', borderRadius: '100px',
                  background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                  fontSize: 'var(--typo-caption-3-bold-size)',
                  fontWeight: 'var(--typo-caption-3-bold-weight)',
                  color: 'white', lineHeight: 1.4,
                }}>
                  {typeof d === 'string' ? d : d}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Info area */}
        <div style={{ padding: '14px 16px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
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
                padding: '2px 8px', borderRadius: '100px',
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

          {/* Meta row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{
              margin: 0, fontSize: 'var(--typo-caption-2-regular-size)',
              color: 'var(--color-on-surface-variant2)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <Icon name="calendar" size={12} style={{ opacity: 0.6 }} />
              {subtitle}
            </p>
            {memberCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '3px',
              }}>
                <Icon name="person" size={12} style={{ opacity: 0.4 }} />
                <span style={{
                  fontSize: 'var(--typo-caption-3-regular-size)',
                  color: 'var(--color-on-surface-variant2)',
                }}>
                  {memberCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* More button (top-right on cover) */}
      <button
        onClick={(e) => { e.stopPropagation(); onMore(); }}
        style={{
          position: 'absolute', top: '10px', right: '10px',
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: '16px', fontWeight: 700, letterSpacing: '1px',
        }}
      >
        ···
      </button>
    </div>
  );
}

/* ── Home Page ── */
export default function HomePage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTrip, setEditTrip] = useState(null); // trip object for edit mode
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [moreMenu, setMoreMenu] = useState(null);
  const [legacyHidden, setLegacyHidden] = useState(() => {
    // One-time reset: restore legacy card if it was hidden before duplication was available
    const hidden = localStorage.getItem('legacy_trip_hidden') === 'true';
    const alreadyReset = localStorage.getItem('legacy_hidden_reset_v1') === 'true';
    if (hidden && !alreadyReset) {
      localStorage.removeItem('legacy_trip_hidden');
      localStorage.setItem('legacy_hidden_reset_v1', 'true');
      return false;
    }
    return hidden;
  });

  /* ── Total trip count ── */
  const totalTrips = trips.length + (legacyHidden ? 0 : 1);

  /* ── Load trips from Supabase ── */
  const fetchTrips = useCallback(async () => {
    try {
      const data = await loadTrips();
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trips:', err);
      setToast({ message: '여행 목록을 불러오지 못했습니다', icon: 'info' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  /* ── Create trip ── */
  const handleCreate = useCallback(async (data) => {
    try {
      const newTrip = await createTrip({ ...data, coverImage: data.coverImage });
      setShowCreate(false);
      setToast({ message: `"${newTrip.name}" 여행이 생성되었습니다`, icon: 'check' });
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

  /* ── Duplicate legacy trip ── */
  const handleDuplicateLegacy = useCallback(async () => {
    setMoreMenu(null);
    try {
      const legacyData = loadCustomData();
      const newTrip = await duplicateTrip({
        name: '후쿠오카 · 유후인 여행 (복제)',
        destinations: ['후쿠오카', '구마모토', '유후인'],
        startDate: '2026-02-19',
        endDate: '2026-02-24',
        scheduleData: legacyData,
      });
      setToast({ message: '여행이 복제되었습니다', icon: 'check' });
      await fetchTrips();
      navigate(`/trip/${newTrip.id}`);
    } catch (err) {
      console.error('Failed to duplicate legacy trip:', err);
      setToast({ message: '복제에 실패했습니다', icon: 'info' });
    }
  }, [fetchTrips, navigate]);

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

  /* ── Delete legacy data ── */
  const handleDeleteLegacy = useCallback(() => {
    setMoreMenu(null);
    setConfirmDialog({
      title: '로컬 여행 삭제',
      message: '이 여행을 목록에서 삭제하시겠습니까?\n로컬에 저장된 커스텀 데이터도 함께 삭제됩니다.',
      confirmLabel: '삭제',
      onConfirm: () => {
        localStorage.removeItem('travel_custom_data');
        localStorage.setItem('legacy_trip_hidden', 'true');
        setLegacyHidden(true);
        setConfirmDialog(null);
        setToast({ message: '여행이 삭제되었습니다', icon: 'trash' });
      },
    });
  }, []);

  /* ── Navigation ── */
  const handleOpenTrip = useCallback((trip) => navigate(`/trip/${trip.id}`), [navigate]);
  const handleOpenLegacy = useCallback(() => navigate('/trip/legacy'), [navigate]);

  /* ── Sign out ── */
  const handleSignOut = useCallback(() => {
    setConfirmDialog({
      title: '로그아웃', message: '로그아웃 하시겠습니까?', confirmLabel: '로그아웃',
      onConfirm: async () => { await signOut(); setConfirmDialog(null); },
    });
  }, [signOut]);

  return (
    <div style={{
      width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h1 style={{
            margin: 0, fontSize: 'var(--typo-heading-2-bold-size, 22px)',
            fontWeight: 'var(--typo-heading-2-bold-weight, 700)',
            color: 'var(--color-on-surface)',
            letterSpacing: 'var(--typo-heading-2-bold-letter-spacing)',
          }}>
            내 여행
          </h1>
          {/* Profile */}
          {profile && (
            <div
              onClick={handleSignOut}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px 4px 4px', borderRadius: '20px',
                background: 'var(--color-surface-container-low)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-container)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-container-low)'; }}
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
          margin: '0 0 20px', fontSize: 'var(--typo-caption-1-regular-size)',
          fontWeight: 'var(--typo-caption-1-regular-weight)',
          color: 'var(--color-on-surface-variant2)',
        }}>
          여행을 계획하고 함께하는 사람들과 공유하세요
        </p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 20px 100px', overflowY: 'auto' }}>
        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2].map((i) => (
              <div key={i} style={{
                height: '140px', borderRadius: 'var(--radius-md, 8px)',
                background: 'var(--color-surface-container-low)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
          </div>
        )}

        {!loading && (
          <>
            {/* Legacy trip card */}
            {!legacyHidden && (
              <TripCard
                title="후쿠오카 · 유후인 여행"
                subtitle="2/19 (목) — 2/24 (화) · 5박6일"
                destinations={['후쿠오카', '구마모토', '유후인']}
                coverColor="linear-gradient(135deg, #D94F3B, #F07040)"
                badge="로컬"
                onClick={handleOpenLegacy}
                onMore={() => setMoreMenu({ legacy: true })}
              />
            )}

            {/* Supabase trips */}
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                title={trip.name}
                subtitle={formatDateRange(trip)}
                destinations={trip.destinations}
                coverColor={trip.coverColor}
                coverImage={trip.coverImage}
                memberCount={trip.members?.length || 0}
                onClick={() => handleOpenTrip(trip)}
                onMore={() => setMoreMenu({ trip })}
              />
            ))}

            {/* Empty state — only when truly no trips at all */}
            {totalTrips === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '48px 20px', textAlign: 'center',
                marginTop: '24px',
              }}>
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'var(--color-primary-container)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
                }}>
                  <Icon name="navigation" size={32} />
                </div>
                <p style={{
                  margin: '0 0 6px',
                  fontSize: 'var(--typo-body-1-n---bold-size)',
                  fontWeight: 'var(--typo-body-1-n---bold-weight)',
                  color: 'var(--color-on-surface)',
                }}>
                  새로운 여행을 계획해보세요
                </p>
                <p style={{
                  margin: '0 0 24px', fontSize: 'var(--typo-caption-1-regular-size)',
                  color: 'var(--color-on-surface-variant2)', lineHeight: 1.6,
                }}>
                  아래 버튼을 눌러 여행을 만들고<br />함께할 사람들을 초대할 수 있습니다
                </p>
                <Button variant="primary" size="lg" iconLeft="plus"
                  onClick={() => setShowCreate(true)}
                  style={{ borderRadius: '12px' }}>
                  첫 여행 만들기
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB: Create Trip (hide if empty state already has button) */}
      {totalTrips > 0 && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 10,
        }}>
          <Button variant="primary" size="xlg" iconLeft="plus"
            onClick={() => setShowCreate(true)}
            style={{
              borderRadius: '24px', padding: '0 24px', height: '48px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}>
            여행 만들기
          </Button>
        </div>
      )}

      {/* Create Trip Dialog */}
      {showCreate && (
        <CreateTripDialog onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}

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

      {/* More Menu Bottom Sheet */}
      {moreMenu && (
        <BottomSheet onClose={() => setMoreMenu(null)} maxHeight="auto" zIndex={3000}>
          <div style={{ padding: '8px 24px 24px' }}>
            <h3 style={{
              margin: '0 0 16px',
              fontSize: 'var(--typo-body-1-n---bold-size)',
              fontWeight: 'var(--typo-body-1-n---bold-weight)',
              color: 'var(--color-on-surface)',
            }}>
              {moreMenu.legacy ? '후쿠오카 · 유후인 여행' : moreMenu.trip?.name}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* 여행 수정 (Supabase only) */}
              {!moreMenu.legacy && moreMenu.trip && (
                <MoreMenuItem
                  icon="edit" label="여행 수정"
                  onClick={() => { setEditTrip(moreMenu.trip); setMoreMenu(null); }}
                />
              )}

              {/* 여행 공유 (Supabase only) */}
              {!moreMenu.legacy && moreMenu.trip && (
                <MoreMenuItem
                  icon="share" label="여행 공유"
                  onClick={() => handleShareTrip(moreMenu.trip)}
                />
              )}

              {/* 여행 복제 */}
              <MoreMenuItem
                icon="copy" label="여행 복제"
                onClick={() => moreMenu.legacy ? handleDuplicateLegacy() : handleDuplicateTrip(moreMenu.trip)}
              />

              {/* 여행 삭제 */}
              <MoreMenuItem
                icon="trash" label="여행 삭제" danger
                onClick={() => {
                  if (moreMenu.legacy) {
                    handleDeleteLegacy();
                  } else {
                    setMoreMenu(null);
                    handleDelete(moreMenu.trip);
                  }
                }}
              />
            </div>
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

/* ── More Menu Item ── */
function MoreMenuItem({ icon, label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '13px 14px', borderRadius: 'var(--radius-md, 8px)',
        background: 'none', border: 'none', cursor: 'pointer',
        width: '100%', textAlign: 'left', transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? 'var(--color-error-container, #FEE2E2)'
          : 'var(--color-surface-container-low)';
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      <Icon name={icon} size={18} style={{ opacity: 0.6 }} />
      <span style={{
        fontSize: 'var(--typo-label-2-medium-size)',
        fontWeight: 'var(--typo-label-2-medium-weight)',
        color: danger ? 'var(--color-error)' : 'var(--color-on-surface)',
      }}>
        {label}
      </span>
    </button>
  );
}
