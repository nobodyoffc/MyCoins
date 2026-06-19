# Running MyCoins in the Android Simulator

## Prerequisites

- Android Studio installed with Android SDK at `~/Library/Android/sdk`
- At least one AVD (Android Virtual Device) created
- Node.js ≥ 22.11.0 and `npm install` already run in this repo

## Port note

Metro defaults to **8081**, but `8081` is used by the local FCH API.
Use **8082** for Metro to avoid the conflict.

## Step 1 — Start an emulator

List available AVDs:

```bash
~/Library/Android/sdk/emulator/emulator -list-avds
```

Boot one (replace the name with any from the list above):

```bash
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_VanillaIceCream &
```

Or just open **Android Studio → Device Manager** and press ▶ on an AVD.

Verify it is attached:

```bash
~/Library/Android/sdk/platform-tools/adb devices
```

You should see at least one line ending in `device`.

## Step 2 — Build and install the app

From the project root:

```bash
export ANDROID_HOME=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
npx react-native run-android --port 8082
```

This will:

1. Compile the native Android app with Gradle.
2. Install `app-debug.apk` on every attached emulator/device.
3. Start Metro on port **8082** and run `adb reverse tcp:8082 tcp:8082` so the
   emulator can reach it.
4. Launch `MainActivity` automatically.

## Step 3 — Reopen the app later

If the emulator is still running and the APK is already installed, you can skip
the rebuild and just start Metro:

```bash
npx react-native start --port 8082
```

Then tap the MyCoins icon on the emulator home screen.

## Troubleshooting

### `java.nio.file.NoSuchFileException: ... lib*  2.so`

Finder (or iCloud sync) copied native build outputs and left files with a
` 2.so` suffix that break Gradle's CMake state. Clean them and rebuild:

```bash
find node_modules -type f \( -name "* 2.so" -o -name "* 2.a" -o -name "* 2.o" \) -delete
npx react-native run-android --port 8082
```

### `CXX5304 Observed package id 'platforms;android-36' in inconsistent location`

Harmless warning — an `android-36-2` folder exists next to `android-36` in the
SDK. The build continues. To silence it, delete the duplicate SDK folder from
Android Studio's SDK Manager.

### Port 8081 already in use

Expected — the FCH API binds to 8081. Always pass `--port 8082` to both
`run-android` and `start`.

### `adb: command not found`

Add the platform-tools directory to PATH (see step 2) or call it by full path:
`~/Library/Android/sdk/platform-tools/adb`.

## iOS note

`npm run ios` currently fails because `xcode-select` points to Command Line
Tools rather than a full Xcode install. Install Xcode from the App Store, then:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
npm run ios -- --port 8082
```
