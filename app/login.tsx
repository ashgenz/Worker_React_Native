import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { API_PORT, LOGIN_API_PATH, buildUrl } from '../constants/API'; 
// Use the new buildUrl function
const API_URL = buildUrl(API_PORT, LOGIN_API_PATH);


// const API_URL = `http://${API_BASE}:8000/workers/login`;

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert("Error", "Please enter both phone number and password");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(API_URL, { phone, password });

      if (response.data.success) {
        await AsyncStorage.setItem("workerToken", response.data.token);
        await AsyncStorage.setItem("workerId", response.data.worker.id);
        router.replace("/(tabs)");
      } else {
        Alert.alert("Error", "Invalid credentials");
      }
    } catch (error: any) {
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
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#ccc",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 16 },
});
