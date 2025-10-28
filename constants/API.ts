import Constants from 'expo-constants';
import { Platform } from 'react-native';

// --- CONFIGURATION: Centralize Ports and Paths ---
export const API_PORT = 8000;         // Used for Login and Balance
export const BOOKINGS_PORT = 5000;    // Used for Open/Accepted Bookings
export const WORKER_API_PATH = "/api/worker";
export const LOGIN_API_PATH = "/workers/login";
// ---------------------

const getApiHost = (): string => {
  if (__DEV__) {
    const manifest = Constants.manifest;
    
    // 1. Get IP from Expo Manifest (LAN/Physical Devices)
    if (manifest?.debuggerHost) {
      const ipAddress = manifest.debuggerHost.split(':')[0];
      return ipAddress; 
    } 
    
    // 2. Emulator/Simulator Specific IPs (Fallback)
    if (Platform.OS === 'android') {
      return '10.0.2.2'; // Android Emulator
    } else if (Platform.OS === 'ios') {
      return 'localhost'; // iOS Simulator
    }
    
    // Fallback IP
    return '127.0.0.1';
  } 
  
  // 3. Production/Standalone Build Host (MUST be your public domain)
  return 'api.yourproductiondomain.com'; 
};

export const API_HOST = getApiHost(); 

// --- Convenience function to build URLs ---
export const buildUrl = (port: number, path: string) => {
    // Determine protocol (use http for local dev, or https for public production domain)
    const protocol = API_HOST.includes('.') && API_HOST !== '10.0.2.2' ? 'http' : 'http';
    return `${protocol}://${API_HOST}:${port}${path}`;
}