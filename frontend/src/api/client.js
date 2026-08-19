// api/client.js — Wrapper Axios avec auth JWT
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
//const API_URL = 'https://fame-catering-temperature-vid.trycloudflare.com';

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

// Injecte le token sur chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pwc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirection vers login si 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('pwc_token');
      localStorage.removeItem('pwc_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// --- Auth ---
export const login = async (username, password) => {
  const { data } = await api.post('/auth/login-json', { username, password });
  localStorage.setItem('pwc_token', data.access_token);
  localStorage.setItem('pwc_user', JSON.stringify(data.user));
  return data;
};

export const logout = () => {
  localStorage.removeItem('pwc_token');
  localStorage.removeItem('pwc_user');
  window.location.href = '/login';
};

export const getCurrentUser = () => {
  const u = localStorage.getItem('pwc_user');
  return u ? JSON.parse(u) : null;
};

// --- Users (admin) ---
export const listUsers = () => api.get('/users').then((r) => r.data);
export const createUser = (payload) => api.post('/users', payload).then((r) => r.data);
export const updateUser = (id, payload) =>
  api.patch(`/users/${id}`, payload).then((r) => r.data);
export const deleteUser = (id) => api.delete(`/users/${id}`);

// --- IV ---
export const listModels = () => api.get('/iv/models').then((r) => r.data);
export const predictIV = (payload) => api.post('/iv/predict', payload).then((r) => r.data);
export const predictIVAll = (payload) =>
  api.post('/iv/predict-all', payload).then((r) => r.data);

// --- Pricing ---
export const priceOption = (payload) =>
  api.post('/pricing/option', payload).then((r) => r.data);

// --- Surface ---
export const listSurfaceDates = () => api.get('/surface/dates').then((r) => r.data);
export const getSurface = (date_obs_raw, model_name) => {
  const date_obs = date_obs_raw ? date_obs_raw.replace(/^\[.*?\]\s*/, '') : date_obs_raw;
  return api.get('/surface', { params: { date_obs, model_name } }).then((r) => r.data);
};

// --- Evaluation ---
export const getEvaluation = () => api.get('/evaluation').then((r) => r.data);
export const getGlobalEvaluation = () => api.get('/evaluation/global').then((r) => r.data);

export default api;