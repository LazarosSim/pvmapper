
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDB } from '@/lib/db-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, UserPlus } from 'lucide-react';
import { useInitialSetup } from '@/hooks/use-initial-setup';

const LoginPage = () => {
  const { currentUser, login, register } = useDB();
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const navigate = useNavigate();
  
  // Setup initial manager account if needed
  const { isSetup } = useInitialSetup();
  
  // If already logged in, redirect to home page
  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(loginUsername, loginPassword)) {
      navigate('/');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerPassword !== registerConfirm) {
      alert("Passwords don't match");
      return;
    }
    if (register(registerUsername, registerPassword)) {
      navigate('/');
    }
  };

  if (!isSetup) {
    return <div>Setting up application...</div>;
  }

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
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={!loginUsername || !loginPassword}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
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
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Confirm Password"
                    value={registerConfirm}
                    onChange={(e) => setRegisterConfirm(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!registerUsername || !registerPassword || registerPassword !== registerConfirm}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Register
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
        <CardFooter className="flex flex-col text-center text-sm text-muted-foreground pt-0">
          <p className="mt-2">Demo credentials:</p>
          <p>Manager: manager / manager123</p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
