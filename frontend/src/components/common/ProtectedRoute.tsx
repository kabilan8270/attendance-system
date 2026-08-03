import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserType } from '../../types';

export const ProtectedRoute = ({
  children,
  allow,
}: {
  children: ReactNode;
  allow: UserType;
}) => {
  const { userType, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (userType !== allow) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
