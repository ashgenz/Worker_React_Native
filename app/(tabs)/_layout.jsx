import React, { useEffect, useState } from "react";
import { Tabs, Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View } from "react-native";
export default function TabLayout() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      const token = await AsyncStorage.getItem("workerToken");
      setIsLoggedIn(!!token);
      setLoading(false);
    };
    checkLogin();
  }, []);

  return (
    <>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#6c47ff" />
        </View>
      ) : !isLoggedIn ? (
        <Redirect href="/login" />
      ) : (
        <Tabs>
          <Tabs.Screen name="index" options={{ title: "Home" }} />
          <Tabs.Screen name="explore" options={{ title: "My Bookings" }} />
          {/* <Tabs.Screen name="Balance" options={{ title: "Account" }} /> */}
        </Tabs>
      )}
    </>
  );
}
