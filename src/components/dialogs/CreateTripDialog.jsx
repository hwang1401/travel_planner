import { useState, useCallback } from 'react';
import Button from '../common/Button';
import Field from '../common/Field';
import Icon from '../common/Icon';
import AddressSearch from '../common/AddressSearch';
import BottomSheet from '../common/BottomSheet';

/*
 * ── Create Trip Dialog ──
 * Full-screen style bottom sheet for creating a new trip
 *
 * Steps:
 *   1. Trip name + destinations
 *   2. Date range
 *   3. Members (sharing)
 */

export default function CreateTripDialog({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [destinations, setDestinations] = useState([]);
  const [destInput, setDestInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [members, setMembers] = useState([]);
  const [memberName, setMemberName] = useState('');

  /* ── Destination helpers ── */
  const addDestination = useCallback((dest, lat, lon) => {
    if (!dest || !dest.trim()) return;
    const trimmed = dest.trim();
    if (destinations.some((d) => d.name === trimmed)) return;
    setDestinations((prev) => [...prev, { name: trimmed, lat: lat || null, lon: lon || null }]);
    setDestInput('');
  }, [destinations]);

  const removeDestination = useCallback((idx) => {
    setDestinations((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /* ── Member helpers ── */
  const addMember = useCallback(() => {
    if (!memberName.trim()) return;
    setMembers((prev) => [...prev, { name: memberName.trim(), role: 'editor' }]);
    setMemberName('');
  }, [memberName]);

  const removeMember = useCallback((idx) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /* ── Submit ── */
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim() && startDate && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        destinations: destinations.map((d) => d.name),
        startDate,
        endDate: endDate || startDate,
        members: members.map((m) => ({ ...m, role: m.role || 'editor' })),
      });
    } catch (err) {
      console.error('Create trip error:', err);
      setSubmitting(false);
    }
  };

  /* ── Duration calc ── */
  const duration = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1)
    : null;

  return (
    <BottomSheet onClose={onClose} maxHeight="92vh">
      {/* Header */}
      <div style={{
        padding: '6px 16px 12px 20px', flexShrink: 0,
        borderBottom: '1px solid var(--color-outline-variant)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h3 style={{ margin: 0, fontSize: 'var(--typo-body-1-n---bold-size)', fontWeight: 'var(--typo-body-1-n---bold-weight)', color: 'var(--color-on-surface)' }}>
          새 여행 만들기
        </h3>
        <Button variant="ghost-neutral" size="sm" iconOnly="close" onClick={onClose} />
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── Section: 여행 정보 ── */}
        <section>
          <p style={{
            margin: '0 0 12px', fontSize: 'var(--typo-caption-1-bold-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            여행 정보
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="여행 이름" required size="lg" variant="outlined"
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="예: 후쿠오카 가족여행" />

            {/* Destinations */}
            <div>
              <AddressSearch
                label="여행지"
                value={destInput}
                onChange={(addr, lat, lon) => {
                  if (addr) addDestination(addr, lat, lon);
                  else setDestInput('');
                }}
                placeholder="도시 또는 장소를 검색하세요"
                size="lg"
              />
              {/* Destination chips */}
              {destinations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {destinations.map((dest, i) => (
                    <div key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 10px', borderRadius: 'var(--radius-md, 8px)',
                      background: 'var(--color-primary-container)',
                      fontSize: 'var(--typo-caption-1-bold-size)',
                      fontWeight: 'var(--typo-caption-1-bold-weight)',
                      color: 'var(--color-on-primary-container)',
                    }}>
                      <Icon name="pin" size={12} />
                      {dest.name}
                      <button onClick={() => removeDestination(i)} style={{
                        border: 'none', background: 'none', cursor: 'pointer',
                        padding: '0 0 0 2px', display: 'flex', alignItems: 'center',
                      }}>
                        <Icon name="close" size={12} style={{ opacity: 0.6 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Section: 일정 ── */}
        <section>
          <p style={{
            margin: '0 0 12px', fontSize: 'var(--typo-caption-1-bold-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            일정
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Field label="출발일" required size="lg" variant="outlined"
              type="date" value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate && e.target.value > endDate) setEndDate(e.target.value);
              }}
              style={{ flex: 1 }} />
            <Field label="귀국일" size="lg" variant="outlined"
              type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              style={{ flex: 1 }} />
          </div>

          {duration && (
            <p style={{
              margin: '8px 0 0', fontSize: 'var(--typo-caption-2-medium-size)',
              fontWeight: 'var(--typo-caption-2-medium-weight)', color: 'var(--color-on-surface-variant)',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <Icon name="calendar" size={12} />
              {duration - 1}박 {duration}일
            </p>
          )}
        </section>

        {/* ── Section: 공유 ── */}
        <section>
          <p style={{
            margin: '0 0 12px', fontSize: 'var(--typo-caption-1-bold-size)',
            fontWeight: 'var(--typo-caption-1-bold-weight)', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            함께하는 사람
          </p>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <Field label="이름" size="lg" variant="outlined"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMember(); }}
              placeholder="이름 입력"
              style={{ flex: 1 }} />
            <Button variant="neutral" size="lg" iconOnly="plus" onClick={addMember}
              disabled={!memberName.trim()}
              style={{ flexShrink: 0, marginBottom: '0px' }} />
          </div>

          {/* Member list */}
          {members.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', marginTop: '10px',
              background: 'var(--color-surface-container-lowest)',
              borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--color-outline-variant)',
              overflow: 'hidden',
            }}>
              {members.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px',
                  borderBottom: i < members.length - 1 ? '1px solid var(--color-surface-dim)' : 'none',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--color-primary-container)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--typo-caption-2-bold-size)', fontWeight: 'var(--typo-caption-2-bold-weight)',
                    color: 'var(--color-on-primary-container)', flexShrink: 0,
                  }}>
                    {m.name.charAt(0)}
                  </div>
                  <span style={{
                    flex: 1, fontSize: 'var(--typo-label-2-medium-size)',
                    fontWeight: 'var(--typo-label-2-medium-weight)', color: 'var(--color-on-surface)',
                  }}>
                    {m.name}
                  </span>
                  <span style={{
                    fontSize: 'var(--typo-caption-2-regular-size)', color: 'var(--color-on-surface-variant2)',
                  }}>
                    {m.role === 'editor' ? '편집자' : '보기 전용'}
                  </span>
                  <button onClick={() => removeMember(i)} style={{
                    border: 'none', background: 'none', cursor: 'pointer', padding: '4px',
                    display: 'flex',
                  }}>
                    <Icon name="close" size={14} style={{ opacity: 0.4 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Submit */}
      <div style={{ padding: '0 20px 20px', flexShrink: 0 }}>
        <Button variant="primary" size="xlg" fullWidth onClick={handleCreate} disabled={!canSubmit}>
          {submitting ? '생성 중...' : '여행 만들기'}
        </Button>
      </div>
    </BottomSheet>
  );
}
