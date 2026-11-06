import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5158/api';

const dashboardApi = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
dashboardApi.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add response interceptor for handling auth errors
dashboardApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear invalid token
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('currentUser');
        }
        return Promise.reject(error);
    }
);

// Dashboard API methods
const getDashboardStats = async () => {
	try {
		// Use the dedicated dashboard stats endpoint
		const response = await dashboardApi.get('/dashboard/stats');
		return response.data;
	} catch (error) {
		console.error('🔴 Error fetching dashboard stats:', error);
		if (error.response?.status === 401) {
			console.error('🔐 Authentication required for dashboard stats');
		}
		// Return fallback data instead of throwing error
		return {
			totalUsers: 0,
			totalLecturers: 0,
			totalDepartments: 0,
			completedEvaluations: 0,
			pendingEvaluations: 0
		};
	}
};

const getRecentActivity = async () => {
	try {
		// Use the dedicated dashboard recent activity endpoint
		const response = await dashboardApi.get('/dashboard/recent-activity');
		return response.data || [];
	} catch (error) {
		console.error('🔴 Error fetching recent activity:', error);
		if (error.response?.status === 401) {
			console.error('🔐 Authentication required for recent activity');
		}
		// Return empty array instead of throwing error
		return [];
	}
};

const getPerformanceData = async () => {
	try {
		// Use the dedicated dashboard performance endpoint
		const response = await dashboardApi.get('/dashboard/performance');
		return response.data || [];
	} catch (error) {
		console.error('🔴 Error fetching performance data:', error);
		if (error.response?.status === 401) {
			console.error('🔐 Authentication required for performance data');
		}
		// Return fallback data instead of throwing error
		return [
			{ name: 'Teaching', value: 0 },
			{ name: 'Research', value: 0 },
			{ name: 'Service', value: 0 }
		];
	}
};

const getDepartmentData = async () => {
	try {
		// Use the dedicated dashboard department data endpoint
		const response = await dashboardApi.get('/dashboard/department-data');
		return response.data || [];
	} catch (error) {
		console.error('🔴 Error fetching department data:', error);
		if (error.response?.status === 401) {
			console.error('🔐 Authentication required for department data');
		}
		// Return fallback data instead of throwing error
		return [
			{ name: 'No Departments', lecturers: 0, avgScore: 0 }
		];
	}
};

export default {
	getDashboardStats,
	getRecentActivity,
	getPerformanceData,
	getDepartmentData,
};
