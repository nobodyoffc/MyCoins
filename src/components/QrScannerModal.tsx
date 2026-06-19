import React, {useEffect, useRef, useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import {Camera, CameraType} from 'react-native-camera-kit';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (value: string) => void;
}

type PermissionState = 'pending' | 'granted' | 'denied';

export function QrScannerModal({visible, onClose, onScanned}: QrScannerModalProps) {
  const t = useT();
  const [permission, setPermission] = useState<PermissionState>('pending');
  // Guard against multiple onReadCode events firing before the modal closes.
  const handledRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      // Reset state each time the modal is dismissed so the next open re-scans.
      handledRef.current = false;
      setPermission('pending');
      return;
    }

    // On iOS the native Camera view requests authorization itself when it
    // mounts, so we render it directly. On Android we must request the runtime
    // permission before mounting the camera.
    if (Platform.OS !== 'android') {
      setPermission('granted');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('scanner.permissionTitle'),
            message: t('scanner.permissionMessage'),
            buttonPositive: t('common.ok'),
            buttonNegative: t('scanner.cancel'),
          },
        );
        if (!cancelled) {
          setPermission(
            result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied',
          );
        }
      } catch {
        if (!cancelled) {
          setPermission('denied');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, t]);

  const handleReadCode = (event: {nativeEvent: {codeStringValue: string}}) => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;
    const value = event.nativeEvent.codeStringValue ?? '';
    onScanned(value.trim());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen">
      <View style={styles.container}>
        {permission === 'granted' ? (
          <Camera
            style={StyleSheet.absoluteFill}
            cameraType={CameraType.Back}
            scanBarcode
            onReadCode={handleReadCode}
            // NOTE: do NOT enable `showFrame`. It restricts barcode detection to
            // the small frame rectangle, so large/close QR codes that overflow
            // the frame can't be decoded until you back the phone away. Scanning
            // the full camera view lets big QR codes be recognised up close.
          />
        ) : (
          <View style={styles.centered}>
            {permission === 'pending' ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.permissionText}>
                {t('scanner.permissionDenied')}
              </Text>
            )}
          </View>
        )}

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.header}>
            <Text style={styles.title}>{t('scanner.title')}</Text>
          </View>
          <View style={styles.footer}>
            <Text style={styles.instruction}>{t('scanner.instruction')}</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>{t('scanner.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permissionText: {
    color: colors.white,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  title: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
  footer: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  instruction: {
    color: colors.white,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  cancelText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
