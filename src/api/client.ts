import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('edumanage_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token expiry
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config?._retry && !error.config?.url?.includes('/auth/login')) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem('edumanage_refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', { token: refreshToken });
          if (res.data?.success && res.data?.data?.accessToken) {
            const newToken = res.data.data.accessToken;
            localStorage.setItem('edumanage_token', newToken);
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(error.config);
          }
        } catch (refreshErr) {
          localStorage.removeItem('edumanage_token');
          localStorage.removeItem('edumanage_refresh_token');
          localStorage.removeItem('edumanage_user');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('edumanage_token');
        localStorage.removeItem('edumanage_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
