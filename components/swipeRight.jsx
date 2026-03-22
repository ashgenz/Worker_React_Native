import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';

const SwipeButton = ({ onComplete, title, color }) => {
  // 1. FIX: Use a Ref instead of State so PanResponder can read it!
  const trackWidthRef = useRef(0); 
  const pan = useRef(new Animated.Value(0)).current;

  // Sizing constants
  const KNOB_SIZE = 50;
  const PADDING = 4;

  const panResponder = useRef(
    PanResponder.create({
      // 2. FIX: Ensure it grabs the touch immediately
      onStartShouldSetPanResponder: () => true, 
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5;
      },
      
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      },
      
      onPanResponderMove: (_, gestureState) => {
        // 3. FIX: Read from the current ref!
        if (trackWidthRef.current === 0) return; 
        
        const MAX_SWIPE = trackWidthRef.current - KNOB_SIZE - (PADDING * 2);
        
        // BOUNDARY LOCK: Forces the knob to stay inside the track
        let newX = gestureState.dx;
        if (newX < 0) newX = 0; 
        if (newX > MAX_SWIPE) newX = MAX_SWIPE; 
        
        pan.setValue(newX);
      },
      
      onPanResponderRelease: (_, gestureState) => {
        // 4. FIX: Read from the current ref!
        if (trackWidthRef.current === 0) return;
        
        const MAX_SWIPE = trackWidthRef.current - KNOB_SIZE - (PADDING * 2);
        
        // TRIGGER SUCCESS: Must swipe 75% of the way
        if (gestureState.dx >= MAX_SWIPE * 0.75) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          
          Animated.timing(pan, {
            toValue: MAX_SWIPE,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            onComplete(); 
            pan.setValue(0); // Instantly resets back to the start
          });
        } 
        // TRIGGER FAIL: Bounce back
        else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      }
    })
  ).current;

  return (
    <View 
      style={[styles.track, { backgroundColor: color + '20' }]}
      onLayout={(event) => {
        // 5. FIX: Update the Ref dynamically so it never goes out of bounds
        trackWidthRef.current = event.nativeEvent.layout.width;
      }}
    >
      <Text style={[styles.title, { color: color }]}>{title}</Text>
      
      <Animated.View
        style={[
          styles.knob, 
          { backgroundColor: color, transform: [{ translateX: pan }] }
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.arrow}>→</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    padding: 4, 
    width: '100%', 
    position: 'relative',
    marginVertical: 10,
  },
  title: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
    zIndex: -1, 
  },
  knob: {
    width: 50, 
    height: 50, 
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  arrow: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  }
});

export default SwipeButton;