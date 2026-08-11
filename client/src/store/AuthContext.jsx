import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api/auth';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On initial load, try to load token and user from localStorage
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false); // Finished loading auth state
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.login({ email, password });
      const { token, user, organizations, currentOrganization, permissions } = response;
      
      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Return full response so LoginPage can handle organization redirect
      return { token, user, organizations, currentOrganization, permissions };
    } catch (error) {
      // The component calling login will handle the error display
      // The interceptor has already created a standard Error object
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Redirect will be handled by the component that calls logout
  };

  const setAuth = (token, user) => {
    setToken(token);
    setUser(user);
    if (token) localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token,
    setUser, // Expose setUser
    setAuth, // Allow setting auth state from outside (e.g. register)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
