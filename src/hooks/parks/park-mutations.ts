import { useMutation, useQueryClient, onlineManager } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============= Mutation Functions =============

const addPark = async ({
  name,
  expectedBarcodes,
  validateBarcodeLength,
  userId,
}: {
  name: string;
  expectedBarcodes: number;
  validateBarcodeLength: boolean;
  userId: string;
}) => {
  console.log('[addPark] Creating park:', { name, expectedBarcodes, validateBarcodeLength });

  const { data: insertedPark, error } = await supabase
    .from('parks')
    .insert({
      name,
      expected_barcodes: expectedBarcodes,
      validate_barcode_length: validateBarcodeLength,
      user_id: userId,
      created_at: new Date().toISOString(),
    })
    .select();

  if (error) {
    console.error('[addPark] Error:', error);
    throw error;
  }
  
  console.log('[addPark] Created:', insertedPark);
  return insertedPark;
};

const updatePark = async ({
  id,
  name,
  expectedBarcodes,
  validateBarcodeLength,
}: {
  id: string;
  name: string;
  expectedBarcodes: number;
  validateBarcodeLength: boolean;
}) => {
  console.log('[updatePark] Updating park:', id);

  const { data: updatedPark, error } = await supabase
    .from('parks')
    .update({
      name,
      expected_barcodes: expectedBarcodes,
      validate_barcode_length: validateBarcodeLength,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[updatePark] Error:', error);
    throw error;
  }
  
  console.log('[updatePark] Updated:', updatedPark);
  return updatedPark.id;
};

const deletePark = async (id: string) => {
  console.log('[deletePark] Deleting park:', id);

  const { data, error } = await supabase
    .from('parks')
    .delete()
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[deletePark] Error:', error);
    throw error;
  }
  
  console.log('[deletePark] Deleted:', data);
  return data;
};

const archivePark = async (id: string) => {
  console.log('[archivePark] Archiving park:', id);

  const { error } = await supabase
    .from('parks')
    .update({
      archived: true,
      archived_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[archivePark] Error:', error);
    throw error;
  }
  
  return id;
};

const unarchivePark = async (id: string) => {
  console.log('[unarchivePark] Restoring park:', id);

  const { error } = await supabase
    .from('parks')
    .update({
      archived: false,
      archived_at: null,
    })
    .eq('id', id);

  if (error) {
    console.error('[unarchivePark] Error:', error);
    throw error;
  }
  
  return id;
};

// ============= React Query Mutation Hooks =============

/**
 * Hook for adding a new park
 */
export const useAddPark = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addPark,
    mutationKey: ['parks', 'add'],
    onSuccess: (insertedPark) => {
      console.log('[useAddPark] Success:', insertedPark);
    },
    onSettled: () => {
      // Always invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
  });
};

/**
 * Hook for updating a park
 */
export const useUpdatePark = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updatePark,
    mutationKey: ['parks', 'update'],
    onSuccess: (updatedParkId) => {
      console.log('[useUpdatePark] Success:', updatedParkId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
  });
};

/**
 * Hook for deleting a park
 */
export const useDeletePark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePark,
    mutationKey: ['parks', 'delete'],
    onSuccess: (deletedPark) => {
      console.log('[useDeletePark] Success:', deletedPark);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
  });
};

/**
 * Hook for archiving a park
 */
export const useArchivePark = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: archivePark,
    mutationKey: ['parks', 'archive'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
  });
};

/**
 * Hook for unarchiving/restoring a park
 */
export const useUnarchivePark = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unarchivePark,
    mutationKey: ['parks', 'unarchive'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parks'] });
    },
  });
};
