// src/api/users.js
import http from './httpClient';

export const getUsers = () => http.get('/Users').then(res => res.data);
export const createUser = (data) => http.post('/Users', data).then(res => res.data);
export const updateUser = (id, data) => http.put(`/Users/${id}`, data).then(res => res.data);
export const deleteUser = (id) => http.delete(`/Users/${id}`).then(res => res.data);
