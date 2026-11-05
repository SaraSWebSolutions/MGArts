import api, { unwrapItem, unwrapList } from "./api";

const list = async (path, params) =>
  unwrapList((await api.get(path, { params })).data);
const item = async (path) => unwrapItem((await api.get(path)).data);
/** paginated list -> { rows, meta, summary } (send page / limit / search in params) */
const paged = async (path, params) => {
  const body = (await api.get(path, { params })).data;
  return {
    rows: unwrapList(body),
    meta: body?.meta ?? null,
    summary: body?.summary ?? null,
  };
};

/** Build multipart FormData from a plain object (null/undefined are skipped). */
export const toFormData = (values) => {
  const fd = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    fd.append(key, value);
  });
  return fd;
};

export const authApi = {
  login: (credentials) => api.post("/login", credentials),
  logout: () => api.post("/logout"),
  profile: () => item("/profile"),
  updateProfile: (formData) => api.post("/profile/update", formData),
};

export const usersApi = {
  list: (params) => list("/users", params),
  page: (params) => paged("/users", params),
  get: (id) => item(`/users/${id}`),
  create: (formData) => api.post("/users", formData),
  update: (id, formData) => api.post(`/users/${id}`, formData), // multipart update uses POST
  remove: (id) => api.delete(`/users/${id}`),
};

export const rolesApi = {
  list: (params) => list("/roles", params),
  page: (params) => paged("/roles", params),
  get: (id) => item(`/roles/${id}`),
  create: (payload) => api.post("/roles", payload),
  update: (id, payload) => api.put(`/roles/${id}`, payload),
  remove: (id) => api.delete(`/roles/${id}`),
  permissions: (id) => list(`/roles/${id}/permissions`),
  assignPermissions: (id, permissionIds) =>
    api.post(`/roles/${id}/permissions`, { permission_ids: permissionIds }),
};

export const permissionsApi = {
  list: (params) => list("/permissions", params),
  page: (params) => paged("/permissions", params),
  create: (payload) => api.post("/permissions", payload),
  update: (id, payload) => api.put(`/permissions/${id}`, payload),
  remove: (id) => api.delete(`/permissions/${id}`),
};

const crud = (base) => ({
  list: (params) => list(`/${base}`, params),
  page: (params) => paged(`/${base}`, params),
  get: (id) => item(`/${base}/${id}`),
  create: (payload) => api.post(`/${base}`, payload),
  update: (id, payload) => api.put(`/${base}/${id}`, payload),
  remove: (id) => api.delete(`/${base}/${id}`),
});

export const customersApi = crud("customers");
export const workersApi = crud("workers");
export const taxRatesApi = crud("tax-rates");
export const settingsApi = {
  get: () => item("/settings"),
  update: (payload) => api.put("/settings", payload),
  uploadLogo: (file) => api.post("/settings/logo", toFormData({ logo: file })),
  removeLogo: () => api.delete("/settings/logo"),
};

/** transaction endpoints - POST creates, /void reverses stock */
const txn = (base) => ({
  list: (params) => list(`/${base}`, params),
  page: (params) => paged(`/${base}`, params),
  get: (id) => item(`/${base}/${id}`),
  create: (payload) => api.post(`/${base}`, payload),
  void: (id) => api.post(`/${base}/${id}/void`),
});
export const receiptsApi = txn("gold-receipts");
export const conversionsApi = txn("conversions");
export const purchasesApi = txn("purchases");
export const salesApi = txn("sales");
export const paymentsApi = txn("payments");
export const jobsApi = {
  ...txn("jobs"),
  receive: (id, payload) => api.post(`/jobs/${id}/receive`, payload),
  cancel: (id) => api.post(`/jobs/${id}/cancel`),
  deliver: (id) => api.post(`/jobs/${id}/deliver`),
  setCharges: (id, payload) => api.put(`/jobs/${id}/charges`, payload),
};
export const jewelleryApi = {
  list: (params) => list("/jewellery", params),
  page: (params) => paged("/jewellery", params),
  update: (id, payload) => api.put(`/jewellery/${id}`, payload),
};

/** raw GETs (response has extra keys such as summary / totals) */
export const fetchData = async (path, params) =>
  (await api.get(path, { params })).data;
