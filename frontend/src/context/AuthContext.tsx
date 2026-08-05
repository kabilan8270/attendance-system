import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getStoredAuth, setStoredAuth, clearStoredAuth } from '../api/client';
import { AdminUser, EmployeeUser, UserType } from '../types';

interface AuthState {
  userType: UserType | null;
  user: AdminUser | EmployeeUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthContextValue extends AuthState {
  loading: boolean;
  adminLogin: (adminCode: string, password: string) => Promise<void>;
  employeeLogin: (employeeId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Clears the local session (storage + in-memory state) without calling
   * the single-device /auth/logout endpoint. Used after actions that already
   * revoke sessions server-side — e.g. "Logout All Devices" or a password
   * change — so the app's auth state and the server agree immediately
   * instead of waiting for the next 401 + failed refresh round trip.
   */
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    userType: null,
    user: null,
    accessToken: null,
    refreshToken: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) setState(stored);
    setLoading(false);
  }, []);

  const adminLogin = async (adminCode: string, password: string) => {
    const { data } = await api.post('/auth/admin/login', { adminCode, password });
    const newState: AuthState = {
      userType: 'admin',
      user: data.data.user,
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken,
    };
    setStoredAuth(newState);
    setState(newState);
  };

  const employeeLogin = async (employeeId: string, password: string) => {
    const { data } = await api.post('/auth/employee/login', { employeeId, password });
    const newState: AuthState = {
      userType: 'employee',
      user: data.data.user,
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken,
    };
    setStoredAuth(newState);
    setState(newState);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken: state.refreshToken });
    } catch {
      // ignore network errors on logout
    }
    clearStoredAuth();
    setState({ userType: null, user: null, accessToken: null, refreshToken: null });
  };

  const clearSession = () => {
    clearStoredAuth();
    setState({ userType: null, user: null, accessToken: null, refreshToken: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, loading, adminLogin, employeeLogin, logout, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
