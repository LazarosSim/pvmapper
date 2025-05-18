import {supabase} from "@/integrations/supabase/client.ts";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Barcode} from "@/lib/types/db-types.ts";
import {useSupabase} from "@/lib/supabase-provider.tsx";

const loadBarcodes = async () => {
    const {data, error} = await supabase
        .from('barcodes')
        .select('id, code, rowId:row_id, userId:user_id, timestamp, displayOrder:display_order, latitude, longitude')
        .order('timestamp', {ascending: false});

    if (error) {
        throw error;
    }

    return data;
}

const toDb = (code:string, rowId:string, userId?:string) => {
    return {
        code: code,
        row_id: rowId,
        user_id: userId,
        timestamp: new Date(Date.now()).toISOString()
    }
}


export const useBarcodes = () => {
    return useQuery({
        queryKey: ['barcodes'],
        queryFn: loadBarcodes
    });
}

export type BarcodeSearchQuery = {
    code?: string;
}

const addBarcode = async (
    code: string,
    rowId: string,
    afterBarcodeIndex?: number,
    userId?: string) => {

    if(!code.trim())
        throw new Error("Barcode is required");

    const {data: insertedRow, error} = await supabase
        .from('barcodes')
        .insert(toDb(code, rowId, userId))
        .select();

    if (error) {
        console.error("Error adding barcode:", error);
        throw error;
    }
    return insertedRow;
}


//TODO: order them based on the display order instead of the timestamp
const loadBarcodesByRow = async (rowId: string, searchQuery?: BarcodeSearchQuery) => {
    const { code } = searchQuery
    const query = supabase
        .from('barcodes')
        .select('id, code, rowId:row_id, userId:user_id, timestamp, displayOrder:display_order, latitude, longitude')
        .eq("row_id", rowId)
        .order('timestamp', { ascending: false });

    if (code) query.like("code", `%${code}%`);
    const {data: barcodes, error} = await query;

    if (error) {
        console.error("Error loading barcodes:", error);
        throw error;
    }

    return barcodes;
}

export const useRowBarcodes = (rowId: string, searchQuery?: BarcodeSearchQuery) => {
    return useQuery({
        queryKey: ['barcodes', rowId],
        queryFn: () => loadBarcodesByRow(rowId, searchQuery),
        enabled: Boolean(rowId)
    });
}

export const useAddBarcodeToRow = (rowId: string) => {
    const queryClient = useQueryClient();
    const { user } = useSupabase();
    return useMutation({
            mutationFn: (code:string) => addBarcode(code, rowId, null, user?.id),
            mutationKey: ['barcodes', rowId],
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: ['barcodes', rowId],
                    exact: true,    // only that one
                })
            }
        }
    );
}