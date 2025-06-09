import {supabase} from "@/integrations/supabase/client.ts";
import {PostgrestError} from "@supabase/supabase-js";

const toDb = (code: string, rowId: string, givenTimestamp: string, order_in_row: number, userId?: string) => {
    return {
        code: code,
        row_id: rowId,
        user_id: userId,
        order_in_row: order_in_row,
        timestamp: givenTimestamp
    }
}

function assertNoError(error: PostgrestError | null, op: string): asserts error is null {
    if (error) {
        console.error(`Error ${op}: ${error.message}`);
        throw error;
    }
}

export const addBarcode = async (
    code: string,
    rowId: string,
    orderInRow: number,
    isLast: boolean,
    userId?: string,
    timestamp?: string) => {

    console.log('[addBarcode] START', {code, rowId, orderInRow, userId})

    if (!timestamp) {
        timestamp = new Date(Date.now()).toISOString()
    }

    if (!isLast) {
        console.info('Shifting barcodes...')
        await supabase.rpc('shift_order', {p_row_id: rowId, p_index: orderInRow});
    }

    const {data: insertedRow, error} = await supabase
        .from('barcodes')
        .insert(toDb(code, rowId, timestamp, orderInRow, userId))
        .select();

    assertNoError(error, 'inserting barcode');
    return insertedRow;
}

export const updateBarcode = async ({id, code}: { id: string, code: string }) => {
    console.log("about to update barcode with id " + id + " and code " + code);

    const {data: updatedRow, error} = await supabase
        .from('barcodes')
        .update({code: code})
        .eq('id', id)
        .select('*')
        .single()

    assertNoError(error, 'updating barcode');
    return updatedRow;
}

export const deleteBarcode = async (id: string) => {
    console.log("about to delete barcode with id " + id);

    const {data: deletedBarcode, error} = await supabase
        .from('barcodes')
        .delete()
        .eq('id', id)
        .select('*')
        .single()

    assertNoError(error, 'deleting barcode');
    return deletedBarcode;
}