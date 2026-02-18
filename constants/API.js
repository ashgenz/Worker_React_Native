import Constants from 'expo-constants';
import { Platform } from 'react-native';

// --- CONFIGURATION ---
export const API_PORT = 8000;         // For login.tsx, Balance.tsx
export const BOOKINGS_PORT = 5000;    // For index.tsx, explore.tsx
export const WORKER_API_PATH = "/api/worker";
export const LOGIN_API_PATH = "/workers/login";
// ---------------------

const getApiHost = (): string => {
 
  return '192.168.0.183'; 
};

export const API_HOST = getApiHost(); 

/**
 * Constructs the full API URL.
 */
export const buildUrl = (port: number, path: string) => {
    // Use https for external domains, http for local dev IPs
    const protocol = (API_HOST.includes('.') && !API_HOST.startsWith('1')) ? 'https' : 'http';
    return `${protocol}://${API_HOST}:${port}${path}`;
}