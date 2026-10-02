import {useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {toast} from 'sonner';
import type {User} from '../types/db-types';

const PROFILE_CACHE_KEY = 'pvmapper:profile';

// The last loaded profile is kept on the device so the app still knows who is
// signed in (and their role) when it starts without a connection.
const readCachedProfile = (userId: string): User | null => {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null') as User | null;
    return cached?.id === userId ? cached : null;
  } catch {
    return null;
  }
};

const writeCachedProfile = (user: User | null) => {
  try {
    if (user) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Storage full or unavailable: the profile is simply loaded again next time.
  }
};

export const useUser = () => {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<User[]>([]);

  // Fetch user profile data from the database
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
          .select('id, username, role, created_at')
        .eq('id', userId)
        .single();

      if (error) {
        const cached = readCachedProfile(userId);
        if (cached) {
          setCurrentUser(cached);
          return cached;
        }
        console.error('Error fetching user profile:', error);
        toast.error(`Failed to load profile: ${error.message}`);
        setCurrentUser(null);
        return null;
      }

      if (data) {
        const user: User = {
          id: data.id,
          username: data.username,
          role: data.role,
          createdAt: data.created_at,
        };
        setCurrentUser(user);
        writeCachedProfile(user);
        return user;
      }
      
      setCurrentUser(null);
      return null;
    } catch (caught) {
      const error = caught as Error;
      console.error('Error in fetchUserProfile:', error.message);
      const cached = readCachedProfile(userId);
      setCurrentUser(cached);
      return cached;
    } finally {
      setIsLoading(false);
    }
  };

  // Refetch user profile
  const refetchUser = async (userId?: string) => {
    if (userId) {
      await fetchUserProfile(userId);
    } else {
      setCurrentUser(null);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      // Treat "session_not_found" as successful logout - user is already signed out
      if (error && !error.message.includes('session_not_found') && !error.message.includes('Auth session missing')) {
        console.error('Error logging out:', error);
        toast.error(`Failed to logout: ${error.message}`);
        return;
      }
      
      // Clear the last route to prevent redirecting back after logout
      localStorage.removeItem('lastRoute');
      writeCachedProfile(null);
      
      toast.success('Logged out successfully');
    } catch (caught) {
      const error = caught as Error;
      // Handle network errors or other issues gracefully
      console.error('Error in logout:', error.message);
      // Still consider it a successful logout from the user's perspective
      localStorage.removeItem('lastRoute');
      writeCachedProfile(null);
      toast.success('Logged out successfully');
    }
  };

  // Helper function to check if current user is a manager
  const isManager = () => {
    return currentUser?.role === 'manager' || currentUser?.role === 'admin';
  };

  return {
    currentUser,
    isLoading,
    users,
    setUsers,
    fetchUserProfile,
    refetchUser,
    logout,
    isManager,
  };
};
