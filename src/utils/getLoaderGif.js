import { Global } from "./Global";

/**
 * Decides which GIF should be shown based on animationState or currentStep
 * @param {string} animationState - Current animation state
 * @param {string} currentStep - Current step of verification
 * @param {string} apiurl - Base API URL
 * @param {string} imageurl - Path to image folder (default: 'file/getCommonFile/image/')
 * @returns {any} - Gif image source or null
 */
export const getLoaderGif = (animationState, currentStep, apiurl, imageurl = 'file/getCommonFile/image/') => {
  try {
    const FaceGifUrl = `${apiurl}${imageurl}Face.gif`;
    const LocationGifUrl = `${apiurl}${imageurl}Location.gif`;

    if (
      animationState === Global.AnimationStates.faceScan ||
      currentStep === 'Identity Verification'
    ) {
      return { uri: FaceGifUrl };
    }

    if (
      animationState === Global.AnimationStates.qrScan ||
      currentStep === 'Location Verification'
    ) {
      return { uri: LocationGifUrl };
    }

    return null;
  } catch (error) {
    console.error("Error in getLoaderGif:", error);
    return null;
  }
};
