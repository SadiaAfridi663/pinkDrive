import axios from 'axios';
import logger from '../utils/logger';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status >= 500) {
      logger.error('Server Error:', error.response?.data?.message || error.message);
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (token) => api.post('/auth/verify', { token }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
};

export const driverAPI = {
  uploadDocuments: (formData) =>
    api.post('/driver-verification/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getStatus: () => api.get('/driver-verification/status'),
  removeDocument: (documentId) => api.delete(`/driver-verification/documents/${documentId}`),
};

export const adminAPI = {
  getPendingVerifications: () => api.get('/driver-verification/pending'),
  reviewVerification: (userId, action, adminNote) =>
    api.patch(`/driver-verification/review/${userId}`, { action, adminNote }),
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  suspendUser: (id) => api.patch(`/admin/users/${id}/suspend`),
  getAllRides: (params) => api.get('/admin/rides', { params }),
  getActivities: (params) => api.get('/admin/activities', { params }),
};

export const rideAPI = {
  createRide: (data) => api.post('/rides', data),
  uploadSelfie: (rideId, formData) =>
    api.post(`/rides/${rideId}/selfie`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadTempSelfie: (formData) =>
    api.post('/rides/selfie/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getActiveRide: () => api.get('/rides/active'),
  getPendingRides: () => api.get('/rides/pending'),
  acceptRide: (rideId) => api.patch(`/rides/${rideId}/accept`),
  updateStatus: (rideId, status) => api.patch(`/rides/${rideId}/status`, { status }),
  cancelRide: (rideId) => api.patch(`/rides/${rideId}/cancel`),
  getHistory: () => api.get('/rides/history'),
  getRideById: (rideId) => api.get(`/rides/${rideId}`),
  updateDriverLocation: (rideId, lat, lng) => api.patch(`/rides/${rideId}/driver-location`, { lat, lng }),
  getNearbyDrivers: (lat, lng, radius) => api.get('/rides/nearby-drivers', { params: { lat, lng, radius } }),
};

export const serviceAreaAPI = {
  getAll: () => api.get('/service-areas'),
  getActive: () => api.get('/service-areas/active'),
  create: (data) => api.post('/service-areas', data),
  update: (id, data) => api.patch(`/service-areas/${id}`, data),
  remove: (id) => api.delete(`/service-areas/${id}`),
};

export const sosAPI = {
  trigger: (data) => api.post('/sos/trigger', data),
  getAlerts: (status) => api.get('/sos/alerts', { params: { status } }),
  resolveAlert: (id) => api.patch(`/sos/${id}/resolve`),
  getContacts: () => api.get('/sos/contacts'),
  addContact: (data) => api.post('/sos/contacts', data),
  removeContact: (id) => api.delete(`/sos/contacts/${id}`),
};

export default api;
