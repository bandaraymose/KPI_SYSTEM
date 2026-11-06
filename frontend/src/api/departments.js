// src/api/departments.js
import http from './httpClient';

export const getDepartments = () => http.get('/Departments').then(res => res.data);
export const createDepartment = (data) => http.post('/Departments', data).then(res => res.data);
export const updateDepartment = (id, data) => http.put(`/Departments/${id}`, data).then(res => res.data);
export const deleteDepartment = (id) => http.delete(`/Departments/${id}`).then(res => res.data);
