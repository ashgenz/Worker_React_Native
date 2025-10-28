import React, { useEffect, useState } from "react";
import { View, Text,Button, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Transaction {
  _id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  date: string;
}

interface BalanceResponse {
  workerId: string;
  balance: number;
  currency: string;
  lastUpdated: string;
}




import { API_BASE } from "@/constants/API";

const WorkerWallet = () => {
  const [balanceData, setBalanceData] = useState<BalanceResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const API_BASE1 = `http://${API_BASE}:8000/api/worker`;

  const fetchBalance = async () => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      const res = await axios.get(`${API_BASE1}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalanceData(res.data);
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      const res = await axios.get(`${API_BASE1}/wallet/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions([...res.data].reverse());
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const handleTopUp = async () => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      await axios.post(
        `${API_BASE1}/wallet/topup`,
        { amount: 200, description: "Manual top-up" }, // 👈 dummy top-up
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchBalance();
      await fetchTransactions();
    } catch (err) {
      console.error("Top-up failed:", err);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchBalance();
      await fetchTransactions();
      setLoading(false);
    })();
  },[refresh]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading wallet...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>💰 My Wallet</Text>

      {balanceData && (
        <View style={styles.card}>
          <Text style={styles.balanceText}>
            {balanceData.currency} {balanceData.balance.toFixed(2)}
          </Text>
          <Text style={styles.subText}>
            Last Updated: {new Date(balanceData.lastUpdated).toLocaleString()}
          </Text>
        </View>
      )}

      <Button
  title="🔄 Refresh"
  onPress={() => setRefresh((prev) => !prev)} // toggle state
  color="#007AFF"
/>

      <TouchableOpacity style={styles.topUpBtn} onPress={handleTopUp}>
        <Text style={styles.topUpText}>➕ Add ₹200</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHeading}>📜 Transaction History</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.txnBox}>
            <Text style={styles.txnType}>
              {item.type.toUpperCase()} ₹{item.amount}
            </Text>
            <Text style={styles.txnDesc}>{item.description}</Text>
            <Text style={styles.txnDate}>
              {new Date(item.date).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f5" },
  heading: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  card: { backgroundColor: "#fff", padding: 20, borderRadius: 12, alignItems: "center", marginBottom: 20 },
  balanceText: { fontSize: 28, fontWeight: "bold", color: "#2e7d32" },
  subText: { fontSize: 14, color: "#555", marginTop: 8 },
  topUpBtn: { backgroundColor: "#1976d2", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 20 },
  topUpText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  sectionHeading: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  txnBox: { backgroundColor: "#fff", padding: 10, borderRadius: 8, marginBottom: 8 },
  txnType: { fontSize: 16, fontWeight: "bold" },
  txnDesc: { fontSize: 14, color: "#555" },
  txnDate: { fontSize: 12, color: "#777" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});

export default WorkerWallet;
