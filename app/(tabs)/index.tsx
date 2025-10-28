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

// 🆕 Replace hardcoded URL
const BASE_URL = buildUrl(BOOKINGS_PORT, `${WORKER_API_PATH}/bookings`);

// const BASE_URL = `http://${API_BASE}:5000/api/worker/bookings`; // ✅ Correct route

interface Service {
  _id: string;
  WorkName: string;
  FrequencyPerDay?: string;
  TimeSlot1?: string;
  TimeSlot2?: string;
  NoOfPeople?: number;
  IncludeNaashta?: boolean;
  IsEnabled?: boolean;
  BartanMode?: string;
  AmountOfBartan?: number;
  NoOfRooms?: number;
  NoOfKitchen?: number;
  HallSize?: number;
  JhaduFrequency?: string;
  JhaduTimeSlot?: string;
  NoOfToilets?: number;
  FrequencyPerWeek?: string;
}

interface Booking {
  _id: string;
  bookingId: string;
  IdCustomer: string;
  IdWorker: string;
  TempPhoneCustomer: string;
  TempPhoneWorker: string;
  WorkName: string;
  MonthlyOrOneTime: string;
  WhichPlan: string;
  Date: string;
  address: string;
  status?: string;
  acceptedBy?: string;
  rejectedBy?: string[];
  services?: Service[];
  EstimatedPrice: number;

}


const Home: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

const fetchBookings = async () => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      if (!token) {
        Alert.alert("Error", "No token found, please login again.");
        return;
      }
      // console.log("Token:", token);
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

  const handleAction = async (id: string, action: "accept" | "reject") => {
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
  });

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
      <FlatList
        data={bookings}
        keyExtractor={(item) => item._id}
renderItem={({ item }) => (
  
  <View style={styles.card}>
     <Text style={styles.row}>💰 Price: ₹{item.EstimatedPrice}</Text>
    {/* Header with status badge */}
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

    {/* Quick Info Row */}
    <Text style={styles.row}>📍 {item.address || "No address"}</Text>
    <Text style={styles.row}>
      👤 {item.IdCustomer} | 📞 {item.TempPhoneCustomer}
    </Text>
    <Text style={styles.row}>
      📅 {new Date(item.Date).toLocaleDateString()} | 📝 {item.MonthlyOrOneTime} / {item.WhichPlan}
    </Text>

    {/* Services Section */}
    {item.services && item.services.length > 0 && (
      <View style={{ marginTop: 6 }}>
        <Text style={styles.sectionHeading}>🛠 Services:</Text>
        {item.services.map((srv) => (
          <View key={srv._id} style={styles.serviceBox}>
            <Text style={styles.serviceName}>{srv.WorkName}</Text>

            {/* Show only fields that exist */}
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

    {/* Actions */}
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

serviceRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 2 },
serviceMeta: { fontSize: 12, color: "#777" },
moreText: { fontSize: 12, color: "#888", fontStyle: "italic" },

info: { fontSize: 14, marginTop: 2, color: "#444" },


serviceTitle: { fontWeight: "600", fontSize: 14, marginBottom: 2 },

  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  heading: { fontSize: 22, fontWeight: "bold", marginBottom: 12 },

  meta: { marginTop: 6, color: "#555", fontSize: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

});

export default Home;
