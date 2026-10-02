/**
 * Default name for a new row: one more than the highest "Row N" in the park.
 * Subrows ("Row 3_a") and decimal names ("Row 10.1") count by their leading number.
 */
export function nextRowName(existingNames: string[]): string {
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  let next = 1;
  for (const name of existingNames) {
    const match = name.match(/^Row\s+(\d+)/i);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  while (taken.has(`row ${next}`)) next++;
  return `Row ${next}`;
}

export type SubRowPlan =
  | { error: string }
  | { renameParentTo?: string; newRowName: string };

/**
 * Work out the names for adding a subrow under `parentName`.
 * "Row 5" becomes "Row 5_a" and the new row is "Row 5_b";
 * when "Row 5_a".."Row 5_c" exist, the new row is "Row 5_d".
 */
export function planSubRow(parentName: string, parkRowNames: string[]): SubRowPlan {
  const baseMatch = parentName.match(/^Row\s+(\d+)(?:_[a-z])?$/i);
  if (!baseMatch) {
    return { error: 'Unable to determine parent row base name' };
  }
  const rowNumber = baseMatch[1];

  if (!/_[a-z]$/i.test(parentName)) {
    return { renameParentTo: `Row ${rowNumber}_a`, newRowName: `Row ${rowNumber}_b` };
  }

  const suffixes = parkRowNames
    .map((name) => name.match(/^Row\s+(\d+)_([a-z])$/i))
    .filter((match): match is RegExpMatchArray => !!match && match[1] === rowNumber)
    .map((match) => match[2].toLowerCase().charCodeAt(0));

  const parentSuffix = parentName.slice(-1).toLowerCase().charCodeAt(0);
  const lastSuffix = Math.max(parentSuffix, ...suffixes);
  return { newRowName: `Row ${rowNumber}_${String.fromCharCode(lastSuffix + 1)}` };
}
