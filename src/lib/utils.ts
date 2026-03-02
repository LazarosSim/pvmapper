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

/**
 * Sanitize a string into a valid Excel sheet name (max 31 chars, safe chars only).
 */
export function toSafeSheetName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 31);
}

/**
 * Ensure a sheet name is unique within the set of already-used names.
 * Appends _2, _3, etc. if a collision is found, keeping within 31 chars.
 */
export function ensureUniqueSheetName(name: string, usedNames: Set<string>): string {
  let candidate = name;
  let counter = 2;
  while (usedNames.has(candidate)) {
    const suffix = `_${counter}`;
    candidate = name.slice(0, 31 - suffix.length) + suffix;
    counter++;
  }
  usedNames.add(candidate);
  return candidate;
}

export interface WorksheetEntry {
  originalName: string;
  sheetName: string;
  type: 'summary' | 'row';
  worksheet: any;
}

/**
 * Sort worksheet entries: Summary first, then rows by natural order of originalName.
 */
export function sortWorksheetEntries(entries: WorksheetEntry[]): WorksheetEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type === 'summary' && b.type !== 'summary') return -1;
    if (a.type !== 'summary' && b.type === 'summary') return 1;
    return naturalCompare(a.originalName, b.originalName);
  });
}
