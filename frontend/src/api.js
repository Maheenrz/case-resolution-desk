import axios from 'axios';

// Set VITE_API_URL in .env (or your Vercel/Railway env) when you deploy.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const API = axios.create({ baseURL: API_URL });

export const analyzeCase = (facts) => API.post('/api/cases/analyze', facts);
export const listCases = () => API.get('/api/cases');
export const getCase = (id) => API.get(`/api/cases/${id}`);
export const addNote = (id, note) => API.post(`/api/cases/${id}/notes`, { note });