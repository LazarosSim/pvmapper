import {supabase} from "@/lib/supabase/client.ts";

export const fetchBarcodes = async () => {
    const { data: barcodes, error } =  await supabase
        .from('barcodes')
        .select('*');

    if (error) {
        console.error("SB ERROR: ", error);
        throw error;
    }

    return barcodes;
};

export const fetchRowBarcodes = async (rowId: string) => {
    const { data: row, error } =  await supabase
        .from("barcodes")
        .select("*")
        .eq("row_id", rowId);

    if (error) {
        console.error("SB ERROR: ", error);
        throw error;
    }

    return row;
};