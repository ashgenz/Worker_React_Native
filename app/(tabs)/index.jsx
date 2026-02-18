import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
// 🆕 Import dynamic logic
import { BOOKINGS_PORT, WORKER_API_PATH, buildUrl } from '../../constants/API';
// 🆕 ADD: Import router for navigation
import { router } from "expo-router";

// 🆕 Replace hardcoded URL
const BASE_URL = `https://urbanlite-backends.onrender.com/api/worker/bookings`; // ✅ Correct route

const Home = () => {
  // Removed <Booking[]> type
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          onPress: async () => {
            await AsyncStorage.removeItem("workerToken");
            await AsyncStorage.removeItem("workerId");
            // Redirect to the login screen, replacing the current history stack
            router.replace("/login"); 
          },
          style: "destructive",
        },
      ],
      { cancelable: true }
    );
  };

  const fetchBookings = async () => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      if (!token) {
        Alert.alert("Error", "No token found, please login again.");
        return;
      }
      const res = await axios.get(`${BASE_URL}/open`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching bookings:", err);
      setLoading(false);
    }
  };

  // Removed type annotations for id and action
  const handleAction = async (id, action) => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      if (!token) {
        Alert.alert("Error", "No token found, please login again.");
        return;
      }

      const res = await axios.post(`${BASE_URL}/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Alert.alert("Success", `Booking ${action}ed successfully!`);
      fetchBookings(); // refresh after action
    } catch (err) {
      console.error(`Error on ${action}:`, err);
      Alert.alert("Error", "This booking is no longer available.");
      fetchBookings();
    }
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 5000); // refresh every 5 sec
    return () => clearInterval(interval);
  }, []); // Added missing dependency array to prevent infinite loop

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6c47ff" />
        <Text>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>📋 Open Bookings</Text>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.row}>💰 Price: ₹{(item.EstimatedPrice) * 0.8}</Text>
            
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{item.WorkName}</Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: item.status === "accepted" ? "#4caf50" : "#f44336" },
                ]}
              >
                <Text style={styles.badgeText}>
                  {item.status === "accepted" ? "Accepted" : "Open"}
                </Text>
              </View>
            </View>

            <Text style={styles.row}>📍 {item.address || "No address"}</Text>
            <Text style={styles.row}>
              👤 {item.IdCustomer} | 📞 {item.TempPhoneCustomer}
            </Text>
            <Text style={styles.row}>
              📅 {new Date(item.Date).toLocaleDateString()} | 📝 {item.MonthlyOrOneTime} / {item.WhichPlan}
            </Text>

            {item.services && item.services.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <Text style={styles.sectionHeading}>🛠 Services:</Text>
                {item.services.map((srv) => (
                  <View key={srv._id} style={styles.serviceBox}>
                    <Text style={styles.serviceName}>{srv.WorkName}</Text>

                    {srv.FrequencyPerDay && <Text style={styles.serviceDetail}>• Frequency: {srv.FrequencyPerDay}</Text>}
                    {srv.JhaduFrequency && <Text style={styles.serviceDetail}>• Jhadu Frequency: {srv.JhaduFrequency}</Text>}
                    {(srv.JhaduTimeSlot || srv.TimeSlot1 || srv.TimeSlot2) && (
                      <Text style={styles.serviceDetail}>
                        • Time Slot: {srv.JhaduTimeSlot || srv.TimeSlot1} {srv.TimeSlot2 || ""}
                      </Text>
                    )}
                    {srv.FrequencyPerWeek && <Text style={styles.serviceDetail}>• {srv.FrequencyPerWeek}</Text>}
                    {srv.NoOfRooms !== undefined && <Text style={styles.serviceDetail}>• Rooms: {srv.NoOfRooms}</Text>}
                    {srv.NoOfKitchen !== undefined && <Text style={styles.serviceDetail}>• Kitchens: {srv.NoOfKitchen}</Text>}
                    {srv.NoOfToilets !== undefined && <Text style={styles.serviceDetail}>• Toilets: {srv.NoOfToilets}</Text>}
                    {srv.HallSize !== undefined && <Text style={styles.serviceDetail}>• Hall Size: {srv.HallSize}</Text>}
                    {srv.AmountOfBartan !== undefined && <Text style={styles.serviceDetail}>• Bartan: {srv.AmountOfBartan}</Text>}
                    {srv.NoOfPeople !== undefined && <Text style={styles.serviceDetail}>• People: {srv.NoOfPeople}</Text>}
                    {srv.IncludeNaashta && <Text style={styles.serviceDetail}>• Includes Naashta</Text>}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#4caf50" }]}
                onPress={() => handleAction(item._id, "accept")}
              >
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  logoutButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#e53935",
    borderRadius: 5,
    marginBottom: 10, // Added margin for spacing
  },
  logoutText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  title: { fontSize: 16, fontWeight: "bold", color: "#333" },
  row: { fontSize: 13, color: "#555", marginVertical: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: "#fff", fontWeight: "600", fontSize: 11 },
  sectionHeading: { fontSize: 13, fontWeight: "600", marginTop: 6, marginBottom: 2 },
  serviceBox: {
    backgroundColor: "#f9f9f9",
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#eee",
  },
  serviceName: { fontWeight: "600", fontSize: 13, marginBottom: 2 },
  serviceDetail: { fontSize: 12, color: "#555", marginLeft: 6 },
  actions: { marginTop: 8, flexDirection: "row", justifyContent: "flex-end" },
  btn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  heading: { fontSize: 22, fontWeight: "bold", marginBottom: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});

export default Home;