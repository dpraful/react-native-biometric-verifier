import { useCallback } from 'react';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import { Global } from '../utils/Global';

/**
 * Custom hook to process images: resize and convert to Base64.
 *
 * @returns {Object} { convertImageToBase64 }
 */
export const useImageProcessing = () => {
  /**
   * Converts an image URI to a Base64 string after resizing.
   *
   * @param {string} uri - Image file URI.
   * @param {boolean} includeMimeType - Whether to include MIME type in the result.
   * @returns {Promise<string>} Base64 string of the image.
   */
  const convertImageToBase64 = useCallback(async (uri, includeMimeType = false) => {
    try {
      if (!uri || typeof uri !== 'string') {
        throw new Error('Invalid image URI provided.');
      }

      // Optional: Check file info
      try {
        await RNFS.stat(uri);
      } catch {
        // Skip warnings; silently ignore
      }

      // Resize image
      const resizedImage = await ImageResizer.createResizedImage(
        uri,
        Global.ImageResize.width,
        Global.ImageResize.height,
        Global.ImageResize.format,  // 'JPEG' or 'PNG'
        Global.ImageResize.quality, // e.g., 80
        0,                    // Rotation
        undefined,            // Output path
        false                 // Keep EXIF metadata
      );

      if (!resizedImage?.uri) {
        throw new Error('Image resizing returned an invalid result.');
      }

      // Convert resized image to Base64
      let base64Data = await RNFS.readFile(resizedImage.uri, 'base64');

      if (includeMimeType) {
        const mimeType = Global.ImageResize.format.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
        base64Data = `data:${mimeType};base64,${base64Data}`;
      }

      return base64Data;
    } catch (error) {
      console.error('Error in convertImageToBase64:', error.message || error);
      throw error; // Rethrow for caller handling
    }
  }, []);

  return { convertImageToBase64 };
};
