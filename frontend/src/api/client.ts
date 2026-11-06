import axios from "axios";

// Use Create React App environment variables instead of Vite
const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5158/api"
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
