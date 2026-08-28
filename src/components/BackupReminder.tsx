import React, {useEffect, useRef, useState} from 'react';
import {Alert} from 'react-native';
import {useAccountStore} from '../store/account-store';
import {useT} from '../i18n';
import {BackupKeyModal} from './BackupKeyModal';

/**
 * Global one-shot nudge for a key the app generated on the user's behalf —
 * currently the first key of a brand-new account. It lives at the app root
 * because the screen that triggers it (CreateAccount) unmounts the moment
 * login succeeds, so it cannot host the dialog itself.
 */
export function BackupReminder() {
  const t = useT();
  const {keys, pendingBackupKeyId, clearPendingBackup} = useAccountStore();
  const [backupKeyId, setBackupKeyId] = useState<string | null>(null);
  // Guards against re-prompting for the same key if this re-renders.
  const promptedFor = useRef<string | null>(null);

  const pendingKey = keys.find(k => k.id === pendingBackupKeyId);

  useEffect(() => {
    if (!pendingBackupKeyId || !pendingKey) {
      promptedFor.current = null;
      return;
    }
    if (promptedFor.current === pendingBackupKeyId) {
      return;
    }
    promptedFor.current = pendingBackupKeyId;
    const id = pendingBackupKeyId;
    Alert.alert(
      t('backup.promptTitle'),
      `${t('backup.newAccountMsg')}\n\n${t('backup.promptMsg')}`,
      [
        {
          text: t('backup.later'),
          style: 'cancel',
          onPress: () => clearPendingBackup(),
        },
        {
          text: t('backup.backupNow'),
          onPress: () => {
            clearPendingBackup();
            setBackupKeyId(id);
          },
        },
      ],
    );
    // `t` is intentionally omitted: re-running on a language change would
    // raise a second dialog for a key the user has already answered for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBackupKeyId, pendingKey, clearPendingBackup]);

  const backupKey = keys.find(k => k.id === backupKeyId);

  return (
    <BackupKeyModal
      visible={backupKey != null}
      keyEntry={backupKey}
      onClose={() => setBackupKeyId(null)}
    />
  );
}
