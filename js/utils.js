window.PixelForgeUtils = {
  debounce(fn, delay = 120) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
  rafThrottle(fn) {
    let rafId = null;
    return (...args) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        fn(...args);
      });
    };
  },
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  nowISO() {
    return new Date().toISOString();
  },
  formatTimestamp(isoString) {
    if (!isoString) return 'never';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return date.toLocaleString();
  }
};
