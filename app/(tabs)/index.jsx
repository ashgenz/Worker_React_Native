import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from "react-native";
import { Dropdown } from 'react-native-element-dropdown';
import axios from "axios";
import { BOOKINGS_API_URL, WORKER_API_URL } from '../../constants/API';
// Remove { Picker } from '@react-native-picker/picker'import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// const BASE_URL = `http://192.168.0.197:5000/api/worker/bookings`;
const BASE_URL = `${BOOKINGS_API_URL}/api/worker/bookings`;

// const WORKER_DB_API = "http://192.168.0.197:8000"; 
const WORKER_DB_API = `${WORKER_API_URL}`; 

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const Home = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workerLocations, setWorkerLocations] = useState([]); 
  const [selectedSource, setSelectedSource] = useState(null); 
  const [distanceFilter, setDistanceFilter] = useState(null); 
const [workerProfile, setWorkerProfile] = useState(null); // Add this state
const [acceptedBookings, setAcceptedBookings] = useState([]);
// Helper: Convert time string "09:00 AM" to minutes from midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  // Handles formats like "09:00 AM" or "9:00-10:00 AM"
  const match = timeStr.match(/(\d+):?(\d+)?/);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2] || 0);
  const isPM = timeStr.toLowerCase().includes('pm');
  if (isPM && hours < 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Helper: Estimate travel time in minutes (assuming 25km/h avg speed)
const getTravelTimeMins = (km) => Math.round((km / 25) * 60);
const checkIfJobFits = (newJob, existingBookings, profile) => {
  const targetDateStr = new Date(newJob.Date).toISOString().split('T')[0];
  let daySlots = [];

  // 1. Gather existing slots for that day
  existingBookings.forEach(b => {
    if (new Date(b.Date).toISOString().split('T')[0] !== targetDateStr) return;
    b.services.forEach(srv => {
      const t1 = srv.TimeSlot1 || srv.JhaduTimeSlot;
      if (t1) daySlots.push({ start: parseTimeToMinutes(t1), dur: b.workDuration?.morning || 60, loc: b.location });
      if (srv.TimeSlot2) daySlots.push({ start: parseTimeToMinutes(srv.TimeSlot2), dur: b.workDuration?.evening || 60, loc: b.location });
    });
  });

  // 2. Add New Job slots
  newJob.services.forEach(srv => {
    const t1 = srv.TimeSlot1 || srv.JhaduTimeSlot;
    if (t1) daySlots.push({ start: parseTimeToMinutes(t1), dur: newJob.workDuration?.morning || 60, loc: newJob.location });
    if (srv.TimeSlot2) daySlots.push({ start: parseTimeToMinutes(srv.TimeSlot2), dur: newJob.workDuration?.evening || 60, loc: newJob.location });
  });

  // 3. Sort by start time
  daySlots.sort((a, b) => a.start - b.start);

  // 4. Sequential check with "Window" logic
  let lastFinish = 0;
  let lastLat = profile?.locations?.[0]?.lat;
  let lastLng = profile?.locations?.[0]?.lng;

  for (let slot of daySlots) {
    const travel = lastLat ? getTravelTimeMins(calculateDistance(lastLat, lastLng, slot.loc.lat, slot.loc.lng)) : 0;
    
    // Arrival must be before the window ends (Window start + 240 mins)
    const arrivalTime = lastFinish + travel;
    
    if (arrivalTime > slot.start + 240) return false;

    // The actual start is the later of arrival or window start
    const actualStart = Math.max(arrivalTime, slot.start);
    lastFinish = actualStart + slot.dur;
    lastLat = slot.loc.lat;
    lastLng = slot.loc.lng;
  }

  return true;
};

const fetchData = async () => {
  try {
    // Keep loading true if it's the very first fetch
    const token = await AsyncStorage.getItem("workerToken");
    const workerId = await AsyncStorage.getItem("workerId");
    if (!token || !workerId) return;

    // Use Promise.all to fetch everything simultaneously
    const [bookingsRes, workerDataRes, acceptedRes] = await Promise.all([
      axios.get(`${BASE_URL}/open`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${WORKER_DB_API}/workers/${workerId}`),
      axios.get(`${BOOKINGS_API_URL}/api/worker/bookings/all`, { headers: { Authorization: `Bearer ${token}` } })
    ]);

    // Update all states at once
    setBookings(bookingsRes.data);
    setWorkerProfile(workerDataRes.data);
    setAcceptedBookings(acceptedRes.data);

    // Update locations logic
    const locations = workerDataRes.data.locations || [];
    if (locations.length > 0) {
      setWorkerLocations(locations);
      setSelectedSource(prev => prev || locations[0]);
    }

  } catch (err) {
    console.error("Fetch error:", err);
  } finally {
    setLoading(false); // Only now do we stop the spinner
    setRefreshing(false);
  }
};
  // const fetchData = async () => {
  //   try {
  //     const token = await AsyncStorage.getItem("workerToken");
  //     const workerId = await AsyncStorage.getItem("workerId");
  //     if (!token || !workerId) return;

  //     // 1. Bookings
  //     const bookingsRes = await axios.get(`${BASE_URL}/open`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     setBookings(bookingsRes.data);

  //     // 2. Locations
  //     try {
  //       const workerDataRes = await axios.get(`${WORKER_DB_API}/workers/${workerId}`);
  //       const locations = workerDataRes.data.locations || [];
        
  //       if (locations.length > 0) {
  //         setWorkerLocations(locations);
          
  //         // Set default only if null
  //         setSelectedSource(prev => {
  //            if (!prev) return locations[0];
  //            // Optional: Update current selection reference if it changed in DB
  //            const stillExists = locations.find(l => l._id === prev._id);
  //            return stillExists || locations[0];
  //         });
  //       }
  //     } catch (e) {
  //       console.warn("Worker fetch error:", e.message);
  //     }
  //   } catch (err) {
  //     console.error("Fetch error:", err);
  //   } finally {
  //     setLoading(false);
  //     setRefreshing(false);
  //   }
  // };

  const savedCallback = useRef();
  useEffect(() => { savedCallback.current = fetchData; });
  useEffect(() => {
    fetchData();
    const id = setInterval(() => savedCallback.current(), 10000); 
    return () => clearInterval(id);
  }, []);

  const handleAction = async (item, action) => {
    Alert.alert("Confirm", `i here by confirm that i will be on time everyday at this work, exluding week off.and report a emergency leave 48hours before the leave. 

Do you want to ${action} this job?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Yes", onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("workerToken");
            const workerId = await AsyncStorage.getItem("workerId");
            const acceptRes = await axios.post(`${BASE_URL}/${item._id}/${action}`, {}, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (acceptRes.status === 200 || acceptRes.status === 201) {
              // Update Location
              if (item.location && item.location.lat) {
                  await axios.post(`${WORKER_DB_API}/api/internal/worker/add-location`, {
                      workerId,
                      lat: item.location.lat,
                      lng: item.location.lng,
                      label: ` ${item.CustomerName} ${item.WorkName}`,
                      bookingId: item._id
                  });
              }
              fetchData();
            }
          } catch (err) {
            Alert.alert("Error", "Action failed.");
            fetchData();
          }
      }}
    ]);
  };
  
const filteredBookings = useMemo(() => {
  if (!bookings || bookings.length === 0) return [];

  const workerId = workerProfile?._id;
  
  // 🟢 Extract the IDs of week-off backups attached to my jobs
  const myRegularBackupIds = acceptedBookings.map(b => b.backupBookingId).filter(Boolean);
  
  // 🟢 Extract the IDs of leave replacements (1day/emg) attached to my jobs
  const myLeaveReplacementIds = acceptedBookings.flatMap(acc => 
    (acc.leavesTaken || []).map(leave => leave.backupBookingId)
  ).filter(Boolean);

  const workerFullDayLeaves = (workerProfile?.fullDayLeaves || []).map(d => 
    new Date(d).toISOString().split('T')[0]
  );

  const sLat = selectedSource?.lat || selectedSource?.latitude;
  const sLng = selectedSource?.lng || selectedSource?.longitude;

  return bookings
    .map(b => {
      const bLat = b.location?.lat || b.location?.latitude;
      const bLng = b.location?.lng || b.location?.longitude;
      const dist = (sLat !== undefined && bLat !== undefined)
        ? calculateDistance(Number(sLat), Number(sLng), Number(bLat), Number(bLng))
        : 999;
      return { ...b, currentDistance: dist };
    })
    .filter(b => {
      // --- OWNERSHIP FILTERS ---
      if (workerId && b.IdWorker === workerId) return false;

      // 🟢 Hide Week-Off Backups generated from my jobs
      if (myRegularBackupIds.includes(b.bookingId)) return false;

      // 🟢 Hide Leave Replacements generated from my jobs
      if (myLeaveReplacementIds.includes(b.bookingId)) return false;

      // --- AVAILABILITY FILTERS ---
      const bookingDateStr = new Date(b.Date).toISOString().split('T')[0];
      if (workerFullDayLeaves.includes(bookingDateStr)) return false;

      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const bookingDayName = dayNames[new Date(b.Date).getDay()];
      if (workerProfile?.weekOffDay?.toLowerCase() === bookingDayName) return false;

      if (distanceFilter !== null && b.currentDistance > distanceFilter) return false;

      if (!acceptedBookings || acceptedBookings.length === 0) return true;
      return checkIfJobFits(b, acceptedBookings, workerProfile);
    })
    .sort((a, b) => a.currentDistance - b.currentDistance);
}, [bookings, selectedSource, distanceFilter, workerProfile, acceptedBookings]);


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER WITH PICKER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>📋 Open Bookings</Text>
          <Text style={styles.countText}>{filteredBookings.length} jobs available</Text>
        </View>

        {/* Picker Container */}
        <Dropdown
    style={styles.dropdown}
    placeholderStyle={styles.placeholderStyle}
    selectedTextStyle={styles.selectedTextStyle}
    containerStyle={styles.dropdownContainer} // The "HTML" list part
    itemTextStyle={styles.itemTextStyle}
    data={workerLocations}
    maxHeight={300}
    labelField="label"
    valueField="_id"
    placeholder="Select Location"
    value={selectedSource?._id}
    onChange={item => {
      setSelectedSource(item);
    }}
    // This makes it look like a professional web dropdown
    renderLeftIcon={() => (
      <Text style={{ marginRight: 5 }}>📍</Text>
    )}
  />
      </View>

      {/* FILTER TABS */}
      <View style={styles.filterContainer}>
        {[null, 1, 3, 5].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.filterBtn, distanceFilter === d && styles.activeFilterBtn]}
            onPress={() => setDistanceFilter(d)}
          >
            <Text style={[styles.filterBtnText, distanceFilter === d && styles.activeFilterText]}>
              {d === null ? "All" : `<${d}km`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredBookings}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchData(); }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Jobs Found</Text>
            <Text style={styles.emptySub}>
              {distanceFilter 
                ? `No bookings within ${distanceFilter}km of selected location.` 
                : "No open bookings available."}
            </Text>
          </View>
        }
