// constants/API.ts

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiHost = (): string => {
  // Check if we are in development mode
  if (__DEV__) {
    
    // --- 1. Expo Manifest (Best for LAN/Physical Devices) ---
    const manifest = Constants.manifest;
    if (manifest?.debuggerHost) {
      // debuggerHost is in the format '192.168.1.79:8081'. We extract ONLY the IP.
      const ipAddress = manifest.debuggerHost.split(':')[0];
      console.log(`Using Expo Manifest IP: ${ipAddress}`);
      return ipAddress; // Return only the IP address
    } 
    
    // --- 2. Emulator/Simulator Specific IPs (Fallback/Alternative) ---
    if (Platform.OS === 'android') {
      // Android Emulator IP (always points to your host machine)
      console.log("Using Android Emulator IP: 10.0.2.2");
      return '10.0.2.2';
    } else if (Platform.OS === 'ios') {
      // iOS Simulator IP (always points to your host machine)
      console.log("Using iOS Simulator IP: localhost");
      return 'localhost';
    }
    
    // Fallback if the above checks fail in development
    console.warn("Could not determine API host. Falling back to localhost.");
    return 'localhost';
  } 
  
  // --- 3. Production Hostname ---
  // This MUST be your live server's public domain or static IP (no 'http://' or route here).
  return 'api.yourproductiondomain.com';
};

/**
 * The base hostname (IP address or domain) for API calls.
 * Other files must append the protocol, port, and route (e.g., `http://${API_HOST}:8000/api/worker`).
 */
export const API_BASE = getApiHost(); 

// Export the port/route info separately so it can be used with API_HOST
export const BACKEND_PORT = 8000;
export const API_ROUTE_PATH = "/api/worker";