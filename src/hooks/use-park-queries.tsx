import {supabase} from "@/integrations/supabase/client.ts";
import {onlineManager, useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {mapPark, Park} from "@/types/types.ts";


const deletePark = async (id: string) => {
    console.log("about to delete park with id " + id);

    const deleteQuery = await supabase
        .from('parks')
        .delete()
        .eq('id', id)
        .select('*')
        .single()

    if (deleteQuery.error) {
        console.error("Error deleting park:", deleteQuery.error);
        throw deleteQuery.error;
    }
    return deleteQuery.data;
}

const updatePark = async (
    {id, name, expectedBarcodes, validateBarcodeLength}: {
        id: string,
        name: string,
        expectedBarcodes: number,
        validateBarcodeLength: boolean
    }
) => {
    console.log("about to update park with id " + id + " and name " + name);

    const {data: updatedPark, error} = await supabase
        .from('parks')
        .update({
            id: id,
            name: name,
            expected_barcodes: expectedBarcodes,
            validate_barcode_length: validateBarcodeLength
        })
        .eq('id', id)
        .select('*')
        .single()
    if (error) {
        console.error("Error updating park:", error);
        throw error;
    }
    return updatedPark.id;
}


const loadParkStats = async (): Promise<Park[]> => {
    const {data, error} = await supabase
        .from('park_stats')
        .select('id, name, expected_barcodes, current_barcodes, created_at, created_by, validate_barcode_length')
        .order('name', { ascending: true })
    if (error) {
        console.error("Error loading park stats:", error);
        throw error;
    }
    return data.map((rawPark) => mapPark(rawPark))
}

const addPark = async (
    {name, expectedBarcodes, validateBarcodeLength, userId}: {
        name: string,
        expectedBarcodes: number,
        validateBarcodeLength: boolean,
        userId: string
    }) => {
    console.log('[addPark] START', {name, expectedBarcodes, validateBarcodeLength})

    const {data: insertedPark, error} = await supabase
        .from('parks')
        .insert({
            name,
            expected_barcodes: expectedBarcodes,
            validate_barcode_length: validateBarcodeLength,
            user_id: userId,
            created_at: new Date().toISOString()
        })
        .select();

    if (error) {
        console.error("Error adding park:", error);
        throw error;
    }
    return insertedPark;
}

export const useAddPark = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: addPark,
        mutationKey: ['parks'],
        onSuccess: (insertedPark) => {
            console.log("added park", insertedPark)

        },
        onSettled: () => {
            if (onlineManager.isOnline()) {
                queryClient.invalidateQueries({queryKey: ['parks']});
            }
        },
    })
}



export const useParkStats = () => {
    return useQuery({
        queryKey: ['parks'],
        queryFn: () => loadParkStats(),
        enabled: onlineManager.isOnline()
    });
}

export const useUpdatePark = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updatePark,
        mutationKey: ['parks'],
        onSuccess: (updatedPark) => {
            console.log("updated park", updatedPark)
        },
        onSettled: () => {
            if (onlineManager.isOnline()) {
                queryClient.invalidateQueries({queryKey: ['parks']});
            }
        },
    })
}

export const useDeletePark = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deletePark,
        mutationKey: ['parks'],
        onSuccess: (deletedPark) => {
            console.log("deleted park", deletedPark)
        },
        onSettled: () => {
            if (onlineManager.isOnline()) {
                queryClient.invalidateQueries({queryKey: ['parks']});
            }
        },
    })
}