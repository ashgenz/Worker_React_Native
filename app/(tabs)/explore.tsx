import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";  // 👈 import hook

// import dotenv from "dotenv";

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
  WorkName: string;
  address: string;
  Date: string;
  status: string;
  IdCustomer: string;
  TempPhoneCustomer: string;
  TempPhoneWorker: string;
  WhichPlan: string;
  MonthlyOrOneTime: string;
  services?: Service[];
  EstimatedPrice: number;

  // 🔹 Add this
  payment?: {
    method: "to_app" | "to_worker";
    status: "pending" | "completed";
    commission: {
      amount: number;
      isSettled: boolean;
      settledAt?: string;
    };
  };
}

// const ROUTERIPALLBACKEND = process.env.ROUTERIPALLBACKEND || "192.168.0.169" ;
// const PORTBOOKINGS = process.env.PORTBOOKINGS || 5000 ;
// const ROUTERIPALLBACKEND ="192.168.0.169" ;
// const PORTBOOKINGS =5000 ;


import Constants from "expo-constants";
const { BASE_URL, ROUTERIPALLBACKEND, PORTBOOKINGS } = Constants.expoConfig?.extra || {};

// use BASE_URL for axios calls

const WorkerAcceptedBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();
  // Replace with your backend API URL
  const API_URL = `http://192.168.1.15:5000/api/worker/bookings/accepted`; 

  const payCommission = async (bookingId: string) => {
  try {
    const token = await AsyncStorage.getItem("workerToken");
    await axios.post(
      `http://192.168.1.15:5000/api/worker/bookings/${bookingId}/pay-commission`,
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
        const token =await AsyncStorage.getItem("workerToken"); // get this from async storage / context
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
// const fetchBookings = async () => {
//   try {
//     const token = await AsyncStorage.getItem("workerToken");
//     console.log("workerToken:", token);
//     if (!token) {
//       // alert("Error", "No token found, please login again.");
//       setLoading(false);
//       return;
//     }
//     const res = await axios.get(`http://192.168.1.15:5000/api/worker/bookings/open`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });
//     setBookings(res.data);
//     setLoading(false);
//   } catch (err: any) {
//     console.error("Error fetching bookings:", err?.response?.status, err?.response?.data || err.message);
//     setLoading(false);
//   }
// };
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
  <View style={styles.card}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={styles.title}>{item.WorkName}</Text>
    </View>

    <Text>📍 Address: {item.address}</Text>
    <Text>📅 {new Date(item.Date).toLocaleDateString()}</Text>
    <Text>👤 Customer ID: {item.IdCustomer}</Text>
    <Text>📞 Customer Phone: {item.TempPhoneCustomer}</Text>
    <Text>📝 Plan: {item.MonthlyOrOneTime} | {item.WhichPlan}</Text>
    <Text>💰 Price: ₹{item.EstimatedPrice}</Text>
<Text>💳 Payment: {item.payment?.status || "pending"} ({item.payment?.method})</Text>
<Text>⚖️ Commission: ₹{item.payment?.commission?.amount || 0}</Text>

{item.payment?.commission?.isSettled ? (
  <Text style={{ color: "green" }}>✅ Commission Settled</Text>
) : (
  <TouchableOpacity
    style={styles.payBtn}
    onPress={() => payCommission(item._id)}
  >
    <Text style={styles.payBtnText}>Pay Commission</Text>
  </TouchableOpacity>
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
            {srv.AmountOfBartan !== undefined && (
  <Text style={styles.serviceDetail}>• Utensils: {srv.AmountOfBartan}</Text>
)}

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

const styles = StyleSheet.create({badge: {
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
