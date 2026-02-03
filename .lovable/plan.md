
# Plan: Preserve Barcode Order at All Stages of Data Handling

## Root Cause Analysis

After a barcode was edited in Row 1 of Test Park, it moved from position 39 to position 2. This is a **critical data integrity bug** caused by field name mismatch between database responses (snake_case) and client cache (camelCase).

### The Bug Flow

```text
1. User edits barcode at position 39
2. updateBarcode() calls Supabase .update().select('*')
3. Server returns: { id: "...", code: "...", order_in_row: 38, ... }
4. useUpdateRowBarcode.onSuccess replaces cached barcode with server response
5. Cache now has: { id: "...", code: "...", order_in_row: 38, orderInRow: undefined }
6. mergeBarcodesWithPending sorts by: (a.orderInRow ?? 0)
7. undefined ?? 0 = 0, so barcode moves to position 1/2
```

### Identified Vulnerabilities

| Location | Issue | Severity |
|----------|-------|----------|
| `useUpdateRowBarcode` in `use-barcodes-queries.tsx:183` | Replaces cache entry with raw server response (snake_case), losing `orderInRow` | **CRITICAL** |
| `useDeleteRowBarcode` in `use-barcodes-queries.tsx:197-207` | Mutates array in place (splice) instead of returning new array | Medium |
| `mergeBarcodesWithPending` in `use-offline-barcodes.ts:71` | Relies on `orderInRow ?? 0` - undefined becomes 0 | High |
| `updateBarcode` in `barcode-service.ts:56` | Returns `select('*')` without field mapping | Contributing factor |
| Optimistic update in `use-offline-barcodes.ts:216-223` | Preserves order correctly (no issue here) | OK |

---

## Solution: Order-Preserving Cache Updates

### Phase 1: Fix `useUpdateRowBarcode` Cache Update

**File:** `src/hooks/use-barcodes-queries.tsx`

**Current (broken):**
```typescript
onSuccess: (barcode) => {
    queryClient.setQueryData(['barcodes', 'row', rowId],
        (oldData:{ id:string, code:string} []) => {
            if (oldData) {
                const index = oldData.findIndex(b => b.id === barcode.id);
                if (index >= 0) {
                    oldData[index] = barcode; // PROBLEM: Replaces with snake_case
                }
            }
            return oldData;
        })
}
```

**Fixed (order-preserving):**
```typescript
onSuccess: (serverBarcode) => {
    queryClient.setQueryData<Barcode[]>(['barcodes', 'row', rowId],
        (oldData) => {
            if (!oldData) return oldData;
            
            return oldData.map(b => {
                if (b.id === serverBarcode.id) {
                    // Merge: update only the code, preserve all other fields
                    return {
                        ...b,
                        code: serverBarcode.code,
                        // Explicitly preserve order
                        orderInRow: b.orderInRow,
                    };
                }
                return b;
            });
        })
}
```

**Key changes:**
- Use `.map()` instead of mutating in place (React Query best practice)
- Merge fields instead of replacing the entire object
- Explicitly preserve `orderInRow` from the original cache entry

### Phase 2: Fix `useDeleteRowBarcode` Cache Update

**File:** `src/hooks/use-barcodes-queries.tsx`

**Current (mutates in place):**
```typescript
onSuccess: (barcode) => {
    queryClient.setQueryData(['barcodes', 'row', rowId],
        (oldData:{ id:string, code:string} []) => {
            if (oldData) {
                const index = oldData.findIndex(b => b.id === barcode.id);
                if (index >= 0) {
                    oldData.splice(index, 1); // Mutates array
                }
            }
            return oldData;
        })
    ...
}
```

**Fixed (immutable):**
```typescript
onSuccess: (deletedBarcode) => {
    queryClient.setQueryData<Barcode[]>(['barcodes', 'row', rowId],
        (oldData) => {
            if (!oldData) return oldData;
            // Filter returns new array, preserves order of remaining items
            return oldData.filter(b => b.id !== deletedBarcode.id);
        })
    ...
}
```

