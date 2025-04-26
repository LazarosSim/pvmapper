
import { useEffect, useState } from 'react';
import { useDB } from '@/lib/db-provider';

export function useInitialSetup() {
  const { users, register } = useDB();
  const [isSetup, setIsSetup] = useState(false);
  
  useEffect(() => {
    // If no users exist, create an initial manager account
    if (users.length === 0) {
      register('manager', 'manager123', 'manager');
    }
    setIsSetup(true);
  }, [users, register]);
  
  return { isSetup };
}
