import React, { useEffect, useRef } from 'react';
import { Animated, Text, Platform, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Global } from '../utils/Global';

export const Notification = ({ notification = {}, fadeAnim, slideAnim }) => {
  const { visible = false, type = 'info', message = '' } = notification;

  // Animations (must ALWAYS exist)
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const iconMap = {
    success: { name: 'check-circle', color: Global.AppTheme.success },
    error: { name: 'error', color: Global.AppTheme.error },
    info: { name: 'info', color: Global.AppTheme.info },
  };

  const { name: iconName, color: iconColor } =
    iconMap[type] || iconMap.info;

  useEffect(() => {
    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );

    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
      ])
    );

    if (visible) {
      heartbeat.start();
      if (type === 'error') shake.start();
    } else {
      heartbeat.stop();
      shake.stop();
      scaleAnim.setValue(1);
      shakeAnim.setValue(0);
    }

    return () => {
      heartbeat.stop();
      shake.stop();
    };
  }, [visible, type]);

  const shakeRotate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          opacity: visible ? 1 : 0,
          transform: [
            { translateY: slideAnim instanceof Animated.Value ? slideAnim : 0 },
          ],
        },
      ]}
    >
      <Animated.View
        style={{
          transform: [
            { scale: scaleAnim },
            ...(type === 'error' ? [{ rotate: shakeRotate }] : []),
          ],
        }}
      >
        <Icon name={iconName} size={50} color={iconColor} />
      </Animated.View>

      <Text style={styles.message}>
        {message || 'No message provided'}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    borderRadius: 12,
    marginVertical: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Global.AppTheme.dark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  icon: {
    marginRight: 10,
  },
  message: {
    fontSize: 14,
    color: Global.AppTheme.light,
    fontWeight: '500',
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  },
});

export default Notification;
