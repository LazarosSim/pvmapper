// Re-export from refactored modules for backwards compatibility
// This file is kept for existing imports - new code should import from '@/hooks/parks'
export { 
  useParkStats, 
  useParkById 
} from './parks/park-queries';

export { 
  useAddPark, 
  useUpdatePark, 
  useDeletePark, 
  useArchivePark, 
  useUnarchivePark 
} from './parks/park-mutations';