renderItem={({ item }) => {
  // Around line 278 inside renderItem:
const type = (item.bookingType || "").toLowerCase();
const bId = (item.bookingId || "").toLowerCase();
const reqDay = (item.weekDayRequested || "").toLowerCase();

// 🟢 STRICT DETECTION
const isOneDay = type === "onedaybackup" || bId.startsWith("1day") || reqDay.length > 10;
const isEmergency = type === "emergency" || bId.startsWith("emg");
const isBackup = (type === "backup" || bId.startsWith("bkp")) && !isOneDay;
const isSpecial = isBackup || isOneDay || isEmergency;
  
  const months = item.Months || 1;
  const displayPrice = (isOneDay || isEmergency) ? item.EstimatedPrice : (item.EstimatedPrice * 0.8) / months;
const shortId = item.bookingId ? item.bookingId.slice(-6).toUpperCase() : "N/A";

  const formatTitle = () => {
    // Show ID first for easy reference
    const prefix = `[#${shortId}] `;
    if (!item.weekDayRequested) return  item.WorkName;
    
    const day = item.weekDayRequested;
    const capDay = day.charAt(0).toUpperCase() + day.slice(1);
    
    if (isOneDay || isEmergency) return `${item.WorkName}`;
    if (isBackup) return `${item.WorkName}`;
    
    return  item.WorkName;
  };

const getDurationLabel = (item) => {
// Around line 278 inside renderItem:
const type = (item.bookingType || "").toLowerCase();
const bId = (item.bookingId || "").toLowerCase();
const reqDay = (item.weekDayRequested || "").toLowerCase();

// 🟢 STRICT DETECTION
const isOneDay = type === "onedaybackup" || bId.startsWith("1day") || reqDay.length > 10;
const isEmergency = type === "emergency" || bId.startsWith("emg");
const isBackup = (type === "backup" || bId.startsWith("bkp")) && !isOneDay;
const isSpecial = isBackup || isOneDay || isEmergency;

  if (isOneDay || isEmergency) return "Duration: 1 Day";
  
  if (isBackup) {
    const displayDay = reqDay ? (reqDay.charAt(0).toUpperCase() + reqDay.slice(1)) : "Backup";
    return `4 days (Every ${displayDay})`;
  }
  
  const monthsCount = item.Months || 1;
  return `Duration: ${monthsCount} ${monthsCount > 1 ? "Months" : "Month"}`;
};

const theme = {
    card: isOneDay ? styles.oneDayCard : isEmergency ? styles.emergencyCard : isBackup ? styles.backupCard : {},
    banner: isOneDay ? styles.oneDayBanner : isEmergency ? styles.emergencyBanner : isBackup ? styles.backupBanner : {},
    label: isEmergency ? "🚨 URGENT" : isOneDay ? "⚡ 1-DAY" : isBackup ? "🛡️ BACKUP" : "Earnings",
    btn: isBackup ? '#334155' : isOneDay ? '#333' : isEmergency ? '#b91c1c' : '#6c47ff',
    // 🟢 Fix: Ensure text is white on dark cards
    textColor: isOneDay ? '#fff' : '#1A1A1A',
    subTextColor: isOneDay ? '#94a3b8' : '#7F8C8D'
  };

  return (
    <View style={[styles.card, theme.card]}>
      {/* --- PRICE BANNER --- */}
      <View style={[styles.priceBanner, theme.banner]}>
        <View>
          <Text style={[styles.priceLabel, isSpecial && { color: isOneDay ? '#94a3b8' : '#475569' }]}>
            {theme.label} {isSpecial ? "EARNINGS" : "YOUR EARNINGS"}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[styles.priceValue, isOneDay && { color: '#fff' }]}>₹{displayPrice.toFixed(0)}</Text>
            {!isSpecial && months > 1 && (
              <Text style={styles.perMonthLabel}> / month</Text>
            )}
          </View>
          
          <View style={{ marginTop: 4, flexDirection: 'row' }}>
            <View style={[styles.tag, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }]}>
              <Text style={{ fontSize: 11, color: '#475569', fontWeight: '700' }}>
                📅 {getDurationLabel(item)}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.topRightIdBadge}>
          <Text style={styles.idBadgeText}>#{shortId}</Text>
        </View>

        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>
            {item.currentDistance > 100 ? "N/A" : `${item.currentDistance.toFixed(2)} km`}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
