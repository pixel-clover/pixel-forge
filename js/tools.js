window.PixelForgeTools = {
  deferredInstallPrompt: null,
  bindInstallPrompt(buttonId, onStatus) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      button.hidden = false;
      onStatus?.('App install is available.');
    });
    button.addEventListener('click', async () => {
      if (!this.deferredInstallPrompt) return;
      this.deferredInstallPrompt.prompt();
      await this.deferredInstallPrompt.userChoice;
      this.deferredInstallPrompt = null;
      button.hidden = true;
    });
  },
  registerServiceWorker(onStatus) {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(() => onStatus?.('Offline support enabled.'))
        .catch(() => onStatus?.('Offline mode setup failed.'));
    });
  }
};
