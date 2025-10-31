import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: Array<'admin' | 'sales_rep' | 'viewer'>;
  fallback?: ReactNode;
}

/**
 * Component to guard content based on user roles
 */
export const RoleGuard = ({ children, allowedRoles, fallback }: RoleGuardProps) => {
  const { userRole, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You don't have permission to access this content. Required role: {allowedRoles.join(' or ')}.
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
};

/**
 * Hook to check if user has a specific role
 */
export const useHasRole = (role: 'admin' | 'sales_rep' | 'viewer') => {
  const { userRole } = useAuth();
  return userRole === role;
};

/**
 * Hook to check if user has any of the specified roles
 */
export const useHasAnyRole = (roles: Array<'admin' | 'sales_rep' | 'viewer'>) => {
  const { userRole } = useAuth();
  return userRole ? roles.includes(userRole) : false;
};
