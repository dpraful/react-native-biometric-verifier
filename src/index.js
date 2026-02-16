import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  InteractionManager,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
// Custom hooks
import { useCountdown } from "./hooks/useCountdown";
import { useGeolocation } from "./hooks/useGeolocation";
import { useImageProcessing } from "./hooks/useImageProcessing";
import { useNotifyMessage } from "./hooks/useNotifyMessage";
import { useSafeCallback } from "./hooks/useSafeCallback";

// Utils
import { getDistanceInMeters } from "./utils/distanceCalculator";
import { Global } from "./utils/Global";
import networkServiceCall from "./utils/NetworkServiceCall";
import { getLoaderGif } from "./utils/getLoaderGif";

// Components
import Loader from "./components/Loader";
import { CountdownTimer } from "./components/CountdownTimer";
import { Card } from "./components/Card";
import { Notification } from "./components/Notification";
import CaptureImageWithoutEdit from "./components/CaptureImageWithoutEdit";
import StepIndicator from "./components/StepIndicator";

const BiometricModal = React.memo(
  ({ data, depKey, qrscan = false, callback, apiurl, onclose, frameProcessorFps, livenessLevel, fileurl, imageurl, navigation, duration = 100, MaxDistanceMeters = 30, antispooflevel }) => {

    // Custom hooks
    const { countdown, startCountdown, resetCountdown, pauseCountdown, resumeCountdown } = useCountdown(duration);
    const { requestLocationPermission, getCurrentLocation } = useGeolocation();
    const { convertImageToBase64 } = useImageProcessing();
    const { notification, fadeAnim, slideAnim, notifyMessage, clearNotification } = useNotifyMessage();
    const safeCallback = useSafeCallback(callback, notifyMessage);

    // State
    const [modalVisible, setModalVisible] = useState(false);
    const [cameraType, setCameraType] = useState("back");
    const [state, setState] = useState({
      isLoading: false,
      loadingType: Global.LoadingTypes.none,
      currentStep: "Start",
      employeeData: null,
      animationState: Global.AnimationStates.faceScan,
    });

    // Refs
    const dataRef = useRef(data);
    const mountedRef = useRef(true);
    const responseRef = useRef(null);
    const processedRef = useRef(false);
    const resetTimeoutRef = useRef(null);

    // Animation values
    const iconScaleAnim = useRef(new Animated.Value(1)).current;
    const iconOpacityAnim = useRef(new Animated.Value(0)).current;

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        mountedRef.current = false;

        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current);
        }

        clearNotification();
      };
    }, []);

    // Update dataRef when data changes
    useEffect(() => {
      dataRef.current = data;
    }, [data]);

    // Animation helper
    const animateIcon = useCallback(() => {
      // Reset animation
      iconScaleAnim.setValue(1);
      iconOpacityAnim.setValue(0);

      // Start animation sequence
      Animated.sequence([
        Animated.parallel([
          Animated.timing(iconOpacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(iconScaleAnim, {
            toValue: 1.2,
            friction: 3,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
    }, [iconScaleAnim, iconOpacityAnim]);

    // State update helper
    const updateState = useCallback((newState) => {
      if (mountedRef.current) {
        setState((prev) => {
          const merged = { ...prev, ...newState };

          if (JSON.stringify(prev) !== JSON.stringify(merged)) {
            // Pause/resume countdown based on loading state
            if (newState.isLoading !== undefined) {
              if (newState.isLoading) {
                pauseCountdown();
              } else {
                resumeCountdown();
              }
            }

            // Animate icon when step changes
            if (newState.currentStep && newState.currentStep !== prev.currentStep) {
              animateIcon();
            }

            return merged;
          }

          return prev;
        });
      }
    }, [animateIcon, pauseCountdown, resumeCountdown]);

    // Reset state helper
    const resetState = useCallback(() => {
      onclose(false);

      setState({
        isLoading: false,
        loadingType: Global.LoadingTypes.none,
        currentStep: "Start",
        employeeData: null,
        animationState: Global.AnimationStates.faceScan,
      });

      setModalVisible(false);
      processedRef.current = false;
      resetCountdown();
      clearNotification();

      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    }, [resetCountdown, clearNotification]);

    // Error handler
    const handleProcessError = useCallback(
      (message, errorObj = null) => {
        if (errorObj) {
          console.error("Process Error:", errorObj);
        }

        notifyMessage(message, "error");
        updateState({
          animationState: Global.AnimationStates.error,
          isLoading: false,
          loadingType: Global.LoadingTypes.none,
        });

        if (resetTimeoutRef.current) {
          clearTimeout(resetTimeoutRef.current);
        }

        resetTimeoutRef.current = setTimeout(() => {
          resetState();
        }, 1200);
      },
      [notifyMessage, resetState, updateState]
    );

    // Countdown finish handler
    const handleCountdownFinish = useCallback(() => {
      handleProcessError("Time is up! Please try again.");

      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }, [handleProcessError, navigation]);

    // API URL validation
    const validateApiUrl = useCallback(() => {
      if (!apiurl || typeof apiurl !== "string") {
        handleProcessError("Invalid API URL configuration.");
        return false;
      }

      return true;
    }, [apiurl, handleProcessError]);

    // Face scan upload
    const uploadFaceScan = useCallback(
      async (selfie) => {
        if (!validateApiUrl()) return;
        const currentData = dataRef.current;

        if (!currentData) {
          handleProcessError("Employee data not found.");
          return;
        }

        updateState({
          isLoading: true,
          loadingType: Global.LoadingTypes.faceRecognition,
          animationState: Global.AnimationStates.processing,
        });

        InteractionManager.runAfterInteractions(async () => {
          let base64;

          try {
            updateState({
              loadingType: Global.LoadingTypes.imageProcessing,
            });

            base64 = await convertImageToBase64(selfie?.uri);
          } catch (err) {
            console.error("Image conversion failed:", err);
            handleProcessError("Image conversion failed.", err);
            return;
          }

          if (!base64) {
            handleProcessError("Failed to process image.");
            return;
          }

          try {
            const body = { image: base64 };
            const header = { faceid: currentData };
            const buttonapi = `${apiurl}python/recognize`;

            updateState({
              loadingType: Global.LoadingTypes.networkRequest,
            });

            const response = await networkServiceCall(
              "POST",
              buttonapi,
              header,
              body
            );

            if (response?.httpstatus === 200 && response.data?.data) {
              responseRef.current = {
                ...responseRef.current,
                faceRecognition: response.data?.data || null,
              };
              updateState({
                employeeData: response.data?.data || null,
                animationState: Global.AnimationStates.success,
                isLoading: false,
                loadingType: Global.LoadingTypes.none,
              });

              notifyMessage("Identity verified successfully!", "success");

              safeCallback(responseRef.current);

              if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
              }

              resetTimeoutRef.current = setTimeout(() => {
                resetState();
              }, 1200);
            } else {
              handleProcessError(
                response?.data?.message ||
                "Face not recognized. Please try again."
              );
            }
          } catch (error) {
            console.error("Network request failed:", error);
            handleProcessError(
              "Connection error. Please check your network.",
              error
            );
          }
        });
      },
      [
        convertImageToBase64,
        notifyMessage,
        qrscan,
        resetState,
        updateState,
        validateApiUrl,
        safeCallback,
        handleProcessError
      ]
    );

    // QR code processing
    const handleQRScanned = useCallback(
      async (qrCodeData) => {
        if (!validateApiUrl()) return;

        updateState({
          animationState: Global.AnimationStates.processing,
          isLoading: true,
          loadingType: Global.LoadingTypes.locationVerification,
        });

        try {
          updateState({
            loadingType: Global.LoadingTypes.locationPermission,
          });

          const hasPermission = await requestLocationPermission();

          if (!hasPermission) {
            handleProcessError("Location permission not granted.");
            return;
          }

          const qrString =
            typeof qrCodeData === "object" ? qrCodeData?.data : qrCodeData;

          if (!qrString || typeof qrString !== "string") {
            handleProcessError("Invalid QR code. Please try again.");
            return;
          }

          updateState({
            loadingType: Global.LoadingTypes.gettingLocation,
          });

          const location = await getCurrentLocation();

          const [latStr, lngStr, qrKey] = qrString.split(",");
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);
          const validCoords = !isNaN(lat) && !isNaN(lng);
          const validDev =
            !isNaN(location?.latitude) && !isNaN(location?.longitude);

          if (validCoords && validDev) {
            updateState({
              loadingType: Global.LoadingTypes.calculateDistance,
            });

            const distance = getDistanceInMeters(
              lat,
              lng,
              location.latitude,
              location.longitude
            );

            if (distance <= MaxDistanceMeters && qrKey === depKey) {
              responseRef.current = location
              notifyMessage("Location verified successfully!", "success");

              updateState({
                animationState: Global.AnimationStates.success,
                isLoading: false,
                loadingType: Global.LoadingTypes.none,
              });
              setTimeout(() => handleStartFaceScan(), 1200);

            } else {
              handleProcessError(
                `Location mismatch (${distance.toFixed(0)}m away).`
              );
            }
          } else {
            handleProcessError("Invalid coordinates in QR code.");
          }
        } catch (error) {
          console.error("Location verification failed:", error);
          handleProcessError(
            "Unable to verify location. Please try again.",
            error
          );
        }
      },
      [
        getCurrentLocation,
        notifyMessage,
        requestLocationPermission,
        resetState,
        updateState,
        validateApiUrl,
        handleProcessError
      ]
    );

    // Image capture handler
    const handleImageCapture = useCallback(
      async (capturedData) => {
        if (state.currentStep === "Identity Verification") {
          uploadFaceScan(capturedData);
        } else if (state.currentStep === "Location Verification") {
          handleQRScanned(capturedData);
        }
      },
      [state.currentStep, uploadFaceScan, handleQRScanned]
    );

    // Start face scan
    const handleStartFaceScan = useCallback(() => {
      updateState({
        currentStep: "Identity Verification",
        animationState: Global.AnimationStates.faceScan,
      });
      setCameraType("front");
    }, [updateState]);

    // Start QR code scan
    const startQRCodeScan = useCallback(() => {
      updateState({
        currentStep: "Location Verification",
        animationState: Global.AnimationStates.qrScan,
      });
      setCameraType("back");
    }, [updateState]);

    // Start the verification process
    const startProcess = useCallback(() => {
      startCountdown(handleCountdownFinish);
      if (qrscan) {
        startQRCodeScan()
      } else {
        handleStartFaceScan();
      }
    }, [handleCountdownFinish, handleStartFaceScan, startCountdown, startQRCodeScan]);

    // Open modal when data is received
    useEffect(() => {
      if (data && !modalVisible && !processedRef.current) {
        processedRef.current = true;
        setModalVisible(true);
        startProcess();
      }
    }, [data, modalVisible, startProcess]);

    // Determine if camera should be shown
    const shouldShowCamera =
      (state.currentStep === "Identity Verification" ||
        state.currentStep === "Location Verification") &&
      state.animationState !== Global.AnimationStates.success &&
      state.animationState !== Global.AnimationStates.error;

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetState}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          {/* Camera component - full screen */}
          {shouldShowCamera && !state.isLoading && (
            <View style={styles.cameraContainer}>
              <CaptureImageWithoutEdit
                cameraType={cameraType}
                onCapture={handleImageCapture}
                showCodeScanner={state.currentStep === "Location Verification"}
                isLoading={state.isLoading}
                frameProcessorFps={frameProcessorFps}
                livenessLevel={livenessLevel}
                antispooflevel={antispooflevel}
              />
            </View>
          )}

          {/* UI elements positioned absolutely on top of camera */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={resetState}
            accessibilityLabel="Close modal"
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Icon name="close" size={24} color={Global.AppTheme.light} />
          </TouchableOpacity>

          <View style={styles.topContainer}>
            {!shouldShowCamera && (
              <View style={styles.headerContainer}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Biometric Verification</Text>
                  <Text style={styles.subtitle}>{state.currentStep}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.topContainerstep}>
            <StepIndicator currentStep={state.currentStep} qrscan={qrscan} />
          </View>

          {state.employeeData && (
            <View style={styles.cardContainer}>
              <Card employeeData={state.employeeData} apiurl={apiurl} fileurl={fileurl} />
            </View>
          )}

          <View style={styles.notificationContainer}>
            <Notification
              notification={notification}
              fadeAnim={fadeAnim}
              slideAnim={slideAnim}
            />
          </View>

          <View style={styles.timerContainer}>
            <CountdownTimer
              duration={Global.CountdownDuration}
              currentTime={countdown}
            />
          </View>
          <Loader
            state={state}
            gifSource={getLoaderGif(state.animationState, state.currentStep, apiurl, imageurl)}
          />
        </View>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Global.AppTheme.modalBackground || 'rgba(0, 0, 0, 0.85)',
  },
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  topContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  topContainerstep: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    zIndex: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 10
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Global.AppTheme.textLight || Global.AppTheme.light,
    marginBottom: 5,
    textAlign: 'left',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 18,
    color: Global.AppTheme.textLight || Global.AppTheme.light,
    marginBottom: 0,
    fontWeight: '600',
    textAlign: 'left',
    opacity: 0.9,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-medium',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
    zIndex: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 8,
  },
  cardContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  notificationContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  timerContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});

export default BiometricModal;