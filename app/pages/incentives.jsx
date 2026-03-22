import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftIcon, TrophyIcon, StarIcon, HeartIcon } from "react-native-heroicons/solid";
import { router } from "expo-router";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {WORKER_API_URL } from '../../constants/API';
const { width } = Dimensions.get("window");
const vw = (number) => width * (number / 100);

export default function IncentivesScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    backupsAccepted: 0,
    emergencyAccepted: 0,
    retainedCustomer: 0,
    totalEarned: 0 // Added state for total earnings
  });

  const fetchStats = async () => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      const response = await axios.get(`${WORKER_API_URL}/api/worker/incentives/see`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- THE CLAIM FUNCTION ---
  const handleClaim = async (type) => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      const res = await axios.post(`${WORKER_API_URL}/api/worker/claim-incentive`, 
        { incentiveType: type },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.success) {
        Alert.alert("Success!", res.data.message);
        fetchStats(); // Refresh the numbers!
      }
    } catch (error) {
      Alert.alert("Error", error.response?.data?.message || "Failed to claim");
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6c47ff" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeftIcon size={vw(7)} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incentives & Bonuses</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* --- NEW: TOTAL EARNED BADGE --- */}
        <View style={styles.totalEarningsBadge}>
           <Text style={styles.totalLabel}>Total Bonus Earned</Text>
           <Text style={styles.totalAmount}>₹{stats.totalEarned}</Text>
        </View>
        <Text style={styles.intro}>Complete goals to earn extra money in your wallet!</Text>

        {/* 1. Backup Incentive */}
        <IncentiveCard 
          icon={<TrophyIcon size={vw(8)} color="#6c47ff" />}
          title="Backup Master"
          description="Complete 5 backup bookings"
          reward="₹250 Bonus"
          current={stats.backupsAccepted}
          target={5}
          type="backup"
          onClaim={handleClaim} // PASSING THE FUNCTION HERE
        />

        {/* 2. Emergency Incentive */}
        <IncentiveCard 
          icon={<StarIcon size={vw(8)} color="#f59e0b" />}
          title="Emergency Responder"
          description="Complete 3 emergency bookings"
          reward="₹150 Bonus"
          current={stats.emergencyAccepted}
          target={3}
          type="emergency"
          onClaim={handleClaim} // PASSING THE FUNCTION HERE
        />

        {/* 3. Retained Incentive */}
        <IncentiveCard 
          icon={<HeartIcon size={vw(8)} color="#ef4444" />}
          title="Customer Favorite"
          description="Retain 10 customers"
          reward="₹1,000 Bonus"
          current={stats.retainedCustomer}
          target={10}
          type="retained"
          onClaim={handleClaim} // PASSING THE FUNCTION HERE
        />
      </ScrollView>
    </View>
  );
}

// --- CARD COMPONENT ---
const IncentiveCard = ({ icon, title, description, reward, current, target, type, onClaim }) => {
  const progress = Math.min(current / target, 1);
  const isEligible = current >= target;

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.iconBox}>{icon}</View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{description}</Text>
          <Text style={styles.cardReward}>{reward}</Text>
        </View>
        
        {/* CLAIM BUTTON */}
        <TouchableOpacity 
          disabled={!isEligible}
          onPress={() => onClaim(type)}
          style={[styles.claimBtn, !isEligible && styles.disabledBtn]}
        >
          <Text style={[styles.claimBtnText, !isEligible && { color: '#94a3b8' }]}>
            {isEligible ? "Claim" : "Locked"}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* PROGRESS BAR */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{current} / {target} Jobs Done</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: vw(5) },
  headerTitle: { fontSize: vw(5.5), fontWeight: '800', marginLeft: vw(4), color: '#1e293b' },
  scrollContent: { padding: vw(5) },
  intro: { fontSize: vw(4), color: '#64748b', marginBottom: vw(6), fontWeight: '500' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: vw(5), marginBottom: vw(4), elevation: 2 },
  iconBox: { width: vw(15), height: vw(15), borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { marginLeft: vw(5), flex: 1 },
  cardTitle: { fontSize: vw(4.5), fontWeight: '700', color: '#1e293b' },
  cardDesc: { fontSize: vw(3.5), color: '#64748b', marginTop: 2 },
  cardReward: { fontSize: vw(4), fontWeight: '800', color: '#6c47ff', marginTop: 4 },
  
  claimBtn: { backgroundColor: '#6c47ff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, justifyContent: 'center' },
  disabledBtn: { backgroundColor: '#e2e8f0' },
  claimBtnText: { color: '#fff', fontWeight: '800', fontSize: vw(3.5) },
  
  progressContainer: { marginTop: 15 },
  progressBarBg: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#6c47ff' },
  progressText: { fontSize: vw(3), color: '#94a3b8', marginTop: 5, fontWeight: '600', textAlign: 'right' },
  totalEarningsBadge: {
  backgroundColor: '#1e293b', // Dark themed badge
  borderRadius: 20,
  padding: vw(5),
  alignItems: 'center',
  marginBottom: vw(6),
  flexDirection: 'row',
  justifyContent: 'space-between'
},
totalLabel: {
  color: '#94a3b8',
  fontSize: vw(4),
  fontWeight: '600'
},
totalAmount: {
  color: '#ffffff',
  fontSize: vw(6),
  fontWeight: '800'
},
});