import api from './index';

export const register = async (userData) => {
  return api.post('/auth/register', userData);
};

export const login = async (userData) => {
  return api.post('/auth/login', userData);
};

export const verifyInvitation = async (code) => {
  return api.get(`/auth/invitation/${code}`);
};

export const getInvitations = async () => {
  return api.get('/auth/invitations');
};

export const generateInvitation = async (data) => {
  return api.post('/auth/invitations', data);
};

