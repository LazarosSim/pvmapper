
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SupabaseContextType {
  user: User | null;
  session: Session | null;
  isInitialized: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription }} = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (isMounted) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession }}) => {
      if (isMounted) {
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setIsInitialized(true);
      }
    }).catch(error => {
      console.error("Error getting session:", error);
      if (isMounted) {
        setIsInitialized(true); // Still mark as initialized even on error
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    isInitialized,
    signIn: async (username: string, password: string) => {
      try {
        // Add a default email domain for demo purposes
        const email = `${username.toLowerCase()}@example.com`;
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error("SignIn error:", error);
          toast.error(error.message);
          throw error;
        }
      } catch (error: any) {
        console.error("SignIn error:", error);
        toast.error(error.message || 'Failed to sign in');
        throw error;
      }
    },
    signOut: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("SignOut error:", error);
          toast.error(error.message);
          throw error;
        }
      } catch (error: any) {
        console.error("SignOut error:", error);
        toast.error(error.message || 'Failed to sign out');
        throw error;
      }
    }
  }), [user, session, isInitialized]);

  // Always render children to ensure consistent hook execution
  return (
    <SupabaseContext.Provider value={value}>
      {isInitialized ? (
        children
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <svg className="animate-spin h-10 w-10 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xl font-medium">Initializing...</p>
          </div>
        </div>
      )}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
