import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/lib/supabase-provider';
import { configureSync, onPushed, startAutoSync } from './sync';
import { supabaseServer } from './supabase-server';
import { migrateLegacyDeviceData } from './legacy-migration';

configureSync(supabaseServer);

/** Keeps the phone's copy in step with the server while someone is signed in. */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Uploads change server-only views (archived parks, statistics)
    onPushed(() => {
      queryClient.invalidateQueries({ queryKey: ['server'] });
      queryClient.invalidateQueries({ queryKey: ['userTotalStats'] });
    });
  }, [queryClient]);

  useEffect(() => {
    if (!user?.id) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    // Data left by the previous app version is moved in before the first sync
    migrateLegacyDeviceData()
      .catch((error) => console.error('[Sync] Could not move data from the previous version:', error))
      .finally(() => {
        if (!cancelled) stop = startAutoSync();
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [user?.id]);

  return <>{children}</>;
}
