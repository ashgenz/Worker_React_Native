import React, { useEffect, useState } from "react";
import { Tabs, Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View } from "react-native";
import IconSymbol  from '../../components/ui/IconSymbol'

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
  <Tabs.Screen 
    name="index" 
    options={{ 
      title: "Bookings",
      tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
    }} 
  />
  <Tabs.Screen 
    name="explore" 
    options={{ 
      title: "My Bookings",
      tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
    }} 
  />

  {/* --- ADDED BALANCE TAB --- */}
  <Tabs.Screen
    name="Balance"
    options={{
      title: 'Wallet',
      tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
    }}
  />

  <Tabs.Screen
    name="account"
    options={{
      title: 'Account',
      tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
    }}
  />
</Tabs>
      )}
    </>
  );
}
