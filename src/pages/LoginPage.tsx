import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabase } from '@/lib/supabase-provider';
import { useAuthForm } from '@/hooks/use-auth-form';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';

const LoginPage = () => {
  const [creatingDemoAccounts, setCreatingDemoAccounts] = useState(false);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [backgroundError, setBackgroundError] = useState(false);
  const {
    user,
    isInitialized
  } = useSupabase();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const {
    loginUsername,
    setLoginUsername,
    loginPassword,
    setLoginPassword,
    registerUsername,
    setRegisterUsername,
    registerPassword,
    setRegisterPassword,
    registerConfirm,
    setRegisterConfirm,
    loading,
    handleLogin,
    handleRegister
  } = useAuthForm();

  useEffect(() => {
    if (isInitialized && user) {
      setShouldRedirect(true);
    }
  }, [isInitialized, user]);

  useEffect(() => {
    const clearSession = async () => {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.log('No active session to clear');
      }
    };
    if (location.pathname === '/login') {
      clearSession();
    }
  }, [location]);

  const createDemoAccounts = async () => {
    try {
      setCreatingDemoAccounts(true);
      const {
        data: existingProfiles,
        error: profileError
      } = await supabase.from('profiles').select('username').or('username.eq.antrian,username.eq.lazaros').limit(2);
      if (profileError) {
        console.error("Error checking profiles:", profileError);
        return;
      }
      if (existingProfiles && existingProfiles.length === 2) {
        console.log("Demo accounts already exist, skipping creation");
        return;
      }
      console.log("Setting up demo accounts...");
      const createDemoUser = async (username: string, password: string, role: string) => {
        try {
          const email = `${username.toLowerCase()}@example.com`;
          const {
            data: existingUser
          } = await supabase.from('profiles').select('username').eq('username', username).single();
          if (existingUser) {
            console.log(`${username} account already exists, skipping`);
            return;
          }
          const {
            error
          } = await supabase.auth.signUp({
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
      await createDemoUser("antrian", "antrian1", "user");
      await createDemoUser("lazaros", "lazaros2", "manager");
      console.log("Demo accounts setup complete");
    } catch (error) {
      console.error("Error creating demo accounts:", error);
    } finally {
      setCreatingDemoAccounts(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      createDemoAccounts();
    }
  }, [isInitialized]);

  useEffect(() => {
    const preloadImage = () => {
      const img = new Image();
      img.src = 'https://ynslzmpfhmoghvcacwzd.supabase.co/storage/v1/object/public/images/loginbackground.jpg';
      img.onload = () => setBackgroundLoaded(true);
      img.onerror = () => {
        console.error("Failed to load background image");
        setBackgroundError(true);
      };
    };
    preloadImage();
  }, []);

  if (!isInitialized) {
    return <div className="min-h-screen flex items-center justify-center bg-xpenergy-primary bg-opacity-80 p-4">
        <div className="text-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-xl font-medium text-white">Loading authentication...</p>
        </div>
      </div>;
  }

  if (shouldRedirect) {
    return <Navigate to="/" replace />;
  }

  const fallbackBackground = "url('https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')";
  const backgroundImage = !backgroundError ? "url('https://ynslzmpfhmoghvcacwzd.supabase.co/storage/v1/object/public/images/loginbackground.jpg')" : fallbackBackground;

  return <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center relative overflow-hidden bg-xpenergy-primary" style={{
    backgroundImage: backgroundImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }}>
      <Card className="w-full max-w-md shadow-xl backdrop-blur-sm border border-white/20 z-10 animate-fade-in bg-transparent my-0 mx-0 rounded-none py-0 px-0">
        <CardHeader className="text-center space-y-2 bg-transparent">
          <CardTitle className="font-inter bg-gradient-to-br from-xpenergy-accent to-xpenergy-accent text-xpenergy-accent font-black tracking-energy text-center text-3xl px-0">XP ENERGY PV MAPPER</CardTitle>
          <CardDescription className="text-lg text-xpenergy-primary/90 font-inter">
            Sign in to continue tracking solar installations
          </CardDescription>
        </CardHeader>
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login" className="font-montserrat font-medium">Login</TabsTrigger>
            <TabsTrigger value="register" className="font-montserrat font-medium">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="animate-fade-in">
            <LoginForm username={loginUsername} setUsername={setLoginUsername} password={loginPassword} setPassword={setLoginPassword} loading={loading} onSubmit={handleLogin} />
          </TabsContent>
          <TabsContent value="register" className="animate-fade-in">
            <RegisterForm username={registerUsername} setUsername={setRegisterUsername} password={registerPassword} setPassword={setRegisterPassword} confirmPassword={registerConfirm} setConfirmPassword={setRegisterConfirm} loading={loading} onSubmit={handleRegister} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>;
};

export default LoginPage;
