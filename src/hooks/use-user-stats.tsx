import {supabase} from "@/integrations/supabase/client.ts";
import {useQuery} from "@tanstack/react-query";


const loadUserStats = async() => {
    const {data, error} = await supabase
        .from('user_stats')
        .select('username, totalScans:total_scans, averageDailyScans:average_daily_scans, daysActive:days_active, dailyScans:daily_scans')
        .order('daily_scans', { ascending: false });
    if (error) {
        console.error("Error loading user stats:", error);
        throw error;
    }
    return data;
}



export const useUserStats = () => {
    return useQuery({
        queryKey: ['userTotalStats'],
        queryFn: () => loadUserStats(),
        enabled: true
    });
}