### Phase 3: Add Defensive Ordering in `mergeBarcodesWithPending`

**File:** `src/hooks/use-offline-barcodes.ts`

**Current (vulnerable to undefined):**
```typescript
return combined.sort((a, b) => (a.orderInRow ?? 0) - (b.orderInRow ?? 0));
```

**Fixed (defensive with timestamp fallback):**
```typescript
return combined.sort((a, b) => {
    // Primary sort: by orderInRow (required for correct display)
    const orderA = a.orderInRow ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.orderInRow ?? Number.MAX_SAFE_INTEGER;
    
    if (orderA !== orderB) {
        return orderA - orderB;
    }
    
    // Fallback: sort by timestamp to maintain insertion order
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeA - timeB;
});
```

**Why `MAX_SAFE_INTEGER` instead of 0:**
- If `orderInRow` is undefined (corrupted data), push to end not beginning
- Prevents newly corrupted data from displacing existing ordered data

### Phase 4: Add Defensive Ordering in Query Functions

**File:** `src/hooks/use-barcodes-queries.tsx`

Already correctly ordering by `order_in_row` in the query (line 30), but add a client-side safety sort after mapping:

```typescript
const loadBarcodesByRow = async (rowId: string): Promise<Barcode[]> => {
    const query = supabase
        .from('barcodes')
        .select('id, code, rowId:row_id, userId:user_id, timestamp, orderInRow:order_in_row, latitude, longitude')
        .eq("row_id", rowId)
        .order('order_in_row', {ascending: true});

    const {data: barcodes, error} = await query;

    if (error) {
        console.error("Error loading barcodes:", error);
        throw error;
    }
    
    // Safety sort - ensure order even if cache was corrupted
    return (barcodes || []).sort((a, b) => 
        (a.orderInRow ?? Number.MAX_SAFE_INTEGER) - (b.orderInRow ?? Number.MAX_SAFE_INTEGER)
    );
}
```

### Phase 5: Improve `updateBarcode` Service Response

**File:** `src/services/barcode-service.ts`

**Current:** Returns raw server response with snake_case

**Fixed:** Map to client format with explicit ordering:

```typescript
export const updateBarcode = async ({id, code}: { id: string, code: string }) => {
    console.log("about to update barcode with id " + id + " and code " + code);

    const {data: updatedRow, error} = await supabase
        .from('barcodes')
        .update({code: code})
        .eq('id', id)
        .select('id, code, rowId:row_id, userId:user_id, timestamp, orderInRow:order_in_row, latitude, longitude')
        .single()

    assertNoError(error, 'updating barcode');
    return updatedRow;
}
```

This ensures the response matches the client type (camelCase) exactly.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/use-barcodes-queries.tsx` | Fix `useUpdateRowBarcode` and `useDeleteRowBarcode` cache updates |
| `src/hooks/use-offline-barcodes.ts` | Defensive sorting in `mergeBarcodesWithPending` |
| `src/services/barcode-service.ts` | Map response fields to camelCase in `updateBarcode` |

---

## Testing Checklist

After implementation:

- [ ] Edit barcode at position 39 in Row 1 - verify it stays at position 39
- [ ] Edit barcode at position 1 in Row 1 - verify it stays at position 1
- [ ] Delete barcode at position 20 - verify positions 21+ shift down correctly
- [ ] Add new barcode - verify it appears at the end
- [ ] Insert barcode at middle position - verify order is maintained
- [ ] Refresh page after edit - verify database order matches display
- [ ] Test offline edit + sync - verify order preserved after sync
- [ ] Export data - verify exported order matches UI order

---

## Prevention: Type Safety Improvements

Add explicit type checking to catch similar issues in the future:

```typescript
// In types/db-types.ts - add validation
export function assertBarcodeHasOrder(barcode: Partial<Barcode>): asserts barcode is Barcode {
    if (typeof barcode.orderInRow !== 'number') {
        console.error('Barcode missing orderInRow:', barcode);
        throw new Error('Barcode must have orderInRow');
    }
}
```
