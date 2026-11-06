// src/api/httpClient.js
import axios from 'axios';

const httpClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach token if present
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken'); // Fixed: use 'authToken' to match apiService
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default httpClient;
