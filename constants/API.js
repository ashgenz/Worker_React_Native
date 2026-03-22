import Constants from 'expo-constants';
import { Platform } from 'react-native';

// --- CONFIGURATION ---
export const API_PORT = 8000;         // For Worker/Login/Balance
export const BOOKINGS_PORT = 5000;    // For Job listings/Open bookings
export const WORKER_API_PATH = "/api/worker";
export const LOGIN_API_PATH = "/workers/login";
// ---------------------

// Your updated Worker IP
const getApiHost = () => {
  return '192.168.0.190'; 
};

export const API_HOST = getApiHost(); 

/**
 * Constructs the full API URL.
 */
export const buildUrl = (port, path) => {
    // Detects if we should use http (local IP) or https (domain)
    const protocol = (API_HOST.includes('.') && !API_HOST.startsWith('192')) ? 'https' : 'http';
    
    // Ensure the port is correctly appended for the base URL
    return `${protocol}://${API_HOST}:${port}${path}`;
};

// --- DIRECT EXPORTS ---
// These will now return the full strings:
// WORKER_API_URL = "http://192.168.0.174:8000"
// BOOKINGS_API_URL = "http://192.168.0.174:5000"
export const WORKER_API_URL = buildUrl(API_PORT, "");
export const BOOKINGS_API_URL = buildUrl(BOOKINGS_PORT, "");