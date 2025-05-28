import {supabase} from "@/integrations/supabase/client.ts";
import {onlineManager, useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
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

    console.log('[addBarcode] START', {code, rowId, displayOrder, userId})

    if(!code.trim())
        throw new Error("Barcode is required");

    console.info('[addBarcode] before supabase')
    const {data: insertedRow, error} = await supabase
        .from('barcodes')
        .insert(toDb(code, rowId, displayOrder, userId))
        .select();
    console.log('[addBarcode] after supabase', {insertedRow, error})

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

const loadBarcodesByPark = async (parkId: string) => {
    const query = supabase
        .from('barcodes')
        .select('id, code, park:rows (park_id, parks(name)) ,userId:user_id, timestamp, displayOrder:display_order')
        .eq("rows.park_id", parkId)
        .order('display_order', { ascending: true });

    const {data: barcodes, error} = await query;
    if (error) {
        console.error("Error loading barcodes:", error);
        throw error;
    }

    const flattenedBarcodes = barcodes.map(({ id, code, userId, timestamp, displayOrder, park: {park_id, parks: {name}}}) => (
        {   id,
            code,
            userId,
            timestamp,
            displayOrder,
            parkId: park_id,
            parkName: name,
        }));
    return flattenedBarcodes;
}


export const useRowBarcodes = (rowId: string) => {
    const queryClient = useQueryClient()
    return useQuery({
        queryKey: ['barcodes', rowId],
        queryFn: () => loadBarcodesByRow(rowId),
        enabled: Boolean(rowId) && onlineManager.isOnline(),
        staleTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
        initialData: () => queryClient.getQueryData(['barcodes', rowId]),
    });
}

export const useParkBarcodes = (parkId: string) => {
    return useQuery({
        queryKey: ['barcodes', parkId],
        queryFn: () => loadBarcodesByPark(parkId),
        enabled: Boolean(parkId)
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
        mutationFn: ({code, displayOrder}: AddBarcodeVariables) => addBarcode(code, rowId, displayOrder, user?.id),
        mutationKey: ['barcodes', rowId],
        onMutate: async ({code, displayOrder}) => {
            const previous = queryClient.getQueryData<Barcode[]>(['barcodes', rowId]);

            if (previous) {
                queryClient.setQueryData<Barcode[]>(['barcodes', rowId], [
                    ...previous,
                    {
                        id: `temp-${Date.now()}`,
                        code,
                        displayOrder,
                    } as Barcode,
                ]);
            }
            return {previous};
        },

        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(['barcodes', rowId], context.previous);
            }
        },

        onSettled: () => {
            if(onlineManager.isOnline()) {
                queryClient.invalidateQueries({queryKey: ['barcodes', rowId]});
            }
        },
        });
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



