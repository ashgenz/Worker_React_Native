import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Dimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { 
  GiftIcon, 
  ClipboardDocumentIcon, 
  ShareIcon, 
  ArrowLeftIcon 
} from "react-native-heroicons/solid";
import * as Clipboard from 'expo-clipboard';
import { router } from "expo-router";

const { width } = Dimensions.get("window");
const vw = (number) => width * (number / 100);

export default function ReferEarnScreen() {
  const insets = useSafeAreaInsets();
  
  // In a real scenario, you would fetch this from AsyncStorage or your User state
  const referralCode = "WORKER100"; 

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Join UrbanLite using my code ${referralCode} and start earning! Get ₹100 bonus after your first 5 bookings. Download now: https://tryurbanlite.in`,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(referralCode);
    Alert.alert("Copied!", "Referral code copied to clipboard.");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeftIcon size={vw(7)} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
      </View>

      <View style={styles.content}>
        {/* Hero Illustration Area */}
        <View style={styles.heroCircle}>
          <GiftIcon size={vw(20)} color="#4338ca" />
        </View>

        {/* Main Text */}
        <Text style={styles.mainTitle}>Invite your friends to UrbanLite!</Text>
        <Text style={styles.description}>
          Know someone who wants to work? Invite them and get 
          <Text style={styles.highlightText}> ₹100 </Text> 
          in your wallet when they complete their 
          <Text style={styles.highlightText}> first 5 bookings</Text>.
        </Text>

        {/* Code Box */}
        <View style={styles.codeBox}>
          <View>
            <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
            <Text style={styles.codeValue}>{referralCode}</Text>
          </View>
          <TouchableOpacity onPress={copyToClipboard} style={styles.copyIcon}>
            <ClipboardDocumentIcon size={28} color="#4338ca" />
          </TouchableOpacity>
        </View>

        {/* Share Button */}
        <TouchableOpacity 
          onPress={shareCode}
          style={styles.shareButton}
        >
          <ShareIcon size={20} color="white" />
          <Text style={styles.shareButtonText}>Share Code</Text>
        </TouchableOpacity>

        {/* T&C Link */}
        <TouchableOpacity style={styles.tcContainer}>
          <Text style={styles.tcText}>Terms & Conditions Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: vw(5),
    paddingVertical: vw(4),
  },
  headerTitle: {
    fontSize: vw(5.5),
    fontWeight: 'bold',
    marginLeft: vw(4),
    color: '#1f2937'
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: vw(8),
    paddingTop: vw(10),
  },
  heroCircle: {
    backgroundColor: '#eef2ff',
    padding: vw(8),
    borderRadius: 100,
    marginBottom: vw(8),
  },
  mainTitle: {
    fontSize: vw(6),
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: vw(3),
  },
  description: {
    fontSize: vw(4),
    textAlign: 'center',
    color: '#6b7280',
    lineHeight: vw(6),
    marginBottom: vw(10),
  },
  highlightText: {
    color: '#4338ca',
    fontWeight: 'bold',
  },
  codeBox: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: vw(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    marginBottom: vw(8),
  },
  codeLabel: {
    fontSize: vw(3),
    color: '#9ca3af',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: vw(6),
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: vw(1),
  },
  copyIcon: {
    marginLeft: 'auto',
  },
  shareButton: {
    width: '100%',
    backgroundColor: '#4338ca',
    paddingVertical: vw(4.5),
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: "#4338ca",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  shareButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: vw(4.5),
  },
  tcContainer: {
    marginTop: vw(6),
  },
  tcText: {
    color: '#4338ca',
    textDecorationLine: 'underline',
    fontSize: vw(3.2),
  },
});