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

export default api;
