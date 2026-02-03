/**
 * Hook for managing workspace selection and prefetching
 * A workspace is a park that the user wants to work on offline
 */

import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Park, Row, Barcode } from '@/lib/types/db-types';

const WORKSPACE_STORAGE_KEY = 'pvmapper:current-workspace';

interface WorkspaceStatus {
  parkId: string | null;
  isPrefetching: boolean;
  isPrefetched: boolean;
  progress: {
    current: number;
    total: number;
    stage: 'park' | 'rows' | 'barcodes' | 'complete';
  };
  error: string | null;
}

interface UseWorkspaceReturn {
  currentWorkspace: string | null;
  workspaceStatus: WorkspaceStatus;
  selectWorkspace: (parkId: string) => void;
  prefetchWorkspace: () => Promise<void>;
  clearWorkspace: () => void;
  isWorkspaceReady: boolean;
}

// Helper to load park by ID
const loadParkById = async (parkId: string): Promise<Park | null> => {
  const { data, error } = await supabase
    .from('park_stats')
    .select('id, name, expected_barcodes, current_barcodes, created_at, created_by, validate_barcode_length, archived, archived_at')
    .eq('id', parkId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return {
    id: data.id!,
    name: data.name!,
    createdAt: data.created_at!,
    createdBy: data.created_by || '',
    expectedBarcodes: data.expected_barcodes ?? 0,
    currentBarcodes: data.current_barcodes ?? 0,
    validateBarcodeLength: data.validate_barcode_length ?? false,
    archived: data.archived ?? false,
    archivedAt: data.archived_at || null,
  };
};

// Helper to load rows by park ID
const loadRowsByParkId = async (parkId: string): Promise<Row[]> => {
  const { data, error } = await supabase
    .from('rows')
    .select('id, name, createdAt:created_at, currentBarcodes:current_barcodes, expectedBarcodes:expected_barcodes, parkId:park_id, park:parks(name)')
    .eq('park_id', parkId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Row[];
};

// Helper to load barcodes by row ID
const loadBarcodesByRow = async (rowId: string): Promise<Barcode[]> => {
  const { data, error } = await supabase
    .from('barcodes')
    .select('id, code, rowId:row_id, userId:user_id, timestamp, orderInRow:order_in_row, latitude, longitude')
    .eq('row_id', rowId)
    .order('order_in_row', { ascending: true });

  if (error) throw error;

  return (data || []).sort((a, b) =>
    (a.orderInRow ?? Number.MAX_SAFE_INTEGER) - (b.orderInRow ?? Number.MAX_SAFE_INTEGER)
  ) as Barcode[];
};

export const useWorkspace = (): UseWorkspaceReturn => {
  const queryClient = useQueryClient();

  // Load workspace from localStorage on mount
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(() => {
    try {
      return localStorage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>({
    parkId: currentWorkspace,
    isPrefetching: false,
    isPrefetched: false,
    progress: {
      current: 0,
      total: 0,
      stage: 'park',
    },
    error: null,
  });

  // Update status when workspace changes
  useEffect(() => {
    setWorkspaceStatus(prev => ({
      ...prev,
      parkId: currentWorkspace,
    }));
  }, [currentWorkspace]);

  const selectWorkspace = useCallback((parkId: string) => {
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, parkId);
      setCurrentWorkspace(parkId);
      setWorkspaceStatus({
        parkId,
        isPrefetching: false,
        isPrefetched: false,
        progress: {
          current: 0,
          total: 0,
          stage: 'park',
        },
        error: null,
      });
    } catch (error) {
      console.error('Failed to save workspace:', error);
      toast.error('Failed to save workspace selection');
    }
  }, []);

  const clearWorkspace = useCallback(() => {
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      setCurrentWorkspace(null);
      setWorkspaceStatus({
        parkId: null,
        isPrefetching: false,
        isPrefetched: false,
        progress: {
          current: 0,
          total: 0,
          stage: 'park',
        },
        error: null,
      });
    } catch (error) {
      console.error('Failed to clear workspace:', error);
    }
  }, []);

  const prefetchWorkspace = useCallback(async () => {
    if (!currentWorkspace) {
      toast.error('No workspace selected');
      return;
    }

    if (!navigator.onLine) {
      toast.error('Cannot prefetch while offline');
      return;
    }

    setWorkspaceStatus(prev => ({
      ...prev,
      isPrefetching: true,
      isPrefetched: false,
      progress: { current: 0, total: 0, stage: 'park' },
      error: null,
    }));

    try {
      console.log('[Workspace] Starting prefetch for park:', currentWorkspace);

      // Stage 1: Prefetch park metadata
      setWorkspaceStatus(prev => ({
        ...prev,
        progress: { ...prev.progress, stage: 'park' },
      }));

      await queryClient.prefetchQuery({
        queryKey: ['park', currentWorkspace],
        queryFn: () => loadParkById(currentWorkspace),
      });

      // Stage 2: Prefetch all rows in park
      setWorkspaceStatus(prev => ({
        ...prev,
        progress: { ...prev.progress, stage: 'rows' },
      }));

      const rows = await queryClient.fetchQuery({
        queryKey: ['rows', 'park', currentWorkspace],
        queryFn: () => loadRowsByParkId(currentWorkspace),
      });

      console.log('[Workspace] Fetched rows:', rows.length);

      // Stage 3: Prefetch barcodes for every row
      setWorkspaceStatus(prev => ({
        ...prev,
        progress: {
          current: 0,
          total: rows.length,
          stage: 'barcodes',
        },
      }));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        console.log(`[Workspace] Prefetching data for row ${i + 1}/${rows.length}:`, row.id);

        // Prefetch individual row data (needed by ScanRowPage's useRow hook)
        await queryClient.prefetchQuery({
          queryKey: ['rows', 'single', row.id],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('rows')
              .select('id, name, createdAt:created_at, currentBarcodes:current_barcodes, expectedBarcodes:expected_barcodes, parkId:park_id, park:parks(name)')
              .eq('id', row.id)
              .single();
            if (error) throw error;
            return data;
          },
        });

        // Prefetch barcodes for this row
        await queryClient.prefetchQuery({
          queryKey: ['barcodes', 'row', row.id],
          queryFn: () => loadBarcodesByRow(row.id),
        });

        setWorkspaceStatus(prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            current: i + 1,
          },
        }));
      }

      // Complete!
      setWorkspaceStatus(prev => ({
        ...prev,
        isPrefetching: false,
        isPrefetched: true,
        progress: {
          current: rows.length,
          total: rows.length,
          stage: 'complete',
        },
      }));

      toast.success('Workspace ready for offline work');
      console.log('[Workspace] Prefetch complete');

    } catch (error) {
      console.error('[Workspace] Prefetch failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setWorkspaceStatus(prev => ({
        ...prev,
        isPrefetching: false,
        isPrefetched: false,
        error: errorMessage,
      }));

      toast.error(`Failed to prefetch workspace: ${errorMessage}`);
    }
  }, [currentWorkspace, queryClient]);

  const isWorkspaceReady = workspaceStatus.isPrefetched && !workspaceStatus.error;

  return {
    currentWorkspace,
    workspaceStatus,
    selectWorkspace,
    prefetchWorkspace,
    clearWorkspace,
    isWorkspaceReady,
  };
};
