import axios from 'axios';

// 1. Buat instance custom axios
const api = axios.create({
  baseURL: '/api',
});

// 2. TAMBAHKAN INTERCEPTOR UNTUK INSTANCE 'api' INI
// Tanpa ini, header X-User-NIK & X-User-Name tidak akan pernah terhantar!
api.interceptors.request.use(
  (config) => {
    const savedUser = localStorage.getItem('saiyamfg_current_user');
    if (savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        config.headers['X-User-NIK'] = userObj.nik || '-';
        config.headers['X-User-Name'] = userObj.name || 'System/Guest';
      } catch (e) {
        console.error("Gagal membaca session user untuk logging:", e);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==========================================
// API CALLS (Gunakan 'api' instance)
// ==========================================

export const getOrders = async () => {
  const response = await api.get('/orders');
  return response.data;
};

export const getOrder = async (id) => {
  const response = await api.get(`/orders/${id}`);
  return response.data;
};

export const createOrder = async (formData) => {
  const response = await api.post('/orders', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const updateOrder = async (id, data) => {
  const response = await api.put(`/orders/${id}`, data);
  return response.data;
};

export const generateOrder = async (id) => {
  const response = await api.post(`/orders/${id}/generate`);
  return response.data;
};

export const deleteOrder = async (id) => {
  const response = await api.delete(`/orders/${id}`);
  return response.data;
};

export const getBacklogParts = async ({ search = '', projectNo = '', unfulfilledOnly = true, limit = 100, offset = 0 } = {}) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (projectNo) params.append('project_no', projectNo);
  params.append('unfulfilled_only', unfulfilledOnly);
  params.append('limit', limit);
  params.append('offset', offset);

  // Menggunakan 'api' instance agar interceptor berfungsi
  const response = await api.get(`/reports/backlog-parts?${params.toString()}`);
  return response.data;
};

export const downloadBacklogPartsExcel = (search = '', projectNo = '', unfulfilledOnly = true) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (projectNo) params.append('project_no', projectNo);
  params.append('unfulfilled_only', unfulfilledOnly);

  window.location.href = `/api/reports/backlog-parts/export?${params.toString()}`;
};

// --- FUNGSI MASTER BOM SQL SERVER ---
export const checkMasterBomExists = async (bomId) => {
  const response = await api.get(`/manufacturing-mst-bom/check/${encodeURIComponent(bomId)}`);
  return response.data;
};

export const uploadMasterBom = async (orderId, itemNo = '') => {
  const response = await api.post(
    `/manufacturing-mst-bom/upload/${orderId}?item_no=${encodeURIComponent(itemNo)}`
  );
  return response.data;
};