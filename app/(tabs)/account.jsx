import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Dimensions, TouchableOpacity, Alert, StyleSheet, Linking, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserCircleIcon, ChevronRightIcon } from "react-native-heroicons/solid";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from "expo-router";
import axios from 'axios';

// This pulls the IP directly from your constants file
import { WORKER_API_URL } from '../../constants/API';


const { width } = Dimensions.get("window");
const vw = (number) => width * (number / 100);

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const [showSkills, setShowSkills] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
const [user, setUser] = useState({ 
    name: "UrbanLite Worker", 
    phone: "Loading...",
    skills: [], // Add skills to state
    scoreValue: 0, // State to hold the final calculated score
    weekOffDay: "",
  });
const calculateTotalScore = (scoreObj) => {
    if (!scoreObj) return 0;

    // A. Quality (Max 400)
    const quality = (scoreObj.qualityOfWork?.rating || 0) * 4;

    // B. On-Time (Max 200)
    const onTimeRate = scoreObj.onTime?.total > 0 ? (scoreObj.onTime.count / scoreObj.onTime.total) : 1;
    const onTime = onTimeRate * 200;

    // C. Behaviour (Max 200)
    const behaviorRate = scoreObj.behaviour?.total > 0 ? (scoreObj.behaviour.good / scoreObj.behaviour.total) : 1;
    const behaviour = behaviorRate * 200;

    // D. Checklist (Max 200)
    const checklistRate = scoreObj.checklistFollow?.total > 0 ? (scoreObj.checklistFollow.followed / scoreObj.checklistFollow.total) : 1;
    const checklist = checklistRate * 200;

    // E. Penalties
    const defaults = (scoreObj.defaultedToWork?.count || 0) * 50;

    const total = Math.max(0, Math.min(1000, quality + onTime + behaviour + checklist - defaults));
    return Math.round(total);
  };
