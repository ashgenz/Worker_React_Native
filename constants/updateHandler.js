import { Alert, Linking } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

// Fetches version from app.json
const CURRENT_VERSION = Constants.expoConfig?.version; 

export const checkForWorkerUpdates = async () => {
  try {
    // 1. Use the Raw GitHub URL for your worker config
    const GITHUB_RAW_URL = "https://raw.githubusercontent.com/ashgenz/updateJson-CustomerAPP-for-Updates/refs/heads/master/workerApp/update-config.json";

    // 2. Add a unique timestamp to bypass GitHub's cache
    const response = await axios.get(`${GITHUB_RAW_URL}?t=${new Date().getTime()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

    const { latestVersion, downloadUrl, forceUpdate } = response.data;

    // 3. Comparison logic
    if (latestVersion !== CURRENT_VERSION) {
      Alert.alert(
        "Worker App Update",
        `A new version (${latestVersion}) is available. Current version: ${CURRENT_VERSION}.`,
        [
          { 
            text: "Update Now", 
            onPress: () => Linking.openURL(downloadUrl) 
          },
          !forceUpdate && { 
            text: "Later", 
            style: "cancel" 
          },
        ].filter(Boolean),
        { cancelable: !forceUpdate }
      );
    }
  } catch (error) {
    console.log("Worker update check skipped:", error.message);
  }
};