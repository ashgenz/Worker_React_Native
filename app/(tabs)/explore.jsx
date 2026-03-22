import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
  Linking,
  ScrollView, Alert,
  Modal,
  Dimensions,
  PanResponder,
  Animated,
} from "react-native";
import axios from "axios";
import {Stack, router } from "expo-router";
import { GiftIcon } from "react-native-heroicons/solid";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import SwipeButton from "../../components/swipeRight.jsx";
import { BOOKINGS_API_URL, WORKER_API_URL } from '../../constants/API';
const { width } = Dimensions.get('window');
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const JOB_COLORS = [
  "#6c47ff", "#f59e0b", "#10b981", "#ef4444", "#ec4899", 
  "#06b6d4", "#8b5cf6", "#f43f5e", "#14b8a6", "#f97316",
  "#3b82f6", "#84cc16", "#0ea5e9", "#d946ef", "#6366f1"
];
const WorkerAcceptedBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null); // New: For Day-level selection
  const [activeTab, setActiveTab] = useState("bookings"); // New: "bookings" or "calendar"
  const [selectedJob, setSelectedJob] = useState(null); // New: For calendar job selection
  const [arrivedJobs, setArrivedJobs] = useState([]); // Track which jobs you've arrived at
  const [completedJobs, setCompletedJobs] = useState([]);
  const isFocused = useIsFocused();
 const [leaveModalVisible, setLeaveModalVisible] = useState(false);
const [selectedBookingForLeave, setSelectedBookingForLeave] = useState(null);
const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]); // Array of strings
const [manualOrder, setManualOrder] = useState({}); // { "2026-03-19": [key1, key2, key3] }
const [draggingJobKey, setDraggingJobKey] = useState(null);
const [dragTargetIndex, setDragTargetIndex] = useState(null);
  // 1. Add state for worker profile to get weekOffDay
const [workerProfile, setWorkerProfile] = useState(null);
// 1. Add this state to track the focus date for the Daily View
const [focusDate, setFocusDate] = useState(new Date());
  const currentMonthName = MONTH_NAMES[new Date().getMonth()];
const [routeModalVisible, setRouteModalVisible] = useState(false);
const [draggingJob, setDraggingJob] = useState(null);
const [safeZones, setSafeZones] = useState([]);
const [hoverIdx, setHoverIdx] = useState(null);
const [fullDayLeaveModalVisible, setFullDayLeaveModalVisible] = useState(false);
const [selectedFullDayLeaves, setSelectedFullDayLeaves] = useState([]);
const [dbLeaves, setDbLeaves] = useState([]); // Leaves already in Database

const isDateSelectable = (dateStr, bookingOrBookings) => {
  const now = new Date();
  const targetDate = new Date(dateStr);
  
  // Rule: Only apply time-locking for TODAY. Future dates are always selectable.
  if (targetDate.toDateString() !== now.toDateString()) return true;

  const targetBookings = Array.isArray(bookingOrBookings) 
    ? bookingOrBookings 
    : [bookingOrBookings];

  const nowMins = now.getHours() * 60 + now.getMinutes();
  let isLocked = false;

  targetBookings.forEach(b => {
    // Only check if the booking is active on the target date
    const bStart = new Date(b.Date);
    const months = b.Months || 1;
    const bEnd = new Date(bStart);
    bEnd.setMonth(bStart.getMonth() + months);

    if (targetDate >= bStart && targetDate <= bEnd) {
      b.services.forEach(srv => {
        // Collect all potential start times for this booking (Morning & Evening)
        const times = [];
        if (srv.TimeSlot1 || srv.JhaduTimeSlot) times.push(srv.TimeSlot1 || srv.JhaduTimeSlot);
        if (srv.TimeSlot2) times.push(srv.TimeSlot2);

        times.forEach(tStr => {
          const startMins = parseTimeToMinutes(tStr.split('-')[0].trim());
          
          // LOCK CONDITION:
          // 1. Work has already started/passed (startMins <= nowMins)
          // 2. Work starts in less than 120 minutes (2 hours)
          if (startMins - nowMins < 120) {
            isLocked = true;
          }
        });
      });
    }
  });

  return !isLocked;
};


const fetchHolidays = async () => {
  try {
    const workerId = await AsyncStorage.getItem("workerId");
    // Ensure the URL matches your backend structure (add /api if needed)
    const res = await axios.get(`${WORKER_API_URL}/workers/${workerId}/leaves`);
    setDbLeaves(res.data || []);
  } catch (err) {
    console.error("Error fetching holidays:", err);
  }
};

// Call this when the modal opens
useEffect(() => {
  if (fullDayLeaveModalVisible) {
    fetchHolidays();
  }
}, [fullDayLeaveModalVisible]);

const maxBookingDate = useMemo(() => {
  if (bookings.length === 0) return 28; // Default to 28 days if no bookings
  
  let furthest = new Date();
  bookings.forEach(b => {
    const start = new Date(b.Date);
    const end = new Date(start);
    end.setMonth(start.getMonth() + (b.Months || 1));
    if (end > furthest) furthest = end;
  });

  // Calculate difference in days from today
  const diffTime = Math.abs(furthest - new Date());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 90 ? 90 : diffDays; // Cap at 90 days to avoid performance lag
}, [bookings]);

// 3. Logic to toggle selection (Max 2)
// Calculate total leaves taken this month to enforce limits
const leavesThisMonthCount = useMemo(() => {
  const now = new Date();
  const currentMonth = now.getMonth();
  // Combine DB leaves and newly selected leaves for the count
  return dbLeaves.filter(date => new Date(date).getMonth() === currentMonth).length;
}, [dbLeaves]);

const isLimitReached = (leavesThisMonthCount + selectedFullDayLeaves.length) >= 2;

// Calculate how many leaves are in each month based on DB data
const getLeavesCountForMonth = (dateString) => {
  const targetDate = new Date(dateString);
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();

  return dbLeaves.filter(leaveDate => {
    const d = new Date(leaveDate);
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  }).length;
};

const toggleFullDaySelection = (dateStr) => {
  // 1. If already selected, allow unselecting
  if (selectedFullDayLeaves.includes(dateStr)) {
    setSelectedFullDayLeaves(prev => prev.filter(d => d !== dateStr));
    return;
  }

  // 2. Check how many are already in the DB for THIS specific date's month
  const alreadyInDB = getLeavesCountForMonth(dateStr);
  
  // 3. Check how many the user has selected in the UI for THIS specific date's month
  const currentlySelectedInUI = selectedFullDayLeaves.filter(d => {
    const selDate = new Date(d);
    const targetDate = new Date(dateStr);
    return selDate.getMonth() === targetDate.getMonth() && selDate.getFullYear() === targetDate.getFullYear();
  }).length;

  // 4. Total check
  if (alreadyInDB + currentlySelectedInUI >= 2) {
    const monthName = new Date(dateStr).toLocaleString('en-US', { month: 'long' });
    Alert.alert("Limit Reached", `You have already taken or selected 2 leaves for ${monthName}.`);
    return;
  }

  setSelectedFullDayLeaves(prev => [...prev, dateStr]);
};
const handleApplyFullDayLeave = async () => {
  const now = new Date();
  let totalPenalty = 0;
  let emergencyDatesCount = 0;

  // 1. Check all selected dates against current bookings
  selectedFullDayLeaves.forEach(dateStr => {
    const leaveDay = new Date(dateStr);
    
    // Find jobs the worker has on this specific date
    const jobsOnThisDay = bookings.filter(b => {
      const start = new Date(b.Date);
      const months = b.Months || 1;
      const end = new Date(start);
      end.setMonth(start.getMonth() + months);
      return leaveDay >= start && leaveDay <= end;
    });

    // Check if any job starts within 6 hours
    jobsOnThisDay.forEach(job => {
      const timeStr = job.services[0]?.TimeSlot1 || job.services[0]?.JhaduTimeSlot || "09:00 AM";
      const startMins = parseTimeToMinutes(timeStr.split('-')[0].trim());
      
      const workStartTime = new Date(leaveDay);
      workStartTime.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);

      const diffInHours = (workStartTime - now) / (1000 * 60 * 60);
      if (diffInHours < 6 && diffInHours > 0) {
        totalPenalty += 10;
        emergencyDatesCount++;
      }
    });
  });

  const message = totalPenalty > 0 
    ? `You are applying for leave on short notice (<6 hours). A total penalty of ₹${totalPenalty} will be charged. Continue?`
    : `Confirm your ${selectedFullDayLeaves.length} holiday(s)?`;

  Alert.alert(totalPenalty > 0 ? "🚨 Penalty Warning" : "Confirm Holidays", message, [
    { text: "No", style: "cancel" },
    {
      text: "Yes, Confirm",
      onPress: async () => {
        try {
          const token = await AsyncStorage.getItem("workerToken");
          const workerId = await AsyncStorage.getItem("workerId");

          const res = await axios.post(`${WORKER_API_URL}/workers/${workerId}/apply-leave`, 
            { dates: selectedFullDayLeaves }, 
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (res.status === 200 || res.status === 201) {
            Alert.alert("Success", "Holidays confirmed and backup shifts created.");
            setSelectedFullDayLeaves([]);
            setFullDayLeaveModalVisible(false);
            fetchWorkerProfile(); 
          }
        } catch (err) {
          Alert.alert("Error", err.response?.data?.message || "Failed to apply leave.");
        }
      }
    }
  ]);
};


