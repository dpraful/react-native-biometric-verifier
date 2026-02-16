import { useCallback } from 'react';
import {
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';

/**
 * High-accuracy geolocation hook with GPS warm-up
 *
 * @param {Function} notifyMessage - (message, type) => void
 */
export const useGeolocation = (notifyMessage) => {
  /**
   * Request location permission (Android only)
   */
  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const fineGranted =
        result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED;

      if (!fineGranted) {
        notifyMessage?.(
          'Precise location permission is required for accurate location.',
          'error'
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Permission error:', error);
      notifyMessage?.('Location permission error.', 'error');
      return false;
    }
  }, [notifyMessage]);

  /**
   * Get current location with GPS warm-up
   */
  const getCurrentLocation = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return reject('Permission denied');
      }

      let watchId = null;
      let timeoutId = null;

      const cleanup = () => {
        if (watchId !== null) {
          Geolocation.clearWatch(watchId);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      // Safety timeout (avoid infinite GPS wait)
      timeoutId = setTimeout(() => {
        cleanup();
        notifyMessage?.(
          'Unable to get accurate location. Please try again outdoors.',
          'error'
        );
        reject('Location timeout');
      }, 25000);

      watchId = Geolocation.watchPosition(
        (position) => {
          const { accuracy } = position.coords;

          /**
           * Accept the location only when GPS is accurate enough
           * Typical threshold: 15–25 meters
           */
          if (accuracy && accuracy <= 20) {
            cleanup();
            resolve(position.coords);
          }
        },
        (error) => {
          cleanup();

          // GPS disabled
          if (error.code === 2) {
            notifyMessage?.(
              'Please enable GPS for accurate location.',
              'warning'
            );
            Linking.openSettings();
          } else {
            notifyMessage?.('Unable to fetch location.', 'error');
          }

          reject(error);
        },
        {
          enableHighAccuracy: true,
          accuracy: {
            android: 'high',
            ios: 'best',
          },
          distanceFilter: 0,
          interval: 1000,
          fastestInterval: 500,
          forceRequestLocation: true,
          showLocationDialog: true,
          maximumAge: 0,
        }
      );
    });
  }, [notifyMessage, requestLocationPermission]);

  return {
    requestLocationPermission,
    getCurrentLocation,
  };
};
