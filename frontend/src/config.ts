const DEFAULT_PRODUCTION_BACKEND = 'https://ndc-t9im.onrender.com';
const DEFAULT_LOCAL_BACKEND = 'http://localhost:8001';

const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalhost ? DEFAULT_LOCAL_BACKEND : DEFAULT_PRODUCTION_BACKEND)
).replace(/\/$/, '');

