import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { Global } from '../utils/Global';

export const CountdownTimer = ({ duration, currentTime }) => {
  const progress = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current; // for pulsing effect

  useEffect(() => {
    Animated.timing(progress, {
      toValue: currentTime / duration,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [currentTime, duration, progress]);

  // Pulse animation only in last 10 seconds
  useEffect(() => {
    if (currentTime <= 10 && currentTime > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1); // reset
    }
  }, [currentTime, pulseAnim]);

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  // Change color when < 10 seconds
  const isEnding = currentTime <= 10;
  const circleColor = isEnding ? 'red' : Global.AppTheme.light;
  const textColor = isEnding ? 'red' : Global.AppTheme.light;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.timerWrapper,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Animated.View style={styles.animatedWrapper}>
          <Animated.View
            style={[
              styles.progressCircle,
              {
                strokeDashoffset,
                transform: [{ rotate: '-90deg' }],
                borderColor: circleColor,
                borderLeftColor: 'transparent',
                borderBottomColor: 'transparent',
              },
            ]}
          />
        </Animated.View>
        <Text style={[styles.timeText, { color: textColor }]}>
          {currentTime}s
        </Text>
      </Animated.View>
      <Text style={[styles.remainingText, { color: textColor }]}>
        Remaining
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    alignItems: 'center',
  },
  timerWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  animatedWrapper: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  progressCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
  },
  timeText: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium',
  },
  remainingText: {
    fontSize: 14,
    marginTop: 5,
    opacity: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
});
