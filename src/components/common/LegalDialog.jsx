/**
 * LegalDialog — 이용약관 / 개인정보 처리방침 풀스크린 팝업.
 * 간단한 마크다운을 HTML로 변환하여 표시합니다.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBackClose } from '../../hooks/useBackClose';
import Button from './Button';
import { SPACING } from '../../styles/tokens';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../data/legalDocs';

/* ── 간이 마크다운 → React ── */
function parseMd(md) {
  const lines = md.split('\n');
  const elements = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄
    if (line.trim() === '') { i++; continue; }

    // 수평선
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--color-outline-variant)', margin: '20px 0' }} />);
      i++; continue;
    }

    // 제목
    if (line.startsWith('### ')) {
      elements.push(<h4 key={key++} style={{ margin: '20px 0 8px', fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>{bold(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={key++} style={{ margin: '24px 0 8px', fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)' }}>{bold(line.slice(3))}</h3>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={key++} style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: 'var(--color-on-surface)' }}>{bold(line.slice(2))}</h2>);
      i++; continue;
    }

    // 테이블
    if (line.trim().startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]); i++;
      }
      elements.push(renderTable(tableLines, key++));
      continue;
    }

    // 번호 리스트
    if (/^\d+\.\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.7 }}>
          {items.map((item, j) => <li key={j}>{bold(item)}</li>)}
        </ol>
      );
      continue;
    }

    // 불릿 리스트
    if (line.trim().startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.7 }}>
          {items.map((item, j) => <li key={j}>{bold(item)}</li>)}
        </ul>
      );
      continue;
    }

    // 일반 문단
    elements.push(<p key={key++} style={{ margin: '8px 0', fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.7 }}>{bold(line)}</p>);
    i++;
  }

  return elements;
}

/** **bold** 처리 */
function bold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>{part}</strong>
      : part
  );
}

/** 마크다운 테이블 → <table> */
function renderTable(lines, key) {
  const parse = (line) => line.split('|').slice(1, -1).map(c => c.trim());
  const header = parse(lines[0]);
  // 2번째 줄은 구분선 (|---|---|)
  const rows = lines.slice(2).map(parse);

  return (
    <div key={key} style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', lineHeight: 1.6 }}>
        <thead>
          <tr>
            {header.map((h, j) => (
              <th key={j} style={{ padding: '6px 8px', background: 'var(--color-surface-container-lowest)', borderBottom: '1px solid var(--color-outline-variant)', textAlign: 'left', fontWeight: 600, color: 'var(--color-on-surface)', whiteSpace: 'nowrap' }}>{bold(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>{bold(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LegalDialog({ type, onClose }) {
  useBackClose(true, onClose);

  useEffect(() => {
    const scrollY = window.scrollY ?? window.pageYOffset;
    document.body.style.position = 'fixed';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.top = `-${scrollY}px`;
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const content = type === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;
  const title = type === 'privacy' ? '개인정보 처리방침' : '서비스 이용약관';

  const modal = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface)',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: SPACING.md,
        padding: `${SPACING.md} ${SPACING.md} ${SPACING.md} ${SPACING.sm}`,
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${SPACING.md})`,
        borderBottom: '1px solid var(--color-outline-variant)',
        flexShrink: 0,
      }}>
        <Button variant="ghost-neutral" size="sm" iconOnly="chevronLeft" onClick={onClose} />
        <span style={{
          fontWeight: 600,
          fontSize: 'var(--typo-label-1-bold-size, 15px)',
          color: 'var(--color-on-surface)',
          flex: 1,
        }}>
          {title}
        </span>
      </div>

      {/* 본문 */}
      <div style={{
        flex: 1, overflowY: 'auto', overscrollBehavior: 'contain',
        padding: `${SPACING.xl} ${SPACING.xxl} 40px`,
      }}>
        {parseMd(content)}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
