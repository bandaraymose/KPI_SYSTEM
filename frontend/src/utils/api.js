// Import real-time update utilities
import { notifyEvaluationCreated, notifyEvaluationUpdated, requestReportRefresh } from './reportUpdateEvents.js';
// API Configuration
const API_BASE_URL = 'http://localhost:5158/api';



// API utility class
class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Get auth token from localStorage
  getAuthToken() {
    return localStorage.getItem('authToken');
  }

  // Set auth token
  setAuthToken(token) {
    localStorage.setItem('authToken', token);
  }

  // Remove auth token
  removeAuthToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  }

  // Get current user from localStorage
  getCurrentUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  // Set current user
  setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getAuthToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      // Try to parse as JSON, fall back to text for both success and error cases
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const payload = isJson ? await response.json() : { message: await response.text() };

      if (!response.ok) {
        // If unauthorized, clear token but do NOT redirect. Allow UI to handle error messaging.
        if (response.status === 401) {
          this.removeAuthToken();
        }
        const serverMessage = payload?.message || payload?.error || payload?.title; // ASP.NET often uses 'title' for ProblemDetails
        const err = new Error(serverMessage || `HTTP error! status: ${response.status}`);
        err.status = response.status;
        err.details = payload;
        throw err;
      }

      return payload;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Authentication methods
  async login(email, password) {
    const response = await this.post('/auth/login', { email, password });
    if (response.token) {
      this.setAuthToken(response.token);
      this.setCurrentUser(response.user);
    }
    return response;
  }

  async register(userData) {
    return this.post('/auth/register', userData);
  }

  async signup(signupData) {
    const response = await this.post('/auth/signup', signupData);
    if (response && response.token) {
      this.setAuthToken(response.token);
      this.setCurrentUser(response.user);
    }
    return response;
  }

  // Profile endpoints
  async getProfile() {
    return this.get('/auth/me');
  }

  async updateMyEmail(newEmail, currentPassword) {
    return this.put('/auth/me/email', { newEmail, currentPassword });
  }

  async changeMyPassword(currentPassword, newPassword) {
    return this.put('/auth/me/password', { currentPassword, newPassword });
  }

  logout() {
    this.removeAuthToken();
    window.location.href = '/login';
  }


  // User methods
  async getAllUsers() {
    return this.get('/users');
  }

  async getLecturers() {
    return this.get('/users/lecturers');
  }

  async getUser(id) {
    return this.get(`/users/${id}`);
  }

  async updateUser(id, userData) {
    return this.put(`/users/${id}`, userData);
  }

  async deleteUser(id) {
    return this.delete(`/users/${id}`);
  }

  // Admin create user (with roles/department) via AuthController Register
  async createUser(userData) {
    return this.post('/auth/register', userData);
  }

  // Update roles for a user (Admin only)
  async updateUserRoles(id, roles) {
    return this.put(`/users/${id}/roles`, { roles });
  }

  // Roles (stub, update if backend provides roles endpoint)
  async getAllRoles() {
    // If you have a backend endpoint for roles, use it here. Otherwise, return static roles.
    return ['Admin', 'HOD', 'Dean', 'Lecturer'];
  }

  // Department methods
  async getDepartments() {
    return this.get('/departments');
  }

  async createDepartment(departmentData) {
    return this.post('/departments', departmentData);
  }

  async updateDepartment(id, departmentData) {
    return this.put(`/departments/${id}`, departmentData);
  }

  async deleteDepartment(id) {
    return this.delete(`/departments/${id}`);
  }

  // KPI methods
  async getKpis() {
    return this.get('/kpis');
  }

  async getKpisByDepartment(departmentId) {
    return this.get(`/kpis/department/${departmentId}`);
  }

  async createKpi(kpiData) {
    return this.post('/kpis', kpiData);
  }

  async updateKpi(id, kpiData) {
    return this.put(`/kpis/${id}`, kpiData);
  }

  async deleteKpi(id) {
    return this.delete(`/kpis/${id}`);
  }

  // Areas
  async getAreas(targetRole) {
    const suffix = targetRole ? `?targetRole=${encodeURIComponent(targetRole)}` : '';
    return this.get(`/areas${suffix}`);
  }

  async getAreaById(id) {
    return this.get(`/areas/${id}`);
  }

  async getAreaKpis(areaId) {
    return this.get(`/areas/${areaId}/kpis`);
  }

  async createArea(data) {
    return this.post('/areas', data);
  }

  async updateArea(id, data) {
    return this.put(`/areas/${id}`, data);
  }

  async deleteArea(id) {
    return this.delete(`/areas/${id}`);
  }

  // KPI Assignment methods
  async getKpiAssignments() {
    return this.get('/kpiassignments');
  }

  async getKpiAssignmentsByLecturer(lecturerId) {
    return this.get(`/kpiassignments/lecturer/${lecturerId}`);
  }

  async assignKpiToLecturer(assignmentData) {
    return this.post('/kpiassignments', assignmentData);
  }

  async removeKpiAssignment(id) {
    return this.delete(`/kpiassignments/${id}`);
  }

  // Evaluation methods
  async getEvaluations() {
    return this.get('/evaluations');
  }

  async getEvaluationsByLecturer(lecturerId) {
    return this.get(`/evaluations/lecturer/${lecturerId}`);
  }

  // Area-based evaluations
  async createAreaEvaluation(data) {
    // data: { lecturerId, areaId, comments?, items: [{kpiId, score:0..5}] }
    try {
      const result = await this.post('/areaevaluations', data);
      // Trigger real-time update notification similar to legacy evaluations
      notifyEvaluationCreated(result);
      // storage flags for cross-tab triggers
      try {
        localStorage.setItem('evaluationUpdated', Date.now().toString());
        localStorage.setItem('reportRefreshNeeded', Date.now().toString());
      } catch (_) {}
      console.log('🔔 Real-time update triggered for area evaluation creation');
      return result;
    } catch (error) {
      console.error('Failed to create area evaluation:', error);
      throw error;
    }
  }

  async getAreaEvaluationsByLecturer(lecturerId) {
    return this.get(`/areaevaluations/lecturer/${lecturerId}`);
  }

  // Self-evaluation methods
  async createSelfAreaEvaluation(data) {
    // data: { areaId, comments?, items: [{kpiId, score:0..5}] }
    try {
      const result = await this.post('/areaevaluations/self', data);
      notifyEvaluationCreated(result);
      try {
        localStorage.setItem('evaluationUpdated', Date.now().toString());
        localStorage.setItem('reportRefreshNeeded', Date.now().toString());
      } catch (_) {}
      console.log('🔔 Real-time update triggered for self area evaluation creation');
      return result;
    } catch (error) {
      console.error('Failed to create self area evaluation:', error);
      throw error;
    }
  }

  async getSelfAreaEvaluationsByLecturer(lecturerId) {
    return this.get(`/areaevaluations/lecturer/${lecturerId}/self`);
  }


  async updateEvaluation(id, evaluationData) {
    try {
      const result = await this.put(`/evaluations/${id}`, evaluationData);
      // Trigger real-time update notification
      notifyEvaluationUpdated(result);
      console.log('🔔 Real-time update triggered for evaluation update');
      return result;
    } catch (error) {
      console.error('Failed to update evaluation:', error);
      throw error;
    }
  }

  // Workplan methods
  async getWorkplans() {
    return this.get('/workplans');
  }

  async getWorkplansByLecturer(lecturerId) {
    return this.get(`/workplans/lecturer/${lecturerId}`);
  }

  async createWorkplan(workplanData) {
    return this.post('/workplans', workplanData);
  }

  async updateWorkplan(id, workplanData) {
    return this.put(`/workplans/${id}`, workplanData);
  }

  async deleteWorkplan(id) {
    return this.delete(`/workplans/${id}`);
  }

  // Reports methods
  async getLecturerReport(lecturerId, academicYear, semester) {
    return this.get(`/reports/lecturer/${lecturerId}?academicYear=${academicYear}&semester=${semester}`);
  }

  async getDepartmentReport(departmentId, academicYear, semester) {
    return this.get(`/reports/department/${departmentId}?academicYear=${academicYear}&semester=${semester}`);
  }

  // HOD-specific methods
  async getMyDepartmentLecturers() {
    const user = this.getCurrentUser();
    if (!user || !user.departmentId) {
      throw new Error('User not authenticated or not assigned to a department');
    }
    return this.get(`/departments/${user.departmentId}/lecturers`);
  }

  async getMyDepartmentKpis() {
    const user = this.getCurrentUser();
    if (!user || !user.departmentId) {
      throw new Error('User not authenticated or not assigned to a department');
    }
    return this.get(`/kpis/department/${user.departmentId}`);
  }

  async getMyDepartmentEvaluations() {
    const user = this.getCurrentUser();
    if (!user || !user.departmentId) {
      throw new Error('User not authenticated or not assigned to a department');
    }
    return this.get(`/evaluations/department/${user.departmentId}`);
  }

  async getMyDepartmentWorkplans() {
    const user = this.getCurrentUser();
    if (!user || !user.departmentId) {
      throw new Error('User not authenticated or not assigned to a department');
    }
    return this.get(`/workplans/department/${user.departmentId}`);
  }

  async submitWorkplanToDean(workplanData) {
    return this.post('/workplans/submit-to-dean', workplanData);
  }

  async submitWorkplanToHOD(workplanData) {
    return this.post('/workplans/submit-to-hod', workplanData);
  }

  async getMyDepartmentReports(academicYear, semester) {
    const user = this.getCurrentUser();
    if (!user || !user.departmentId) {
      throw new Error('User not authenticated or not assigned to a department');
    }
    return this.get(`/reports/department/${user.departmentId}?academicYear=${academicYear}&semester=${semester}`);
  }

  async exportMyDepartmentReport(academicYear, semester, format = 'pdf') {
    const user = this.getCurrentUser();
    if (!user || !user.departmentId) {
      throw new Error('User not authenticated or not assigned to a department');
    }
    return this.get(`/reports/department/${user.departmentId}/export?academicYear=${academicYear}&semester=${semester}&format=${format}`);
  }

  // Enhanced KPI Assignment methods
  async getMyKpiAssignments() {
    return this.get('/kpiassignments/my');
  }

  async createKpiAssignment(assignmentData) {
    return this.post('/kpiassignments', assignmentData);
  }

  async deleteKpiAssignment(id) {
    return this.delete(`/kpiassignments/${id}`);
  }

  // Enhanced Evaluation methods
  async getMyEvaluations() {
    return this.get('/evaluations/my');
  }

  async createEvaluation(evaluationData) {
    try {
      const result = await this.post('/evaluations', evaluationData);
      // Trigger real-time update notification
      notifyEvaluationCreated(result);
      console.log('🔔 Real-time update triggered for enhanced evaluation creation');
      return result;
    } catch (error) {
      console.error('Failed to create enhanced evaluation:', error);
      throw error;
    }
  }

  async getEvaluationsByDepartment(departmentId) {
    return this.get(`/evaluations?departmentId=${departmentId}`);
  }

  // Enhanced Workplan methods
  async getMyWorkplans() {
    return this.get('/workplans/my');
  }

  async getWorkplansByDepartment(departmentId) {
    return this.get(`/workplans?departmentId=${departmentId}`);
  }

  // Department methods
  async getDepartmentById(id) {
    return this.get(`/departments/${id}`);
  }

  async getDepartmentHods(id) {
    return this.get(`/departments/${id}/hods`);
  }

  async getDepartmentLecturers(id) {
    return this.get(`/departments/${id}/lecturers`);
  }

  // Enhanced KPI methods

