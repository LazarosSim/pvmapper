
import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/supabase-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, UserPlus, Loader } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LoginPage = () => {
  const { user } = useSupabase();
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingDemoAccounts, setCreatingDemoAccounts] = useState(false);
  const navigate = useNavigate();
  
  if (user) {
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
      const { data, error } = await supabase.auth.signUp({
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
        .limit(1);
      
      if (profileError) {
        console.error("Error checking profiles:", profileError);
        return;
      }
      
      if (existingProfiles && existingProfiles.length > 0) {
        console.log("Demo accounts already exist, skipping creation");
        return;
      }
      
      console.log("Setting up demo accounts...");
      
      const createDemoUser = async (username: string, password: string, role: string) => {
        try {
          const email = `${username.toLowerCase()}@example.com`;
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
      
      // Create demo accounts in parallel to speed up the process
      await Promise.all([
        createDemoUser("antrian", "antrian1", "user"),
        createDemoUser("lazaros", "lazaros2", "manager")
      ]);
      
      console.log("Demo accounts created successfully");
    } catch (error) {
      console.error("Error creating demo accounts:", error);
    } finally {
      setCreatingDemoAccounts(false);
    }
  };

  // Create demo accounts when the component mounts
  useEffect(() => {
    createDemoAccounts();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Inventory Hub</CardTitle>
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
        <CardFooter className="flex flex-col text-center text-sm text-muted-foreground pt-0">
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
