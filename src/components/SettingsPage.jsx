import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from './common/Button';
import ConfirmDialog from './common/ConfirmDialog';
import { getTheme, setTheme, applyTheme } from '../utils/theme';
import { SPACING, RADIUS } from '../styles/tokens';

const THEME_OPTIONS = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
  { value: 'system', label: '시스템 설정 따름' },
];

const rowBase = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.lg,
  width: '100%',
  padding: `${SPACING.lg} ${SPACING.xl}`,
  border: 'none',
  borderRadius: 0,
  background: 'transparent',
  color: 'var(--color-on-surface)',
  fontSize: 'var(--typo-label-2-regular-size)',
  cursor: 'pointer',
  textAlign: 'left',
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [themeValue, setThemeValue] = useState(getTheme());
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    setThemeValue(getTheme());
  }, []);

  const handleThemeChange = (value) => {
    setTheme(value);
    setThemeValue(value);
    applyTheme();
  };

  const handleLogout = () => {
    setConfirmLogout({
      title: '로그아웃',
      message: '로그아웃 하시겠습니까?',
      confirmLabel: '로그아웃',
      onConfirm: async () => {
        await signOut();
        setConfirmLogout(null);
      },
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-surface)',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        padding: `${SPACING.lg} ${SPACING.xl}`,
        borderBottom: '1px solid var(--color-outline-variant)',
        background: 'var(--color-surface-container-lowest)',
      }}>
        <Button variant="ghost-neutral" size="md" iconOnly="chevronLeft" onClick={() => navigate('/')} title="뒤로" />
        <h1 style={{
          margin: 0,
          flex: 1,
          fontSize: 'var(--typo-heading-3-bold-size)',
          fontWeight: 'var(--typo-heading-3-bold-weight)',
          color: 'var(--color-on-surface)',
        }}>
          설정
        </h1>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: SPACING.xl }}>
        {/* 테마 */}
        <section style={{ marginBottom: SPACING.xxxl }}>
          <h2 style={{
            margin: `0 0 ${SPACING.lg}`,
            paddingLeft: SPACING.xl,
            fontSize: 'var(--typo-caption-1-bold-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)',
            color: 'var(--color-on-surface-variant2)',
            letterSpacing: '0.5px',
          }}>
            테마
          </h2>
          <div style={{
            background: 'var(--color-surface-container-lowest)',
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
            border: '1px solid var(--color-outline-variant)',
          }}>
            {THEME_OPTIONS.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleThemeChange(opt.value)}
                style={{
                  ...rowBase,
                  borderTop: i === 0 ? 'none' : '1px solid var(--color-outline-variant)',
                }}
              >
                <span
                  role="presentation"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${themeValue === opt.value ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                    background: themeValue === opt.value ? 'var(--color-primary)' : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {themeValue === opt.value && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--color-on-primary)',
                      }}
                    />
                  )}
                </span>
                <span style={{ flex: 1 }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 로그아웃 */}
        <section>
          <div style={{
            background: 'var(--color-surface-container-lowest)',
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                ...rowBase,
                justifyContent: 'center',
                color: 'var(--color-error)',
                fontWeight: 'var(--typo-label-2-bold-weight)',
              }}
            >
              로그아웃
            </button>
          </div>
        </section>
      </div>

      {confirmLogout && (
        <ConfirmDialog
          title={confirmLogout.title}
          message={confirmLogout.message}
          confirmLabel={confirmLogout.confirmLabel}
          onConfirm={confirmLogout.onConfirm}
          onCancel={() => setConfirmLogout(null)}
        />
      )}
    </div>
  );
}
