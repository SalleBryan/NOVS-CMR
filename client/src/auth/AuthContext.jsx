import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(null); // { kind, user } | { kind, voter }
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setIdentity(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get('/auth/me');
      setIdentity(me);
    } catch {
      setToken(null);
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function staffLogin(username, password) {
    const out = await api.post('/auth/staff/login', { username, password });
    setToken(out.token);
    setIdentity({ kind: 'staff', user: out.user });
    return out;
  }

  async function voterLogin(voterNumber, nationalIdNumber) {
    const out = await api.post('/auth/voter/login', { voterNumber, nationalIdNumber });
    setToken(out.token);
    setIdentity({ kind: 'voter', voter: out.voter });
    return out;
  }

  function logout() {
    setToken(null);
    setIdentity(null);
  }

  const value = {
    identity,
    loading,
    kind: identity?.kind || null,
    role: identity?.user?.role || null,
    user: identity?.user || null,
    voter: identity?.voter || null,
    staffLogin,
    voterLogin,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
