/*
 * Onboarding Slides — shown on first app launch.
 *
 * Design decisions (research-driven):
 * - 3 slides: industry standard for travel apps (TripIt, Wanderlog)
 * - 60/40 split: screenshot area (top) / text+CTA area (bottom)
 * - Full-bleed screenshots on primary gradient — no phone frame gimmick
 * - Expressive minimalism: bold headline, muted desc, generous whitespace
 * - All styling from design tokens (SPACING, COLOR, TYPO, RADIUS)
 * - Matches Splash → Onboarding → Login visual continuity
 */

import { useState, useRef, useCallback } from 'react';
import { SPACING, RADIUS, COLOR, TYPO } from '../styles/tokens';

/* Carousel sizing — single source of truth for translateX math.
 * Uses percentage (%) instead of vw so it works inside the 480px desktop container. */
const CARD_PCT = 65;     // card width in % of container
const CAROUSEL_GAP = 16; // gap between cards in px

const SLIDES = [
  {
    image: '/onboarding/slide1.png',
    title: '하루하루 완벽한 동선',
    desc: '시간대별 일정, 맛집, 관광지를\n한눈에 확인하고 자유롭게 편집하세요.',
  },
  {
    image: '/onboarding/slide2.png',
    title: 'AI와 대화하며 계획하기',
    desc: '목적지와 기간만 알려주세요.\nAI가 맞춤 여행 일정을 추천합니다.',
  },
  {
    image: '/onboarding/slide3.png',
    title: '지도로 한눈에',
    desc: '일정 속 장소들을 지도에서 확인하고\n동행자와 실시간으로 공유하세요.',
  },
];

export default function OnboardingSlides({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const isLast = current === SLIDES.length - 1;
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleComplete = useCallback(() => {
    localStorage.setItem('travelunu_onboarding_done', '1');
    onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (isLast) handleComplete();
    else setCurrent((p) => p + 1);
  }, [isLast, handleComplete]);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    // Only swipe if horizontal distance > vertical (not a scroll)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && current < SLIDES.length - 1) setCurrent((p) => p + 1);
      if (dx < 0 && current > 0) setCurrent((p) => p - 1);
    }
  }, [current]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed', zIndex: 9999,
        top: 0, bottom: 0,
        left: 'var(--app-left, 0px)',
        right: 'var(--app-right, 0px)',
        display: 'flex', flexDirection: 'column',
        background: COLOR.surface,
        overflow: 'hidden',
      }}
    >
      {/* ── Screenshot area ── */}
      <div style={{
        flex: '1 1 0%',
        display: 'flex',
        flexDirection: 'column',
        background: COLOR.primary,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Safe-area spacer — carousel cannot overflow into this */}
        <div style={{ flexShrink: 0, height: 'calc(env(safe-area-inset-top, 0px) + 16px)' }} />

        {/* Carousel viewport — flex:1 gives it a concrete height */}
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '80px',
            background: `linear-gradient(to bottom, transparent, ${COLOR.surface})`,
            zIndex: 1,
            pointerEvents: 'none',
          }} />

          {/* Carousel track — absolute so it inherits viewport height */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: '24px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: `${CAROUSEL_GAP}px`,
            transform: `translateX(calc(50% - ${CARD_PCT / 2}% - ${current} * (${CARD_PCT}% + ${CAROUSEL_GAP}px)))`,
            transition: 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)',
            zIndex: 0,
          }}>
            {SLIDES.map((slide, i) => (
              <div
                key={i}
                style={{
                  flexShrink: 0,
                  width: `${CARD_PCT}%`,
                  height: '100%',
                  borderRadius: RADIUS.xl,
                  overflow: 'hidden',
                  boxShadow: i === current
                    ? '0 16px 48px rgba(0,0,0,0.25)'
                    : '0 8px 24px rgba(0,0,0,0.15)',
                  transform: i === current ? 'scale(1)' : 'scale(0.9)',
                  opacity: i === current ? 1 : 0.4,
                  transition: 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.4s ease, box-shadow 0.4s ease',
                }}
              >
                <img
                  src={slide.image}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                    display: 'block',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom panel: text + controls (40%) ── */}
      <div style={{
        padding: `${SPACING.lg} ${SPACING.xxxl}`,
        paddingBottom: 'calc(var(--safe-area-bottom, 0px) + 16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: COLOR.surface,
      }}>
        {/* Title */}
        <h2 style={{
          margin: `0 0 ${SPACING.md}`,
          fontSize: TYPO.heading2.size,
          fontWeight: TYPO.heading2.weight,
          color: COLOR.onSurface,
          textAlign: 'center',
          letterSpacing: '-0.3px',
        }}>
          {SLIDES[current].title}
        </h2>

        {/* Description */}
        <p style={{
          margin: `0 0 ${SPACING.lg}`,
          fontSize: TYPO.label2.size,
          fontWeight: TYPO.label2.weight,
          color: COLOR.onSurfaceVariant,
          textAlign: 'center',
          lineHeight: 1.6,
          whiteSpace: 'pre-line',
        }}>
          {SLIDES[current].desc}
        </p>

        {/* Dot indicators */}
        <div style={{
          display: 'flex',
          gap: SPACING.md,
          marginBottom: SPACING.lg,
        }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`슬라이드 ${i + 1}`}
              style={{
                width: i === current ? '24px' : '8px',
                height: '8px',
                borderRadius: RADIUS.full,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: i === current ? COLOR.primary : COLOR.outlineVariant,
                transition: 'width 0.3s cubic-bezier(0.25, 0.1, 0.25, 1), background 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            maxWidth: '320px',
            height: '52px',
            borderRadius: RADIUS.lg,
            border: 'none',
            background: COLOR.primary,
            color: COLOR.onPrimary,
            fontSize: TYPO.body1.size,
            fontWeight: TYPO.body1.weight,
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: '0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {isLast ? '시작하기' : '다음'}
        </button>

        {/* Skip — below CTA, hidden on last slide but keeps space */}
        <button
          onClick={isLast ? undefined : handleComplete}
          style={{
            background: 'none', border: 'none',
            marginTop: SPACING.lg,
            padding: `${SPACING.sm} 0`,
            fontSize: TYPO.caption1.size,
            fontWeight: TYPO.caption1.weight,
            color: COLOR.onSurfaceVariant2,
            cursor: isLast ? 'default' : 'pointer',
            fontFamily: 'inherit',
            visibility: isLast ? 'hidden' : 'visible',
          }}
        >
          건너뛰기
        </button>
      </div>
    </div>
  );
}
