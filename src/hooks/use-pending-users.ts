import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PendingUser {
  id: string;
  username: string;
  createdAt: string;
}

const loadPendingUsers = async (): Promise<PendingUser[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, createdAt:created_at')
    .eq('role', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

// approve_user is defined in supabase/pending/01_roles_and_approval.sql and is not
// in the generated types until that SQL is applied and the types are regenerated.
const approveUser = async (userId: string) => {
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ error: { message: string } | null }>)('approve_user', { p_user_id: userId });

  if (error) throw error;
};

export const usePendingUsers = (enabled: boolean) =>
  useQuery({
    queryKey: ['users', 'pending'],
    queryFn: loadPendingUsers,
    enabled,
    staleTime: 30000,
  });

export const useApproveUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveUser,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['userTotalStats'] });
    },
  });
};
