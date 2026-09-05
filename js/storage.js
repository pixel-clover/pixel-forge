window.PixelForgeStorage = {
  KEYS: {
    theme: 'pixel-forge-theme',
    autosave: 'pixel-forge-autosave',
    projects: 'pixel-forge-projects'
  },
  loadJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  },
  saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};
