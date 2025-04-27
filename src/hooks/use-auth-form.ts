
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAuthForm = () => {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  return {
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
    handleRegister,
  };
};
