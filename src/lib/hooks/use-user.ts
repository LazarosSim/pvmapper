
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { User } from '../types/db-types';

export const useUser = () => {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<User[]>([]);

  // Fetch user profile data from the database
  const fetchUserProfile = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role, created_at, user_total_scans')
        .eq('id', userId)
        .single();

      if (error) {
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
          totalScans: data.user_total_scans || 0
        };
        setCurrentUser(user);
        return user;
      }
      
      setCurrentUser(null);
      return null;
    } catch (error: any) {
      console.error('Error in fetchUserProfile:', error.message);
      setCurrentUser(null);
      return null;
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

  // User management
  const register = async (username: string, password: string, role: string) => {
    // Implementation would be added here
  };
  
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error logging out:', error);
        toast.error(`Failed to logout: ${error.message}`);
        return;
      }
      
      toast.success('Logged out successfully');
    } catch (error: any) {
      console.error('Error in logout:', error.message);
      toast.error(`Failed to logout: ${error.message}`);
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
    register,
    logout,
    isManager,
  };
};
