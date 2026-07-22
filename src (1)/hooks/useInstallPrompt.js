import { useEffect, useState } from 'react';

/**
 * Wraps the browser's install-prompt event. Chrome/Edge/Android fire
 * `beforeinstallprompt` when the PWA criteria are met (manifest + service
 * worker + HTTPS); iOS Safari never fires it at all — there's no
 * programmatic install there, only the manual Share → Add to Home
 * Screen path, which is why `canInstall` staying false on iOS is
 * expected, not a bug.
 * @returns {{canInstall: boolean, promptInstall: () => Promise<void>}}
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return { canInstall: !!deferredPrompt && !installed, promptInstall };
}
