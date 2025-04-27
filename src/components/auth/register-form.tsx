
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardContent, CardFooter } from '@/components/ui/card';
import { UserPlus, Loader } from 'lucide-react';

interface RegisterFormProps {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  loading,
  onSubmit
}) => {
  return (
    <form onSubmit={onSubmit}>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
            className="bg-white/70 border-white/30 shadow-sm focus:border-xpenergy-primary"
          />
        </div>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="bg-white/70 border-white/30 shadow-sm focus:border-xpenergy-primary"
          />
        </div>
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            className="bg-white/70 border-white/30 shadow-sm focus:border-xpenergy-primary"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-xpenergy-primary to-xpenergy-secondary hover:from-xpenergy-primary/90 hover:to-xpenergy-secondary/90 text-white shadow-md transition-all duration-300" 
          disabled={loading || !username || !password || password !== confirmPassword}
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
  );
};
