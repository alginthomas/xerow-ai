/**
 * App configuration — resolved at build time via Vite env vars
 */

// API base URL: empty string in production (uses relative /api/* proxied by Netlify)
// 'http://localhost:3001' in development
const envUrl = import.meta.env.VITE_API_BASE_URL;
export const API_BASE = envUrl !== undefined && envUrl !== '' ? envUrl : (import.meta.env.DEV ? 'http://localhost:3001' : '');