<Text style={[styles.title, { color: theme.textColor }]}>{item.WorkName}</Text>          <View style={[styles.badge, { backgroundColor: theme.btn }]}>
            <Text style={styles.badgeText}>{isBackup ? "BACKUP" : isOneDay ? "1-DAY" : isEmergency ? "URGENT" : "OPEN"}</Text>
          </View>
        </View>

        {/* --- 🗓️ SERVICE DATE HIGHLIGHT (All Types) --- */}
        <View style={{ 
            backgroundColor: isOneDay ? '#1a1a1a' : '#fff', 
            padding: 10, 
            borderRadius: 12, 
            marginBottom: 12, 
            borderWidth: 1, 
            borderColor: isOneDay ? '#333' : '#CBD5E1', 
            borderLeftWidth: 4, 
            borderLeftColor: theme.btn 
        }}>
            <Text style={{ fontSize: 13, color: isOneDay ? '#fff' : '#1E293B', fontWeight: 'bold' }}>
              🗓️ {isBackup ? "Start Date:" : "Service Date:"} 
              <Text style={{ color: isOneDay ? '#0ea5e9' : theme.btn }}> 
                {" "}{new Date(item.Date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </Text>
            {isBackup && item.weekDayRequested && (
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '600' }}>
                    🔄 Commitment: Every {item.weekDayRequested.toUpperCase()} (4 weeks)
                </Text>
            )}
        </View>
{/* Inside renderItem in Home.jsx */}
<View style={{ flexDirection: 'row', gap: 8, marginTop: 5 }}>
  {item.workDuration?.morning > 0 && (
    <View style={[styles.tag, { backgroundColor: '#fff7ed', borderColor: '#ffedd5', borderWidth: 1 }]}>
      <Text style={{ fontSize: 10, color: '#9a3412', fontWeight: '800' }}>
        ☀️ Morning: ~{item.workDuration.morning}m
      </Text>
    </View>
  )}
  
  {item.workDuration?.evening > 0 && (
    <View style={[styles.tag, { backgroundColor: '#f0f9ff', borderColor: '#e0f2fe', borderWidth: 1 }]}>
      <Text style={{ fontSize: 10, color: '#075985', fontWeight: '800' }}>
        🌙 Evening: ~{item.workDuration.evening}m
      </Text>
    </View>
  )}
