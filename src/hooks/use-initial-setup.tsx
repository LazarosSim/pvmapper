
import {useEffect, useState} from 'react';
import {useDB} from '@/lib/db-provider';

export function useInitialSetup() {
  const {users} = useDB();
  const [isSetup, setIsSetup] = useState(false);
  
  useEffect(() => {
    // Check if setup is complete (users exist)
    setIsSetup(users.length > 0);
  }, [users]);
  
  return { isSetup };
}
