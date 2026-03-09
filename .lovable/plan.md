

# Plan: Export Mode Dialog with "Metlen Standard" Format

## Overview

When the user clicks the export icon on a park card, instead of immediately exporting, a dialog will appear offering two export modes: **Standard** (current behavior) and **Metlen Standard** (all barcodes in a single sheet with specific columns).

## Changes

### 1. Create Export Mode Dialog Component

**New file: `src/components/parks/ExportDialog.tsx`**

A dialog with two radio/select options:
- **Standard** -- current multi-tab export (one tab per row + summary)
- **Metlen Standard** -- two tabs only: Summary + a single "Barcodes" tab

The "Metlen Standard" tab structure:
| A/A | ROW NAME | STRING NAME | SERIAL NUMBER |
|-----|----------|-------------|---------------|
| 1   | Row 5.2_1 |            | ABC123        |
| 2   | Row 5.2_1 |            | DEF456        |
| 1   | Row 5.2_2 |            | GHI789        |

- **A/A**: Counter that resets to 1 for the first barcode of each row
- **ROW NAME**: The row's name
- **STRING NAME**: Empty column (filled manually later)
- **SERIAL NUMBER**: The barcode code
- Column widths set via `!cols` property so text fits without truncation (A/A: 6, ROW NAME: 20, STRING NAME: 20, SERIAL NUMBER: 30)
- Rows are ordered using `naturalCompare` on row name, barcodes within each row ordered by `order_in_row`

### 2. Update ParkCard Export Button

**File: `src/components/parks/park-card.tsx`**

- Click on export icon opens the new `ExportDialog` instead of calling `handleExportExcel` directly
- Pass park data, rows, and the `fetchBarcodesForRow` function to the dialog
- Move export logic into the dialog component (or keep as callbacks passed in)

### 3. Implementation Details

**Metlen Standard export logic:**
```text
1. Fetch all rows for the park, sorted by naturalCompare
2. For each row (in order):
   a. Fetch barcodes ordered by order_in_row
   b. Reset A/A counter to 1
   c. For each barcode: push [counter++, row.name, "", barcode.code]
3. Create worksheet with headers + data
4. Set !cols for column widths
5. Add Summary tab (same as Standard)
6. Write workbook with 2 tabs: Summary, Barcodes
```

**Column width configuration:**
```typescript
ws['!cols'] = [
  { wch: 6 },   // A/A
  { wch: 20 },  // ROW NAME
  { wch: 20 },  // STRING NAME
  { wch: 30 },  // SERIAL NUMBER
];
```

## Files

| File | Action |
|------|--------|
| `src/components/parks/ExportDialog.tsx` | Create -- dialog with mode selection + both export implementations |
| `src/components/parks/park-card.tsx` | Modify -- open dialog on export click instead of direct export |

