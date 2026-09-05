# Pixel Forge

Pixel Forge is a browser-based dungeon designer for creating room layouts with doors and hallways.

## Project Structure

- `index.html` – app markup and script/style includes
- `styles/theme.css` – theme variables, focus states, accessibility helpers
- `styles/layout.css` – base layout and panel/grid structure
- `styles/components.css` – room/door/hallway/UI component styles
- `js/app.js` – main editor logic and event wiring
- `js/canvas.js` – PNG/SVG export helpers
- `js/tools.js` – install prompt + service worker registration helpers
- `js/state.js` – lightweight runtime metrics store
- `js/utils.js` – debounce, raf-throttle, download, and time utilities
- `js/storage.js` – localStorage key and JSON helpers
- `manifest.json` / `service-worker.js` – basic PWA support

## Features

- Draw/select/move/resize dungeon rooms
- Doors and hallways with draggable anchors
- Undo/redo history
- JSON export/import
- PNG and SVG export
- Auto-save every 30 seconds to localStorage
- Manual save/load of latest project snapshot with timestamp status
- Mini-map, zoom controls, and fit-to-view
- Keyboard shortcut help modal
- PWA manifest + offline cache via service worker

## Accessibility

- ARIA labeling for interactive controls
- Live status updates for save and toast feedback
- Focus-visible outlines for keyboard users
- Keyboard access for workspace and mini-map

## Responsive Breakpoints

- `900px` compact layout
- `768px` tablet adjustments
- `480px` mobile button wrapping
- `320px` small phone fallback

## Development

This repository is static HTML/CSS/JS and does not currently include a test runner.
Open `index.html` in a browser (or serve the directory) to use Pixel Forge.
