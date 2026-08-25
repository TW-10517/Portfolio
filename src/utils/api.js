export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors || {};
  }
}

// A 30-day token can be revoked (logout elsewhere, password change) or simply
// expire while a tab sits open. Nothing used to notice: the app kept rendering
// the editor as if signed in, background syncs failed silently, and the only
// sign of trouble was an error when you finally tried to publish. The session
// owner registers here so it can end the session the moment the server says
// the token is no longer good. A plain callback, rather than importing the
// store, because the store imports this module.
let onUnauthorized = null;

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Images go up as bytes, not as JSON. Base64 inside a JSON body costs a third
// more on the wire and forced the whole document through the parser; this
// posts the blob itself and gets back a short URL to store in its place.
async function requestBinary(path, blob, token) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: blob,
    });
  } catch {
    throw new ApiError("Can't reach the server. Is it running?", 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(json?.error || "Upload failed.", res.status);
  }
  return json;
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
    // Only for calls we actually authenticated: a 401 from login or register
    // means "wrong password", not "your session died".
    if (res.status === 401 && token) onUnauthorized?.();
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

  uploadImage: (token, blob) => requestBinary("/images", blob, token),
  imageUsage: (token) => request("/images", { token }),

  getBySlug: (slug) => request(`/portfolios/by-slug/${encodeURIComponent(slug)}`),
  unlockBySlug: (slug, password) =>
    request(`/portfolios/by-slug/${encodeURIComponent(slug)}/unlock`, { method: "POST", body: { password } }),
};
