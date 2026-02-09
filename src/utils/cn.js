import clsx from 'clsx';

/**
 * Utility for conditionally joining class names.
 * Thin wrapper around clsx for consistency.
 *
 * Usage:
 *   cn("base-class", isActive && "active", variant === "primary" && "bg-primary")
 */
export default function cn(...args) {
  return clsx(...args);
}
