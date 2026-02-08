import Icon from './Icon';
import Button from './Button';

/**
 * Standardized empty state component.
 *
 * @param {object}   props
 * @param {string}   props.icon        - Icon name (from Icon component)
 * @param {string}   props.title       - Main heading text
 * @param {string}   [props.description] - Supporting description
 * @param {object|object[]} [props.actions]  - Button(s) to render. Single object or array.
 *   Each action: { label, variant, iconLeft, onClick }
 */
export default function EmptyState({ icon, title, description, actions }) {
  const actionList = actions
    ? (Array.isArray(actions) ? actions : [actions])
    : [];

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "var(--spacing-sp240) var(--spacing-sp200)", textAlign: "center",
    }}>
      {icon && (
        <Icon
          name={icon}
          size={24}
          style={{ color: "var(--color-on-surface-variant2)", opacity: 0.5, marginBottom: "var(--spacing-sp120)" }}
        />
      )}

      {title && (
        <p style={{
          margin: "0 0 var(--spacing-sp40)",
          fontSize: "var(--typo-body-2-n---bold-size)",
          fontWeight: "var(--typo-body-2-n---bold-weight)",
          color: "var(--color-on-surface)",
        }}>
          {title}
        </p>
      )}

      {description && (
        <p style={{
          margin: "0 0 var(--spacing-sp200)",
          fontSize: "var(--typo-caption-1-regular-size)",
          fontWeight: "var(--typo-caption-1-regular-weight)",
          lineHeight: "var(--typo-caption-1-regular-line-height)",
          color: "var(--color-on-surface-variant2)",
          whiteSpace: "pre-line",
        }}>
          {description}
        </p>
      )}

      {actionList.length > 0 && (
        <div style={{ display: "flex", gap: "var(--spacing-sp80)" }}>
          {actionList.map((a, i) => (
            <Button
              key={i}
              variant={a.variant || "primary"}
              size="md"
              iconLeft={a.iconLeft}
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
