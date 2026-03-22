import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet,KeyboardAvoidingView, // 1. Add this
  Platform,             // 1. Add this
  TouchableWithoutFeedback, // 1. Add this
  Keyboard } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { API_PORT, LOGIN_API_PATH, buildUrl } from '../constants/API'; 
import { WORKER_API_URL } from '../constants/API';
import { useRef } from "react";
// URL for the worker login endpoint
// const API_URL = `https://urbanlite-backends-pd2g.onrender.com/workers/login`;
// const API_URL = `http://192.168.0.197:8000/workers/login`;
const API_URL = `${WORKER_API_URL}/workers/login`;

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
const [displayPassword, setDisplayPassword] = useState("");
  const timerRef = useRef(null);

const handlePasswordChange = (text) => {
  if (timerRef.current) clearTimeout(timerRef.current);

  // 1. Handle Deletion
  if (text.length < displayPassword.length) {
    // Calculate how many characters were removed
    const diff = displayPassword.length - text.length;
    const newRealPass = password.slice(0, -diff);
    setPassword(newRealPass);
    setDisplayPassword("•".repeat(newRealPass.length));
    return;
  }

  // 2. Handle Addition (Typing or Pasting)
  // Identify what was actually added to the input
  const addedChars = text.slice(displayPassword.length);
  const newRealPass = password + addedChars;
  
  setPassword(newRealPass);

  // Show dots for existing chars + the raw newly added string (paste support)
  const maskedPart = "•".repeat(password.length);
  setDisplayPassword(maskedPart + addedChars);

  // 3. Set timer to mask everything
  timerRef.current = setTimeout(() => {
    setDisplayPassword("•".repeat(newRealPass.length));
  }, 800);
};


  const handleLogin = async () => {
    console.log(API_URL);
    if (!phone || !password) {
      Alert.alert("Error", "Please enter both phone number and password");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(API_URL, { phone, password });

      if (response.data.success) {
  const { token, worker } = response.data;

  // Save everything to AsyncStorage
  await AsyncStorage.setItem("workerToken", token);
  await AsyncStorage.setItem("workerId", worker.id);
  
  // ADD THESE TWO LINES:
  await AsyncStorage.setItem("workerName", worker.name);
  await AsyncStorage.setItem("workerPhone", worker.phone);

  await AsyncStorage.setItem("workerSkills", JSON.stringify(worker.skills || []));
  
  router.replace("/(tabs)");
} else {
        Alert.alert("Error", "Invalid credentials");
      }
    } catch (error) {
      console.error(error);
      if (error.response) {
        Alert.alert("Login Failed", error.response.data.error || "Invalid credentials");
      } else {
        Alert.alert("Error", "Could not connect to server");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      {/* 3. Dismiss keyboard on tap outside */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Text style={styles.title}>Worker Login</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          
<TextInput
            style={[styles.input, styles.passwordInput]} 
            placeholder="Password"
            // 🟢 WE TURN OFF secureTextEntry because we are masking manually
            secureTextEntry={false} 
            autoCorrect={false}
            autoCapitalize="none"
            value={displayPassword}
            onChangeText={handlePasswordChange}
          />
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin} 
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Logging in..." : "Login"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 20, 
    backgroundColor: "#fff" 
  },
  title: { 
    fontSize: 28, 
    fontWeight: "bold", 
    marginBottom: 20 
  },
input: {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#ccc",
    // 🟢 Essential: Monospace ensures '•' and 'A' are the same width
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  passwordInput: {
    letterSpacing: 0, // Consistent padding between dots
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  buttonText: { 
    color: "white", 
    fontWeight: "bold", 
    fontSize: 16 
  },
});