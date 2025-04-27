
import React, { useEffect, useState } from 'react';
import { useDB } from '@/lib/db-provider';
import { useNavigate } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
  requireManager?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireManager = false }) => {
  const { currentUser } = useDB();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only redirect if we've confirmed authentication status
    if (isChecking) {
      setIsChecking(false);
      return;
    }
    
    if (!currentUser) {
      navigate('/login');
    } else if (requireManager && currentUser.role !== 'manager') {
      navigate('/');
    }
  }, [currentUser, requireManager, navigate, isChecking]);

  // During initial check, render nothing to prevent flash
  if (isChecking) {
    return null;
  }

  // If not authenticated, render nothing - redirect will happen in effect
  if (!currentUser) {
    return null;
  }

  // If manager is required but user is not a manager, render nothing - redirect will happen in effect
  if (requireManager && currentUser.role !== 'manager') {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
