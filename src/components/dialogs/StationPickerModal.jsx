import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { getStationsByRegion, getStationList, findRoutesByStations } from '../../data/timetable';

/**
 * 출발지 / 도착지 2단계 선택 — 풀스크린 오버레이.
 * createPortal로 document.body에 직접 렌더링하여
 * PageTransition의 transform 등 부모 레이아웃에 영향 받지 않음.
 */
export default function StationPickerModal({ onClose, onSelect, initialFrom = '', initialTo = '' }) {
  const [step, setStep] = useState(initialFrom ? 2 : 1);
  const [from, setFrom] = useState(initialFrom);
  const [query, setQuery] = useState('');

  const regionGroups = useMemo(() => getStationsByRegion(), []);
  const allStations = useMemo(() => getStationList(), []);

  const availableDests = useMemo(() => {
    if (!from) return [];
    return allStations.filter((s) => s !== from && findRoutesByStations(from, s).length > 0);
  }, [from, allStations]);

  const q = (query || '').trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    const src = step === 1
      ? regionGroups
      : regionGroups.map((g) => {
          const destSet = new Set(availableDests);
          return { ...g, stations: g.stations.filter((s) => destSet.has(s)) };
        });
    return src
      .map((g) => ({ ...g, stations: g.stations.filter((s) => !q || s.toLowerCase().includes(q)) }))
      .filter((g) => g.stations.length > 0);
  }, [step, regionGroups, availableDests, q]);

  const handlePick = (station) => {
    if (step === 1) {
      setFrom(station);
      setQuery('');
      setStep(2);
    } else {
      onSelect(from, station);
      onClose();
    }
  };

  const title = step === 1 ? '출발지 선택' : '도착지 선택';

  const overlay = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface-container-lowest)',
      animation: 'stationPickerSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <style>{`
        @keyframes stationPickerSlideIn {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* ── 상단 헤더 ── */}
      <div style={{
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-outline-variant)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px 10px 8px',
        }}>
          <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
          <h3 style={{
            margin: 0, flex: 1,
            fontSize: 'var(--typo-body-1-n---bold-size)',
            fontWeight: 'var(--typo-body-1-n---bold-weight)',
            color: 'var(--color-on-surface)',
          }}>
            {title}
          </h3>
        </div>

        {/* step 2: 출발지 표시 + 변경 */}
        {step === 2 && (
          <div style={{
            padding: '8px 20px 10px',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'var(--color-primary-container)',
            borderBottom: '1px solid var(--color-outline-variant)',
          }}>
            <Icon name="navigation" size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <span style={{
              flex: 1,
              fontSize: 'var(--typo-label-2-bold-size)',
              fontWeight: 700,
              color: 'var(--color-on-primary-container)',
            }}>
              {from} 출발
            </span>
            <button type="button"
              onClick={() => { setStep(1); setFrom(''); setQuery(''); }}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 'var(--typo-caption-1-regular-size)',
                color: 'var(--color-primary)',
                fontFamily: 'inherit', fontWeight: 600,
                padding: '4px 8px',
              }}>
              변경
            </button>
          </div>
        )}

        {/* 검색 입력 — Field/AddressSearch와 동일 스타일 */}
        <div style={{ padding: '12px 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            height: 'var(--height-lg, 36px)', padding: '0 var(--spacing-sp140, 14px)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--color-surface-container-lowest)',
          }}>
            <Icon name="search" size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={step === 1 ? '역명 검색 (예: 하카타)' : '도착지 검색'}
              autoFocus
              style={{
                flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none',
                fontSize: 'var(--typo-label-1-n---regular-size)',
                fontWeight: 'var(--typo-label-1-n---regular-weight)',
                color: 'var(--color-on-surface)', fontFamily: 'inherit',
              }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <Icon name="close" size={14} style={{ opacity: 0.4 }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 역 목록 ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
      }}>
        {filteredGroups.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Icon name="navigation" size={36} style={{ color: 'var(--color-on-surface-variant2)', opacity: 0.2, marginBottom: '16px' }} />
            <p style={{ margin: 0, fontSize: 'var(--typo-body-2-size)', color: 'var(--color-on-surface-variant2)' }}>
              {q ? '검색 결과가 없습니다' : (step === 2 ? `${from}에서 출발하는 노선이 없습니다` : '등록된 역이 없습니다')}
            </p>
          </div>
        ) : (
          filteredGroups.map((g) => (
            <div key={g.region}>
              {/* 지역 헤더 */}
              <div style={{
                padding: '14px 20px 6px',
                fontSize: 'var(--typo-caption-1-bold-size)',
                fontWeight: 700,
                color: 'var(--color-primary)',
                letterSpacing: '0.5px',
                position: 'sticky', top: 0,
                background: 'var(--color-surface-container-lowest)',
                zIndex: 1,
                borderBottom: '1px solid var(--color-surface-dim)',
              }}>
                {g.region}
              </div>
              {g.stations.map((s, i) => (
                <button key={s} type="button"
                  onClick={() => handlePick(s)}
                  style={{
                    width: '100%', padding: '14px 20px',
                    textAlign: 'left', border: 'none',
                    background: 'transparent',
                    color: 'var(--color-on-surface)',
                    fontSize: 'var(--typo-body-2-size)',
                    fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    borderBottom: i < g.stations.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                  }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--color-surface-container-high)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon name="navigation" size={13} style={{ color: 'var(--color-on-surface-variant)' }} />
                  </div>
                  <span style={{ flex: 1 }}>{s}</span>
                  <Icon name="chevronRight" size={12} style={{ opacity: 0.15, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
