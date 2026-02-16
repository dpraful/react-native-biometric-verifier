export class Global {
  // ====== APP CONSTANTS ======
  static AppTheme = {
    primary: '#094485',
    primaryLight: '#1b89ffff',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    dark: '#2D3748',
    light: '#F7FAFC',
    gray: '#A0AEC0',
    background: '#F8F9FA',
    cardBackground: '#FFFFFF',
    textLight: '#FFFFFF',
    shadow: '#00000033', // semi-transparent shadow
    modalBackground: 'rgba(0, 0, 0, 0.85)',
  };

  static LoadingTypes = {
    none: 'none',
    imageProcessing: 'imageProcessing',
    faceRecognition: 'faceRecognition',
    networkRequest: 'networkRequest',
    locationPermission: 'locationPermission',
    gettingLocation: 'gettingLocation',
    calculateDistance: 'calculateDistance',
    locationVerification: 'locationVerification',
  };

  static AnimationStates = {
    faceScan: 'faceScan',
    qrScan: 'qrScan',
    processing: 'processing',
    success: 'success',
    error: 'error',
  };

  static ImageResize = {
    width: 640,
    height: 640,
    format: 'JPEG', // 'PNG' or 'JPEG'
    quality: 85, // 0–100
  };
}
