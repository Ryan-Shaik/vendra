import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS classes safely, resolving conflicts.
 * Uses clsx for conditional logic and tailwind-merge for deduplication.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-accent-primary', className)
 * cn('px-4 px-6') // → 'px-6' (conflict resolved, last wins)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
