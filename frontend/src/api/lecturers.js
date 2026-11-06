// src/api/lecturers.js
import http from './httpClient';

export const getLecturers = () => http.get('/Lecturers').then(res => res.data);
export const getLecturerById = (id) => http.get(`/Lecturers/${id}`).then(res => res.data);
export const createLecturer = (data) => http.post('/Lecturers', data).then(res => res.data);
export const updateLecturer = (id, data) => http.put(`/Lecturers/${id}`, data).then(res => res.data);
export const deleteLecturer = (id) => http.delete(`/Lecturers/${id}`).then(res => res.data);

// KPI assignment
export const assignKpiToLecturer = (lecturerId, kpiId) =>
  http.post(`/Lecturers/${lecturerId}/assign-kpi`, { kpiId }).then(res => res.data);
