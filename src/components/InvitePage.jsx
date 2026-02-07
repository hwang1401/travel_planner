/*
 * ── Invite Page ──
 * Handles trip invitation via share link.
 * URL: /invite/:shareCode
 *
 * Flow:
 *   1. User clicks invite link
 *   2. If authenticated → auto-join trip → redirect to trip
 *   3. If not authenticated → handled by App.jsx (shows LoginPage)
 *      After login, user lands back here and auto-joins
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { joinByShareCode } from '../services/memberService';
import Icon from './common/Icon';
import Button from './common/Button';

export default function InvitePage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState('joining'); // 'joining' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [tripId, setTripId] = useState(null);

  useEffect(() => {
    if (!user || !shareCode) return;

    let cancelled = false;

    async function join() {
      try {
        const id = await joinByShareCode(shareCode);
        if (cancelled) return;
        setTripId(id);
        setStatus('success');
        // Auto-redirect after a brief moment
        setTimeout(() => {
          if (!cancelled) navigate(`/trip/${id}`, { replace: true });
        }, 1500);
      } catch (err) {
        if (cancelled) return;
        console.error('[InvitePage] Join error:', err);
        setErrorMsg(
          err.message?.includes('Invalid share code')
            ? '유효하지 않은 초대 링크입니다.'
            : '여행 참여에 실패했습니다. 다시 시도해주세요.'
        );
        setStatus('error');
      }
    }

    join();
    return () => { cancelled = true; };
  }, [user, shareCode, navigate]);

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-surface)',
      padding: '24px',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      {status === 'joining' && (
        <>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'var(--color-primary-container)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <Icon name="persons" size={28} />
          </div>
          <p style={{
            fontSize: 'var(--typo-body-1-n---bold-size)',
            fontWeight: 'var(--typo-body-1-n---bold-weight)',
            color: 'var(--color-on-surface)',
            marginBottom: '8px',
          }}>
            여행에 참여하는 중...
          </p>
          <div style={{
            width: '24px', height: '24px',
            border: '2.5px solid var(--color-surface-container)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginTop: '16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <Icon name="check" size={28} style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <p style={{
            fontSize: 'var(--typo-body-1-n---bold-size)',
            fontWeight: 'var(--typo-body-1-n---bold-weight)',
            color: 'var(--color-on-surface)',
            marginBottom: '8px',
          }}>
            여행에 참여했습니다!
          </p>
          <p style={{
            fontSize: 'var(--typo-caption-1-regular-size)',
            color: 'var(--color-on-surface-variant2)',
            marginBottom: '20px',
          }}>
            잠시 후 일정 화면으로 이동합니다...
          </p>
          <Button variant="primary" size="lg" onClick={() => navigate(`/trip/${tripId}`, { replace: true })}>
            바로 이동
          </Button>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'var(--color-error-container, #fde8e8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}>
            <Icon name="info" size={28} />
          </div>
          <p style={{
            fontSize: 'var(--typo-body-1-n---bold-size)',
            fontWeight: 'var(--typo-body-1-n---bold-weight)',
            color: 'var(--color-on-surface)',
            marginBottom: '8px',
          }}>
            참여 실패
          </p>
          <p style={{
            fontSize: 'var(--typo-caption-1-regular-size)',
            color: 'var(--color-on-surface-variant2)',
            textAlign: 'center',
            marginBottom: '24px',
          }}>
            {errorMsg}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="neutral" size="lg" onClick={() => navigate('/', { replace: true })}>
              홈으로
            </Button>
            <Button variant="primary" size="lg" onClick={() => {
              setStatus('joining');
              setErrorMsg('');
              // Re-trigger the join
              joinByShareCode(shareCode)
                .then((id) => {
                  setTripId(id);
                  setStatus('success');
                  setTimeout(() => navigate(`/trip/${id}`, { replace: true }), 1500);
                })
                .catch((err) => {
                  setErrorMsg(err.message?.includes('Invalid share code')
                    ? '유효하지 않은 초대 링크입니다.'
                    : '여행 참여에 실패했습니다.');
                  setStatus('error');
                });
            }}>
              다시 시도
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
