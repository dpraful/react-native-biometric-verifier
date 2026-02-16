// components/StepIndicator.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Global } from '../utils/Global';

const StepIndicator = ({ currentStep, qrscan }) => {
  return (
    <View style={styles.statusContainer}>
      {qrscan && (
        <>
          <View style={styles.statusItem}>
            <Icon
              name="location-on"
              size={20}
              color={
                currentStep === "Location Verification" ||
                  currentStep === "Complete"
                  ? Global.AppTheme.light
                  : Global.AppTheme.primary
              }
              style={styles.statusIcon}
            />
            <Text
              style={[
                styles.statusText,
                (currentStep === "Location Verification" ||
                  currentStep === "Complete") && styles.statusTextActive,
              ]}
            >
              QR
            </Text>
          </View>
          <View style={styles.statusSeparator} />
        </>
      )}

      {/* Identity Step */}
      <View style={styles.statusItem}>
        <Icon
          name="face"
          size={20}
          color={
            currentStep === "Identity Verification" ||
              currentStep === "Location Verification" ||
              currentStep === "Complete"
              ? Global.AppTheme.light
              : Global.AppTheme.primary
          }
          style={styles.statusIcon}
        />
        <Text
          style={[
            styles.statusText,
            (currentStep === "Identity Verification" ||
              currentStep === "Location Verification" ||
              currentStep === "Complete") && styles.statusTextActive,
          ]}
        >
          ID
        </Text>
      </View>

      {/* Show Location only if qrscan = true */}

    </View>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statusItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    marginBottom: 5,
  },
  statusText: {
    fontSize: 12,
    color: Global.AppTheme.light,
    opacity: 0.6,
  },
  statusTextActive: {
    opacity: 1,
    fontWeight: '600',
  },
  statusSeparator: {
    width: 40,
    height: 1,
    backgroundColor: Global.AppTheme.light,
    opacity: 0.3,
    marginHorizontal: 15,
  },
});

export default StepIndicator;
