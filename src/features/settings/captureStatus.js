// Auto-capture switch state, shared by the Profile row and its panel.
import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { captureSupported, captureStatus } from '../../native/paymentCapture';
import { t as tr } from '../../i18n';

/** Switch + permission state, refreshed when coming back from Android settings. */
export function useCaptureStatus() {
  const [s, setS] = useState({ enabled: false, allowed: false });
  useEffect(() => {
    if (!captureSupported) return undefined;
    captureStatus().then(setS);
    const h = CapApp.addListener('resume', () => captureStatus().then(setS));
    return () => { Promise.resolve(h).then((x) => x?.remove?.()); };
  }, []);
  return [s, setS];
}

/** One line for the Profile row. */
export const captureSummary = (s) => tr(!s.enabled ? 'Off — UPI and bank payments, one tap to add'
    : s.allowed || s.sms ? 'On — new payments wait on Home' : 'Needs a permission');
