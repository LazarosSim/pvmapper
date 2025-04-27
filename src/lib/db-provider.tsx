
import { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from './supabase-provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type User = {
  id: string;
  username: string;
  role: string;
};

type DBContextType = {
  currentUser: User | null | undefined;
  isDBLoading: boolean;
  refetchUser: () => Promise<void>;
};

const DBContext = createContext<DBContextType | undefined>(undefined);

export function DBProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSupabase();
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  const [isDBLoading, setIsDBLoading] = useState<boolean>(true);

  // Fetch user profile data from the database
  const fetchUserProfile = async (userId: string) => {
    setIsDBLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        toast.error(`Failed to load profile: ${error.message}`);
        setCurrentUser(null);
        return null;
      }

      if (data) {
        setCurrentUser(data);
        return data;
      }
      
      setCurrentUser(null);
      return null;
    } catch (error: any) {
      console.error('Error in fetchUserProfile:', error.message);
      setCurrentUser(null);
      return null;
    } finally {
      setIsDBLoading(false);
    }
  };

  // Refetch user profile
  const refetchUser = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
    } else {
      setCurrentUser(null);
      setIsDBLoading(false);
    }
  };

  // Fetch user profile when auth user changes
  useEffect(() => {
    let isMounted = true;
    
    const loadUserProfile = async () => {
      if (user?.id) {
        if (isMounted) {
          await fetchUserProfile(user.id);
        }
      } else {
        // No logged in user
        if (isMounted) {
          setCurrentUser(null);
          setIsDBLoading(false);
        }
      }
    };
    
    loadUserProfile();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Create context value
  const contextValue: DBContextType = {
    currentUser,
    isDBLoading,
    refetchUser
  };

  return (
    <DBContext.Provider value={contextValue}>
      {children}
    </DBContext.Provider>
  );
}

export const useDB = () => {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error('useDB must be used within a DBProvider');
  }
  return context;
};
