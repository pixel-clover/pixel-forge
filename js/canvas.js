window.PixelForgeCanvas = {
  exportPng(node, filename) {
    const svg = this.buildSvg(node);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, node.scrollWidth);
      canvas.height = Math.max(1, node.scrollHeight);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#12141a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        window.PixelForgeUtils.downloadBlob(pngBlob, filename);
      }, 'image/png');
    };
    img.src = url;
  },
  exportSvg(node, filename) {
    const svg = this.buildSvg(node);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    window.PixelForgeUtils.downloadBlob(blob, filename);
  },
  buildSvg(node) {
    const width = Math.max(1, node.scrollWidth);
    const height = Math.max(1, node.scrollHeight);
    const clone = node.cloneNode(true);
    clone.style.transform = 'none';
    clone.querySelectorAll('.grid-layer,.room-tooltip,.context-menu,.mini-map').forEach((el) => el.remove());
    const serializer = new XMLSerializer();
    const body = serializer.serializeToString(clone);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%">${body}</foreignObject></svg>`;
  }
};