</View>
        <Text style={[styles.address, isOneDay && { color: '#94a3b8' }]}>📍 {item.address}</Text>

        {/* --- SERVICE DETAILS --- */}
        {item.services?.length > 0 && (
          <View style={styles.servicesSection}>
            <Text style={[styles.sectionHeading, { color: theme.subTextColor }]}>📋 Service Details:</Text>
            {item.services.map((srv, index) => (
              <View key={srv._id || index} style={[styles.serviceBox, isOneDay && { backgroundColor: '#1a1a1a', borderColor: '#333' }]}>
                <Text style={[styles.serviceName, { color: theme.textColor }]}>{srv.WorkName}</Text>
                <View style={styles.detailsGrid}>
                  {(srv.TimeSlot1 || srv.JhaduTimeSlot) && (
                    <Text style={styles.tag}>⏰ {srv.TimeSlot1 || srv.JhaduTimeSlot}</Text>
                  )}
                  {srv.TimeSlot2 && <Text style={styles.tag}>🌙 {srv.TimeSlot2}</Text>}

                  {srv.WorkName === "Cook Service" ? (
                    <>
                      {srv.NoOfPeople ? <Text style={styles.tag}>👥 For {srv.NoOfPeople} People</Text> : null}
                      {srv.IncludeNaashta && <Text style={styles.tag}>🥪 With Breakfast</Text>}
                    </>
                  ) : (
                    <>
                      {srv.FrequencyPerDay && <Text style={styles.tag}>🔄 {srv.FrequencyPerDay}/day </Text>}
                      {srv.JhaduFrequency && <Text style={styles.tag}>🧹 {srv.JhaduFrequency}</Text>}
                      {srv.NoOfRooms ? <Text style={styles.tag}>🛏 {srv.NoOfRooms} Rooms</Text> : null}
                      {srv.NoOfKitchen ? <Text style={styles.tag}>🍳 {srv.NoOfKitchen} Kitchen</Text> : null}
                      {srv.NoOfToilets ? <Text style={styles.tag}>🚽 {srv.NoOfToilets} Toilets</Text> : null}
                      {/* Only show frequency for normal long-term bookings */}
                      {!isSpecial && srv.FrequencyPerWeek && <Text style={styles.tag}>📅 {srv.FrequencyPerWeek}</Text>}
                      {srv.AmountOfBartan ? <Text style={styles.tag}>🍽 {srv.AmountOfBartan} Utensils</Text> : null}
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.acceptBtn, { backgroundColor: theme.btn }]}
          onPress={() => handleAction(item, "accept")}
        >
          <Text style={styles.acceptBtnText}>
            {isOneDay ? "Accept 1-Day Shift" : isBackup ? "Accept Backup Shift" : isEmergency ? "Accept Emergency" : "Accept Job"}
          </Text> 
        </TouchableOpacity>
      </View>
    </View>
  );
}}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E1E8EE',
    justifyContent: 'space-between',
    zIndex: 10 // Ensure header stays above content
  },
  heading: { fontSize: 18, fontWeight: "800", color: "#2C3E50" },
  countText: { fontSize: 11, color: "#94A3B8" },
  
  // Fixed Picker Styles
pickerWrapper: { 
    width: 160, 
    height: 42, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 8, 
    borderWidth: 1.5, 
    borderColor: '#CBD5E1', 
    justifyContent: 'center', // Centers the Picker vertically
    overflow: 'hidden', 
    position: 'relative',
    elevation: 3, 
    shadowColor: "#000", 
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 }
  },
  picker: { 
    width: '130%', 
    height: 50, // Slightly taller than container to ensure text isn't cut off
    color: '#000000', 
    marginLeft: -5,  
  },
  arrowIcon: {
    position: 'absolute',
    right: 12,
    // Remove 'top' and use this to perfectly center the arrow regardless of height
    height: '100%',
    justifyContent: 'center', 
    pointerEvents: 'none', 
  },

  filterContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', justifyContent: 'center', gap: 10 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  activeFilterBtn: { backgroundColor: '#6c47ff' },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  activeFilterText: { color: '#fff' },
  
  listContent: { padding: 16, paddingBottom: 250 },
  card: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 15, elevation: 3, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: {width: 0, height: 2} },
  priceBanner: { backgroundColor: '#EBF4FF', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#4A90E2', fontWeight: '700', fontSize: 11 },
  priceValue: { color: '#2C3E50', fontWeight: '800', fontSize: 18 },
  distanceBadge: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  distanceText: { color: '#6c47ff', fontWeight: 'bold', fontSize: 12 },
  cardBody: { padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", flex: 1 },
  address: { fontSize: 13, color: "#7F8C8D", marginBottom: 12 },
  badge: { backgroundColor: "#27AE60", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  sectionHeading: { fontSize: 12, fontWeight: "700", color: "#2C3E50", marginBottom: 8 },
  serviceBox: { backgroundColor: "#F9FBFC", padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: "#EDF2F7" },
  serviceName: { fontWeight: "700", fontSize: 13, color: "#2D3748", marginBottom: 4 },
  detailsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  serviceDetail: { fontSize: 11, color: "#718096", marginRight: 10 },
  acceptBtn: { backgroundColor: "#6c47ff", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 8 },
  acceptBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: '#94A3B8' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#2C3E50', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 40 },
  dropdown: {
    width: 160,
    height: 42,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    // Shadow
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownContainer: {
    borderRadius: 8,
    marginTop: 2,
    elevation: 5,
  },
  placeholderStyle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#000000', // Content text black
    fontWeight: '500',
  },
  itemTextStyle: {
    fontSize: 14,
    color: '#000000', // List text black
  },
  servicesSection: { marginTop: 10 },
  sectionHeading: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 5 },
  serviceBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  serviceName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  tag: { 
    backgroundColor: '#E2E8F0', 
    color: '#475569', 
    fontSize: 11, 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  backupCard: {
    backgroundColor: "#F1F5F9", // Grey background
    borderColor: "#CBD5E1",
    borderWidth: 1,
  },
  backupBanner: {
    backgroundColor: "#E2E8F0", // Darker grey banner
  },
  backupDayText: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 8,
    fontStyle: 'italic',
    backgroundColor: '#fff',
    padding: 5,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  perMonthLabel: { 
    fontSize: 12, 
    color: '#4A90E2', 
    marginLeft: 4, 
    fontWeight: '600' 
  },
  // Backup (Weekday) - Grey
  backupCard: { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1", borderWidth: 1 },
  backupBanner: { backgroundColor: "#E2E8F0" },

  // OneDayBackup - Black
  oneDayCard: { backgroundColor: "#000000", borderColor: "#333", borderWidth: 1 },
  oneDayBanner: { backgroundColor: "#1a1a1a" },

  // Emergency - Reddish
  emergencyCard: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1 },
  emergencyBanner: { backgroundColor: "#fee2e2" },
  topRightIdBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  idBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b', // Subtle slate color
    letterSpacing: 0.5,
  },
  tagWrapper: {
    marginTop: 6,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  durationTagText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
});

export default Home;