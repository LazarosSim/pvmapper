import {supabase} from "@/integrations/supabase/client.ts";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useSupabase} from "@/lib/supabase-provider.tsx";



const loadParkStats = async () => {
    const {data, error} = await supabase
        .from('park_stats')
        .select('name, expectedBarcodes:expected_barcodes, currentBarcodes:current_barcodes')
        .order('name', { ascending: true })
    if (error) {
        console.error("Error loading park stats:", error);
        throw error;
    }
    return data;
}

export const useParkStats = () => {
    return useQuery({
        queryKey: ['parkStats'],
        queryFn: () => loadParkStats(),
        enabled: true
    });
}