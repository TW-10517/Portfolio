export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors || {};
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Is it running?", 0);
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // empty/non-JSON body is fine for some responses
  }

  if (!res.ok) {
    const message = json?.error || json?.errors?.form || "Something went wrong.";
    throw new ApiError(message, res.status, json?.errors);
  }
  return json;
}

export const api = {
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login: (data) => request("/auth/login", { method: "POST", body: data }),
  logout: (token) => request("/auth/logout", { method: "POST", token }),
  me: (token) => request("/auth/me", { token }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, password) => request("/auth/reset-password", { method: "POST", body: { token, password } }),
  verifyEmail: (token) => request("/auth/verify-email", { method: "POST", body: { token } }),
  resendVerification: (token) => request("/auth/resend-verification", { method: "POST", token }),
  changePassword: (token, currentPassword, newPassword) =>
    request("/auth/change-password", { method: "POST", body: { currentPassword, newPassword }, token }),
  deleteAccount: (token, password) => request("/auth/me", { method: "DELETE", body: { password }, token }),

  getMine: (token) => request("/portfolios/mine", { token }),
  saveMine: (token, body) => request("/portfolios/mine", { method: "PUT", body, token }),
  deleteMine: (token) => request("/portfolios/mine", { method: "DELETE", token }),

  getBySlug: (slug) => request(`/portfolios/by-slug/${encodeURIComponent(slug)}`),
  unlockBySlug: (slug, password) =>
    request(`/portfolios/by-slug/${encodeURIComponent(slug)}/unlock`, { method: "POST", body: { password } }),
};
