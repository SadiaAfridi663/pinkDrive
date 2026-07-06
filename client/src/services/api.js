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
  registerDocs: (formData) =>
    api.post('/auth/register-docs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  finalizeDriver: (formData) =>
    api.post('/auth/finalize-driver', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (token) => api.post('/auth/verify', { token }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  uploadProfilePhoto: (formData) =>
    api.post('/auth/profile-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
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
  getUserById: (id) => api.get(`/admin/users/${id}`),
  getPendingVerifications: () => api.get('/driver-verification/pending'),
  reviewVerification: (userId, action, adminNote) =>
    api.patch(`/driver-verification/review/${userId}`, { action, adminNote }),
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  suspendUser: (id) => api.patch(`/admin/users/${id}/suspend`),
  updateUserRestriction: (id, restriction) => api.patch(`/admin/users/${id}/restriction`, { restriction }),
  getAllRides: (params) => api.get('/admin/rides', { params }),
  getRideById: (id) => api.get(`/admin/rides/${id}`),
  overridePaymentStatus: (id, paymentStatus) => api.patch(`/admin/rides/${id}/payment-status`, { paymentStatus }),
  getActivities: (params) => api.get('/admin/activities', { params }),
  getPaymentStats: () => api.get('/admin/payments'),
  getDisputes: (params) => api.get('/admin/disputes', { params }),
  getDisputeById: (id) => api.get(`/admin/disputes/${id}`),
  resolveDispute: (id, data) => api.patch(`/admin/disputes/${id}/resolve`, data),
  clearDebt: (id) => api.post(`/admin/debts/${id}/clear`),
  getWithdrawals: (params) => api.get('/admin/withdrawals', { params }),
  processWithdrawal: (id, data) => api.patch(`/admin/withdrawals/${id}`, data),
  getDriverWallets: () => api.get('/admin/wallets'),
  getDriverWalletById: (id) => api.get(`/admin/wallets/${id}`),
  settleCommission: (id) => api.post(`/admin/wallets/${id}/settle-commission`),
  adjustWallet: (id, data) => api.post(`/admin/wallets/${id}/adjust`, data),
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
  acceptOffer: (bidId) => api.post('/rides/accept-offer', { bidId }),
  updateStatus: (rideId, status) => api.patch(`/rides/${rideId}/status`, { status }),
  cancelRide: (rideId) => api.patch(`/rides/${rideId}/cancel`),
  getHistory: () => api.get('/rides/history'),
  getRideById: (rideId) => api.get(`/rides/${rideId}`),
  getRideBids: (rideId) => api.get(`/rides/${rideId}/bids`),
  updateDriverLocation: (rideId, lat, lng) => api.patch(`/rides/${rideId}/driver-location`, { lat, lng }),
  getNearbyDrivers: (lat, lng, radius) => api.get('/rides/nearby-drivers', { params: { lat, lng, radius } }),
  confirmPayment: (rideId) => api.post(`/rides/${rideId}/confirm-payment`),
  acknowledgePayment: (rideId) => api.post(`/rides/${rideId}/acknowledge-payment`),
  reportIssue: (rideId, data) => api.post(`/rides/${rideId}/report-issue`, data),
};

export const serviceAreaAPI = {
  getAll: () => api.get('/service-areas'),
  getActive: () => api.get('/service-areas/active'),
  create: (data) => api.post('/service-areas', data),
  update: (id, data) => api.patch(`/service-areas/${id}`, data),
  remove: (id) => api.delete(`/service-areas/${id}`),
};

export const walletAPI = {
  getWallet: () => api.get('/wallet'),
  topup: (amount) => api.post('/wallet/topup', { amount }),
  confirmTopup: (sessionId) => api.post('/wallet/confirm-topup', { session_id: sessionId }),
  getTransactions: (params) => api.get('/wallet/transactions', { params }),
  getDriverEarnings: (params) => api.get('/wallet/driver-earnings', { params }),
  getWithdrawable: () => api.get('/wallet/withdrawable'),
  requestWithdrawal: (data) => api.post('/wallet/withdraw', data),
  getWithdrawals: (params) => api.get('/wallet/withdrawals', { params }),
};

export const paymentsAPI = {
  getConfig: () => api.get('/payments/config'),
  createCheckoutSession: (rideId) => api.post('/payments/create-checkout-session', { rideId }),
  getSessionStatus: (sessionId) => api.get('/payments/session-status', { params: { session_id: sessionId } }),
};

export const sosAPI = {
  trigger: (data) => api.post('/sos/trigger', data),
  getAlerts: (status) => api.get('/sos/alerts', { params: { status } }),
  resolveAlert: (id) => api.patch(`/sos/${id}/resolve`),
  getContacts: () => api.get('/sos/contacts'),
  addContact: (data) => api.post('/sos/contacts', data),
  removeContact: (id) => api.delete(`/sos/contacts/${id}`),
};

export const sharedTripAPI = {
  create: (data) => api.post('/shared-trips', data),
  getAvailable: (lat, lng) => {
    const params = {};
    if (lat != null && lng != null) { params.lat = lat; params.lng = lng; }
    return api.get('/shared-trips/available', { params });
  },
  getMyTrips: () => api.get('/shared-trips/my'),
  getMyRequests: () => api.get('/shared-trips/requests/my'),
  requestJoin: (tripId, data) => api.post(`/shared-trips/${tripId}/request`, data),
  getTripRequests: (tripId) => api.get(`/shared-trips/${tripId}/requests`),
  acceptRequest: (requestId) => api.patch(`/shared-trips/requests/${requestId}/accept`),
  declineRequest: (requestId, reason) => api.patch(`/shared-trips/requests/${requestId}/decline`, { reason }),
  cancelTrip: (tripId) => api.patch(`/shared-trips/${tripId}/cancel`),
};

export const reviewAPI = {
  create: (data) => api.post('/reviews', data),
  getDriverReviews: (driverId) => api.get(`/reviews/driver/${driverId}`),
  getMyReviews: () => api.get('/reviews/my'),
  getMyRatings: () => api.get('/reviews/my-ratings'),
};

export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
};

export default api;
