import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";  // 👈 import hook

import Constants from "expo-constants";
const { BASE_URL, ROUTERIPALLBACKEND, PORTBOOKINGS } = Constants.expoConfig?.extra || {};

// use BASE_URL for axios calls

import { BOOKINGS_PORT, WORKER_API_PATH, buildUrl } from '../../constants/API'; 

// NOTE: You were attempting to use Constants.expoConfig?.extra, but this is less reliable 
// for local development than the debuggerHost approach, so we will remove those lines.

// 🆕 Construct the base URL for booking operations
// const COMMISSION_PAYMENT_BASE = buildUrl(BOOKINGS_PORT, `${WORKER_API_PATH}/bookings`);
// const API_URL = `${COMMISSION_PAYMENT_BASE}/accepted`; // Used inside fetchBookings
const WorkerAcceptedBookings = () => {
  // Removed <Booking[]> type
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();
  
  // Replace with your backend API URL
  const API_URL = `https://urbanlite-backends.onrender.com/api/worker/bookings/all`;

  // Removed : string type from parameter
  const payCommission = async (bookingId) => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      await axios.post(
        `https://urbanlite-backends.onrender.com/api/worker/bookings/${bookingId}/pay-commission`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("✅ Commission paid successfully");
      fetchBookings(); // refresh bookings after payment
    } catch (err) {
      alert("❌ Failed to pay commission");
      console.error(err);
    }
  };

  const fetchBookings = async () => {
    try {
      const token = await AsyncStorage.getItem("workerToken"); // get this from async storage / context
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(res.data);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 5000);
    return () => clearInterval(interval);
  }, []); // run once

  if (loading) {
    return <ActivityIndicator size="large" style={{ flex: 1, justifyContent: "center" }} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Accepted Bookings</Text>
      {bookings.length === 0 ? (
        <Text>No accepted bookings yet.</Text>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                item.status === "cancelled" && { backgroundColor: "#ffeaea", borderColor: "#ff7777" },
              ]}
            >
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.title}>{item.WorkName}</Text>

                {/* Status Badge */}
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        item.status === "cancelled"
                          ? "#e53935"
                          : item.status === "accepted"
                          ? "#4caf50"
                          : "#ff9800",
                    },
                  ]}
                >
                  <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
                </View>
              </View>

              {/* Booking Details */}
              <Text>📍 Address: {item.address}</Text>
              <Text>📅 {new Date(item.Date).toLocaleDateString()}</Text>
              <Text>👤 Customer ID: {item.IdCustomer}</Text>
              <Text>📞 Customer Phone: {item.TempPhoneCustomer}</Text>
              <Text>📝 Plan: {item.MonthlyOrOneTime} | {item.WhichPlan}</Text>
              <Text>💰 Price: ₹{item.EstimatedPrice}</Text>
              <Text>💰 Your-cut: ₹{item.EstimatedPrice * 0.8}</Text>
              <Text>💳 Payment: {item.payment?.status || "pending"} ({item.payment?.method})</Text>
              <Text>⚖️ Commission: ₹{item.payment?.commission?.amount || 0}</Text>

              {/* Commission Action */}
              {item.status === "accepted" && !item.payment?.commission?.isSettled ? (
                <TouchableOpacity style={styles.payBtn} onPress={() => payCommission(item._id)}>
                  <Text style={styles.payBtnText}>Pay Commission</Text>
                </TouchableOpacity>
              ) : item.payment?.commission?.isSettled ? (
                <Text style={{ color: "green" }}>✅ Commission Settled</Text>
              ) : null}

              {/* Cancelled Message */}
              {item.status === "cancelled" && (
                <Text style={{ color: "#d32f2f", marginTop: 4 }}>❌ Cancelled by Customer</Text>
              )}

              {/* Services Section */}
              {item.services && item.services.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.sectionHeading}>🛠 Services:</Text>
                  {item.services.map((srv) => (
                    <View key={srv._id} style={styles.serviceBox}>
                      <Text style={styles.serviceTitle}>{srv.WorkName}</Text>
                      {srv.FrequencyPerDay && <Text style={styles.serviceDetail}>• {srv.FrequencyPerDay} / day</Text>}
                      {srv.TimeSlot1 && <Text style={styles.serviceDetail}>• Slot1: {srv.TimeSlot1}</Text>}
                      {srv.TimeSlot2 && <Text style={styles.serviceDetail}>• Slot2: {srv.TimeSlot2}</Text>}
                      {srv.NoOfPeople && <Text style={styles.serviceDetail}>• People: {srv.NoOfPeople}</Text>}
                      {srv.IncludeNaashta && <Text style={styles.serviceDetail}>• Includes Naashta</Text>}
                      {srv.NoOfRooms !== undefined && <Text style={styles.serviceDetail}>• Rooms: {srv.NoOfRooms}</Text>}
                      {srv.NoOfKitchen !== undefined && <Text style={styles.serviceDetail}>• Kitchens: {srv.NoOfKitchen}</Text>}
                      {srv.NoOfToilets !== undefined && <Text style={styles.serviceDetail}>• Toilets: {srv.NoOfToilets}</Text>}
                      {srv.HallSize !== undefined && <Text style={styles.serviceDetail}>• Hall Size: {srv.HallSize}</Text>}
                      {srv.FrequencyPerWeek && <Text style={styles.serviceDetail}>• {srv.FrequencyPerWeek}</Text>}
                      {srv.AmountOfBartan !== undefined && <Text style={styles.serviceDetail}>• Utensils: {srv.AmountOfBartan}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  sectionHeading: { fontSize: 15, fontWeight: "600", marginTop: 6, marginBottom: 4 },
  serviceBox: {
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  serviceTitle: { fontWeight: "600", fontSize: 14, marginBottom: 2 },
  serviceDetail: { fontSize: 13, color: "#555", marginLeft: 4 },
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  heading: { fontSize: 20, fontWeight: "bold", marginBottom: 12 },
  card: { padding: 12, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "bold" },
  payBtn: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#e53935",
    borderRadius: 8,
    alignItems: "center",
  },
  payBtnText: { color: "#fff", fontWeight: "bold" },
});

export default WorkerAcceptedBookings;