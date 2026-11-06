// src/api/evaluations.js
import http from './httpClient';

export const getCompletedEvaluations = () =>
  http.get('/Evaluations?status=completed').then(res => res.data);

export const getEvaluationById = (id) =>
  http.get(`/Evaluations/${id}`).then(res => res.data);

export const submitEvaluation = (data) =>
  http.post('/Evaluations', data).then(res => res.data);
