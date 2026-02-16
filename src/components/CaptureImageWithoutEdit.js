import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import {
  Camera,
  getCameraDevice,
  useCodeScanner,
  useCameraFormat,
} from 'react-native-vision-camera';
import { Global } from '../utils/Global';
import { useFaceDetectionFrameProcessor } from '../hooks/useFaceDetectionFrameProcessor';

const CaptureImageWithoutEdit = React.memo(
  ({
    cameraType = 'front',
    onCapture,
    showCodeScanner = false,
    isLoading = false,
    frameProcessorFps = 1,
    livenessLevel = 0,
    antispooflevel,
  }) => {
    const cameraRef = useRef(null);
    const [cameraDevice, setCameraDevice] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraInitialized, setCameraInitialized] = useState(false);
    const [currentCameraType, setCurrentCameraType] = useState(cameraType);
    const [isInitializing, setIsInitializing] = useState(true);

    const [faces, setFaces] = useState([]);
    const [livenessStep, setLivenessStep] = useState(0);
    const [blinkCount, setBlinkCount] = useState(0);
    const [progress, setProgress] = useState(0);
    const [faceCount, setFaceCount] = useState(0);
    const [isFaceLive, setIsFaceLive] = useState(false);
    const [antiSpoofConfidence, setAntiSpoofConfidence] = useState(0);
    const [isFaceCentered, setIsFaceCentered] = useState(false);
    const [hasSingleFace, setHasSingleFace] = useState(false);

    const captured = useRef(false);
    const isMounted = useRef(true);

    const instructionAnim = useRef(new Animated.Value(1)).current;
    const liveIndicatorAnim = useRef(new Animated.Value(0)).current;

    const resetCaptureState = useCallback(() => {
      captured.current = false;
      setFaces([]);
      setLivenessStep(0);
      setBlinkCount(0);
      setProgress(0);
      setFaceCount(0);
      setIsFaceLive(false);
      setAntiSpoofConfidence(0);
      setIsFaceCentered(false);
      setHasSingleFace(false);
    }, []);

    const codeScanner = useCodeScanner({
      codeTypes: ['qr', 'ean-13'],
      onCodeScanned: (codes) => {
        try {
          if (showCodeScanner && codes && codes[0]?.value && !isLoading) {
            onCapture(codes[0].value);
          }
        } catch (error) {
          console.error('Error processing scanned code:', error);
        }
      },
    });

    const onStableFaceDetected = useCallback(
      async (faceRect) => {
        if (!isMounted.current) return;
        if (captured.current) return;

        captured.current = true;
        setFaces([faceRect]);

        try {
          if (!cameraRef.current) {
            throw new Error('Camera ref not available');
          }

          const photo = await cameraRef.current.takePhoto({
            flash: 'off',
            qualityPrioritization: 'quality',
            enableShutterSound: false,
            skipMetadata: true,
          });

          if (!photo || !photo.path) {
            throw new Error('Failed to capture photo - no path returned');
          }

          const photopath = `file://${photo.path}`;
          const fileName = photopath.substr(photopath.lastIndexOf('/') + 1);
          const photoData = {
            uri: photopath,
            filename: fileName,
            filetype: 'image/jpeg',
          };

          onCapture(photoData, faceRect);
        } catch (e) {
          console.error('Capture error:', e);
          captured.current = false;
          resetCaptureState();
        }
      },
      [onCapture, resetCaptureState]
    );

    const onFacesUpdate = useCallback((payload) => {
      if (!isMounted.current) return;
      try {
        const { count, progress, antiSpoofState } = payload;
        setFaceCount(count);
        setProgress(progress);

        // Update anti-spoof related states
        if (antiSpoofState) {
          setIsFaceLive(antiSpoofState.isLive || false);
          setAntiSpoofConfidence(antiSpoofState.confidence || 0);
          setIsFaceCentered(antiSpoofState.isFaceCentered || false);
          setHasSingleFace(antiSpoofState.hasSingleFace || false);
        }

        if (count === 1) {
          setFaces((prev) => {
            if (prev.length === 1) return prev;
            return [{ x: 0, y: 0, width: 0, height: 0 }];
          });
        } else {
          setFaces([]);
        }
      } catch (error) {
        console.error('Error updating faces:', error);
      }
    }, []);

    const onLivenessUpdate = useCallback(
      (step, extra) => {
        setLivenessStep(step);
        if (extra?.blinkCount !== undefined) setBlinkCount(extra.blinkCount);

        instructionAnim.setValue(0);
        Animated.timing(instructionAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      },
      [instructionAnim]
    );

    const onAntiSpoofUpdate = useCallback((result) => {
      if (!isMounted.current) return;
      try {
        // Animate live indicator when face becomes live
        if (result?.isLive && !isFaceLive) {
          Animated.spring(liveIndicatorAnim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }).start();
        } else if (!result?.isLive && isFaceLive) {
          Animated.timing(liveIndicatorAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }

        setIsFaceLive(result?.isLive || false);
        setAntiSpoofConfidence(result?.confidence || 0);
        setIsFaceCentered(result?.isFaceCentered || false);
      } catch (error) {
        console.error('Error updating anti-spoof:', error);
      }
    }, [isFaceLive, liveIndicatorAnim]);

    const {
      frameProcessor,
      forceResetCaptureState,
      updateShowCodeScanner,
      updateIsActive,
      capturedSV,
    } = useFaceDetectionFrameProcessor({
      onStableFaceDetected,
      onFacesUpdate,
      onLivenessUpdate,
      onAntiSpoofUpdate,
      showCodeScanner,
      isLoading,
      isActive: showCamera && cameraInitialized,
      livenessLevel: livenessLevel,
      antispooflevel,
    });

    useEffect(() => {
      if (capturedSV?.value && !captured.current) {
        captured.current = true;
      } else if (!capturedSV?.value && captured.current) {
        captured.current = false;
      }
    }, [capturedSV?.value]);

    const getPermission = useCallback(async () => {
      try {
        if (!isMounted.current) return;

        setIsInitializing(true);
        setShowCamera(false);

        const newCameraPermission = await Camera?.requestCameraPermission();
        if (newCameraPermission === 'granted') {
          let devices = await Camera?.getAvailableCameraDevices();

          // Retry once after short delay if no devices found
          if (!devices || devices.length === 0) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            devices = await Camera?.getAvailableCameraDevices();
          }

          if (!devices || devices.length === 0) {
            throw new Error('No camera devices available');
          }

          const device = getCameraDevice(devices, currentCameraType);
          if (!device) throw new Error(`No ${currentCameraType} camera available`);

          setCameraDevice(device);
          setShowCamera(true);
        } else {
          console.warn('Camera permission not granted');
        }
      } catch (error) {
        console.error('Camera permission error:', error);
        setShowCamera(false);
      } finally {
        if (isMounted.current) {
          setIsInitializing(false);
        }
      }
    }, [currentCameraType]);

    const initializeCamera = useCallback(async () => {
      await getPermission();
    }, [getPermission]);

    useEffect(() => {
      isMounted.current = true;

      const initOnMount = async () => {
        try {
          await initializeCamera();
        } catch (error) {
          console.error('Failed to initialize camera on mount:', error);
        }
      };

      initOnMount();

      return () => {
        isMounted.current = false;
        setShowCamera(false);
        forceResetCaptureState();
      };
    }, [initializeCamera, forceResetCaptureState]);

    useEffect(() => {
      updateIsActive(showCamera && cameraInitialized);
    }, [showCamera, cameraInitialized, updateIsActive]);

    useEffect(() => {
      if (cameraType !== currentCameraType) {
        setCurrentCameraType(cameraType);
        initializeCamera();
      }
    }, [cameraType, currentCameraType, initializeCamera]);

    const format = useCameraFormat(cameraDevice, [
      { fps: 30 },
    ]);

    useEffect(() => {
      try {
        updateShowCodeScanner(!!showCodeScanner);
        if (showCodeScanner && captured.current) {
          forceResetCaptureState();
          resetCaptureState();
        }
      } catch (error) {
        console.error('Error updating code scanner:', error);
      }
    }, [
      showCodeScanner,
      updateShowCodeScanner,
      forceResetCaptureState,
      resetCaptureState,
    ]);

    const handleRetry = useCallback(async () => {
      try {
        setShowCamera(false);
        setCameraInitialized(false);
        forceResetCaptureState();
        resetCaptureState();
        await initializeCamera();
      } catch (error) {
        console.error('Retry failed:', error);
      }
    }, [initializeCamera, resetCaptureState, forceResetCaptureState]);

    const getInstruction = useCallback(() => {
      if (faceCount > 1) {
        return 'Multiple faces detected';
      }

      if (!hasSingleFace) {
        return 'Position your face in the frame';
      }

      if (!isFaceCentered) {
        return 'Center your face in the frame';
      }

      if (livenessLevel === 0) {
        if (!isFaceLive) return 'Verifying liveness...';
        if (progress < 100) return 'Hold still...';
        return 'Perfect! Capturing...';
      }

      if (livenessLevel === 1) {
        switch (livenessStep) {
          case 0:
            return 'Face the camera straight';
          case 1:
            if (!isFaceLive) return 'Verifying liveness...';
            return `Blink your eyes ${blinkCount} of 3 times`;
          case 2:
            if (!isFaceLive) return 'Verifying liveness...';
            if (progress < 100) return 'Hold still...';
            return 'Perfect! Capturing...';
          default:
            return 'Align your face in frame';
        }
      }

      return 'Align your face in frame';
    }, [
      livenessLevel,
      livenessStep,
      blinkCount,
      progress,
      faceCount,
      hasSingleFace,
      isFaceCentered,
      isFaceLive,
    ]);

    const getInstructionContainerStyle = useCallback(() => {
      const baseStyle = [
        styles.instructionContainer,
        {
          opacity: instructionAnim,
          transform: [
            {
              translateY: instructionAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ];

      if (faceCount > 1) {
        return [...baseStyle, styles.errorInstructionContainer];
      }

      if (isFaceLive) {
        return [...baseStyle, styles.liveInstructionContainer];
      }

      if (hasSingleFace && isFaceCentered) {
        return [...baseStyle, styles.verifyingInstructionContainer];
      }

      return baseStyle;
    }, [faceCount, isFaceLive, hasSingleFace, isFaceCentered, instructionAnim]);

    const getInstructionStyle = useCallback(() => {
      if (faceCount > 1) {
        return [styles.instructionText, styles.errorInstructionText];
      }

      if (isFaceLive) {
        return [styles.instructionText, styles.liveInstructionText];
      }

      return styles.instructionText;
    }, [faceCount, isFaceLive]);

    const getStepConfig = useCallback(() => {
      switch (livenessLevel) {
        case 0:
          return { totalSteps: 0, showSteps: false };
        case 1:
          return { totalSteps: 1, showSteps: true };
        default:
          return { totalSteps: 0, showSteps: false };
      }
    }, [livenessLevel]);

    const stepConfig = getStepConfig();

    return (
      <View style={styles.container}>
        <View style={styles.cameraContainer}>
          {!isInitializing && showCamera && cameraDevice ? (
            <Camera
              ref={cameraRef}
              style={styles.camera}
              device={cameraDevice}
              isActive={cameraInitialized && showCamera && !isLoading}
              photo={true}
              format={cameraDevice ? format : undefined}
              codeScanner={showCodeScanner && cameraInitialized ? codeScanner : undefined}
              enableZoomGesture={false}
              lowLightBoost={cameraDevice?.supportsLowLightBoost}
              frameProcessor={
                !showCodeScanner && cameraInitialized ? frameProcessor : undefined
              }
              frameProcessorFps={frameProcessorFps}
              onInitialized={() => {
                setCameraInitialized(true);
              }}
              onError={(error) => {
                console.error('Camera error:', error);
              }}
              exposure={0}
              pixelFormat="yuv"
              preset="photo"
              orientation="portrait"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              {isInitializing && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Global.AppTheme.primary} />
                  <Text style={styles.placeholderText}>Initializing camera...</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
                accessibilityLabel="Retry camera initialization"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showCodeScanner && showCamera && cameraDevice && livenessLevel === 1 && (
            <View style={styles.livenessContainer}>
              <Animated.View style={getInstructionContainerStyle()}>
                <Text style={getInstructionStyle()}>{getInstruction()}</Text>
              </Animated.View>

              {livenessStep === 1 && (
                <View style={styles.blinkProgressContainer}>
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.blinkDot,
                        blinkCount >= i && styles.blinkDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}

              {stepConfig.showSteps && faceCount <= 1 && (
                <>
                  <View style={styles.stepsContainer}>
                    {Array.from({ length: stepConfig.totalSteps + 1 }).map(
                      (_, step) => (
                        <React.Fragment key={step}>
                          <View
                            style={[
                              styles.stepIndicator,
                              livenessStep > step
                                ? styles.stepCompleted
                                : livenessStep === step
                                  ? styles.stepCurrent
                                  : styles.stepPending,
                            ]}
                          >
                            <Text style={styles.stepText}>{step + 1}</Text>
                          </View>
                          {step < stepConfig.totalSteps && (
                            <View
                              style={[
                                styles.stepConnector,
                                livenessStep > step
                                  ? styles.connectorCompleted
                                  : {},
                              ]}
                            />
                          )}
                        </React.Fragment>
                      )
                    )}
                  </View>

                  <View style={styles.stepLabelsContainer}>
                    {livenessLevel === 1 && (
                      <>
                        <Text style={styles.stepLabel}>Center</Text>
                        <Text style={styles.stepLabel}>Blink</Text>
                      </>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

          {!showCodeScanner && showCamera && cameraDevice && livenessLevel === 0 && (
            <View style={styles.livenessContainer}>
              <Animated.View style={getInstructionContainerStyle()}>
                <Text style={getInstructionStyle()}>{getInstruction()}</Text>
              </Animated.View>
              {isFaceCentered && (
                <View style={styles.confidenceContainer}>
                  <Text style={styles.confidenceText}>
                    Confidence: {Math.round(antiSpoofConfidence * 100)}%
                  </Text>
                  <View style={styles.confidenceBar}>
                    <View
                      style={[
                        styles.confidenceProgress,
                        {
                          width: `${antiSpoofConfidence * 100}%`,
                          backgroundColor: antiSpoofConfidence * 100 > 40
                            ? Global.AppTheme.success
                            : antiSpoofConfidence * 100 > 20
                              ? Global.AppTheme.warning
                              : Global.AppTheme.error
                        }
                      ]}
                    />
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }
);

CaptureImageWithoutEdit.displayName = 'CaptureImageWithoutEdit';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Global.AppTheme.dark,
    minHeight: 300,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    color: Global.AppTheme.light,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  retryButton: {
    backgroundColor: Global.AppTheme.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  retryButtonText: {
    color: Global.AppTheme.light,
    fontWeight: 'bold',
  },
  livenessContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  liveInstructionContainer: {
    backgroundColor: Global.AppTheme.success,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  verifyingInstructionContainer: {
    backgroundColor: Global.AppTheme.warning,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorInstructionContainer: {
    backgroundColor: Global.AppTheme.error,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  liveInstructionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  errorInstructionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Live Indicator
  liveIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: Global.AppTheme.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  liveIndicatorInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 6,
  },
  liveIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Status Overview
  statusOverview: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusGood: {
    backgroundColor: Global.AppTheme.success,
  },
  statusPending: {
    backgroundColor: '#666',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
  },
  confidenceContainer: {
    marginTop: 8,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  confidenceBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceProgress: {
    height: '100%',
    borderRadius: 2,
  },
  // Existing styles
  blinkProgressContainer: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  blinkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#555',
    marginHorizontal: 4,
  },
  blinkDotActive: {
    backgroundColor: Global.AppTheme.success,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  stepCompleted: {
    backgroundColor: Global.AppTheme.primary,
    borderColor: Global.AppTheme.primary,
  },
  stepCurrent: {
    backgroundColor: Global.AppTheme.primary,
    borderColor: Global.AppTheme.primary,
    opacity: 0.7,
  },
  stepPending: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  stepText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
  connectorCompleted: {
    backgroundColor: Global.AppTheme.primary,
  },
  stepLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 5,
  },
  stepLabel: {
    color: 'white',
    fontSize: 12,
    opacity: 0.8,
    textAlign: 'center',
    flex: 1,
  },
  stabilityContainer: {
    alignItems: 'center',
    width: '100%',
  },
  stabilityBar: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  stabilityProgress: {
    height: '100%',
    backgroundColor: Global.AppTheme.primary,
    borderRadius: 3,
  },
});

export default CaptureImageWithoutEdit;