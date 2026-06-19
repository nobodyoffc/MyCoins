import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Modal,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {Avatar} from './Avatar';
import {navigate} from '../navigation/navigationRef';
import {useAccountStore} from '../store/account-store';
import {formatAddress} from '../utils/format';
import {colors, spacing, fontSize} from '../utils/theme';
import {useT} from '../i18n';

let ViewShot: any = null;
let CameraRoll: any = null;

try {
  ViewShot = require('react-native-view-shot').default;
} catch {}

try {
  CameraRoll = require('@react-native-camera-roll/camera-roll').CameraRoll;
} catch {}

/**
 * Floating avatar shown at the top-right corner of all screens
 * when a key is active. Shows which identity the user is using.
 */
export function FloatingAvatar() {
  const {isLoggedIn, activeKeyId} = useAccountStore();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const viewShotRef = useRef<any>(null);

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => setToastVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  if (!isLoggedIn || !activeKeyId) return null;

  const handleCopyLabel = () => {
    Clipboard.setString(activeKeyId);
    setToastVisible(true);
  };

  const handleOpenKeys = () => {
    navigate('KeysTab');
  };

  const handleSaveAvatar = async () => {
    try {
      if (!ViewShot || !CameraRoll) {
        Alert.alert(t('common.error'), t('components.floatingAvatar.saveRequiresRebuild'));
        return;
      }
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        Alert.alert(t('common.error'), t('components.floatingAvatar.captureFailed'));
        return;
      }
      await CameraRoll.saveAsset(uri, {type: 'photo'});
      Alert.alert(t('common.saved'), t('components.floatingAvatar.savedToLibrary'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('components.floatingAvatar.saveFailed'));
    }
  };

  const avatarContent = (
    <Avatar address={activeKeyId} size={200} />
  );

  const wrappedAvatar = ViewShot ? (
    <ViewShot
      ref={viewShotRef}
      options={{format: 'png', quality: 1, result: 'tmpfile'}}
      style={styles.avatarWrapper}>
      {avatarContent}
    </ViewShot>
  ) : (
    <View style={styles.avatarWrapper}>{avatarContent}</View>
  );

  return (
    <>
      <View
        style={[
          styles.container,
          {top: insets.top + 4},
        ]}
        pointerEvents="box-none">
        <View style={styles.badge}>
          <TouchableOpacity
            onPress={handleOpenKeys}
            onLongPress={() => setDialogVisible(true)}>
            <Avatar address={activeKeyId} size={42} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleOpenKeys}
            onLongPress={handleCopyLabel}>
            <Text style={styles.label} numberOfLines={1}>
              {formatAddress(activeKeyId, 6, 6)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={dialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDialogVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            {wrappedAvatar}
            <Text style={styles.dialogAddress}>
              {formatAddress(activeKeyId, 10, 10)}
            </Text>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.saveBtn]}
                onPress={handleSaveAvatar}>
                <Text style={styles.saveBtnText}>{t('common.save')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.okBtn]}
                onPress={() => setDialogVisible(false)}>
                <Text style={styles.okBtnText}>{t('common.ok')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toastVisible && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{t('components.floatingAvatar.copied')}</Text>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.md - 10,
    zIndex: 1000,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingRight: spacing.sm,
    paddingLeft: 2,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginLeft: spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    minWidth: 280,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  avatarWrapper: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
  },
  dialogAddress: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: 'monospace',
    marginTop: spacing.md,
  },
  dialogButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  dialogBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  okBtn: {
    backgroundColor: colors.border,
  },
  okBtnText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2000,
  },
  toast: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  toastText: {
    color: '#fff',
    fontSize: fontSize.md,
  },
});
