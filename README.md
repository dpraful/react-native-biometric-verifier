# React Native Biometric Verifier

A powerful and easy-to-use React Native module for biometric verification, featuring face recognition and QR code scanning capabilities with location validation.


## Features

- **Face Recognition**: Capture and verify user identity via face scan.
- **QR Code Scanning**: specialized mode for location verification using QR codes.
- **Location Validation**: Verify user presence within a specific geofence.
- **Liveness Detection**: Configurable liveness and anti-spoofing checks.
- **Customizable UI**: Animations, countdown timers, and feedback notifications.

## Installation

```bash
npm install react-native-biometric-verifier
```

### Peer Dependencies

This library relies on several peer dependencies that you must install in your project:

```bash
npm install react-native-vector-icons react-native-geolocation-service react-native-image-resizer react-native-fs prop-types
```

### Platform Configuration

#### iOS
Add the following keys to your `Info.plist` file to request camera and location permissions:

```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera for biometric verification</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to verify your presence at the designated area</string>
```

#### Android
Add the following permissions to your `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## Usage

Import the `BiometricModal` component and standard React hooks.

```javascript
import React, { useState } from 'react';
import { View, Button } from 'react-native';
import BiometricModal from 'react-native-biometric-verifier';

const App = () => {
  const [isVerifierOpen, setIsVerifierOpen] = useState(false);

  const handleVerificationComplete = (data) => {
    console.log('Verification Success:', data);
    // Handle success (e.g., navigate to next screen, show success message)
    setIsVerifierOpen(false);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Start Verification" onPress={() => setIsVerifierOpen(true)} />

      {isVerifierOpen && (
        <BiometricModal
          data="USER_UNIQUE_ID" // e.g., Employee ID or Face ID
          depKey="DEPARTMENT_KEY" // Optional: for QR location validation
          apiurl="https://your-api-endpoint.com/"
          onclose={(val) => setIsVerifierOpen(val)}
          callback={handleVerificationComplete}
          // Optional Props
          qrscan={false} // Set to true to enable QR scan mode first
          duration={100} // Countdown duration in seconds
          MaxDistanceMeters={30} // Allowed radius for location verification
          frameProcessorFps={5}
          livenessLevel="high"
          antispooflevel="high"
        />
      )}
    </View>
  );
};

export default App;
```

## Props

| Prop | Type | Required | Description | Default |
|------|------|----------|-------------|---------|
| `apiurl` | string | Yes | Base URL for the verification backend API. | - |
| `data` | string | Yes | Unique identifier for the user (e.g., Face ID, User ID). | - |
| `onclose` | function | Yes | Callback function to close the modal. | - |
| `callback` | function | Yes | Callback function returning successful verification data. | - |
| `qrscan` | boolean | No | If `true`, starts with QR code scanning mode. | `false` |
| `depKey` | string | No | Key used to validate the QR code content. | - |
| `duration` | number | No | Timeout duration for the session in seconds. | `100` |
| `MaxDistanceMeters` | number | No | Maximum allowed distance (meters) for location check. | `30` |
| `frameProcessorFps` | number | No | Frames per second for image processing. | - |
| `livenessLevel` | string | No | Liveness detection strictness. | - |
| `antispooflevel` | string | No | Anti-spoofing strictness. | - |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any bugs or improvements.

## License

JESCON TECHNOLOGIES PVT LTD
