import {useQuery} from '@tanstack/react-query'
import {supabase} from '@/integrations/supabase/client'
import {mapUser, User} from "@/types/types.ts";


export function useCurrentUser() {
    return useQuery({
        queryKey: ['user-profile'],
        queryFn: loadCurrentUser,
        networkMode: 'offlineFirst',
    });
}

const loadCurrentUser = async (): Promise<User> => {
    const userResponse = await supabase.auth.getUser();
    if (userResponse.error) {
        throw userResponse.error;
    }
    const userId = userResponse.data.user.id;

    const user = await supabase
        .from('profiles')
        .select('id, username, role, created_at')
        .eq('id', userId)
        .single();
    if (user.error) {
        throw user.error;
    }
    if (!user.data) {
        throw new Error('User not found');
    }
    return mapUser(user.data);
}
