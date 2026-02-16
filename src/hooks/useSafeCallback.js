import { useCallback } from "react";

/**
 * Hook to safely execute a callback function with error handling
 */
export const useSafeCallback = (callback, notifyMessage) => {
  return useCallback(
    (response) => {
      if (typeof callback === "function") {
        try {
          callback(response);
        } catch (err) {
          console.error("Callback execution failed:", err);
          if (typeof notifyMessage === "function") {
            notifyMessage("Unexpected error while processing callback.", "error");
          }
        }
      }
    },
    [callback, notifyMessage]
  );
};