const panY = useRef(new Animated.Value(0)).current;
const getDropValidity = (fromIdx, toIdx) => {
  if (fromIdx === null || toIdx === null) return true;
  const testOrder = [...dailyJobs.jobs];
  const [movedItem] = testOrder.splice(fromIdx, 1);
  testOrder.splice(toIdx, 0, movedItem);

  let currTime = 300; // Start at 5 AM
  const startLoc = workerProfile?.locations?.[0] || { lat: 26.91, lng: 75.78 };
  let cLat = startLoc.lat; let cLng = startLoc.lng;

  for (let job of testOrder) {
    const travel = getTravelTimeMins(getDistanceKM(cLat, cLng, job.location.lat, job.location.lng));
    const arrival = currTime + travel;
    // Constraint: Must arrive before the range ends
    if (arrival > job.latestEnd) return false;
    currTime = Math.max(arrival, job.earliestStart) + job.workDuration;
    cLat = job.location.lat; cLng = job.location.lng;
  }
  return true;
};
const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
    onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gestureState) => {
      // Calculate how many rows we moved (assuming row height ~110px)
      const moveDiff = Math.round(gestureState.dy / 110);
      const toIndex = Math.max(0, Math.min(dailyJobs.jobs.length - 1, draggingIndex + moveDiff));
      
      if (draggingIndex !== null && getDropValidity(draggingIndex, toIndex)) {
        handleMoveJob(draggingIndex, toIndex);
      } else if (draggingIndex !== null) {
        Alert.alert("Invalid Move", "This shift would make you late for a customer.");
      }
      
      setDraggingIndex(null);
      panY.setValue(0);
    },
  })
).current;

const getDistanceDelta = (jobKey, targetIndex) => {
  if (!jobKey || targetIndex === null) return null;

  const currentJobs = dailyJobs.jobs;
  const originalTotal = dailyJobs.totalKm;
  const jobToMove = currentJobs.find(j => j.uniqueKey === jobKey);
  const otherJobs = currentJobs.filter(j => j.uniqueKey !== jobKey);

  // Create the hypothetical sequence
  const testSequence = [...otherJobs];
  testSequence.splice(targetIndex, 0, jobToMove);

  // Calculate hypothetical distance
  const startLoc = workerProfile?.locations?.[0] || { lat: 26.9124, lng: 75.7873 };
  let testKm = 0;
  let cLat = startLoc.lat;
  let cLng = startLoc.lng;

  for (let job of testSequence) {
    testKm += getDistanceKM(cLat, cLng, job.location.lat, job.location.lng);
    cLat = job.location.lat;
    cLng = job.location.lng;
  }
  // Add return to home
  testKm += getDistanceKM(cLat, cLng, startLoc.lat, startLoc.lng);

  const delta = testKm - originalTotal;
  if (Math.abs(delta) < 0.1) return "0 km"; // Ignore tiny changes
  return delta > 0 ? `+${delta.toFixed(1)} km` : `${delta.toFixed(1)} km`;
};

const getSafeDropRange = (jobToMoveKey) => {
  const currentJobs = dailyJobs.jobs;
  const moveIdx = currentJobs.findIndex(j => j.uniqueKey === jobToMoveKey);
  if (moveIdx === -1) return [];

  let validIndices = [];
  const otherJobs = currentJobs.filter(j => j.uniqueKey !== jobToMoveKey);

  // Test every possible position (0 to N)
  for (let i = 0; i <= otherJobs.length; i++) {
    const testSequence = [...otherJobs];
    testSequence.splice(i, 0, currentJobs[moveIdx]);

    let currTime = 300; // 5 AM
    const startLoc = workerProfile?.locations?.[0] || { lat: 26.91, lng: 75.78 };
    let cLat = startLoc.lat; let cLng = startLoc.lng;
    let possible = true;

    for (let job of testSequence) {
      const travel = getTravelTimeMins(getDistanceKM(cLat, cLng, job.location.lat, job.location.lng));
      const arrival = currTime + travel;
      if (arrival > job.latestEnd) { possible = false; break; }
      currTime = Math.max(arrival, job.earliestStart) + job.workDuration;
      cLat = job.location.lat; cLng = job.location.lng;
    }
    if (possible) validIndices.push(i);
  }
  return validIndices;
};


const handleMoveJob = async (fromIndex, toIndex) => {
  if (toIndex < 0 || toIndex >= dailyJobs.jobs.length) return;
  
  const dateKey = focusDate.toISOString().split('T')[0];
  const newOrder = [...dailyJobs.jobs.map(j => j.uniqueKey)];
  
  // Swap positions
  const [movedItem] = newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, movedItem);
  
  // 1. Update State
  const updatedManualOrder = {
    ...manualOrder,
    [dateKey]: newOrder
  };
  setManualOrder(updatedManualOrder);

  // 2. Persist to Storage
  try {
    await AsyncStorage.setItem("worker_manual_order", JSON.stringify(updatedManualOrder));
  } catch (e) {
    console.error("Failed to save order", e);
  }

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};
const isDropZoneValid = (jobKey, targetIndex) => {
  if (!jobKey) return false;
  const currentJobs = dailyJobs.jobs;
  const jobToMove = currentJobs.find(j => j.uniqueKey === jobKey);
  const otherJobs = currentJobs.filter(j => j.uniqueKey !== jobKey);
  
  // Create the hypothetical new order
  const testSequence = [...otherJobs];
  testSequence.splice(targetIndex, 0, jobToMove);

  let currTime = 300; // Start day at 5 AM
  const startLoc = workerProfile?.locations?.[0] || { lat: 26.9124, lng: 75.7873 };
  let currLat = startLoc.lat;
  let currLng = startLoc.lng;

  for (let i = 0; i < testSequence.length; i++) {
    const job = testSequence[i];
    const dist = getDistanceKM(currLat, currLng, job.location.lat, job.location.lng);
    const travelTime = getTravelTimeMins(dist);
    const arrival = currTime + travelTime;

    // 🟢 VALIDATION: Can you arrive before the window closes?
    // We add a 10-minute grace period for traffic.
    if (arrival > job.latestEnd + 10) return false;

    // 🟢 WORK FLOW: You start at the LATER of your arrival or the window opening.
    const actualStartTime = Math.max(arrival, job.earliestStart);

    // Update for next job: start of work + how long work takes
    currTime = actualStartTime + job.workDuration;
    currLat = job.location.lat;
    currLng = job.location.lng;
  }
  return true;
};
// Helper for exact time conversion
const indexToTime = (index) => {
  const totalMinutes = index * 30;
  let hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes === 0 ? '00' : minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
};
// Helper to sum up work duration of all active services in a job
const getJobWorkDuration = (activeServices) => {
  // Summing workDuration from the services (assuming it's stored in minutes)
  // If workDuration is at the top level of the job: job.workDuration.morning + evening
  return activeServices.reduce((sum, srv) => sum + (srv.workDuration || 30), 0); 
};


// 2. Add these helper functions for the Day Selector logic
const setDayOffset = (offset) => {
  const newDate = new Date(focusDate);
  newDate.setDate(newDate.getDate() + offset);
  setFocusDate(newDate);
};

// Calculate distance between two points in KM
// Helper: Calculate distance between two points in KM (Haversine Formula)
const getDistanceKM = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Helper: Estimate travel time in minutes (assuming 25km/h avg speed in traffic)
const getTravelTimeMins = (km) => Math.round((km / 25) * 60);

// Helper: Convert time string "09:00 AM" to minutes from midnight for sorting
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):?(\d+)?/);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || 0);
  const isPM = timeStr.toLowerCase().includes('pm');
  if (isPM && hours < 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Estimate travel time in minutes based on distance
const estimateTravelTime = (km) => Math.round((km / 30) * 60);


const toggleDateSelection = (dateStr) => {
  if (!selectedBookingForLeave) return;
  const targetDate = new Date(dateStr); // The date you clicked

  // 1. Count DB leaves for THAT SPECIFIC month/year
  const dbLeavesInTargetMonth = selectedBookingForLeave.leavesTaken?.filter(leave => {
    const d = new Date(leave.date || leave);
    return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
  }).length || 0;

  // 2. Count UI selections for THAT SPECIFIC month/year
  const uiSelectedInTargetMonth = selectedDates.filter(ds => {
    const d = new Date(ds);
    return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
  }).length;

  const totalForMonth = dbLeavesInTargetMonth + uiSelectedInTargetMonth;

  if (selectedDates.includes(dateStr)) {
    setSelectedDates(prev => prev.filter(d => d !== dateStr));
  } else {
    // Fresh limit check per month
    if (totalForMonth >= 2) {
      const monthLabel = MONTH_NAMES[targetDate.getMonth()];
      Alert.alert("Limit Reached", `Maximum 2 leaves allowed for ${monthLabel}.`);
      return;
    }
    setSelectedDates(prev => [...prev, dateStr]);
  }
};

const handleApplyLeave = async (date) => {
  const now = new Date();
  const workDate = new Date(date);
  
  // 1. Check Leave Limit (Simplistic check based on current fetched bookings)
  const leavesThisMonth = bookings.filter(b => 
    b.bookingType === "oneDayBackup" && 
    new Date(b.Date).getMonth() === now.getMonth()
  ).length;

  if (leavesThisMonth >= 2) {
    Alert.alert("Limit Reached", "You can only take 2 leaves per month to maintain your trust score.");
    return;
  }

  // 2. Calculate Hours Gap for Penalty
  // Assuming work starts at the TimeSlot1 of the original booking
  const scheduledTimeStr = selectedBookingForLeave.services[0]?.TimeSlot1 || "09:00 AM";
  const [time, modifier] = scheduledTimeStr.split(' ');
  let [hours, minutes] = time.split(':');
  if (modifier === 'PM' && hours < 12) hours = parseInt(hours) + 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  
  const workStartTime = new Date(workDate);
  workStartTime.setHours(hours, parseInt(minutes), 0, 0);
  
  const diffInHours = (workStartTime - now) / (1000 * 60 * 60);

  let message = "This leave is free of charge.";
  if (diffInHours < 4) {
    message = "Notice is less than 4 hours. A ₹10 penalty will be deducted from your wallet.";
  } else if (diffInHours < 12) {
    message = "Notice is less than 12 hours. Please try to inform earlier next time.";
  }

  Alert.alert("Confirm Leave", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Confirm", onPress: () => processLeaveBackend(date) }
  ]);
};

