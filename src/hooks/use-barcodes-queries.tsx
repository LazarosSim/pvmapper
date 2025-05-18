import {supabase} from "@/integrations/supabase/client.ts";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Barcode} from "@/lib/types/db-types.ts";
import {useSupabase} from "@/lib/supabase-provider.tsx";



const toDb = (code:string, rowId:string, displayOrder?:number, userId?:string) => {
    const now = Date.now();
    return {
        code: code,
        row_id: rowId,
        user_id: userId,
        display_order: displayOrder || 0,
        timestamp: new Date(now).toISOString()
    }
}



export type BarcodeSearchQuery = {
    code?: string;
}

const addBarcode = async (
    code: string,
    rowId: string,
    displayOrder?: number,
    userId?: string) => {

    if(!code.trim())
        throw new Error("Barcode is required");

    const {data: insertedRow, error} = await supabase
        .from('barcodes')
        .insert(toDb(code, rowId, displayOrder, userId))
        .select();

    if (error) {
        console.error("Error adding barcode:", error);
        throw error;
    }
    return insertedRow;
}

const resetRow = async (rowId: string)=> {

    if(!rowId.trim())
        throw new Error("Row ID is required");

    const {error, count} = await supabase
        .from('barcodes')
        .delete()
        .eq('row_id', rowId)
        .select();
    if (error) {
        console.error("Error resetting row:", error);
        throw error;
    }
    return count;
    }



const loadBarcodesByRow = async (rowId: string, searchQuery?: BarcodeSearchQuery) => {
    const { code } = searchQuery
    const query = supabase
        .from('barcodes')
        .select('id, code, rowId:row_id, userId:user_id, timestamp, displayOrder:display_order, latitude, longitude')
        .eq("row_id", rowId)
        .order('display_order', { ascending: true });

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



class AddBarcodeVariables {
    code: string;
    displayOrder?: number;
}

export const useAddBarcodeToRow = (rowId: string) => {
    const queryClient = useQueryClient();
    const { user } = useSupabase();
    return useMutation({
            mutationFn: ({ code, displayOrder }: AddBarcodeVariables) => addBarcode(code, rowId, displayOrder, user?.id),
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



export const useResetRowBarcodes = (rowId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => resetRow(rowId),
        mutationKey: ['barcodes', rowId],
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['barcodes', rowId],
                exact: true,    // only that one
            })
        }
    })
}