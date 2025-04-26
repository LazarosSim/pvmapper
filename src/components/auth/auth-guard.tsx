
import React, { useEffect } from 'react';
import { useDB } from '@/lib/db-provider';
import { useNavigate } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
  requireManager?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireManager = false }) => {
  const { currentUser } = useDB();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (requireManager && currentUser.role !== 'manager') {
      navigate('/');
    }
  }, [currentUser, requireManager, navigate]);

  if (!currentUser) {
    return null;
  }

  if (requireManager && currentUser.role !== 'manager') {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
