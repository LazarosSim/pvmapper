import {supabase} from "@/lib/supabase/client.ts";

const fetchRows = async () => {
    const { data: rows, error } =  await supabase
        .from('rows')
        .select('*');

    if (error) {
        console.error("SB ERROR: ", error);
        throw error;
    }

    return rows;
};

const fetchRowById = async (rowId: string) => {
    const { data: row, error } =  await supabase
        .from("rows")
        .select("*, park:parks(id, name)")
        .eq("id", rowId);

    if (error) {
        console.error("SB ERROR: ", error);
        throw error;
    }

    return row;
};