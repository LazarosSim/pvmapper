import {supabase} from "@/integrations/supabase/client.ts";
import {onlineManager, useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Barcode} from "@/lib/types/db-types.ts";
import {useSupabase} from "@/lib/supabase-provider.tsx";
import {useEffect} from "react";
import {addBarcode, deleteBarcode, updateBarcode} from "@/services/barcode-service.ts";

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
    return barcodes;
}

const loadBarcodesByPark = async (parkId: string) => {

    console.info('about to load those juicy barcodes for my park')
    const query = supabase
        .from('barcodes')
        .select('id, code, park:rows (park_id, parks(name)) ,userId:user_id, timestamp, orderInRow:order_in_row, rowId:row_id')
        .eq("rows.park_id", parkId)
        .order('order_in_row', {ascending: true});

    const {data: barcodes, error} = await query;
    if (error) {
        console.error("Error loading barcodes:", error);
        throw error;
    }

    const flattenedBarcodes = barcodes.map(({
                                                id,
                                                code,
                                                userId,
                                                timestamp,
                                                orderInRow,
                                                rowId,
                                                park: {park_id, parks: {name}}
                                            }) => (
        {   id,
            code,
            userId,
            timestamp,
            orderInRow,
            rowId,
            parkId: park_id,
            parkName: name,
        }));
    console.info('loaded the barcodes', flattenedBarcodes)
    return flattenedBarcodes;
}


export const useRowBarcodes = (rowId: string) => {
    const queryClient = useQueryClient()
    return useQuery({
        queryKey: ['barcodes', rowId],
        queryFn: () => loadBarcodesByRow(rowId),
        enabled: Boolean(rowId) && onlineManager.isOnline(),
        retry: false,
        refetchOnWindowFocus: false,
        initialData: () => queryClient.getQueryData<Barcode[]>(['barcodes', rowId]),
    });
}

export const useParkBarcodes = (parkId: string) => {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: ['barcodes', parkId],
        queryFn: () => loadBarcodesByPark(parkId),
        enabled: Boolean(parkId) && onlineManager.isOnline(),
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity
    });

    useEffect(() => {
        console.info("caching data into the rows")
        if (query.data && !query.isError) {
            const byRow: Record<string, Barcode[]> = {};
            query.data.forEach(b => {
                (byRow[b.rowId] ||= []).push(b);
            });
            Object.entries(byRow).forEach(([rowId, barcodes]) => {
                queryClient.setQueryData(['barcodes', rowId], barcodes);
            });
        }
    }, [query.data, queryClient, query.isError])

    return query;
};



class AddBarcodeVariables {
    code: string;
    orderInRow: number;
    isLast: boolean;
    timestamp?: string;
}

export const useAddBarcodeToRow = (rowId: string) => {
    const queryClient = useQueryClient();
    const { user } = useSupabase();
    return useMutation({
        mutationFn: ({
                         code,
                         orderInRow,
                         isLast,
                         timestamp
                     }: AddBarcodeVariables) => addBarcode(code, rowId, orderInRow, isLast, user?.id, timestamp),
        mutationKey: ['barcodes', rowId],
        onMutate: async ({code, orderInRow}) => {
            const previous = queryClient.getQueryData<Barcode[]>(['barcodes', rowId]);

            if (previous) {
                queryClient.setQueryData<Barcode[]>(['barcodes', rowId], [
                    ...previous,
                    {
                        id: `temp-${Date.now()}`,
                        code,
                        orderInRow,
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

        retry: false
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