// ... inside AccountScreen component
useEffect(() => {
    const loadUser = async () => {
      try {
        const name = await AsyncStorage.getItem("workerName");
        const phone = await AsyncStorage.getItem("workerPhone");
        const skillsRaw = await AsyncStorage.getItem("workerSkills");
        const token = await AsyncStorage.getItem("workerToken");
        const workerId = await AsyncStorage.getItem("workerId");

        // Fetch fresh score data from your backend
        const res = await axios.get(`${WORKER_API_URL}/workers/${workerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const finalScore = calculateTotalScore(res.data.score);

        setUser({
          name: name || "UrbanLite Worker",
          phone: phone || "No Phone Number",
          skills: skillsRaw ? JSON.parse(skillsRaw) : [],
          scoreValue: finalScore,
          weekOffDay: res.data.weekOffDay, // Fixed the typo here
        });
      } catch (e) {
        console.log("Failed to load profile", e);
      }
    };
    loadUser();
  }, []);

  const handleSupportFeedback = () => {
    setFeedbackMessage('');
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = async () => {
    const msg = feedbackMessage.trim();
    if (!msg) {
      Alert.alert("Error", "Message cannot be empty");
      return;
    }
    setShowFeedbackModal(false);
    await sendFeedbackToDB(msg);
    setFeedbackMessage('');
  };
const sendFeedbackToDB = async (message) => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      // Use the imported constant
      const API_URL = `${WORKER_API_URL}/api/worker/feedback`;

      const response = await axios.post(
        API_URL,
        { 
          message: message,
          name: user.name,
          phone: user.phone 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert("Success", "Your feedback has been submitted. We will get back to you soon!");
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
      Alert.alert("Error", "Failed to submit feedback. Please try again later.");
    }
  };
const handleLogout = async () => {
  // ... inside onPress
  await AsyncStorage.removeItem("workerToken");
  await AsyncStorage.removeItem("workerId");
  
  // ADD THESE TWO LINES:
  await AsyncStorage.removeItem("workerName");
  await AsyncStorage.removeItem("workerPhone");
await AsyncStorage.removeItem("workerSkills"); // Clear skills on logout
  router.replace("/login"); 
};

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Simple Header */}
      {/* <View style={{ paddingTop: insets.top + vw(5), paddingHorizontal: vw(5), paddingBottom: vw(4), backgroundColor: 'white' }}>
          <Text style={{ fontSize: vw(7), fontWeight: 'bold' }}>Account</Text>
      </View> */}

      <ScrollView contentContainerStyle={{ paddingTop: vw(5) }}>
        {/* --- PROFILE HEADER --- */}
        <View style={{ alignItems: 'center', marginBottom: vw(8) }}>
          <View style={styles.avatarContainer}>
             <UserCircleIcon size={vw(22)} color="#9ca3af" />
          </View>
          
          <Text style={{ fontSize: vw(6), fontWeight: 'bold', color: '#1f2937' }}>
            {user.name}
          </Text>
          <Text style={{ fontSize: vw(4), color: '#6b7280', marginTop: 2 }}>
            {user.phone}
          </Text>
          {/* --- NEW: SCORE DISPLAY --- */}
          {/* --- SCORE & WEEK OFF BADGES --- */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(3), marginTop: vw(4) }}>
            {/* Trust Score Badge */}
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreLabel}>TRUST SCORE</Text>
              <Text style={styles.scoreNumber}>
                 {user.scoreValue}<Text style={{ fontSize: vw(3), color: '#94a3b8' }}> / 1000</Text>
              </Text>
            </View>

            {/* Weekly Off Badge - Now Always Visible */}
            <View style={[styles.scoreBadge, { borderColor: user.weekOffDay === "notselectedyet" ? '#e5e7eb' : '#10b981' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: vw(2) }}>
                <View>
                  <Text style={[styles.scoreLabel, { color: user.weekOffDay === "notselectedyet" ? '#9ca3af' : '#059669' }]}>
                    WEEKLY OFF
                  </Text>
                  <Text style={[styles.scoreNumber, { 
                    textTransform: 'capitalize', 
                    fontSize: user.weekOffDay === "notselectedyet" ? vw(3.5) : vw(4.5),
                    color: user.weekOffDay === "notselectedyet" ? '#9ca3af' : '#1f2937'
                  }]}>
                    {user.weekOffDay === "notselectedyet" ? "Not Set" : user.weekOffDay}
                  </Text>
                </View>
                
                {/* Change / Set Button */}
                <TouchableOpacity 
                  onPress={() => Alert.alert("Week-Off Request", "Your week-off is automatically optimized for your area. Please contact support to manually update your preference.")}
                  style={{ 
                    backgroundColor: user.weekOffDay === "notselectedyet" ? '#6b7280' : '#10b981', 
                    paddingVertical: 4, 
                    paddingHorizontal: 8, 
                    borderRadius: 6 
                  }}
                >
                  <Text style={{ color: 'white', fontSize: vw(2.5), fontWeight: '900' }}>
                    {user.weekOffDay === "notselectedyet" ? "SET" : "CHANGE"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
        </View>

        {/* --- MENU OPTIONS --- */}
        <View style={{ paddingHorizontal: vw(5) }}>
          <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: vw(2) }} />

<MenuOption 
  icon="🎁" 
  title="Refer & Earn" 
  subtitle="Invite friends and earn rewards"
  onPress={() => router.push("/pages/refer")} // This points to app/pages/refer.jsx
/>
<MenuOption 
  icon="🛠" 
  title="My Services" 
  subtitle={showSkills ? "Hide your work categories" : "View your active work categories"}
  onPress={() => setShowSkills(!showSkills)} // Toggle the list
/>
{/* --- Insert this below the "My Services" block --- */}
{/* <MenuOption 
  icon="📅" 
  title="Weekly Off" 
  subtitle={
    !user.weekOffDay || user.weekOffDay === "notselectedyet" 
    ? "No off-day assigned" 
    : `Your assigned off-day is ${user.weekOffDay.charAt(0).toUpperCase() + user.weekOffDay.slice(1)}`
  }
  onPress={() => {
    if(!user.weekOffDay || user.weekOffDay === "notselectedyet") {
        Alert.alert("Weekly Off", "System will automatically assign an off-day based on area demand.");
    }
  }} 
/> */}
{showSkills && (
  <View style={styles.expandedSkillsBox}>
    {user.skills.length > 0 ? (
      user.skills.map((skill, index) => (
        <View key={index} style={styles.skillItem}>
          <Text style={styles.skillDot}>•</Text>
          <Text style={styles.skillListText}>{skill}</Text>
        </View>
      ))
    ) : (
      <Text style={styles.noSkillsText}>No services assigned yet.</Text>
    )}
  </View>
)}
          <MenuOption 
  icon="📞" 
  title="Support / Help Center" 
  subtitle="Send us a message directly"
  onPress={handleSupportFeedback} 
/>
          {/* Logout Button */}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={{ fontSize: vw(5) }}>🚪</Text>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Support / Contact Modal - works on both iOS and Android */}
      <Modal visible={showFeedbackModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Support & Feedback</Text>
            <Text style={styles.modalSubtitle}>How can we help you? Enter your message below.</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Type your message..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              value={feedbackMessage}
              onChangeText={setFeedbackMessage}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowFeedbackModal(false); setFeedbackMessage(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSubmitFeedback}>
                <Text style={styles.modalSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const MenuOption = ({ icon, title, subtitle, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.menuItem}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ fontSize: vw(6) }}>{icon}</Text>
      <View style={{ marginLeft: vw(4) }}>
        <Text style={{ fontSize: vw(4.5), fontWeight: '500', color: '#1f2937' }}>{title}</Text>
        {subtitle && <Text style={{ fontSize: vw(3.2), color: '#9ca3af' }}>{subtitle}</Text>}
      </View>
    </View>
    <ChevronRightIcon size={vw(5)} color="#d1d5db" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  avatarContainer: {
    width: vw(28),
    height: vw(28),
    borderRadius: vw(14),
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vw(3),
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vw(5),
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb'
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vw(4),
    marginTop: vw(6),
    backgroundColor: '#fef2f2',
    paddingHorizontal: vw(4),
    borderRadius: 12
  },
  logoutText: {
    fontSize: vw(4.5),
    fontWeight: '700',
    color: '#dc2626',
    marginLeft: vw(4)
  },
  expandedSkillsBox: {
    backgroundColor: '#f8faff',
    paddingHorizontal: vw(10), // Indent the list
    paddingVertical: vw(2),
    borderLeftWidth: 3,
    borderLeftColor: '#4338ca', // Indigo accent line
    marginBottom: vw(2),
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vw(2),
  },
  skillDot: {
    fontSize: vw(5),
    color: '#4338ca',
    marginRight: vw(3),
  },
  skillListText: {
    fontSize: vw(4),
    color: '#374151',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  noSkillsText: {
    fontSize: vw(3.5),
    color: '#9ca3af',
    fontStyle: 'italic',
    paddingVertical: vw(2),
  },
  scoreBadge: {
    backgroundColor: '#f8faff',
    paddingHorizontal: vw(6),
    paddingVertical: vw(2),
    borderRadius: 20,
    marginTop: vw(4),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  scoreLabel: {
    fontSize: vw(2.5),
    fontWeight: '800',
    color: '#4338ca', // Indigo color
    letterSpacing: 1,
  },
  scoreNumber: {
    fontSize: vw(5.5),
    fontWeight: '900',
    color: '#1f2937',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: vw(5),
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: vw(6),
  },
  modalTitle: {
    fontSize: vw(5.5),
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: vw(3.5),
    color: '#6b7280',
    marginBottom: vw(4),
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: vw(4),
    fontSize: vw(4),
    color: '#1f2937',
    minHeight: 100,
    marginBottom: vw(4),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalCancelText: {
    fontSize: vw(4),
    color: '#6b7280',
    fontWeight: '500',
  },
  modalSubmitBtn: {
    backgroundColor: '#4338ca',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginLeft: 12,
  },
  modalSubmitText: {
    fontSize: vw(4),
    color: 'white',
    fontWeight: '600',
  },
});