async getMyKpis() {
  try {
    // First try the dedicated endpoint
    return await this.get('/kpis/my');
  } catch (error) {
    console.log('Falling back to extracting KPIs from assignments');
    // Fallback: get assignments and extract KPIs
    const assignments = await this.get('/kpiassignments/my');
    
    // Extract unique KPIs from the assignments
    const uniqueKpis = [];
    const seenIds = new Set();
    
    assignments.forEach(assignment => {
      if (assignment.kpi && !seenIds.has(assignment.kpi.id)) {
        uniqueKpis.push(assignment.kpi);
        seenIds.add(assignment.kpi.id);
      }
    });
    
    return uniqueKpis;
  }
}

async getMyAssign() {
  try {
    // First try the dedicated endpoint
    return await this.get('/kpiassignments/my-kpis');
  } catch (error) {
    console.log('Falling back to extracting KPIs from assignments');
    // Fallback: get assignments and extract KPIs
    const assignments = await this.get('/kpiassignments/my');
    
    // Extract unique KPIs from the assignments
    const uniqueKpis = [];
    const seenIds = new Set();
    
    assignments.forEach(assignment => {
      if (assignment.kpi && !seenIds.has(assignment.kpi.id)) {
        uniqueKpis.push(assignment.kpi);
        seenIds.add(assignment.kpi.id);
      }
    });
    
    return uniqueKpis;
  }
}

  async getAllKpis() {
    return this.get('/kpis');
  }

  // Standard Workplan methods
  async getStandardWorkplans() {
    return this.get('/standardworkplans');
  }

  async getStandardWorkplansForAssignment() {
    return this.get('/standardworkplans/for-assignment');
  }

  async getStandardWorkplanById(id) {
    return this.get(`/standardworkplans/${id}`);
  }

  async createStandardWorkplan(workplanData) {
    return this.post('/standardworkplans', workplanData);
  }

  async updateStandardWorkplan(id, workplanData) {
    return this.put(`/standardworkplans/${id}`, workplanData);
  }

  async deleteStandardWorkplan(id) {
    return this.delete(`/standardworkplans/${id}`);
  }

  // Workplan Assignment methods
  async getMyWorkplanAssignments() {
    return this.get('/workplanassignments/my');
  }

  async getWorkplanAssignmentsByMe() {
    return this.get('/workplanassignments/assigned-by-me');
  }

  async assignWorkplan(assignmentData) {
    return this.post('/workplanassignments/assign', assignmentData);
  }

  async bulkAssignWorkplan(bulkAssignmentData) {
    return this.post('/workplanassignments/bulk-assign', bulkAssignmentData);
  }

  async updateWorkplanAssignmentStatus(assignmentId, statusData) {
    return this.put(`/workplanassignments/${assignmentId}/status`, statusData);
  }

  async removeWorkplanAssignment(assignmentId) {
    return this.delete(`/workplanassignments/${assignmentId}`);
  }

  // Assign all KPIs under selected areas to selected assignees (skip duplicates silently)
  async assignKpisByAreas(payload) {
    // payload: { standardWorkplanId, assigneeIds: string[], areaIds: number[], assignmentNotes? }
    return this.post('/workplanassignments/assign-areas', payload);
  }

  // Dean-specific methods
  async getHODs() {
    return this.get('/users/hods');
  }

  async getAllEvaluations() {
    return this.get('/evaluations');
  }

  async getAllKpiAssignments() {
    return this.get('/kpiassignments');
  }

  async getWorkplansForReview() {
    return this.get('/workplans/for-review');
  }

  async reviewWorkplan(workplanId, reviewData) {
    return this.put(`/workplans/${workplanId}/review`, reviewData);
  }

  async submitWorkplanToVC(workplanData) {
    return this.post('/workplans/submit-to-vc', workplanData);
  }
}

// Create and export a single instance
const apiService = new ApiService();
export default apiService;

// Export individual methods for convenience
export const {
  login,
  signup,
  register,
  logout,
  getLecturers,
  getUser,
  updateUser,
  deleteUser,
  createUser,
  updateUserRoles,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getKpis,
  getKpisByDepartment,
  createKpi,
  updateKpi,
  deleteKpi,
  getKpiAssignments,
  getKpiAssignmentsByLecturer,
  assignKpiToLecturer,
  removeKpiAssignment,
  getEvaluations,
  getEvaluationsByLecturer,
  createEvaluation,
  updateEvaluation,
  getWorkplans,
  getWorkplansByLecturer,
  createWorkplan,
  updateWorkplan,
  deleteWorkplan,
  getLecturerReport,
  getDepartmentReport,
  getCurrentUser,
  getAuthToken,
  getMyKpiAssignments,
  createKpiAssignment,
  deleteKpiAssignment,
  getMyEvaluations,
  getEvaluationsByDepartment,
  getMyWorkplans,
  getWorkplansByDepartment,
  getDepartmentById,
  getDepartmentHods,
  getDepartmentLecturers,
  getMyKpis,
  getMyAssign,
  getAllKpis
} = apiService;