# Android Keystore Backup

## EAS Build Credentials
- **Build Credentials ID:** fwlkAux-aO (default)
- **Project:** PotholeReactNative
- **Package:** com.pothole.app
- **Owner:** ranjitadh

## How to Download Keystore
```bash
eas credentials --platform android
```
1. Select "production" profile
2. Choose "Download keystore"
3. Save the .keystore file securely

## Details to Record After Download
- **Keystore file:** (record filename)
- **Keystore password:** (shown in eas credentials)
- **Key alias:** (shown in eas credentials)
- **Key password:** (shown in eas credentials)

## Important
- The keystore is also stored on Expo servers for EAS builds
- If you lose the keystore, you CANNOT update your published app
- Keep an offline backup in a password manager or encrypted storage
