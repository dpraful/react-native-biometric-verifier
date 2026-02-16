import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for a countdown timer with pause/resume functionality.
 *
 * @param {number} duration - Countdown duration in seconds
 * @param {Function} onExpire - Callback fired when countdown reaches zero.
 * @returns {Object}
 */
export const useCountdown = (duration, onExpire) => {
  const [countdown, setCountdown] = useState(duration);
  const timerRef = useRef(null);
  const countdownRef = useRef(duration);
  const isPausedRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Keep onExpire updated
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Update duration dynamically if it changes
  useEffect(() => {
    countdownRef.current = duration;
    setCountdown(duration);
  }, [duration]);

  // Start or restart the countdown
  const startCountdown = useCallback((onExpireCallback) => {
    try {
      countdownRef.current = duration;
      setCountdown(duration);
      isPausedRef.current = false;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const expireCallback = onExpireCallback || onExpireRef.current;

      timerRef.current = setInterval(() => {
        if (isPausedRef.current) return;

        countdownRef.current -= 1;

        if (countdownRef.current <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          expireCallback?.();
        } else {
          setCountdown(countdownRef.current);
        }
      }, 1000);
    } catch (error) {
      console.error('Error in startCountdown:', error);
    }
  }, [duration]);

  const pauseCountdown = useCallback(() => {
    isPausedRef.current = true;
  }, []);

  const resumeCountdown = useCallback(() => {
    isPausedRef.current = false;
  }, []);

  const resetCountdown = useCallback(() => {
    try {
      countdownRef.current = duration;
      setCountdown(duration);
      isPausedRef.current = false;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (error) {
      console.error('Error in resetCountdown:', error);
    }
  }, [duration]);

  const getCurrentCountdown = useCallback(
    () => countdownRef.current,
    []
  );

  const isPaused = useCallback(
    () => isPausedRef.current,
    []
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return {
    countdown,
    startCountdown,
    resetCountdown,
    pauseCountdown,
    resumeCountdown,
    getCurrentCountdown,
    isPaused,
  };
};
