
import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, UserPlus, Loader } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabase } from '@/lib/supabase-provider';
import { toast } from 'sonner';

const LoginPage = () => {
  // State for login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // State for registration form
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [creatingDemoAccounts, setCreatingDemoAccounts] = useState(false);
  const navigate = useNavigate();
  
  // Get authentication state from context
  const { user, isInitialized } = useSupabase();
  
  // Always declare all hooks before any conditional logic
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  // Check if user is logged in and set redirect flag
  useEffect(() => {
    if (isInitialized && user) {
      setShouldRedirect(true);
    }
  }, [isInitialized, user]);
  
  // Handle redirect after all hooks are declared
  if (shouldRedirect) {
    return <Navigate to="/" replace />;
  }
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const email = `${loginUsername.toLowerCase()}@example.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      
      if (error) {
        console.error("Login error:", error);
        toast.error("Login failed: " + error.message);
      } else {
        toast.success(`Welcome back, ${loginUsername}!`);
        navigate('/');
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Login failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerPassword !== registerConfirm) {
      toast.error("Passwords don't match");
      return;
    }
    
    setLoading(true);
    
    try {
      const email = `${registerUsername.toLowerCase()}@example.com`;
      const { error } = await supabase.auth.signUp({
        email,
        password: registerPassword,
        options: {
          data: {
            username: registerUsername,
            role: 'user'
          }
        }
      });
      
      if (error) {
        console.error("Registration error:", error);
        toast.error(error.message);
      } else {
        toast.success("Registration successful! Please log in.");
        // Reset form and switch to login tab
        setRegisterUsername('');
        setRegisterPassword('');
        setRegisterConfirm('');
        const loginTab = document.querySelector('[data-value="login"]') as HTMLElement;
        if (loginTab) loginTab.click();
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error("Registration failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createDemoAccounts = async () => {
    try {
      setCreatingDemoAccounts(true);
      
      // Check if demo accounts already exist to avoid recreating them
      const { data: existingProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .or('username.eq.antrian,username.eq.lazaros')
        .limit(2);
      
      if (profileError) {
        console.error("Error checking profiles:", profileError);
        return;
      }
      
      if (existingProfiles && existingProfiles.length === 2) {
        console.log("Demo accounts already exist, skipping creation");
        return;
      }
      
      console.log("Setting up demo accounts...");
      
      // Create the demo accounts in sequence to avoid race conditions
      const createDemoUser = async (username: string, password: string, role: string) => {
        try {
          const email = `${username.toLowerCase()}@example.com`;
          
          // First check if this specific user already exists
          const { data: existingUser } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .single();
            
          if (existingUser) {
            console.log(`${username} account already exists, skipping`);
            return;
          }
            
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                username,
                role
              }
            }
          });
          
          if (error) {
            console.error(`Error creating ${username} account:`, error);
            throw error;
          }
          
          console.log(`${username} account created successfully`);
        } catch (err) {
          console.error(`Failed to create ${username} account:`, err);
        }
      };
      
      // Create demo accounts sequentially
      await createDemoUser("antrian", "antrian1", "user");
      await createDemoUser("lazaros", "lazaros2", "manager");
      
      console.log("Demo accounts setup complete");
    } catch (error) {
      console.error("Error creating demo accounts:", error);
    } finally {
      setCreatingDemoAccounts(false);
    }
  };

  // Create demo accounts on component mount
  useEffect(() => {
    if (isInitialized) {
      createDemoAccounts();
    }
  }, [isInitialized]);

  // Show loading state while Supabase is initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-xl font-medium">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Inventory Hub</CardTitle>
          <CardDescription>Sign in to continue tracking inventory</CardDescription>
        </CardHeader>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !loginUsername || !loginPassword}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </span>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Login
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Username"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    value={registerConfirm}
                    onChange={(e) => setRegisterConfirm(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !registerUsername || !registerPassword || registerPassword !== registerConfirm}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Registering...
                    </span>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Register
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
        <CardFooter className="flex flex-col text-center text-sm text-muted-foreground pt-2">
          <p className="mt-2">Demo credentials:</p>
          <p>User: antrian / antrian1</p>
          <p>Manager: lazaros / lazaros2</p>
          {creatingDemoAccounts && (
            <p className="mt-2 flex items-center justify-center">
              <Loader className="mr-2 h-3 w-3 animate-spin" />
              Setting up demo accounts...
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
