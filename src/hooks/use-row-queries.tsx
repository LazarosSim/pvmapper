import {supabase} from "@/integrations/supabase/client.ts";
import {useQuery} from "@tanstack/react-query";

const loadRows = async () => {
    const {data, error} = await supabase
        .from('rows')
        .select('*, park:parks(name)')

    if (error) {
        throw error;
    }

    return data;
}

const loadRowById = async (rowId: string) => {
    const {data, error} = await supabase
        .from('rows')
        .select('id, name, createdAt:created_at, currentBarcodes:current_barcodes, expectedBarcodes:expected_barcodes, parkId:park_id, park:parks(name)')
        .eq('id', rowId)
        .single()

    if (error) {
        throw error;
    }

    return data;
}

const loadRowsByParkId = async (parkId: string) => {
    const {data, error} = await supabase
        .from('rows')
        .select('id, name, createdAt:created_at, currentBarcodes:current_barcodes, expectedBarcodes:expected_barcodes, parkId:park_id, park:parks(name)')
        .eq('park_id', parkId)
        .order('name', {ascending: true})
    if (error) {
        throw error;
    }
    return data;
}

export const useRow = (rowId: string) => {
    return useQuery({
        queryKey: ['rows', rowId],
        queryFn: () => loadRowById(rowId),
        enabled: Boolean(rowId)
    });
}

export const useRowsByParkId = (parkId: string) => {
    return useQuery({
        queryKey: ['rows', parkId],
        queryFn: () => loadRowsByParkId(parkId),
        enabled: Boolean(parkId)
    });
}