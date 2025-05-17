import {supabase} from "@/integrations/supabase/client.ts";
import {useQuery} from "@tanstack/react-query";

const loadBarcodes = async () => {
    const { data, error } = await supabase
        .from('barcodes')
        .select('id, code, rowId:row_id, userId:user_id, timestamp, displayOrder:display_order, latitude, longitude')
        .order('timestamp', { ascending: false });

    if (error) {
        throw error;
    }

    return data;
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

const loadBarcodesByRow = async (rowId: string, searchQuery?: BarcodeSearchQuery) => {
    console.log("SB QUERY: ", searchQuery)
    const { code } = searchQuery
    console.log("SB CODE: ", code)
    const query = supabase
        .from('barcodes')
        .select('id, code, rowId:row_id, userId:user_id, timestamp, displayOrder:display_order, latitude, longitude')
        .eq("row_id", rowId)
        .order('timestamp', { ascending: false });

    if (code) query.like("code", `%${code}%`);
    const {data: barcodes, error} = await query;

    console.log("SB DATA: ", barcodes)

    if (error) {
        throw error;
        console.error("SB ERROR: ", error)
    }

    return barcodes;
}

export const useRowBarcodes = (rowId: string, searchQuery?: BarcodeSearchQuery) => {
    return useQuery({
        queryKey: ['barcodes', rowId, searchQuery],
        queryFn: () => loadBarcodesByRow(rowId, searchQuery),
        enabled: Boolean(rowId)
    });
}

//add-barcodes
//