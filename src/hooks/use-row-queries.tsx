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
        .select('*, park:parks(name)')
        .eq('id', rowId)
        .single()

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