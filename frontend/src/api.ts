import { API_BASE_URL } from './config';

const AUTH_STORAGE_KEY = 'nexora_auth_token';

/** API wrapper for the authenticated workspace. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (response.status === 401) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.assign('/');
  }
  return response;
}
