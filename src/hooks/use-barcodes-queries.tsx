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
        display_order: displayOrder || 1000,
        timestamp: new Date(now).toISOString()
    }
}


const addBarcode = async (
    code: string,
    rowId: string,
    displayOrder?: number,
    userId?: string) => {
    console.log("use-barcodes-queries: addBarcode called with code " + code + " and rowId " + rowId + " and displayOrder " + displayOrder + " and userId " + userId + "");

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

    const {count , error} = await supabase
        .from('barcodes')
        .delete({count:"exact"})
        .eq('row_id', rowId)
    if (error) {
        console.error("Error resetting row:", error);
        throw error;
    }
    console.log("about to return " + count)
    return count;
}

const updateBarcode = async ({id, code}:{id:string, code:string}) => {
    console.log("about to update barcode with id " + id + " and code " + code);

    const {data: updatedRow, error} = await supabase
        .from('barcodes')
        .update({ code: code})
        .eq('id', id)
        .select('*')
        .single()
    if (error) {
        console.error("Error updating barcode:", error);
        throw error;
    }
    return updatedRow;
}

const deleteBarcode = async (id:string) => {
    console.log("about to delete barcode with id " + id);

    const {data: deletedBarcode, error} = await supabase
        .from('barcodes')
        .delete()
        .eq('id', id)
        .select('*')
        .single()

    if (error) {
        console.error("Error deleting barcode:", error);
        throw error;
    }
    return deletedBarcode;
}


const loadBarcodesByRow = async (rowId: string) => {
    const query = supabase
        .from('barcodes')
        .select('id, code, rowId:row_id, userId:user_id, timestamp, displayOrder:display_order, latitude, longitude')
        .eq("row_id", rowId)
        .order('display_order', { ascending: true });

    const {data: barcodes, error} = await query;

    if (error) {
        console.error("Error loading barcodes:", error);
        throw error;
    }

    return barcodes;
}

export const useRowBarcodes = (rowId: string) => {
    return useQuery({
        queryKey: ['barcodes', rowId],
        queryFn: () => loadBarcodesByRow(rowId),
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
                })
            },
            onError: (error) => {throw error}
        }
    );
}

export const useUpdateRowBarcode = (rowId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateBarcode,
        onSuccess: (barcode) => {
            queryClient.setQueryData(['barcodes', rowId],
                (oldData:{ id:string, code:string} []) => {
                    if (oldData) {
                        const index = oldData.findIndex(b => b.id === barcode.id);
                        if (index >= 0) {
                            oldData[index] = barcode;
                        }
                    }
                    return oldData;
                })
        }
    })
}

export const useDeleteRowBarcode = (rowId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteBarcode,
        mutationKey: ['barcodes', rowId],
        onSuccess: (barcode) => {
            queryClient.setQueryData(['barcodes', rowId],
                (oldData:{ id:string, code:string} []) => {
                    if (oldData) {
                        const index = oldData.findIndex(b => b.id === barcode.id);
                        if (index >= 0) {
                            oldData.splice(index, 1);
                        }
                    }
                    return oldData;
                })
        }
    })
}



export const useResetRowBarcodes = (rowId: string) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: resetRow,
        mutationKey: ['barcodes', rowId],
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['barcodes', rowId],
                exact: true,    // only that one
            })
        }
    })
}



