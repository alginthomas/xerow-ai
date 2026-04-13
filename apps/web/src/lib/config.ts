/**
 * Shared API configuration
 * In production (Netlify), VITE_API_BASE_URL is "" so requests go to same origin
 * and are proxied via netlify.toml redirects to Railway.
 * In development, falls back to localhost:3001.
 */
const envUrl = import.meta.env.VITE_API_BASE_URL;

// envUrl is "" in production (set in netlify.toml), undefined when not set
export const API_BASE = envUrl !== undefined
  ? envUrl
  : (import.meta.env.DEV ? 'http://localhost:3001' : '');
