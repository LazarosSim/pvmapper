import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Natural comparison for strings containing numbers.
 * Splits strings into numeric and non-numeric segments and compares
 * them appropriately so "Row 10.1_2" sorts before "Row 10.1_19".
 */
export function naturalCompare(a: string, b: string): number {
  const segmentize = (s: string): (string | number)[] => {
    const parts: (string | number)[] = [];
    const regex = /(\d+\.?\d*|\D+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(s)) !== null) {
      const token = match[1];
      const num = Number(token);
      parts.push(isNaN(num) ? token : num);
    }
    return parts;
  };

  const aParts = segmentize(a);
  const bParts = segmentize(b);
  const len = Math.min(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const aVal = aParts[i];
    const bVal = bParts[i];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      if (aVal !== bVal) return aVal - bVal;
    } else {
      const cmp = String(aVal).localeCompare(String(bVal));
      if (cmp !== 0) return cmp;
    }
  }

  return aParts.length - bParts.length;
}
