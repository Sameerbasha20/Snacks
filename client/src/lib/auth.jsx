import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import { connectSocket, disconnectSocket } from './socket';
import { registerSW, subscribePush } from './notify';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const afterLogin = useCallback((u) => {
    setUser(u);
    connectSocket(u.role);
    registerSW().then(() => subscribePush());
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(({ user }) => afterLogin(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [afterLogin]);

  const login = async (email, password) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    afterLogin(user);
    return user;
  };

  const register = async (data) => {
    const { user } = await api('/auth/register', { method: 'POST', body: data });
    return user;
  };

  const logout = () => {
    setToken(null);
    disconnectSocket();
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, loading, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const homeFor = (user) => (user?.role === 'admin' ? '/admin' : user?.role === 'kitchen' ? '/kitchen' : '/menu');
