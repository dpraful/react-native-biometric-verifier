import { useState, useRef, useCallback } from 'react';
import {
  Animated,
  Vibration,
  DeviceEventEmitter,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import { Global } from '../utils/Global';

export const useNotifyMessage = () => {
  const [notification, setNotification] = useState({
    visible: false,
    message: '',
    type: 'info',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const timeoutRef = useRef(null);

  // Styles for notification container based on type
  const getNotificationStyle = useCallback((type) => {
    let backgroundColor = Global.AppTheme.info;
    if (type === 'success') backgroundColor = Global.AppTheme.success;
    if (type === 'error') backgroundColor = Global.AppTheme.error;

    return {
      position: 'absolute',
      top: 20,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor,
      borderRadius: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      minWidth: 200,
      maxWidth: '90%',
    };
  }, []);

  // Styles for notification text
  const notificationTextStyle = useCallback(() => ({
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  }), []);

  const clearNotification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    fadeAnim.setValue(0);
    slideAnim.setValue(-20);

    setNotification({ visible: false, message: '', type: 'info' });
  }, [fadeAnim, slideAnim]);

  const showNotification = useCallback((message, type = 'info') => {
    clearNotification();

    setNotification({ visible: true, message, type });

    fadeAnim.setValue(0);
    slideAnim.setValue(-20);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      timeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(slideAnim, {
            toValue: 20,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start(() => {
          timeoutRef.current = null;
          setNotification({ visible: false, message: '', type: 'info' });
        });
      }, 3000);
    });
  }, [fadeAnim, slideAnim, clearNotification]);

  const notifyMessage = useCallback(
    (msg, type = 'info') => {
      try {
        if (type === 'error' || type === 'success') {
          Vibration.vibrate(100);
        }

        showNotification(msg, type);

        DeviceEventEmitter.emit('event.testToast', {
          displaytext: msg,
          datavalue: type,
        });

        if (Platform.OS === 'android') {
          ToastAndroid.showWithGravityAndOffset(
            msg,
            ToastAndroid.LONG,
            ToastAndroid.BOTTOM,
            0,
            80
          );
        } else {
          Alert.alert(type.toUpperCase(), msg);
        }
      } catch (error) {
        console.error('Error in notifyMessage:', error);
      }
    },
    [showNotification]
  );

  return {
    notification,
    fadeAnim,
    slideAnim,
    notifyMessage,
    clearNotification,
    getNotificationStyle,
    notificationTextStyle,
  };
};