const processLeaveBackend = async (date) => {
  try {
    const token = await AsyncStorage.getItem("workerToken");
    await axios.post(`${BOOKINGS_API_URL}/api/worker/bookings/${selectedBookingForLeave._id}/take-leave`, 
      { leaveDate: date },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setLeaveModalVisible(false);
    fetchBookings();
    Alert.alert("Success", "Leave shift posted for backup.");
  } catch (e) {
    Alert.alert("Error", "Failed to post leave.");
  }
};
const getLeaveTypeForDate = (dateStr, booking) => {
  const now = new Date();
  const targetDate = new Date(dateStr);
  
  // Only today can be an emergency
  if (targetDate.toDateString() !== now.toDateString()) return "normal";

  let isEmergency = false;
  const nowMins = now.getHours() * 60 + now.getMinutes();

  booking.services.forEach(srv => {
    const tStr = srv.TimeSlot1 || srv.JhaduTimeSlot;
    if (tStr) {
      const startMins = parseTimeToMinutes(tStr.split('-')[0].trim());
      const diff = startMins - nowMins;
      
      // If notice is between 2 hours (120m) and 6 hours (360m)
      if (diff >= 120 && diff < 360) {
        isEmergency = true;
      }
    }
  });

  return isEmergency ? "emergency" : "normal";
};
const handleTakeLeaveSubmit = async (dates) => {
  const now = new Date();
  let isEmergency = false;
  let penaltyAmount = 0;

  dates.forEach(dateStr => {
    const leaveDay = new Date(dateStr);
    const timeStr = selectedBookingForLeave.services[0]?.TimeSlot1 || 
                    selectedBookingForLeave.services[0]?.JhaduTimeSlot || "09:00 AM";
    
    const startMins = parseTimeToMinutes(timeStr.split('-')[0].trim());
    const workStartTime = new Date(leaveDay);
    workStartTime.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);

    const diffInHours = (workStartTime - now) / (1000 * 60 * 60);

    // If notice is between 2 and 6 hours, it's an emergency penalty
    if (diffInHours < 6 && diffInHours >= 2) {
      isEmergency = true;
      penaltyAmount += 10;
    }
  });

  const alertTitle = isEmergency ? "🚨 Short Notice Penalty" : "Confirm Leave";
  const alertMsg = isEmergency 
    ? `One or more shifts start in less than 6 hours. A ₹${penaltyAmount} penalty will be deducted. Proceed?`
    : `Apply leave for ${dates.length} day(s)?`;

  Alert.alert(alertTitle, alertMsg, [
    { text: "Cancel", style: "cancel" },
    { 
      text: "Confirm", 
      onPress: async () => {
        setLoading(true);
        try {
          const token = await AsyncStorage.getItem("workerToken");
          await axios.post(
            `${BOOKINGS_API_URL}/api/worker/bookings/${selectedBookingForLeave._id}/take-leave`,
            { leaveDates: dates },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setLeaveModalVisible(false);
          setSelectedDates([]);
          fetchBookings();
          Alert.alert("Success", "Leave processed.");
        } catch (e) {
          Alert.alert("Error", e.response?.data?.message || "Failed to apply leave");
        } finally {
          setLoading(false);
        }
      }
    }
  ]);
};

const isServiceActiveToday = (service, startDate, targetDate, isSpecialBooking) => {
  // If it's a backup/emergency replacement, show all services for that day
  if (isSpecialBooking) return true;

  // 🟢 CRITICAL: Normalize dates to midnight for consistent day-diff math
  const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const t = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  
  const diffDays = Math.round(Math.abs(t - s) / (1000 * 60 * 60 * 24));

  switch (service.WorkName) {
    case "Jhadu Pocha":
      if (service.JhaduFrequency === "Daily") return true;
      return diffDays % 2 === 0; // Alternate day logic

    case "Toilet Cleaning":
      const interval = service.FrequencyPerWeek === "Twice a week" ? 3 : 2;
      return diffDays % interval === 0;

    default:
      return true;
  }
};

// 3. Logic to get specific jobs and their "Today Tasks"
// 1. Logic for Daily Focus View
const dailyJobs = useMemo(() => {
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dateKey = focusDate.toISOString().split('T')[0];
  const dayName = dayNames[focusDate.getDay()];
  const isWeekOff = workerProfile?.weekOffDay === dayName;

  if (isWeekOff) return { isWeekOff: true, jobs: [], totalKm: 0, returnStep: null };

  // 🟢 1. Normalize Focus Date to Midnight for accurate alternate-day math
  const normalizedFocus = new Date(focusDate.getFullYear(), focusDate.getMonth(), focusDate.getDate());

  let rawJobs = [];
  const dailyUniqueIds = [];

  bookings.forEach((booking) => {
    const startDate = new Date(booking.Date);
    const months = booking.Months || 1;
    
    const type = (booking.bookingType || "").toLowerCase();
    const bId = (booking.bookingId || "").toLowerCase();
    const reqDay = (booking.weekDayRequested || "").toLowerCase();

    // End Date Logic
    const endDate = new Date(startDate);
    let isSingleDay = ["onedaybackup", "emergency"].includes(type) || bId.startsWith("1day") || bId.startsWith("emg") || reqDay.length > 10;
    
    if (isSingleDay) {
        endDate.setHours(23,59,59);
        if (focusDate.toDateString() !== startDate.toDateString()) return;
    } else if (type === "backup" || bId.startsWith("bkp")) {
        if (reqDay !== dayName) return;
        endDate.setDate(startDate.getDate() + 28);
        if (focusDate < startDate || focusDate > endDate) return;
    } else {
        endDate.setMonth(startDate.getMonth() + months);
        if (focusDate < startDate || focusDate > endDate) return;
    }

    // 🟢 Use normalizedFocus for service activity check
    const activeServices = booking.services.filter(srv =>
      isServiceActiveToday(srv, startDate, normalizedFocus, isSingleDay || bId.startsWith("bkp"))
    );

    if (activeServices.length === 0) return;

    if (!dailyUniqueIds.includes(booking._id)) dailyUniqueIds.push(booking._id);

    const processSlot = (services, slotType) => {
      const getSlotTime = () => {
        if (slotType === 'morning') {
          const jhadu = services.find(s => s.WorkName === "Jhadu Pocha" && s.JhaduTimeSlot);
          if (jhadu?.JhaduTimeSlot) return jhadu.JhaduTimeSlot;
          const cook = services.find(s => s.WorkName === "Cook Service" && s.TimeSlot1);
          return cook?.TimeSlot1 || services.find(s => s.WorkName === "Bartan Service")?.TimeSlot1 || "08:00 AM";
        } else {
          const cook = services.find(s => s.WorkName === "Cook Service" && s.TimeSlot2);
          return cook?.TimeSlot2 || services.find(s => s.WorkName === "Bartan Service")?.TimeSlot2 || "07:00 PM";
        }
      };

      const timeStr = getSlotTime();
      const [startPart, endPart] = timeStr.split('-').map(t => t.trim());
      const parts = timeStr.split('-').map(t => t.trim());
      const startMins = parseTimeToMinutes(startPart);
      const endMins = parts[1] ? parseTimeToMinutes(parts[1]) : (startMins + 60);
      
      const combinedLabel = services
        .map(s => s.WorkName.replace(" Service", "").replace(" Cleaning", ""))
        .join(" + ");

      const durationFromDB = slotType === 'morning' 
    ? (booking.workDuration?.morning || 0) 
    : (booking.workDuration?.evening || 0);

  return {
    ...booking,
    WorkName: combinedLabel,
    assignedColor: JOB_COLORS[dailyUniqueIds.indexOf(booking._id) % JOB_COLORS.length],
    displayTime: timeStr,
    activeServices: services,
    uniqueKey: `${booking._id}-${slotType}`,
    earliestStart: startMins - 15,
    latestEnd: endMins,
    // 🟢 Updated: Use DB field if available, else fallback to summing active services
    workDuration: durationFromDB > 0 ? durationFromDB : getJobWorkDuration(services)
  };
};

    const morning = activeServices.filter(s => ["Jhadu Pocha", "Toilet Cleaning", "Cook Service", "Bartan Service"].includes(s.WorkName));
    if (morning.length > 0) rawJobs.push(processSlot(morning, 'morning'));

    const isTwice = (s) => s?.TimeSlot2 || /twice/i.test(s?.FrequencyPerDay || "");
    const evening = activeServices.filter(s => ["Cook Service", "Bartan Service"].includes(s.WorkName) && isTwice(s));
    if (evening.length > 0) rawJobs.push(processSlot(evening, 'evening'));
  });

  const startLoc = workerProfile?.locations?.[0] || { lat: 26.9124, lng: 75.7873 };
  let finalSequence = [];
  const currentDayManualOrder = manualOrder[dateKey];

  // --- STEP 2: DETERMINE SEQUENCE ---
  if (currentDayManualOrder && currentDayManualOrder.length === rawJobs.length) {
    finalSequence = currentDayManualOrder.map(key => rawJobs.find(j => j.uniqueKey === key)).filter(Boolean);
  } else {
    let bestPath = [];
    let minTotalKm = Infinity;

    const solvePath = (currLat, currLng, currTime, remaining, currentPath, currentKm) => {
      if (remaining.length === 0) {
        const returnDist = getDistanceKM(currLat, currLng, startLoc.lat, startLoc.lng);
        const total = currentKm + returnDist;
        if (total < minTotalKm) { minTotalKm = total; bestPath = [...currentPath]; }
        return;
      }

      remaining.forEach((job, index) => {
        const travelDist = getDistanceKM(currLat, currLng, job.location?.lat, job.location?.lng);
        const arrivalTime = currTime + getTravelTimeMins(travelDist);

        if (arrivalTime <= job.latestEnd) {
          const actualStartTime = Math.max(arrivalTime, job.earliestStart);
          solvePath(job.location.lat, job.location.lng, actualStartTime + job.workDuration, remaining.filter((_, i) => i !== index), [...currentPath, job], currentKm + travelDist);
        }
      });
    };

    solvePath(startLoc.lat, startLoc.lng, 300, rawJobs, [], 0);
    
    // 🟢 FALLBACK: If solver found no path, just sort by earliest start time!
    finalSequence = bestPath.length > 0 ? bestPath : rawJobs.sort((a, b) => a.earliestStart - b.earliestStart);
  }

  // --- STEP 3: FINAL PROCESSING ---
  let rollingKm = 0;
  let currLat = startLoc.lat;
  let currLng = startLoc.lng;
  let currTime = 300; 

const processedJobs = finalSequence.map((job) => {
    const travelDist = getDistanceKM(currLat, currLng, job.location?.lat, job.location?.lng);
    const travelTime = getTravelTimeMins(travelDist);
    const arrivalTime = currTime + travelTime;
    
    // 🟢 UI Exact Time: Worker starts when they arrive, or when window opens.
    const exactStartTime = Math.max(arrivalTime, job.earliestStart);
    
    // 🟢 Conflict if arrival is past the deadline
    const isConflict = arrivalTime > job.latestEnd + 10; 

    rollingKm += travelDist;
    currLat = job.location.lat;
    currLng = job.location.lng;
    currTime = exactStartTime + job.workDuration;

    return { 
      ...job, 
      distFromPrev: travelDist, 
      travelTimeFromPrev: travelTime, 
      exactStartTime, // This is the "9:15 AM" shown in the list
      isConflict 
    };
  });

  const returnDist = getDistanceKM(currLat, currLng, startLoc.lat, startLoc.lng);
  return {
    isWeekOff: false,
    jobs: processedJobs,
    returnStep: { distFromPrev: returnDist, travelTimeFromPrev: getTravelTimeMins(returnDist), address: "Home", WorkName: "Return Home" },
    totalKm: parseFloat((rollingKm + returnDist).toFixed(2))
  };
}, [bookings, focusDate, workerProfile, manualOrder]);


const totalRouteTime = useMemo(() => {
  if (!dailyJobs || !dailyJobs.jobs || dailyJobs.jobs.length === 0) return 0;

  // 🟢 Updated: Sum the workDuration property directly from the processed jobs
  const totalWork = dailyJobs.jobs.reduce((sum, job) => sum + (job.workDuration || 0), 0);
  
  const totalTravel = dailyJobs.jobs.reduce((sum, job) => sum + (job.travelTimeFromPrev || 0), 0);
  
  // Add the return trip time
  const returnTripTime = dailyJobs.returnStep?.travelTimeFromPrev || 0;

  return totalWork + totalTravel + returnTripTime;
}, [dailyJobs]);



// 2. Fetch worker profile on load
const fetchWorkerProfile = async () => {
  try {
    const workerId = await AsyncStorage.getItem("workerId");
    const token = await AsyncStorage.getItem("workerToken");
    const res = await axios.get(`${WORKER_API_URL}/workers/${workerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setWorkerProfile(res.data);
  } catch (err) {
    console.error("Profile fetch error", err);
  }
};

// Add this new useEffect near your other useEffects
useEffect(() => {
  const loadSavedOrder = async () => {
    try {
      const savedOrder = await AsyncStorage.getItem("worker_manual_order");
      if (savedOrder) {
        setManualOrder(JSON.parse(savedOrder));
      }
    } catch (e) {
      console.error("Failed to load manual order", e);
    }
  };
  loadSavedOrder();
}, []);



useEffect(() => {
  fetchBookings();
  fetchWorkerProfile();
  const interval = setInterval(fetchBookings, 10000);
  return () => clearInterval(interval);
}, []);

// 2. UPDATED: Monthly Calendar Grid Data
const calendarDays = useMemo(() => {
  const days = [];
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  for (let i = 0; i < 35; i++) {
    const curDate = new Date(startOfMonth);
    curDate.setDate(startOfMonth.getDate() + i);
    const dayName = dayNames[curDate.getDay()];
    const isWeekOff = workerProfile?.weekOffDay === dayName;

    let dayExpandedJobs = [];
    if (!isWeekOff) {
      // 🟢 Step A: Tracker for unique IDs for this specific calendar day box
      const localUniqueIds = [];

      bookings.forEach((booking) => {
        const startDate = new Date(booking.Date);
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + (booking.Months || 1));

        const type = (booking.bookingType || "").toLowerCase();
        const bId = (booking.bookingId || "").toLowerCase();
        let shouldShow = false;

        // Type filtering logic
        if (["onedaybackup", "emergency"].includes(type) || bId.startsWith("1day") || bId.startsWith("emg")) {
          if (curDate.toDateString() === startDate.toDateString()) shouldShow = true;
        } else if (type === "backup" || bId.startsWith("bkp")) {
          const curDayName = dayNames[curDate.getDay()];
          if (booking.weekDayRequested?.toLowerCase() === curDayName && curDate >= startDate && curDate <= endDate) shouldShow = true;
        } else {
          if (curDate >= startDate && curDate <= endDate) shouldShow = true;
        }

        if (!shouldShow) return;
// Inside calendarDays bookings.forEach loop:
        const isSpecial = ["onedaybackup", "emergency", "backup"].includes(type) || 
                         bId.startsWith("1day") || bId.startsWith("emg") || bId.startsWith("bkp");

        const activeSrvs = booking.services.filter(s => 
          // 🟢 Pass isSpecial as the 4th argument
          isServiceActiveToday(s, startDate, curDate, isSpecial)
        );
        if (activeSrvs.length > 0) {
          // 🟢 Step B: Assign the same Color ID logic used in dailyJobs
          if (!localUniqueIds.includes(booking._id)) localUniqueIds.push(booking._id);
          const assignedColor = JOB_COLORS[localUniqueIds.indexOf(booking._id) % JOB_COLORS.length];

          const jhadu = booking.services.find(s => s.WorkName === "Jhadu Pocha" && s.JhaduTimeSlot);
          const morningTime = jhadu?.JhaduTimeSlot || booking.services[0]?.TimeSlot1 || "Morning";
          
          dayExpandedJobs.push({ 
            ...booking, 
            displayTime: morningTime, 
            assignedColor // 🟢 Store the color in the object
          });

          // Evening shift check
          const isTwice = (s) => s?.TimeSlot2 || /twice/i.test(s?.FrequencyPerDay || "");
          if (activeSrvs.some(s => isTwice(s))) {
            dayExpandedJobs.push({ 
              ...booking, 
              displayTime: "Evening", 
              assignedColor // 🟢 Same color for evening shift
            });
          }
        }
      });
    }

    days.push({ 
      date: curDate, 
      jobs: dayExpandedJobs.sort((a, b) => (a.displayTime || "").localeCompare(b.displayTime || "")), 
      isWeekOff 
    });
  }
  return days;
}, [bookings, workerProfile]);

  // const API_URL = `https://urbanlite-backends.onrender.com/api/worker/bookings/all`;
  const API_URL = `${BOOKINGS_API_URL}/api/worker/bookings/all`;

  const fetchBookings = async () => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(res.data);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const payCommission = async (bookingId) => {
    try {
      const token = await AsyncStorage.getItem("workerToken");
      await axios.post(
        `${BOOKINGS_API_URL}/api/worker/bookings/${bookingId}/pay-commission`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      alert("✅ Commission paid successfully");
      fetchBookings();
    } catch (err) {
      alert("❌ Failed to pay commission");
    }
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 10000);
    return () => clearInterval(interval);
  }, []);
// 🟢 EXPANDED Palette to prevent duplication


// We will no longer use getColorForBooking(id) globally in the daily view. 
// Instead, we will assign them inside the useMemo.

  // --- NEW: CALENDAR LOGIC ---
  const getColorForBooking = (id) => {
    const colors = [
     "#6c47ff", "#f59e0b", "#10b981", "#ef4444", "#ec4899", 
  "#06b6d4", "#8b5cf6", "#f43f5e", "#14b8a6", "#f97316",
  "#3b82f6", "#84cc16", "#0ea5e9", "#d946ef", "#6366f1"
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // const calendarDays = useMemo(() => {
  //   const days = [];
  //   const now = new Date();
  //   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  //   for (let i = 0; i < 35; i++) {
  //     const day = new Date(startOfMonth);
  //     day.setDate(startOfMonth.getDate() + i);
  //     const dayJobs = bookings.filter(
  //       (b) => new Date(b.Date).toDateString() === day.toDateString(),
  //     );
  //     days.push({ date: day, jobs: dayJobs });
  //   }
  //   return days;
  // }, [bookings]);

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color="#6c47ff"
        style={{ flex: 1, justifyContent: "center" }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
<Stack.Screen 
        options={{
          headerTitle: `My Jobs • ${currentMonthName}`,
          headerRight: () => (
            <TouchableOpacity 
              style={{ marginRight: 15 }} 
              onPress={() => router.push("/pages/incentives")}
            >
              <GiftIcon size={24} color="#6c47ff" />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: '#000' }, // Change to 'black' if you want a black bar
          headerTintColor: '#fff', // Change to 'white' if using a black bar
        }} 
      />
      <StatusBar barStyle="dark-content" />
      {/* --- TAB SELECTOR --- */}
      <View style={styles.tabHeader}>
  <TouchableOpacity
    style={[styles.tabButton, activeTab === "bookings" && styles.activeTab]}
    onPress={() => setActiveTab("bookings")}
  >
    <Text style={[styles.tabText, activeTab === "bookings" && styles.activeTabText]}>Bookings</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.tabButton, activeTab === "calendar" && styles.activeTab]}
    onPress={() => setActiveTab("calendar")}
  >
    <Text style={[styles.tabText, activeTab === "calendar" && styles.activeTabText]}>Calendar</Text>
  </TouchableOpacity>

  
</View>

      {activeTab === "bookings" && (
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.heading}>✅ My Jobs</Text>
            <Text style={styles.subHeading}>
              {bookings.length} Active Bookings
            </Text>
          {/* Add this inside the activeTab === "bookings" block, above the FlatList */}
<TouchableOpacity 
  style={styles.fullDayLeaveTrigger}
  onPress={() => setFullDayLeaveModalVisible(true)}
>
  <Text style={styles.fullDayLeaveTriggerText}>🌴 Plan a Full Day Holiday</Text>
</TouchableOpacity>
          </View>
          <FlatList
            data={bookings}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchBookings();
            }}
renderItem={({ item }) => {
  const months = item.Months || 1;
  const totalEarnings = item.EstimatedPrice * 0.8;
  const monthlyEarnings = totalEarnings / (months || 1);
  const isCancelled = item.status === "cancelled";
  const isMenuOpen = activeMenuId === item._id;

  // --- THEME LOGIC (Type + ID Prefix Check) ---
  const type = (item.bookingType || "").toLowerCase();
  const bId = (item.bookingId || "").toLowerCase();
  
  const isBackup = type === "backup" || bId.startsWith("bkp");
  const isOneDay = type === "onedaybackup" || bId.startsWith("1day") || bId.startsWith("emg");
  const isEmergency = type === "emergency" || bId.startsWith("emg");

  const theme = {
    card: isOneDay ? styles.oneDayCard : isEmergency ? styles.emergencyCard : isBackup ? styles.backupCard : {},
    banner: isOneDay ? styles.oneDayBanner : isEmergency ? styles.emergencyBanner : isBackup ? styles.backupBanner : {},
    label: isEmergency ? "🚨 URGENT" : isOneDay ? "⚡ 1-DAY" : isBackup ? "🛡️ BACKUP" : "YOUR EARNINGS",
    text: (isBackup || isOneDay || isEmergency) ? '#fff' : '#1E293B',
  };

  return (
    <View style={[styles.card, theme.card, isCancelled && styles.cancelledCard]}>
      <View style={[styles.priceBanner, theme.banner, isCancelled && styles.cancelledBanner]}>
        <View>
          <Text style={[styles.priceLabel, (isBackup || isOneDay || isEmergency) && {color: 'rgba(255,255,255,0.8)'}]}>
            {isCancelled ? "LOST EARNINGS" : theme.label}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={[styles.priceValue, { color: theme.text }]}>₹{monthlyEarnings.toFixed(0)}</Text>
            {/* Logic: Only show "/ month" for long term normal bookings */}
            {/* {!isOneDay && !isEmergency && months >= 1 && (
              <Text style={[styles.perMonthText, { color: theme.text, opacity: 0.7 }]}> / month</Text>
            )} */}
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <View style={styles.durationBadge}>
  <Text style={styles.durationText}>
    {/* 🟢 Correctly handles 1-Day, Emergency, and 4-Day Backups */}
    📅 {isOneDay || isEmergency ? "1 Day Shift" : isBackup ? "4 Day Backup" : `${months} Month`}
  </Text>
</View>
          <View style={styles.workDurationRow}>
             {/* ... morning/evening badges ... */}
             {item.workDuration?.morning >= 0 && (
               <View style={[styles.miniDurationBadge,{color: theme.text}]}><Text style={styles.miniDurationText}>☀️ {item.workDuration.morning}m</Text></View>
             )}
             {item.workDuration?.evening >= 0 && (
               <View style={[styles.miniDurationBadge,{color: theme.text}]}><Text style={styles.miniDurationText}>🌙 {item.workDuration.evening}m</Text></View>
             )}
          </View>
        </View>

        {/* Three Dots Menu */}
        {!isCancelled && item.bookingType === 'normal' && (
          <View>
            <TouchableOpacity 
              onPress={() => setActiveMenuId(isMenuOpen ? null : item._id)}
              style={styles.threeDotsBtn}
            >
              <Text style={[styles.threeDotsText, (isBackup || isOneDay || isEmergency) && {color: '#fff'}]}>•••</Text>
            </TouchableOpacity>

            {isMenuOpen && (
              <View style={styles.floatingMenu}>
                <TouchableOpacity 
                  style={styles.menuOption} 
                  onPress={() => {
                    setActiveMenuId(null);
                    setSelectedBookingForLeave(item);
                    setLeaveModalVisible(true);
                  }}
                >
                  <Text style={styles.leaveText}>🏖 Take a Leave</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.title}>{item.WorkName} • {currentMonthName}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>📍 Address:</Text>
              <Text style={styles.infoValue} numberOfLines={3}>{item.address}</Text>
            </View>
          </View>

          <View style={styles.rightActionsColumn}>
            <View style={[styles.statusBadge, { backgroundColor: isCancelled ? "#e53935" : "#4caf50" }]}>
              <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
            </View>

            {item.location?.lat ? (
              <TouchableOpacity
                style={styles.squareMapBtn}
                onPress={() => {
                  const url = `http://maps.google.com/?q=${item.location.lat},${item.location.lng}`;
                  Linking.openURL(url);
                }}
              >
                <Image
                  source={{ uri: "https://media.wired.com/photos/5a6a61938c669c70314b300d/3:2/w_2560%2Cc_limit/Google-Map-US_10.jpg" }}
                  style={styles.mapThumbnail}
                />
                <View style={styles.mapOverlay}><Text style={styles.mapOverlayText}>GO ↗</Text></View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📞 Customer:</Text>
          <Text style={[styles.infoValue, { color: "#6c47ff", fontWeight: "700" }]}>
            {item.TempPhoneCustomer}
          </Text>
        </View>

        <View style={styles.infoGrid}>
          <Text style={styles.miniTag}>📅 Start: {new Date(item.Date).toLocaleDateString()}</Text>
          <Text style={styles.miniTag}>📝 {item.WhichPlan} Plan</Text>
          <Text style={styles.miniTag}>💳 {item.payment?.method || "N/A"}</Text>
        </View>

        {item.services?.length > 0 ? (
          <View style={styles.servicesContainer}>
            <Text style={styles.sectionTitle}>🛠 Service Details:</Text>
            {item.services.map((srv, index) => (
              <View key={srv._id || index} style={styles.serviceBox}>
                <Text style={styles.serviceTitle}>{srv.WorkName}</Text>
                <View style={styles.tagContainer}>
                  {srv.FrequencyPerDay ? <Text style={styles.tag}>🔄 {srv.FrequencyPerDay}/day</Text> : null}
                  
                  {srv.TimeSlot1 || srv.JhaduTimeSlot ? (
                    <Text style={styles.tag}>⏰ {srv.TimeSlot1 || srv.JhaduTimeSlot}</Text>
                  ) : null}
                  
                  {srv.TimeSlot2 ? <Text style={styles.tag}>🌙 {srv.TimeSlot2}</Text> : null}
                  
                  {srv.NoOfRooms ? <Text style={styles.tag}>🛏 {srv.NoOfRooms} Rooms</Text> : null}

                  {/* FIXED: Only show utensils if NOT Cook Service and count > 0 */}
                  {srv.WorkName !== "Cook Service" && srv.AmountOfBartan > 0 ? (
                    <Text style={styles.tag}>🍽 {srv.AmountOfBartan} Utensils</Text>
                  ) : null}

                  {srv.NoOfToilets ? <Text style={styles.tag}>🚽 {srv.NoOfToilets} Toilets</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>Commission Due:</Text>
            <Text style={styles.footerValue}>₹{item.payment?.commission?.amount || 0}</Text>
          </View>

          {item.status === "accepted" && !item.payment?.commission?.isSettled ? (
            <TouchableOpacity style={styles.payBtn} onPress={() => payCommission(item._id)}>
              <Text style={styles.payBtnText}>Pay Now</Text>
            </TouchableOpacity>
          ) : item.payment?.commission?.isSettled ? (
            <Text style={styles.settledText}>✅ Settled</Text>
          ) : null}
        </View>

        {isCancelled ? (
          <View style={styles.cancelledNotice}>
            <Text style={styles.cancelledNoticeText}>❌ This job was cancelled by the customer.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}}
          />
        </View>
      ) } 

{activeTab === "calendar" && (
        <ScrollView style={{ flex: 1 }}>
          
          {/* --- 📍 DAY VIEW --- */}
          <View style={styles.extractedDayContainer}>
            <View style={styles.fullWidthDayBox}>
              <View style={styles.innerDaySelector}>
                <View style={styles.innerDateInfo}>
                  <Text style={styles.innerDayName}>{focusDate.toLocaleDateString('en-US', {weekday: 'short'})}</Text>
                  <Text style={styles.innerDateNumber}>{focusDate.getDate()} {focusDate.toLocaleDateString('en-US', {month: 'short'})}</Text>
                </View>
                {!dailyJobs.isWeekOff && (
  <TouchableOpacity 
    style={styles.totalDistBadge} 
    onPress={() => setRouteModalVisible(true)}
  >
    <Text style={styles.totalDistText}>🚩 {dailyJobs.totalKm.toFixed(1)} KM Today</Text>
  </TouchableOpacity>
)}
                <View style={styles.innerNavGroup}>
                  <TouchableOpacity onPress={() => setDayOffset(-1)} style={styles.innerNavBtn}><Text>◀</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setDayOffset(1)} style={styles.innerNavBtn}><Text>▶</Text></TouchableOpacity>
                </View>
              </View>

              <View style={styles.fullWidthJobsContainer}>
  {dailyJobs.jobs.map((job, index) => {
    const isThisDragging = draggingJobKey === job.uniqueKey;
    const isValidZone = draggingJobKey && isDropZoneValid(draggingJobKey, index);

    return (
      <View key={job.uniqueKey}>
        {/* --- VALID DROP ZONE HIGHLIGHTER --- */}
        {draggingJobKey && draggingJobKey !== job.uniqueKey && (
          <TouchableOpacity
            onPress={() => {
              if (isValidZone) {
                handleMoveJob(dailyJobs.jobs.findIndex(j => j.uniqueKey === draggingJobKey), index);
                setDraggingJobKey(null);
              }
            }}
            style={[
              styles.dropZonePlaceholder,
              isValidZone ? styles.dropZoneValid : styles.dropZoneInvalid
            ]}
          >
            <Text style={styles.dropZoneText}>{isValidZone ? "📥 DROP HERE" : "❌ TOO LATE"}</Text>
            {/* --- ADD THIS PART --- */}
      {isValidZone && (
        <Text style={[
          styles.deltaText, 
          { color: getDistanceDelta(draggingJobKey, index)?.startsWith('+') ? '#ef4444' : '#10b981' }
        ]}>
          {getDistanceDelta(draggingJobKey, index)}
        </Text>
      )}
          </TouchableOpacity>
        )}

        <View style={[
          styles.rowWrapper,
          isThisDragging && styles.draggingRow
        ]}>
          <TouchableOpacity 
            onLongPress={() => {
              setDraggingJobKey(job.uniqueKey);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }}
            onPress={() => draggingJobKey ? setDraggingJobKey(null) : setSelectedJob(job)}
            style={[styles.fullColorRowWide, { backgroundColor: job.assignedColor }]}
          >
            {/* 1. TIME COLUMN */}
            <View style={styles.rowTimeCol}>
              <Text style={styles.wideTimeText}>{indexToTime(job.exactStartTime / 30)}</Text>
            </View>

            {/* 2. SERVICES COLUMN (Lists all active service names) */}
            <View style={styles.rowWorkCol}>
   <View style={styles.wideTasksRow}>
      {/* Instead of just mapping job.activeServices, 
         we check if it's the specific booking.
      */}
      {job.activeServices?.map((s, i) => (
        <Text 
          key={i} 
          numberOfLines={1} 
          style={[styles.wideTaskTag, { fontSize: job.activeServices.length > 2 ? 9 : 10 }]}
        >
          • {s.WorkName.replace(" Service", "")}
        </Text>
      ))}
   </View>
</View>

            {/* 3. NAME & MAP COLUMN */}
            <View style={styles.rowNameCol}>
               <Text style={styles.wideNameText} numberOfLines={1}>{job.CustomerName}</Text>
               <TouchableOpacity 
                  style={styles.miniMapBtn} 
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${job.location?.lat},${job.location?.lng}`)}
                >
                  <Text style={styles.miniMapText}>MAP ↗</Text>
                </TouchableOpacity>
            </View>
            
            {/* 4. HAMBURGER REORDER ICON */}
            <View style={styles.hamburgerContainer}>
              <Text style={styles.hamburgerIcon}>☰</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  })}
  
  {draggingJobKey && (
    <TouchableOpacity style={styles.cancelReorderBtn} onPress={() => setDraggingJobKey(null)}>
      <Text style={styles.cancelReorderText}>Cancel Reordering</Text>
    </TouchableOpacity>
  )}
</View>
            </View>
          </View>
          <Text style={styles.calendarMonthTitle}>
        {MONTH_NAMES[focusDate.getMonth()]} {focusDate.getFullYear()}
      </Text>

          {/* --- 🗓 MONTH VIEW --- */}
          <View style={styles.calendarGrid}>
            {/* Calendar Headers (M, T, W...) */}
            {/* ✅ ADDED: Weekday Headers (S, M, T, W, T, F, S) */}
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <View key={`header-${index}`} style={styles.calendarHeaderCell}>
            <Text style={styles.calendarHeaderDay}>{day}</Text>
          </View>
        ))}
            {calendarDays.map((dayObj, index) => {
              const isSelected = dayObj.date.toDateString() === focusDate.toDateString();
              return (
                <TouchableOpacity key={index} onPress={() => setFocusDate(dayObj.date)} style={[styles.dayBox, dayObj.isWeekOff && styles.weekOffDayBox, isSelected && styles.selectedDayBox]}>
                  <Text style={[styles.dayNumber, isSelected && {color: '#fff'}]}>{dayObj.date.getDate()}</Text>
                  <View style={styles.miniJobsContainer}>
                    {!dayObj.isWeekOff && dayObj.jobs.slice(0, 3).map((job, idx) => (
                      <View key={idx} 
style={[styles.jobIndicatorStick, { backgroundColor: isSelected ? '#fff' : job.assignedColor }]}                      >
                        <Text style={styles.jobIndicatorText} numberOfLines={1}>{(job.displayTime || '').split('-')[0]} {job.TempPhoneCustomer}</Text>
                      </View>
                    ))}
                    {!dayObj.isWeekOff && dayObj.jobs.length > 3 && (
                      <View style={[styles.jobIndicatorStick, styles.moreJobsStick, { backgroundColor: isSelected ? '#6c47ff' : '#94a3b8' }]}>
                        <Text style={styles.moreJobsText}>+{dayObj.jobs.length - 3}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* --- CALENDAR JOB DETAIL MODAL --- */}
      <Modal visible={!!selectedJob} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedJob && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{selectedJob.WorkName}</Text>
                <Text style={styles.modalSub}>
                  {new Date(selectedJob.Date).toDateString()}
                </Text>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>📍 Address:</Text>
                  <Text style={styles.modalVal}>{selectedJob.address}</Text>
                </View>

                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Customer name:</Text>
                  <Text
                    style={[
                      styles.modalVal,
                      { color: "#6c47ff", fontWeight: "bold" },
                    ]}
                  >
                    {selectedJob.CustomerName}
                  </Text>
                </View>

                {/* ✅ FIXED: Show only TODAY'S services, not the whole booking */}
<View style={styles.modalInfoRow}>
  <Text style={styles.modalLabel}>🛠 Today's Tasks & Details:</Text>
  {selectedJob.activeServices && selectedJob.activeServices.length > 0 ? (
    selectedJob.activeServices.map((srv, index) => (
      <View key={srv._id || index} style={styles.modalServiceItem}>
        <Text style={styles.modalServiceTitle}>• {srv.WorkName}</Text>
        
        <View style={styles.modalTagRow}>
          {/* 🍳 COOK DETAILS */}
          {srv.WorkName === "Cook Service" && (
            <>
              {!!srv.NoOfPeople && (
                <Text style={styles.modalMiniTag}>👥 Food for {srv.NoOfPeople} People</Text>
              )}
              {!!srv.VegNonVeg && (
                <Text style={styles.modalMiniTag}>🥗 {srv.VegNonVeg}</Text>
              )}
            </>
          )}

          {/* 🧹 JHADU POCHA DETAILS */}
          {srv.WorkName === "Jhadu Pocha" && (
            <>
              {!!srv.NoOfRooms && (
                <Text style={styles.modalMiniTag}>🛏 {srv.NoOfRooms} Rooms</Text>
              )}
              {!!srv.NoOfKitchen && (
                <Text style={styles.modalMiniTag}>🍳 {srv.NoOfKitchen} Kitchen</Text>
              )}
              {!!srv.HallSize && (
                <Text style={styles.modalMiniTag}>🏠 {srv.HallSize} Hall</Text>
              )}
              {!!srv.NoOfBalcony && (
                <Text style={styles.modalMiniTag}>🌅 {srv.NoOfBalcony} Balcony</Text>
              )}
            </>
          )}

          {/* 🚽 TOILET DETAILS */}
          {srv.WorkName === "Toilet Cleaning" && (
            <>
              {!!srv.NoOfToilets && (
                <Text style={styles.modalMiniTag}>🚽 {srv.NoOfToilets} Toilets</Text>
              )}
            </>
          )}

          {/* 🍽 BARTAN DETAILS (Adding this just in case) */}
          {srv.WorkName === "Bartan Service" && !!srv.AmountOfBartan && (
            <Text style={styles.modalMiniTag}>🍽 {srv.AmountOfBartan} Utensils</Text>
          )}

          {/* SHARED DETAILS (Time & Frequency) */}
          <Text style={styles.modalMiniTag}>⏰ {selectedJob.displayTime}</Text>
          {!!srv.FrequencyPerDay && (
            <Text style={styles.modalMiniTag}>🔄 {srv.FrequencyPerDay}/day</Text>
          )}
        </View>
      </View>
    ))
  ) : (
    <Text style={styles.modalVal}>No specific tasks for this slot today.</Text>
  )}
</View>

                <TouchableOpacity
                  style={styles.modalNavBtn}
                  onPress={() =>
                    Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${selectedJob.location.lat},${selectedJob.location.lng}`,
                    )
                  }
                >
                  <Text style={styles.modalNavText}>Location ↗</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setSelectedJob(null)}
                >
                  <Text style={styles.modalCloseText}>Dismiss</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
     <Modal visible={leaveModalVisible} transparent animationType="slide">
  {/* This wrapper is critical to make the modal centered and background dimmed */}
  <View style={styles.modalOverlay}>
  {selectedBookingForLeave ? (
    <View style={styles.leaveModalContent}>
      <Text style={styles.modalTitle}>Plan Your Leaves</Text>
      <Text style={styles.modalSub}>Select dates. (Max 2 per month)</Text>
      
      {/* Wrapped in a height-limited ScrollView so 28 items don't overflow the screen */}
      <ScrollView contentContainerStyle={styles.leaveDateGrid}>
        {Array.from({ length: 28 }).map((_, offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const dateStr = d.toISOString().split('T')[0];
  
  const isSelectable = isDateSelectable(dateStr, selectedBookingForLeave);
  const isWeekOff = workerProfile?.weekOffDay === d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  // Replace the old isAlreadyTaken variable with this:
  const isAlreadyTaken = selectedBookingForLeave?.leavesTaken?.some(leave => {
    const checkDate = new Date(leave.date || leave).toISOString().split('T')[0];
    return checkDate === dateStr;
  });

  const isBtnDisabled = isWeekOff || isAlreadyTaken || !isSelectable;

  return (
    <TouchableOpacity 
      key={offset}dail
      disabled={isBtnDisabled}
      onPress={() => toggleDateSelection(dateStr)}
      style={[
        styles.dateOption, 
        isBtnDisabled && { opacity: 0.3, backgroundColor: '#e2e8f0', borderColor: '#cbd5e1' },
        isAlreadyTaken && { backgroundColor: '#fee2e2', borderColor: '#f87171' },
        selectedDates.includes(dateStr) && { backgroundColor: '#000', borderColor: '#000' }
      ]}
    >
      <Text style={[
        styles.dateText, 
        selectedDates.includes(dateStr) && {color: '#fff'},
        !isSelectable && d.toDateString() === new Date().toDateString() && { color: '#94a3b8' }
      ]}>
        {d.getDate()}
      </Text>
      <Text style={[styles.dayText, selectedDates.includes(dateStr) && {color: '#fff'}]}>
        {!isSelectable && d.toDateString() === new Date().toDateString() ? d.toLocaleDateString('en-US', {weekday: 'short'}) : d.toLocaleDateString('en-US', {weekday: 'short'})}
      </Text>
    </TouchableOpacity>
  );
})}
      </ScrollView>

      {selectedDates.length > 0 && (
        <TouchableOpacity 
          style={styles.confirmLeaveBtn} 
          onPress={() => handleTakeLeaveSubmit(selectedDates)}
        >
          <Text style={styles.confirmLeaveText}>Confirm {selectedDates.length} Leave(s)</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        onPress={() => { setLeaveModalVisible(false); setSelectedDates([]); }} 
        style={[styles.modalClose, { marginTop: 10 }]}
      >
        <Text style={styles.modalCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
  ):
  <ActivityIndicator size="large" color="#6c47ff" />
  }
  </View>
</Modal>
{/* --- 🚩 ROUTE OPTIMIZATION MODAL --- */}
<Modal visible={routeModalVisible} transparent animationType="slide">
  <View style={styles.modalOverlay}>
    <View style={styles.routeModalContainer}>
      <View style={styles.routeHeader}>
        <Text style={styles.modalTitle}>Daily Route Summary</Text>
        <TouchableOpacity onPress={() => setRouteModalVisible(false)}>
          <Text style={styles.modalCloseText}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* START POINT */}
        <View style={styles.routeStep}>
          <View style={styles.stepDot}><Text style={{color:'#fff', fontSize:8}}>H</Text></View>
          <View style={styles.stepInfo}>
            <Text style={styles.stepTitle}>Home / Start Location</Text>
            <Text style={styles.stepSub}>{workerProfile?.locations?.[0]?.label || "Registered Home"}</Text>
          </View>
        </View>

        {dailyJobs.jobs.map((job, index) => (
          <View key={index}>
            {/* TRAVEL LINE */}
            <View style={styles.travelLine}>
              <View style={styles.verticalDash} />
              <View style={styles.travelStats}>
                <Text style={styles.travelStatsText}>🚗 {job.distFromPrev?.toFixed(1)} km ({job.travelTimeFromPrev} mins travel)</Text>
              </View>
            </View>

            {/* JOB STOP */}
            <View style={styles.routeStep}>
              <View style={[styles.stepDot, { backgroundColor: job.assignedColor }]} />
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>{job.WorkName}</Text>
                <Text style={styles.stepSub} numberOfLines={1}>{job.address}</Text>
                <View style={styles.stepWorkBadge}>
{/* 🟢 Uses the actual minutes assigned during processing */}
<Text style={styles.stepWorkText}>⏱️ Work Duration: {job.workDuration} mins</Text>                </View>
              </View>
            </View>
          </View>
        ))}
{/* 🟢 NEW: ADD RETURN STEP TO UI */}
{dailyJobs.returnStep && (
  <View>
    <View style={styles.travelLine}>
      <View style={[styles.verticalDash, { borderColor: '#94a3b8' }]} />
      <View style={styles.travelStats}>
        <Text style={[styles.travelStatsText, { color: '#64748b', backgroundColor: '#f1f5f9' }]}>
          🚗 {dailyJobs.returnStep.distFromPrev.toFixed(1)} km ({dailyJobs.returnStep.travelTimeFromPrev} mins return)
        </Text>
      </View>
    </View>

    <View style={styles.routeStep}>
      <View style={[styles.stepDot, { backgroundColor: '#475569' }]}>
        <Text style={{ color: '#fff', fontSize: 8 }}>H</Text>
      </View>
      <View style={styles.stepInfo}>
        <Text style={styles.stepTitle}>Back to Home</Text>
        <Text style={styles.stepSub}>End of day summary</Text>
      </View>
    </View>
  </View>
)}
        {/* FINAL SUMMARY FOOTER */}
        <View style={styles.routeSummaryFooter}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Distance</Text>
            <Text style={styles.summaryVal}>{dailyJobs.totalKm} KM</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Est. Total Time</Text>
            <Text style={styles.summaryVal}>
              {Math.floor(totalRouteTime / 60)}h {totalRouteTime % 60}m
            </Text>
          </View>
        </View>
        
        <Text style={styles.footerNote}>*Includes estimated travel time in traffic and service duration.</Text>
      </ScrollView>
    </View>
  </View>
</Modal>
<Modal visible={fullDayLeaveModalVisible} transparent animationType="slide">
  <View style={styles.modalOverlay}>
    <View style={styles.leaveModalContent}>
      <Text style={styles.modalTitle}>Plan Full Day Holidays</Text>
      <Text style={styles.modalSub}>Maximum 2 holidays allowed per month.</Text>
      
      <ScrollView contentContainerStyle={styles.leaveDateGrid}>
        {Array.from({ length: maxBookingDate }).map((_, offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          const dateStr = d.toISOString().split('T')[0];
          const isTooLate = !isDateSelectable(dateStr, bookings);
          const isWeekOff = workerProfile?.weekOffDay === d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const isAlreadyTaken = dbLeaves.includes(dateStr);
          const isSelected = selectedFullDayLeaves.includes(dateStr);
          
          // Check if this specific month is already full
          const monthIsFull = (getLeavesCountForMonth(dateStr) + 
                               selectedFullDayLeaves.filter(sd => sd.startsWith(dateStr.slice(0,7))).length) >= 2;

          return (
            <TouchableOpacity 
              key={offset}
              // Disable if: Weekoff OR Already in DB OR (Month is full AND this date isn't the one selected)
              disabled={isWeekOff || isAlreadyTaken || isTooLate || (monthIsFull && !isSelected)}
              onPress={() => toggleFullDaySelection(dateStr)}
              style={[
                styles.dateOption, 
                isWeekOff && { opacity: 0.1, backgroundColor: '#ccc' },
                isTooLate && { opacity: 0.2, backgroundColor: '#ccc' },
                isAlreadyTaken && { backgroundColor: '#fee2e2', borderColor: '#ef4444' }, // Red for "Used"
                isSelected && { backgroundColor: '#000', borderColor: '#000' },
                (!isSelected && !isAlreadyTaken && monthIsFull) && { opacity: 0.3 } // Fade out dates in a full month
              ]}
            >
              <Text style={[
                styles.dateText, 
                isSelected && {color: '#fff'}, 
                isAlreadyTaken && {color: '#b91c1c'}
              ]}>
                {d.getDate()}
              </Text>
              <Text style={[
                styles.dayText, 
                isSelected && {color: '#fff'}, 
                isAlreadyTaken && {color: '#b91c1c'}
              ]}>
                {isAlreadyTaken ? "USED" : d.toLocaleDateString('en-US', {weekday: 'short'})}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity 
        disabled={selectedFullDayLeaves.length === 0}
        style={[styles.confirmLeaveBtn, selectedFullDayLeaves.length === 0 && { backgroundColor: '#94a3b8' }]} 
        onPress={handleApplyFullDayLeave}
      >
        <Text style={styles.confirmLeaveText}>Confirm Selected Dates</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setFullDayLeaveModalVisible(false)} style={styles.modalClose}>
        <Text style={styles.modalCloseText}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  // Tab Header Styles
  tabHeader: {
    flexDirection: "row",
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 12,
    padding: 4,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  activeTab: { backgroundColor: "#6c47ff" },
  tabText: { fontWeight: "700", color: "#64748B" },
  activeTabText: { color: "#fff" },

  // Original Header Styles
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  heading: { fontSize: 22, fontWeight: "800", color: "#1E293B" },
  subHeading: { fontSize: 13, color: "#64748B", marginTop: 2 },
  listContent: { padding: 16 },

  // Calendar Specific Styles
  calendarScroll: { padding: 10 },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 15,
    color: "#1E293B",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  calendarHeaderCell: {
    width: (width - 20) / 7,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  calendarHeaderDay: { fontSize: 12, fontWeight: "800", color: "#94A3B8" },
  dayBox: {
    width: (width - 20) / 7,
    height: 110,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    padding: 4,
  },
  dayNumber: {
    fontSize: 10,
    fontWeight: "700",
    color: "#CBD5E1",
    marginBottom: 4,
  },
  miniJobsContainer: {
    flex: 1,
    overflow: "hidden",
    maxHeight: 78,
  },
  jobIndicatorStick: {
    padding: 2,
    borderRadius: 4,
    marginBottom: 2,
    minHeight: 15,
  },
  moreJobsStick: {
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  moreJobsText: {
    fontSize: 7,
    color: "#fff",
    fontWeight: "900",
  },
  jobIndicatorText: { fontSize: 6, color: "#fff", fontWeight: "900" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  modalSub: { fontSize: 13, color: "#64748B", marginBottom: 20 },
  modalInfoRow: { marginBottom: 15 },
  modalLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  modalVal: { fontSize: 14, color: "#334155", marginTop: 4 },
  modalNavBtn: {
    backgroundColor: "#6c47ff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  modalNavText: { color: "#fff", fontWeight: "800" },
  modalClose: { marginTop: 15, padding: 10, alignItems: "center" },
  modalCloseText: { color: "#ef4444", fontWeight: "700" },

  // Original Card Styles (Untouched)
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cancelledCard: { opacity: 0.8, borderColor: "#FDA4AF", borderWidth: 1 },
  priceBanner: {
    backgroundColor: "#EEF2FF",
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cancelledBanner: { backgroundColor: "#FFF1F2" },
  priceLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6366F1",
    letterSpacing: 1,
  },
  priceValue: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
  perMonthText: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  durationBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  durationText: { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  cardBody: { padding: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1E293B", flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  rightActionsColumn: { alignItems: "flex-end", gap: 8 },
  squareMapBtn: {
    width: 65,
    height: 65,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  mapThumbnail: { width: "100%", height: "100%", opacity: 0.8 },
  mapOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(108, 71, 255, 0.85)",
    paddingVertical: 2,
    alignItems: "center",
  },
  mapOverlayText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  infoRow: { marginBottom: 8 },
  infoLabel: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  infoValue: { fontSize: 14, color: "#334155", marginTop: 2 },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 5,
    marginBottom: 15,
  },
  miniTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  servicesContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 10,
  },
  serviceBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  tagContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: "#fff",
    color: "#64748B",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  footerLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  footerValue: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  payBtn: {
    backgroundColor: "#6c47ff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  payBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  settledText: { color: "#10B981", fontWeight: "700" },
  cancelledNotice: {
    marginTop: 15,
    backgroundColor: "#FFF1F2",
    padding: 10,
    borderRadius: 8,
  },
  cancelledNoticeText: {
    color: "#E11D48",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  // Today Section Styles
  todaySection: {
    padding: 16,
    backgroundColor: "#fff",
    marginBottom: 10,
    borderRadius: 20,
    marginHorizontal: 10,
    elevation: 3,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E293B",
    marginBottom: 15,
  },
  todayCard: {
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
  },
  todayJobAddr: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 12,
  },
  swipeBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  doneText: {
    color: "#10b981",
    fontWeight: "900",
    textAlign: "center",
    marginTop: 5,
  },
  noJobsText: { color: "#94A3B8", fontSize: 13, fontStyle: "italic" },

  // Scaling Day Popup Styles
  scaledDayContainer: {
    width: width * 0.85,
    minHeight: 300,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 2,
    elevation: 20,
  },
  scaledDayNumber: { fontSize: 40, fontWeight: "900", color: "#6c47ff" },
  scaledClose: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    alignItems: "center",
  },
  scaledCloseText: { fontWeight: "700", color: "#64748B" },
  incentiveBtn: {
  paddingHorizontal: 15,
  justifyContent: "center",
  alignItems: "center",
  borderLeftWidth: 1,
  borderLeftColor: "#E2E8F0",
},
weekOffDayBox: {
  backgroundColor: "#fef2f2", // Light red for holidays
  borderColor: "#fee2e2",
},
todayBox: {
  backgroundColor: "#f0fdf4", // Light green for today
  borderWidth: 2,
  borderColor: "#22c55e",
},
holidayIndicator: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
},
holidayText: {
  fontSize: 8,
  fontWeight: '900',
  color: '#f87171',
  letterSpacing: 1,
},
dailyFocusContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  daySelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navText: { color: '#6c47ff', fontWeight: 'bold', fontSize: 12 },
  focusDateChip: {
    backgroundColor: '#6c47ff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  focusDateText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  
  dailyJobCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 5,
    marginBottom: 12,
  },
  dailyJobHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dailyTimeText: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  dailyNameText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  dailyAddrText: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  
  todayTasksContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  taskTag: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  taskTagText: { fontSize: 10, color: '#4338ca', fontWeight: 'bold' },
  
  dailyGoBtn: { backgroundColor: '#6c47ff', padding: 10, borderRadius: 10, alignItems: 'center' },
  dailyGoText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  offDayBigCard: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFF1F2',
    borderRadius: 20,
  },
  bigOffEmoji: { fontSize: 40, marginBottom: 10 },
  bigOffText: { fontSize: 18, fontWeight: '900', color: '#E11D48' },
  smallOffText: { fontSize: 12, color: '#FDA4AF' },

  selectedDayBox: {
    borderWidth: 2,
    borderColor: '#6c47ff',
    backgroundColor: '#F5F3FF',
  },
  divider: { height: 10, backgroundColor: '#F1F5F9', marginVertical: 10 },

extractedDayContainer: {
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  fullWidthDayBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    elevation: 4,
  },
  innerDaySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  innerDateInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  innerDayName: { fontSize: 12, fontWeight: '700', color: '#6c47ff', textTransform: 'uppercase' },
  innerDateNumber: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  innerNavGroup: { flexDirection: 'row', gap: 10 },
  innerNavBtn: { backgroundColor: '#fff', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  innerNavText: { fontSize: 12 },

  fullWidthJobsContainer: { padding: 10 },
  fullColorRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    width: '100%',
  },

  // Column Widths for Time -> Work -> Name -> Loc
  rowTimeCol: { width: '18%' },
  rowWorkCol: { width: '42%', paddingHorizontal: 4 },
  rowNameCol: { width: '25%' },
  rowLocCol: { width: '15%', alignItems: 'flex-end' },

  wideTimeText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  wideTasksRow: { flexDirection: 'column', gap: 2 },
  wideTaskTag: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  wideNameText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  wideLocText: { fontSize: 11, color: '#fff', fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.1)', padding: 5, borderRadius: 6 },

  // Monthly View Indicator
  jobIndicatorText: { 
    fontSize: 7, 
    color: "#fff", 
    fontWeight: "900", 
    textTransform: 'uppercase' 
  },
  cardHeaderWithMenu: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
    zIndex: 10,
  },
  threeDotsBtn: {
    padding: 10,
    marginTop: -10,
  },
  threeDotsText: {
    transform: [{ rotate: '90deg' }],
    fontSize: 15,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 2,
  },
  floatingMenu: {
    position: 'absolute',
    right: 0,
    top: 30,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 5,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 140,
    zIndex: 1000,
  },
  menuOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  leaveText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 13,
  },
  leaveModalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 20,
    elevation: 20,
  },
  dateOption: {
    width: 60,
    height: 80,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#6c47ff'
  },
  dateText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  dayText: { fontSize: 12, color: '#64748b', textTransform: 'uppercase' },
  infoBox: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  infoText: { fontSize: 12, color: '#475569', marginBottom: 5, fontWeight: '600' },
  confirmLeaveBtn: {
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10
  },
  confirmLeaveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  dateOption: {
    width: (width - 100) / 4, // 4 items per row
    height: 70,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)", // Important for the dimmed background
    justifyContent: "center",
    alignItems: "center",
  },
  leaveModalContent: {
    width: '94%',
    maxHeight: '80%', // Prevents modal from going off screen
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  leaveDateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  dateOption: {
    width: (width - 100) / 4, // Makes exactly 4 columns
    height: 70,
    backgroundColor: '#f1f5f9',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 5,
  },
  confirmLeaveBtn: {
    backgroundColor: '#000',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 15,
  },
  totalDistBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalDistText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  travelStep: {
    alignItems: 'center',
    marginVertical: 4,
  },
  travelStepText: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '700',
    fontStyle: 'italic',
  },
  routeModalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 20,
    maxHeight: '80%',
    elevation: 25,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 15,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
  },
  stepDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#000',
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  stepSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  travelLine: {
    flexDirection: 'row',
    height: 50,
    gap: 15,
  },
  verticalDash: {
    width: 2,
    height: '100%',
    backgroundColor: '#e2e8f0',
    marginLeft: 7,
    borderStyle: 'dashed',
  },
  travelStats: {
    justifyContent: 'center',
  },
  travelStatsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6c47ff',
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepWorkBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepWorkText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  routeSummaryFooter: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#000',
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryVal: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 9,
    color: '#cbd5e1',
    marginTop: 15,
    fontStyle: 'italic',
  },
  reorderControls: {
    paddingRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderArrow: {
    fontSize: 18,
    color: '#94a3b8',
    paddingVertical: 5,
  },
  rowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  draggingRow: {
    opacity: 0.3,
    transform: [{ scale: 0.98 }],
    borderWidth: 2,
    borderColor: '#6c47ff',
    borderRadius: 14,
  },
  hamburgerContainer: {
    width: '10%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    color: '#fff',
    fontSize: 18,
    opacity: 0.8,
  },
  dropZonePlaceholder: {
    height: 40,
    marginVertical: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropZoneValid: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
  },
  dropZoneInvalid: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: '#ef4444',
    opacity: 0.5,
  },
  dropZoneText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#475569',
  },
  cancelReorderBtn: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  cancelReorderText: {
    color: '#fff',
    fontWeight: '800',
  },
  // Adjust column widths to accommodate the extra data
  rowTimeCol: { width: '18%' },
  rowWorkCol: { width: '40%', paddingHorizontal: 4 },
  rowNameCol: { width: '32%' }, // Slightly wider for name + button
  hamburgerContainer: {
    width: '10%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // Map Button Styling
  miniMapBtn: {
    position
: 'absolute',
    bottom: -5,
    right: 9,
    
    backgroundColor: 'rgba(0,0,0,0.15)', // Subtle dark overlay on the background color
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  miniMapText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },

  // Service Tags
  wideTasksRow: {
    flexDirection: 'column', // List services vertically
    gap: 1,
  },
  wideTaskTag: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  
  wideNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  deltaText: {
  fontSize: 11,
  fontWeight: '800',
  marginTop: 2,
},
dropZonePlaceholder: {
  height: 55, // Increased height to fit two lines of text
  marginVertical: 4,
  borderRadius: 10,
  borderWidth: 2,
  borderStyle: 'dashed',
  justifyContent: 'center',
  alignItems: 'center',
},
fullDayLeaveTrigger: {
  backgroundColor: '#000',
  marginHorizontal: 16,
  marginBottom: 15,
  padding: 15,
  borderRadius: 12,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  elevation: 2,
},
fullDayLeaveTriggerText: {
  color: '#fff',
  fontWeight: '800',
  fontSize: 14,
},
// Ensure these exist from previous steps or add them now
dateOption: {
  width: (width - 100) / 4, 
  height: 70,
  backgroundColor: '#f1f5f9',
  borderRadius: 15,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: 'transparent',
  marginBottom: 5,
},
leaveDateGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  justifyContent: 'center',
  paddingBottom: 20,
},
// --- New Theme Styles ---
  backupCard: { borderColor: '#334155', borderWidth: 1 },
  backupBanner: { backgroundColor: '#334155' },
  
  oneDayCard: { borderColor: '#1e293b', borderWidth: 1 },
  oneDayBanner: { backgroundColor: '#1e293b' },
  
  emergencyCard: { borderColor: '#b91c1c', borderWidth: 1.5 },
  emergencyBanner: { backgroundColor: '#b91c1c' },

  // --- Work Duration Styles ---
  workDurationRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 5,
  },
  miniDurationBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  miniDurationText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  // Backup (Weekday) - Dark Slate
  backupCard: { borderColor: '#334155', borderWidth: 1 },
  backupBanner: { backgroundColor: '#334155' },

  // OneDay - Black
  oneDayCard: { borderColor: '#1e293b', borderWidth: 1 },
  oneDayBanner: { backgroundColor: '#1e293b' },

  // Emergency - Red
  emergencyCard: { borderColor: '#b91c1c', borderWidth: 1.5 },
  emergencyBanner: { backgroundColor: '#b91c1c' },

  // Work Duration Badges (Row below the date badge)
  workDurationRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 5,
  },
  miniDurationBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', // Semi-transparent white
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  miniDurationText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  oneDayCard: { backgroundColor: "#000", borderColor: "#333", borderWidth: 1 },
  oneDayBanner: { backgroundColor: "#1a1a1a" },
  emergencyCard: { backgroundColor: "#fff", borderColor: "#b91c1c", borderWidth: 1.5 },
  emergencyBanner: { backgroundColor: "#b91c1c" },
  backupCard: { backgroundColor: "#fff", borderColor: "#334155", borderWidth: 1 },
  backupBanner: { backgroundColor: "#334155" },
});
export default WorkerAcceptedBookings;
