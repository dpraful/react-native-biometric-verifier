import { useCallback, useMemo, useEffect, useRef } from 'react';
import { Worklets } from 'react-native-worklets-core';
import { useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import {
  faceAntiSpoofFrameProcessor,
  initializeFaceAntiSpoof,
  isFaceAntiSpoofAvailable,
} from 'react-native-vision-camera-spoof-detector';

// Optimized constants - tuned for performance
const FACE_STABILITY_THRESHOLD = 3;
const FACE_MOVEMENT_THRESHOLD = 15;
const FRAME_PROCESSOR_MIN_INTERVAL_MS = 500;
const MIN_FACE_SIZE = 0.2;

// Blink detection
const BLINK_THRESHOLD = 0.3;
const REQUIRED_BLINKS = 3;

// Anti-spoofing
const REQUIRED_CONSECUTIVE_LIVE_FRAMES = 3;

// Face centering
const FACE_CENTER_THRESHOLD_X = 0.2;
const FACE_CENTER_THRESHOLD_Y = 0.15;
const MIN_FACE_CENTERED_FRAMES = 2;

// Performance optimization constants
const MAX_FRAME_PROCESSING_TIME_MS = 500;
const BATCH_UPDATE_THRESHOLD = 3;
const REAL_LAPLACIAN_THRESHOLD = 3500;

export const useFaceDetectionFrameProcessor = ({
  onStableFaceDetected = () => { },
  onFacesUpdate = () => { },
  onLivenessUpdate = () => { },
  onAntiSpoofUpdate = () => { },
  showCodeScanner = false,
  isLoading = false,
  isActive = true,
  livenessLevel,
  antispooflevel = 0.35,
}) => {
  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    landmarkMode: 'none',
    contourMode: 'none',
    classificationMode: livenessLevel === 1 ? 'all' : 'none',
    minFaceSize: MIN_FACE_SIZE,
  });

  const isMounted = useRef(true);
  const antiSpoofInitialized = useRef(false);
  const frameProcessingStartTime = useRef(0);

  // Initialize anti-spoofing with memoization
  const initializeAntiSpoof = useCallback(async () => {
    if (antiSpoofInitialized.current) return true;

    try {
      const available = isFaceAntiSpoofAvailable?.();
      if (!available) return false;

      const res = await initializeFaceAntiSpoof();
      antiSpoofInitialized.current = true;
      return true;
    } catch (err) {
      console.error('[useFaceDetection] Error initializing anti-spoof:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!antiSpoofInitialized.current) {
      initializeAntiSpoof();
    }
  }, [initializeAntiSpoof]);

  // Pre-computed shared state with optimized structure
  const sharedState = useMemo(
    () =>
      Worklets.createSharedValue({
        // Core timing
        lastProcessedTime: 0,

        // Face tracking - packed for memory efficiency
        faceTracking: { lastX: 0, lastY: 0, lastW: 0, lastH: 0, stableCount: 0 },

        // State flags - packed together
        flags: {
          captured: false,
          showCodeScanner: showCodeScanner,
          isActive: isActive,
          hasSingleFace: false,
          isFaceCentered: false,
          eyeClosed: false,
        },

        // Liveness state
        liveness: {
          level: livenessLevel,
          step: 0,
          blinkCount: 0,
        },

        // Anti-spoof state
        antiSpoof: {
          consecutiveLiveFrames: 0,
          lastResult: null,
          isLive: false,
          confidence: 0,
        },

        // Face centering
        centering: {
          centeredFrames: 0,
          frameWidth: 0,
          frameHeight: 0,
        },

        // Performance tracking
        performance: {
          batchCounter: 0,
          lastBatchUpdate: 0,
        }
      }),
    []
  );

  // Batched state updates
  useEffect(() => {
    if (!isMounted.current) return;

    const state = sharedState.value;
    state.flags.showCodeScanner = !!showCodeScanner;
    state.flags.isActive = !!isActive;
    state.liveness.level = livenessLevel;

    if (isActive && state.flags.captured) {
      // Batch reset all states
      state.faceTracking.stableCount = 0;
      state.liveness.step = 0;
      state.liveness.blinkCount = 0;
      state.flags.eyeClosed = false;
      state.flags.captured = false;
      state.antiSpoof.consecutiveLiveFrames = 0;
      state.antiSpoof.lastResult = null;
      state.antiSpoof.isLive = false;
      state.antiSpoof.confidence = 0;
      state.flags.hasSingleFace = false;
      state.centering.centeredFrames = 0;
      state.flags.isFaceCentered = false;
    }
  }, [showCodeScanner, isActive, livenessLevel, sharedState]);

  // Optimized JS callbacks with batching
  const callbacksRef = useRef({
    lastFacesEventTime: 0,
    lastLivenessEventTime: 0,
    lastAntiSpoofEventTime: 0,
    pendingFacesUpdate: null,
    pendingLivenessUpdate: null,
    pendingAntiSpoofUpdate: null,
  });

  const FACES_EVENT_INTERVAL_MS = 800;
  const LIVENESS_EVENT_INTERVAL_MS = 700;
  const ANTI_SPOOF_EVENT_INTERVAL_MS = 500;

  // Memoized callbacks with batching
  const runOnStable = useMemo(
    () =>
      Worklets.createRunOnJS((faceRect, antiSpoofResult) => {
        onStableFaceDetected?.(faceRect, antiSpoofResult);
      }),
    [onStableFaceDetected]
  );

  const runOnFaces = useMemo(
    () =>
      Worklets.createRunOnJS((count, progress, step, isCentered, antiSpoofState) => {
        const now = Date.now();
        const callbacks = callbacksRef.current;

        if (now - callbacks.lastFacesEventTime > FACES_EVENT_INTERVAL_MS) {
          callbacks.lastFacesEventTime = now;
          onFacesUpdate?.({ count, progress, step, isCentered, antiSpoofState });
        }
      }),
    [onFacesUpdate]
  );

  const runOnLiveness = useMemo(
    () =>
      Worklets.createRunOnJS((step, extra) => {
        const now = Date.now();
        const callbacks = callbacksRef.current;

        if (now - callbacks.lastLivenessEventTime > LIVENESS_EVENT_INTERVAL_MS) {
          callbacks.lastLivenessEventTime = now;
          onLivenessUpdate?.(step, extra);
        }
      }),
    [onLivenessUpdate]
  );

  const runOnAntiSpoof = useMemo(
    () =>
      Worklets.createRunOnJS((result) => {
        const now = Date.now();
        const callbacks = callbacksRef.current;

        if (now - callbacks.lastAntiSpoofEventTime > ANTI_SPOOF_EVENT_INTERVAL_MS) {
          callbacks.lastAntiSpoofEventTime = now;
          onAntiSpoofUpdate?.(result);
        }
      }),
    [onAntiSpoofUpdate]
  );

  // Optimized face centering check - inlined for performance
  const isFaceCenteredInFrame = Worklets.createRunOnJS((faceBounds, frameWidth, frameHeight) => {
    'worklet';

    if (!faceBounds || frameWidth === 0 || frameHeight === 0) return false;

    const faceCenterX = faceBounds.x + faceBounds.width / 2;
    const faceCenterY = faceBounds.y + faceBounds.height / 2;
    const frameCenterX = frameWidth / 2;
    const frameCenterY = frameHeight / 2;

    return (
      Math.abs(faceCenterX - frameCenterX) <= frameWidth * FACE_CENTER_THRESHOLD_X &&
      Math.abs(faceCenterY - frameCenterY) <= frameHeight * FACE_CENTER_THRESHOLD_Y
    );
  });

  // Fast early exit conditions check
  const shouldProcessFrame = Worklets.createRunOnJS((state, now, isLoading) => {
    'worklet';
    return !(
      state.flags.showCodeScanner ||
      state.flags.captured ||
      isLoading ||
      !state.flags.isActive ||
      (now - state.lastProcessedTime < FRAME_PROCESSOR_MIN_INTERVAL_MS)
    );
  });


  // Optimized frame processor
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      // Performance monitoring
      const processingStart = Date.now();

      const state = sharedState.value;
      const now = frame?.timestamp ? frame.timestamp / 1e6 : Date.now();

      // Fast early exit
      if (!shouldProcessFrame(state, now, isLoading)) {
        frame.release?.();
        return;
      }

      // Performance guard - don't process if taking too long
      if (processingStart - frameProcessingStartTime.current < MAX_FRAME_PROCESSING_TIME_MS) {
        frame.release?.();
        return;
      }

      frameProcessingStartTime.current = processingStart;

      let detected = null;
      let antiSpoofResult = null;

      try {
        // Initialize frame dimensions once
        if (state.centering.frameWidth === 0) {
          state.centering.frameWidth = frame.width;
          state.centering.frameHeight = frame.height;
        }

        // Detect faces
        detected = detectFaces?.(frame);

        // Fast path for no faces
        if (!detected || detected.length === 0) {
          state.faceTracking.stableCount = 0;
          state.antiSpoof.consecutiveLiveFrames = 0;
          state.flags.hasSingleFace = false;
          state.centering.centeredFrames = 0;
          state.flags.isFaceCentered = false;
          state.lastProcessedTime = now;

          runOnFaces(0, 0, state.liveness.step, false, {
            isLive: false,
            confidence: 0,
            consecutiveLiveFrames: 0,
            isFaceCentered: false,
            hasSingleFace: false,
          });
          return;
        }

        // Process single face scenario
        if (detected.length === 1 && !state.flags.captured) {
          const face = detected[0];
          if (!face?.bounds) {
            runOnFaces(0, 0, state.liveness.step, false, {
              isLive: false,
              confidence: 0,
              consecutiveLiveFrames: 0,
              isFaceCentered: false,
              hasSingleFace: false,
            });
            return;
          }

          const bounds = face.bounds;
          const x = Math.max(0, bounds.x);
          const y = Math.max(0, bounds.y);
          const width = Math.max(0, bounds.width);
          const height = Math.max(0, bounds.height);

          // Local state snapshot for performance
          const localState = {
            livenessLevel: state.liveness.level,
            isLive: state.antiSpoof.isLive,
            consecutiveLiveFrames: state.antiSpoof.consecutiveLiveFrames,
            isFaceCentered: state.flags.isFaceCentered,
            antiSpoofConfidence: state.antiSpoof.confidence,
            livenessStep: state.liveness.step,
            blinkCount: state.liveness.blinkCount,
            eyeClosed: state.flags.eyeClosed,
          };

          // Update single face state
          state.flags.hasSingleFace = true;

          // Face centering check
          const centered = isFaceCenteredInFrame(
            bounds,
            state.centering.frameWidth,
            state.centering.frameHeight
          );

          if (centered) {
            state.centering.centeredFrames = Math.min(
              MIN_FACE_CENTERED_FRAMES,
              state.centering.centeredFrames + 1
            );
          } else {
            state.centering.centeredFrames = 0;
          }
          state.flags.isFaceCentered = state.centering.centeredFrames >= MIN_FACE_CENTERED_FRAMES;

          // Anti-spoof detection only when face is centered and single
          if (state.flags.isFaceCentered) {
            try {
              antiSpoofResult = faceAntiSpoofFrameProcessor?.(frame);
              if (antiSpoofResult != null) {
                state.antiSpoof.lastResult = antiSpoofResult;

                const { laplacianScore = 0, confidence = 0, combinedScore = 0 } = antiSpoofResult;

                if (laplacianScore > REAL_LAPLACIAN_THRESHOLD &&
                  confidence > antispooflevel &&
                  combinedScore > antispooflevel) {
                  state.antiSpoof.consecutiveLiveFrames = Math.min(
                    REQUIRED_CONSECUTIVE_LIVE_FRAMES,
                    state.antiSpoof.consecutiveLiveFrames + 1
                  );
                } else {
                  state.antiSpoof.consecutiveLiveFrames = Math.max(0, state.antiSpoof.consecutiveLiveFrames - 1);
                }
                state.antiSpoof.isLive = state.antiSpoof.consecutiveLiveFrames >= REQUIRED_CONSECUTIVE_LIVE_FRAMES;
                state.antiSpoof.confidence = confidence;

                // Batch anti-spoof updates
                if (state.performance.batchCounter % BATCH_UPDATE_THRESHOLD === 0) {
                  runOnAntiSpoof({
                    isLive: state.antiSpoof.isLive,
                    confidence: state.antiSpoof.confidence,
                    rawResult: antiSpoofResult,
                    consecutiveLiveFrames: state.antiSpoof.consecutiveLiveFrames,
                    isFaceCentered: state.flags.isFaceCentered,
                  });
                }
              }
            } catch (antiSpoofError) {
              // Silent error handling
            }
          } else {
            // Reset anti-spoof if face not centered
            state.antiSpoof.consecutiveLiveFrames = 0;
            state.antiSpoof.isLive = false;
          }

          // Liveness logic - optimized
          let newLivenessStep = localState.livenessStep;
          let newBlinkCount = localState.blinkCount;
          let newEyeClosed = localState.eyeClosed;

          if (localState.livenessLevel === 1) {
            if (newLivenessStep === 0) {
              newLivenessStep = 1;
              runOnLiveness(newLivenessStep);
            }
            else if (newLivenessStep === 1) {
              const leftEye = face.leftEyeOpenProbability ?? 1;
              const rightEye = face.rightEyeOpenProbability ?? 1;
              const eyesClosed = leftEye < BLINK_THRESHOLD && rightEye < BLINK_THRESHOLD;

              if (eyesClosed && !newEyeClosed) {
                newBlinkCount++;
                newEyeClosed = true;
                runOnLiveness(newLivenessStep, { blinkCount: newBlinkCount });
              } else if (!eyesClosed && newEyeClosed) {
                newEyeClosed = false;
              }

              if (newBlinkCount >= REQUIRED_BLINKS) {
                newLivenessStep = 2;
                runOnLiveness(newLivenessStep);
              }
            }
          }

          // Face stability check - optimized
          let newStableCount = state.faceTracking.stableCount;
          if (state.faceTracking.lastX === 0 && state.faceTracking.lastY === 0) {
            newStableCount = 1;
          } else {
            const dx = Math.abs(x - state.faceTracking.lastX);
            const dy = Math.abs(y - state.faceTracking.lastY);
            newStableCount = (dx < FACE_MOVEMENT_THRESHOLD && dy < FACE_MOVEMENT_THRESHOLD)
              ? state.faceTracking.stableCount + 1
              : 1;
          }

          // Batch state updates
          state.lastProcessedTime = now;
          state.faceTracking.lastX = x;
          state.faceTracking.lastY = y;
          state.faceTracking.lastW = width;
          state.faceTracking.lastH = height;
          state.faceTracking.stableCount = newStableCount;
          state.liveness.step = newLivenessStep;
          state.liveness.blinkCount = newBlinkCount;
          state.flags.eyeClosed = newEyeClosed;
          state.performance.batchCounter++;

          const progress = Math.min(100, (newStableCount / FACE_STABILITY_THRESHOLD) * 100);

          // Batch face updates
          if (state.performance.batchCounter % BATCH_UPDATE_THRESHOLD === 0) {
            runOnFaces(1, progress, newLivenessStep, state.flags.isFaceCentered, {
              isLive: state.antiSpoof.isLive,
              confidence: state.antiSpoof.confidence,
              consecutiveLiveFrames: state.antiSpoof.consecutiveLiveFrames,
              isFaceCentered: state.flags.isFaceCentered,
              hasSingleFace: true,
            });
          }

          // Capture condition - optimized
          const shouldCapture = !state.flags.captured && (
            newStableCount >= FACE_STABILITY_THRESHOLD &&
            state.antiSpoof.isLive &&
            state.antiSpoof.consecutiveLiveFrames >= REQUIRED_CONSECUTIVE_LIVE_FRAMES &&
            state.flags.isFaceCentered &&
            (localState.livenessLevel === 0 || (
              localState.livenessLevel === 1 &&
              newLivenessStep === 2 &&
              newBlinkCount >= REQUIRED_BLINKS
            ))
          );

          if (shouldCapture) {
            state.flags.captured = true;
            runOnStable(
              { x, y, width, height },
              state.antiSpoof.lastResult
            );
          }
        } else {
          // Multiple faces - reset states
          state.faceTracking.stableCount = 0;
          state.lastProcessedTime = now;
          state.antiSpoof.consecutiveLiveFrames = 0;
          state.flags.hasSingleFace = false;
          state.centering.centeredFrames = 0;
          state.flags.isFaceCentered = false;

          runOnFaces(detected.length, 0, state.liveness.step, false, {
            isLive: false,
            confidence: 0,
            consecutiveLiveFrames: 0,
            isFaceCentered: false,
            hasSingleFace: false,
          });
        }
      } catch (err) {
        // Error boundary - ensure frame is released
      } finally {
        frame.release?.();
      }
    },
    [detectFaces, isLoading]
  );

  // Optimized reset functions
  const resetCaptureState = useCallback(() => {
    const state = sharedState.value;
    state.lastProcessedTime = 0;
    state.faceTracking.lastX = 0;
    state.faceTracking.lastY = 0;
    state.faceTracking.lastW = 0;
    state.faceTracking.lastH = 0;
    state.faceTracking.stableCount = 0;
    state.flags.captured = false;
    state.liveness.step = 0;
    state.liveness.blinkCount = 0;
    state.flags.eyeClosed = false;
    state.antiSpoof.consecutiveLiveFrames = 0;
    state.antiSpoof.lastResult = null;
    state.antiSpoof.isLive = false;
    state.antiSpoof.confidence = 0;
    state.flags.hasSingleFace = false;
    state.centering.centeredFrames = 0;
    state.flags.isFaceCentered = false;
    state.centering.frameWidth = 0;
    state.centering.frameHeight = 0;
    state.performance.batchCounter = 0;
  }, [sharedState]);

  const forceResetCaptureState = useCallback(() => {
    const current = sharedState.value;

    sharedState.value = {
      lastProcessedTime: 0,
      faceTracking: {
        lastX: 0, lastY: 0, lastW: 0, lastH: 0, stableCount: 0
      },
      flags: {
        captured: false,
        showCodeScanner: current.flags.showCodeScanner,
        isActive: current.flags.isActive,
        hasSingleFace: false,
        isFaceCentered: false,
        eyeClosed: false,
      },
      liveness: {
        level: current.liveness.level,
        step: 0,
        blinkCount: 0,
      },
      antiSpoof: {
        consecutiveLiveFrames: 0,
        lastResult: null,
        isLive: false,
        confidence: 0,
      },
      centering: {
        centeredFrames: 0,
        frameWidth: 0,
        frameHeight: 0,
      },
      performance: {
        batchCounter: 0,
        lastBatchUpdate: 0,
      }
    };
  }, [sharedState]);

  const updateShowCodeScanner = useCallback(
    (value) => {
      sharedState.value.flags.showCodeScanner = !!value;
    },
    [sharedState]
  );

  const updateIsActive = useCallback(
    (active) => {
      sharedState.value.flags.isActive = !!active;
      if (!active) sharedState.value.flags.captured = false;
    },
    [sharedState]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      forceResetCaptureState();
    };
  }, [forceResetCaptureState]);

  return {
    frameProcessor,
    resetCaptureState,
    forceResetCaptureState,
    updateShowCodeScanner,
    updateIsActive,
    initializeAntiSpoof,
    capturedSV: { value: sharedState.value.flags.captured },
    antiSpoofState: {
      isLive: sharedState.value.antiSpoof.isLive,
      confidence: sharedState.value.antiSpoof.confidence,
      consecutiveLiveFrames: sharedState.value.antiSpoof.consecutiveLiveFrames,
      lastResult: sharedState.value.antiSpoof.lastResult,
      hasSingleFace: sharedState.value.flags.hasSingleFace,
      isFaceCentered: sharedState.value.flags.isFaceCentered,
    },
  };
};