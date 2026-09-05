(function() {
// ============================================================
            // THEME TOGGLE
            // ============================================================
            const themeToggle = document.getElementById('themeToggle');
            const saveStatusEl = document.getElementById('saveStatus');
            const projectFileNameEl = document.getElementById('projectFileName');
            const srStatusEl = document.getElementById('srStatus');
            const STORAGE_KEYS = window.PixelForgeStorage.KEYS;
            let currentTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'dark';

            function setTheme(theme) {
                document.documentElement.setAttribute('data-theme', theme);
                currentTheme = theme;
                localStorage.setItem(STORAGE_KEYS.theme, theme);
                themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
                setTimeout(updateMiniMap, 100);
            }

            setTheme(currentTheme);

            themeToggle.addEventListener('click', () => {
                setTheme(currentTheme === 'dark' ? 'light' : 'dark');
            });

            // ============================================================
            // DOM REFS
            // ============================================================
            const workspace = document.getElementById("workspace");
            const contentLayer = document.getElementById("contentLayer");
            const toast = document.getElementById("toast");
            const roomTooltip = document.getElementById("roomTooltip");
            const tooltipName = document.getElementById("tooltipName");
            const tooltipDetails = document.getElementById("tooltipDetails");
            const contextMenu = document.getElementById("contextMenu");
            const miniMapCanvas = document.getElementById("miniMapCanvas");
            const miniViewport = document.getElementById("miniViewport");
            const shortcutsModal = document.getElementById("shortcutsModal");

            let toastTimeout = null;

            function showToast(message, duration = 2000) {
                toast.textContent = message;
                toast.classList.add("show");
                if (srStatusEl) srStatusEl.textContent = message;
                clearTimeout(toastTimeout);
                toastTimeout = setTimeout(() => toast.classList.remove("show"), duration);
            }

            // ============================================================
            // SETTINGS
            // ============================================================
            let showLabels = true;
            let snapEnabled = true;
            let gridSize = 28;
            let doorOffset = 8;
            let wallThickness = 3;
            let wallColor = "#5f6a7e";
            let currentProjectName = "untitled";
            let dirtySince = null;

            function setSaveStatus(text) {
                if (saveStatusEl) saveStatusEl.textContent = text;
            }

            function setProjectName(name) {
                currentProjectName = (name || "untitled").trim();
                if (projectFileNameEl) projectFileNameEl.textContent = currentProjectName;
            }

            function markDirty() {
                dirtySince = window.PixelForgeUtils.nowISO();
                setSaveStatus("Unsaved changes");
            }

            // ============================================================
            // UNDO / REDO
            // ============================================================
            const history = [];
            let historyIndex = -1;
            const MAX_HISTORY = 50;

            function saveState() {
                history.splice(historyIndex + 1);
                const state = serializeState();
                history.push(state);
                historyIndex = history.length - 1;
                if (history.length > MAX_HISTORY) {
                    history.shift();
                    historyIndex--;
                }
                updateUndoButtons();
                updateMiniMap();
                markDirty();
            }

            function undo() {
                if (historyIndex > 0) {
                    historyIndex--;
                    restoreState(history[historyIndex]);
                    updateUndoButtons();
                    showToast("↩ Undo");
                    updateMiniMap();
                }
            }

            function redo() {
                if (historyIndex < history.length - 1) {
                    historyIndex++;
                    restoreState(history[historyIndex]);
                    updateUndoButtons();
                    showToast("↪ Redo");
                    updateMiniMap();
                }
            }

            function updateUndoButtons() {
                document.getElementById("undoBtn").style.opacity = historyIndex > 0 ? "1" : "0.3";
                document.getElementById("redoBtn").style.opacity = historyIndex < history.length - 1 ? "1" : "0.3";
            }

            // ============================================================
            // SERIALIZATION
            // ============================================================
            function serializeState() {
                const roomData = rooms.map(r => ({
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                    name: r.name,
                    color: r.color
                }));
                const doorData = doors.map(d => ({
                    roomA: rooms.indexOf(d.roomA),
                    roomB: rooms.indexOf(d.roomB),
                    anchorAPos: d.anchorAPos,
                    anchorBPos: d.anchorBPos
                }));
                const hallwayData = hallways.map(h => ({
                    roomA: rooms.indexOf(h.roomA),
                    roomB: rooms.indexOf(h.roomB),
                    anchorAPos: h.anchorAPos,
                    anchorBPos: h.anchorBPos
                }));
                return {
                    rooms: roomData,
                    doors: doorData,
                    hallways: hallwayData,
                    meta: {
                        projectName: currentProjectName,
                        updatedAt: window.PixelForgeUtils.nowISO()
                    }
                };
            }

            function restoreState(state) {
                rooms.forEach(r => r.element.remove());
                rooms.length = 0;
                doors.forEach(d => { d.element.remove();
                    d.anchorA.remove();
                    d.anchorB.remove();
                    d.wallA.remove();
                    d.wallB.remove(); });
                doors.length = 0;
                hallways.forEach(h => { h.element.remove();
                    h.anchorA.remove();
                    h.anchorB.remove();
                    h.wallA.remove();
                    h.wallB.remove(); });
                hallways.length = 0;
                document.querySelectorAll('.connection-label').forEach(el => el.remove());

                const roomMap = [];
                state.rooms.forEach((rd, i) => {
                    const room = createRoom(rd.x, rd.y, rd.width, rd.height, rd.name, rd.color);
                    roomMap[i] = room;
                });

                state.doors.forEach(dd => {
                    const roomA = roomMap[dd.roomA];
                    const roomB = roomMap[dd.roomB];
                    if (roomA && roomB) {
                        const door = createDoorWithAnchors(roomA, roomB);
                        door.anchorAPos = dd.anchorAPos;
                        door.anchorBPos = dd.anchorBPos;
                        doors.push(door);
                        updateDoor(door);
                    }
                });

                state.hallways.forEach(hd => {
                    const roomA = roomMap[hd.roomA];
                    const roomB = roomMap[hd.roomB];
                    if (roomA && roomB) {
                        const hallway = createHallwayWithAnchors(roomA, roomB);
                        hallway.anchorAPos = hd.anchorAPos;
                        hallway.anchorBPos = hd.anchorBPos;
                        hallways.push(hallway);
                        updateHallway(hallway);
                    }
                });

                selectedRoom = null;
                updateProperties();
                updateEmptyMessage();
                updateAllConnections();
                renderConnectionList();
                highlightConnectionsForRoom(null);
                updateConnectionLabels();
                updateMiniMap();
            }

            // ============================================================
            // EXPORT / IMPORT
            // ============================================================
            function exportLevel() {
                const state = serializeState();
                const json = JSON.stringify(state, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const safeName = (currentProjectName || "pixel_forge_level").replace(/[^a-z0-9-_]+/gi, "_");
                window.PixelForgeUtils.downloadBlob(blob, `${safeName}.json`);
                showToast("📤 Level exported!");
            }

            function importLevel(file) {
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const state = JSON.parse(e.target.result);
                        if (Array.isArray(state.rooms) && Array.isArray(state.doors) && Array.isArray(state.hallways)) {
                            restoreState(state);
                            saveState();
                            setProjectName(file.name.replace(/\.json$/i, ""));
                            showToast("📥 Level imported!");
                        } else {
                            showToast("❌ Invalid file format", 3000);
                        }
                    } catch (err) {
                        showToast("❌ Error importing file: invalid JSON", 3000);
                    }
                };
                reader.readAsText(file);
            }

            function persistProject(auto = false) {
                const payload = {
                    projectName: currentProjectName,
                    updatedAt: window.PixelForgeUtils.nowISO(),
                    theme: currentTheme,
                    camera,
                    data: serializeState()
                };
                window.PixelForgeStorage.saveJSON(STORAGE_KEYS.autosave, payload);
                const projects = window.PixelForgeStorage.loadJSON(STORAGE_KEYS.projects, []);
                projects.unshift(payload);
                window.PixelForgeStorage.saveJSON(STORAGE_KEYS.projects, projects.slice(0, 10));
                window.PixelForgeState.metrics.saveOperations += 1;
                setSaveStatus(auto ? `Auto-saved ${window.PixelForgeUtils.formatTimestamp(payload.updatedAt)}` : `Saved ${window.PixelForgeUtils.formatTimestamp(payload.updatedAt)}`);
                dirtySince = null;
            }

            function loadPersistedProject() {
                const payload = window.PixelForgeStorage.loadJSON(STORAGE_KEYS.autosave, null);
                if (!payload || !payload.data) return false;
                try {
                    restoreState(payload.data);
                    saveState();
                    if (payload.theme) setTheme(payload.theme);
                    if (payload.camera) {
                        camera = payload.camera;
                        updateCamera();
                    }
                    setProjectName(payload.projectName || "untitled");
                    setSaveStatus(`Loaded ${window.PixelForgeUtils.formatTimestamp(payload.updatedAt)}`);
                    dirtySince = null;
                    return true;
                } catch (error) {
                    showToast("❌ Could not restore auto-saved project", 3000);
                    return false;
                }
            }

            // ============================================================
            // GRID SNAP
            // ============================================================
            function snapToGrid(val) {
                if (!snapEnabled) return val;
                return Math.round(val / gridSize) * gridSize;
            }

            // ============================================================
            // SETTINGS BINDING
            // ============================================================
            const doorOffsetInput = document.getElementById("doorOffsetInput");
            const wallThicknessInput = document.getElementById("wallThicknessInput");
            const wallColorInput = document.getElementById("wallColorInput");
            const snapToggle = document.getElementById("snapToggle");
            const gridSizeBtn = document.getElementById("gridSizeBtn");
            const labelsToggle = document.getElementById("labelsToggle");

            doorOffsetInput.addEventListener("input", () => {
                doorOffset = Math.max(0, parseFloat(doorOffsetInput.value) || 0);
                updateAllDoors();
                saveState();
            });

            wallThicknessInput.addEventListener("input", () => {
                wallThickness = Math.max(1, Math.min(12, parseFloat(wallThicknessInput.value) || 3));
                updateAllRooms();
                saveState();
            });

            wallColorInput.addEventListener("input", () => {
                wallColor = wallColorInput.value;
                updateAllRooms();
                saveState();
            });

            snapToggle.addEventListener("click", () => {
                snapEnabled = !snapEnabled;
                snapToggle.textContent = snapEnabled ? "ON" : "OFF";
                snapToggle.classList.toggle("active", snapEnabled);
                showToast(`Snap ${snapEnabled ? "ON" : "OFF"}`);
            });

            labelsToggle.addEventListener("click", () => {
                showLabels = !showLabels;
                labelsToggle.textContent = showLabels ? "ON" : "OFF";
                labelsToggle.classList.toggle("active", showLabels);
                updateConnectionLabels();
                showToast(`Labels ${showLabels ? "ON" : "OFF"}`);
            });

            let gridSizes = [20, 28, 40, 50];
            let gridIndex = 1;

            gridSizeBtn.addEventListener("click", () => {
                gridIndex = (gridIndex + 1) % gridSizes.length;
                gridSize = gridSizes[gridIndex];
                gridSizeBtn.textContent = `Grid: ${gridSize}px`;
                const gridLayer = workspace.querySelector(".grid-layer");
                gridLayer.style.backgroundImage = `
                        linear-gradient(var(--grid-line) 1px, transparent 1px),
                        linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
                    `;
                gridLayer.style.backgroundSize = `${gridSize}px ${gridSize}px`;
                showToast(`Grid: ${gridSize}px`);
                saveState();
            });

            // ============================================================
            // CAMERA
            // ============================================================
            let camera = { x: 0, y: 0, zoom: 1 };

            function updateCamera() {
                contentLayer.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
                document.getElementById("zoomLevel").textContent = Math.round(camera.zoom * 100) + "%";
                updateMiniMap();
            }

            const scheduleMiniMapUpdate = window.PixelForgeUtils.rafThrottle(() => {
                window.PixelForgeState.metrics.miniMapRenders += 1;
                updateMiniMap();
            });
            const scheduleConnectionRefresh = window.PixelForgeUtils.debounce(() => {
                updateAllConnections();
            }, 40);

            // ============================================================
            // PAN
            // ============================================================
            let isPanning = false;
            let panStartX = 0,
                panStartY = 0;
            let panStartCamX = 0,
                panStartCamY = 0;

            // ============================================================
            // ROOM DATA
            // ============================================================
            const rooms = [];
            const doors = [];
            const hallways = [];
            let selectedRoom = null;
            let mode = "draw";
            let drawing = false;
            let startX = 0,
                startY = 0;
            let connectionFirstRoom = null;

            // ============================================================
            // HELPERS
            // ============================================================
            function getMousePosition(e) {
                const rect = workspace.getBoundingClientRect();
                const x = (e.clientX - rect.left - camera.x) / camera.zoom;
                const y = (e.clientY - rect.top - camera.y) / camera.zoom;
                return { x, y };
            }

            function getRoomCenter(room) {
                return { x: room.x + room.width / 2, y: room.y + room.height / 2 };
            }

            function getClosestEdgePoint(room, point, offset = 0) {
                const cx = room.x + room.width / 2;
                const cy = room.y + room.height / 2;
                const dx = point.x - cx;
                const dy = point.y - cy;

                const halfW = room.width / 2;
                const halfH = room.height / 2;

                let ex = cx + Math.max(-halfW, Math.min(halfW, dx));
                let ey = cy + Math.max(-halfH, Math.min(halfH, dy));

                const isInside = Math.abs(dx) < halfW && Math.abs(dy) < halfH;
                if (isInside) {
                    const distToEdge = Math.min(
                        halfW - Math.abs(dx),
                        halfH - Math.abs(dy)
                    );
                    if (distToEdge === halfW - Math.abs(dx)) {
                        ex = cx + (dx > 0 ? halfW - offset : -halfW + offset);
                    } else {
                        ey = cy + (dy > 0 ? halfH - offset : -halfH + offset);
                    }
                } else {
                    const clampedX = Math.max(-halfW + offset, Math.min(halfW - offset, dx));
                    const clampedY = Math.max(-halfH + offset, Math.min(halfH - offset, dy));
                    const distRight = Math.abs(dx - halfW);
                    const distLeft = Math.abs(dx + halfW);
                    const distBottom = Math.abs(dy - halfH);
                    const distTop = Math.abs(dy + halfH);
                    const minDist = Math.min(distRight, distLeft, distBottom, distTop);

                    if (minDist === distRight) {
                        ex = cx + halfW - offset;
                        ey = cy + Math.max(-halfH + offset, Math.min(halfH - offset, dy));
                    } else if (minDist === distLeft) {
                        ex = cx - halfW + offset;
                        ey = cy + Math.max(-halfH + offset, Math.min(halfH - offset, dy));
                    } else if (minDist === distBottom) {
                        ex = cx + Math.max(-halfW + offset, Math.min(halfW - offset, dx));
                        ey = cy + halfH - offset;
                    } else {
                        ex = cx + Math.max(-halfW + offset, Math.min(halfW - offset, dx));
                        ey = cy - halfH + offset;
                    }
                }

                return { x: ex, y: ey };
            }

            function getAnchorWorldPos(room, normPos, offset = 0) {
                const cx = room.x + room.width / 2;
                const cy = room.y + room.height / 2;
                const halfW = room.width / 2;
                const halfH = room.height / 2;

                const onRight = Math.abs(normPos.x - 1) < 0.001;
                const onLeft = Math.abs(normPos.x - 0) < 0.001;
                const onBottom = Math.abs(normPos.y - 1) < 0.001;
                const onTop = Math.abs(normPos.y - 0) < 0.001;

                let x = cx + (normPos.x - 0.5) * 2 * halfW;
                let y = cy + (normPos.y - 0.5) * 2 * halfH;

                const clampedOffset = Math.min(offset, Math.min(halfW, halfH) * 0.8);

                if (onRight) {
                    x = cx + halfW - clampedOffset;
                    y = cy + (normPos.y - 0.5) * 2 * (halfH - clampedOffset);
                } else if (onLeft) {
                    x = cx - halfW + clampedOffset;
                    y = cy + (normPos.y - 0.5) * 2 * (halfH - clampedOffset);
                } else if (onBottom) {
                    x = cx + (normPos.x - 0.5) * 2 * (halfW - clampedOffset);
                    y = cy + halfH - clampedOffset;
                } else if (onTop) {
                    x = cx + (normPos.x - 0.5) * 2 * (halfW - clampedOffset);
                    y = cy - halfH + clampedOffset;
                } else {
                    const dx = normPos.x - 0.5;
                    const dy = normPos.y - 0.5;
                    const clampedX = Math.max(-1, Math.min(1, dx * 2));
                    const clampedY = Math.max(-1, Math.min(1, dy * 2));
                    x = cx + Math.max(-halfW + clampedOffset, Math.min(halfW - clampedOffset, clampedX * halfW));
                    y = cy + Math.max(-halfH + clampedOffset, Math.min(halfH - clampedOffset, clampedY * halfH));
                }

                return { x, y };
            }

            function normalizeEdgePoint(room, point) {
                const cx = room.x + room.width / 2;
                const cy = room.y + room.height / 2;
                const halfW = room.width / 2;
                const halfH = room.height / 2;

                const dx = point.x - cx;
                const dy = point.y - cy;

                let nx = 0.5,
                    ny = 0.5;
                const onRight = Math.abs(dx - halfW) < 2;
                const onLeft = Math.abs(dx + halfW) < 2;
                const onBottom = Math.abs(dy - halfH) < 2;
                const onTop = Math.abs(dy + halfH) < 2;

                if (onRight || onLeft) {
                    const t = (dy + halfH) / (2 * halfH);
                    nx = onRight ? 1 : 0;
                    ny = Math.max(0, Math.min(1, t));
                } else if (onBottom || onTop) {
                    const t = (dx + halfW) / (2 * halfW);
                    nx = Math.max(0, Math.min(1, t));
                    ny = onBottom ? 1 : 0;
                } else {
                    const distRight = Math.abs(dx - halfW);
                    const distLeft = Math.abs(dx + halfW);
                    const distBottom = Math.abs(dy - halfH);
                    const distTop = Math.abs(dy + halfH);
                    const minDist = Math.min(distRight, distLeft, distBottom, distTop);

                    if (minDist === distRight) { nx = 1;
                        ny = (dy + halfH) / (2 * halfH); } else if (minDist === distLeft) { nx = 0;
                        ny = (dy + halfH) / (2 * halfH); } else if (minDist === distBottom) { nx = (dx + halfW) / (2 *
                            halfW);
                        ny = 1; } else { nx = (dx + halfW) / (2 * halfW);
                        ny = 0; }
                    nx = Math.max(0, Math.min(1, nx));
                    ny = Math.max(0, Math.min(1, ny));
                }
                return { x: nx, y: ny };
            }

            // ============================================================
            // CONNECTION HIGHLIGHTING
            // ============================================================
            function highlightConnectionsForRoom(room) {
                document.querySelectorAll('.door.connected, .hallway.connected, .anchor.connected')
                    .forEach(el => el.classList.remove('connected', 'connection-highlight'));

                if (!room) return;

                const connectedDoors = doors.filter(d => d.roomA === room || d.roomB === room);
                const connectedHallways = hallways.filter(h => h.roomA === room || h.roomB === room);

                connectedDoors.forEach(d => {
                    d.element.classList.add('connected', 'connection-highlight');
                    d.anchorA.classList.add('connected');
                    d.anchorB.classList.add('connected');
                });

                connectedHallways.forEach(h => {
                    h.element.classList.add('connected', 'connection-highlight');
                    h.anchorA.classList.add('connected');
                    h.anchorB.classList.add('connected');
                });
            }

            // ============================================================
            // CONNECTION LABELS
            // ============================================================
            function updateConnectionLabels() {
                document.querySelectorAll('.connection-label').forEach(el => el.remove());

                if (!showLabels) return;

                doors.forEach(d => {
                    const posA = getAnchorWorldPos(d.roomA, d.anchorAPos, doorOffset);
                    const posB = getAnchorWorldPos(d.roomB, d.anchorBPos, doorOffset);
                    const midX = (posA.x + posB.x) / 2;
                    const midY = (posA.y + posB.y) / 2;
                    const dist = Math.round(Math.sqrt(
                        Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2)
                    ));
                    const label = document.createElement('div');
                    label.className = 'connection-label door-label';
                    label.textContent = `🚪 ${dist}px`;
                    label.style.left = midX + 'px';
                    label.style.top = (midY - 18) + 'px';
                    contentLayer.appendChild(label);
                });

                hallways.forEach(h => {
                    const posA = getAnchorWorldPos(h.roomA, h.anchorAPos, 0);
                    const posB = getAnchorWorldPos(h.roomB, h.anchorBPos, 0);
                    const midX = (posA.x + posB.x) / 2;
                    const midY = (posA.y + posB.y) / 2;
                    const dist = Math.round(Math.sqrt(
                        Math.pow(posB.x - posA.x, 2) + Math.pow(posB.y - posA.y, 2)
                    ));
                    const label = document.createElement('div');
                    label.className = 'connection-label hallway-label';
                    label.textContent = `🛤️ ${dist}px`;
                    label.style.left = midX + 'px';
                    label.style.top = (midY - 18) + 'px';
                    contentLayer.appendChild(label);
                });
            }

            // ============================================================
            // DOOR
            // ============================================================
            function createDoorWithAnchors(roomA, roomB) {
                const centerA = getRoomCenter(roomA);
                const centerB = getRoomCenter(roomB);

                const edgeA = getClosestEdgePoint(roomA, centerB, doorOffset);
                const edgeB = getClosestEdgePoint(roomB, centerA, doorOffset);
                const normA = normalizeEdgePoint(roomA, edgeA);
                const normB = normalizeEdgePoint(roomB, edgeB);

                const el = document.createElement("div");
                el.className = "door";
                contentLayer.appendChild(el);

                const anchorA = document.createElement("div");
                anchorA.className = "anchor anchor-door";
                anchorA.dataset.side = "a";
                contentLayer.appendChild(anchorA);

                const anchorB = document.createElement("div");
                anchorB.className = "anchor anchor-door";
                anchorB.dataset.side = "b";
                contentLayer.appendChild(anchorB);

                const wallA = document.createElement("div");
                wallA.className = "wall-cut";
                contentLayer.appendChild(wallA);

                const wallB = document.createElement("div");
                wallB.className = "wall-cut";
                contentLayer.appendChild(wallB);

                const door = {
                    roomA,
                    roomB,
                    element: el,
                    anchorA,
                    anchorB,
                    wallA,
                    wallB,
                    anchorAPos: normA,
                    anchorBPos: normB
                };

                let draggingAnchor = null;

                function setupAnchorDrag(anchor, side) {
                    anchor.addEventListener("mousedown", (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.button !== 0) return;

                        draggingAnchor = { anchor, side, door };
                        anchor.classList.add("dragging");
                        document.addEventListener("mousemove", onAnchorDrag);
                        document.addEventListener("mouseup", onAnchorDragEnd);
                    });
                }

                function onAnchorDrag(e) {
                    if (!draggingAnchor) return;
                    const p = getMousePosition(e);
                    const room = draggingAnchor.side === 'a' ? door.roomA : door.roomB;

                    const edgePoint = getClosestEdgePoint(room, p, doorOffset);
                    const norm = normalizeEdgePoint(room, edgePoint);

                    if (draggingAnchor.side === 'a') {
                        door.anchorAPos = norm;
                    } else {
                        door.anchorBPos = norm;
                    }

                    updateDoor(door);
                    updateConnectionLabels();
                }

                function onAnchorDragEnd() {
                    if (draggingAnchor) {
                        draggingAnchor.anchor.classList.remove("dragging");
                        draggingAnchor = null;
                        document.removeEventListener("mousemove", onAnchorDrag);
                        document.removeEventListener("mouseup", onAnchorDragEnd);
                        saveState();
                    }
                }

                setupAnchorDrag(anchorA, 'a');
                setupAnchorDrag(anchorB, 'b');

                updateDoor(door);
                return door;
            }

            function updateDoor(door) {
                const posA = getAnchorWorldPos(door.roomA, door.anchorAPos, doorOffset);
                const posB = getAnchorWorldPos(door.roomB, door.anchorBPos, doorOffset);

                door.anchorA.style.left = posA.x + "px";
                door.anchorA.style.top = posA.y + "px";
                door.anchorB.style.left = posB.x + "px";
                door.anchorB.style.top = posB.y + "px";

                door.element.style.left = ((posA.x + posB.x) / 2) + "px";
                door.element.style.top = ((posA.y + posB.y) / 2) + "px";

                updateWallCut(door.wallA, door.roomA, posA);
                updateWallCut(door.wallB, door.roomB, posB);
            }

            function updateWallCut(wallEl, room, pos) {
                const cx = room.x + room.width / 2;
                const cy = room.y + room.height / 2;
                const halfW = room.width / 2;
                const halfH = room.height / 2;

                const dx = pos.x - cx;
                const dy = pos.y - cy;
                const onRight = Math.abs(dx - halfW) < 3;
                const onLeft = Math.abs(dx + halfW) < 3;
                const onBottom = Math.abs(dy - halfH) < 3;
                const onTop = Math.abs(dy + halfH) < 3;

                const size = 16;
                wallEl.style.width = size + "px";
                wallEl.style.height = size + "px";

                if (onRight || onLeft || onBottom || onTop) {
                    wallEl.style.left = (pos.x - size / 2) + "px";
                    wallEl.style.top = (pos.y - size / 2) + "px";
                    wallEl.style.display = "block";
                    wallEl.style.background = "rgba(255,200,50,0.15)";
                    wallEl.style.border = "2px solid rgba(255,200,50,0.5)";
                    wallEl.style.borderRadius = "50%";
                } else {
                    wallEl.style.display = "none";
                }
            }

            function addDoor(roomA, roomB) {
                if (roomA === roomB) return false;
                for (let d of doors) {
                    if ((d.roomA === roomA && d.roomB === roomB) || (d.roomA === roomB && d.roomB === roomA)) return false;
                }
                const door = createDoorWithAnchors(roomA, roomB);
                doors.push(door);
                renderConnectionList();
                updateConnectionLabels();
                saveState();
                return true;
            }

            function removeDoor(door) {
                door.element.remove();
                door.anchorA.remove();
                door.anchorB.remove();
                door.wallA.remove();
                door.wallB.remove();
                const idx = doors.indexOf(door);
                if (idx !== -1) doors.splice(idx, 1);
                renderConnectionList();
                updateConnectionLabels();
                saveState();
            }

            function updateAllDoors() {
                doors.forEach(d => updateDoor(d));
            }

            // ============================================================
            // HALLWAY
            // ============================================================
            function createHallwayWithAnchors(roomA, roomB) {
                const centerA = getRoomCenter(roomA);
                const centerB = getRoomCenter(roomB);
                const edgeA = getClosestEdgePoint(roomA, centerB, 0);
                const edgeB = getClosestEdgePoint(roomB, centerA, 0);
                const normA = normalizeEdgePoint(roomA, edgeA);
                const normB = normalizeEdgePoint(roomB, edgeB);

                const el = document.createElement("div");
                el.className = "hallway";
                contentLayer.appendChild(el);

                const anchorA = document.createElement("div");
                anchorA.className = "anchor anchor-hallway";
                anchorA.dataset.side = "a";
                contentLayer.appendChild(anchorA);

                const anchorB = document.createElement("div");
                anchorB.className = "anchor anchor-hallway";
                anchorB.dataset.side = "b";
                contentLayer.appendChild(anchorB);

                const wallA = document.createElement("div");
                wallA.className = "wall-cut";
                contentLayer.appendChild(wallA);

                const wallB = document.createElement("div");
                wallB.className = "wall-cut";
                contentLayer.appendChild(wallB);

                const hallway = {
                    roomA,
                    roomB,
                    element: el,
                    anchorA,
                    anchorB,
                    wallA,
                    wallB,
                    anchorAPos: normA,
                    anchorBPos: normB
                };

                let draggingAnchor = null;

                function setupAnchorDrag(anchor, side) {
                    anchor.addEventListener("mousedown", (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.button !== 0) return;

                        draggingAnchor = { anchor, side, hallway };
                        anchor.classList.add("dragging");
                        document.addEventListener("mousemove", onAnchorDrag);
                        document.addEventListener("mouseup", onAnchorDragEnd);
                    });
                }

                function onAnchorDrag(e) {
                    if (!draggingAnchor) return;
                    const p = getMousePosition(e);
                    const room = draggingAnchor.side === 'a' ? hallway.roomA : hallway.roomB;
                    const edgePoint = getClosestEdgePoint(room, p, 0);
                    const norm = normalizeEdgePoint(room, edgePoint);

                    if (draggingAnchor.side === 'a') {
                        hallway.anchorAPos = norm;
                    } else {
                        hallway.anchorBPos = norm;
                    }
                    updateHallway(hallway);
                    updateConnectionLabels();
                }

                function onAnchorDragEnd() {
                    if (draggingAnchor) {
                        draggingAnchor.anchor.classList.remove("dragging");
                        draggingAnchor = null;
                        document.removeEventListener("mousemove", onAnchorDrag);
                        document.removeEventListener("mouseup", onAnchorDragEnd);
                        saveState();
                    }
                }

                setupAnchorDrag(anchorA, 'a');
                setupAnchorDrag(anchorB, 'b');

                updateHallway(hallway);
                return hallway;
            }

            function updateHallway(hallway) {
                const posA = getAnchorWorldPos(hallway.roomA, hallway.anchorAPos, 0);
                const posB = getAnchorWorldPos(hallway.roomB, hallway.anchorBPos, 0);

                hallway.anchorA.style.left = posA.x + "px";
                hallway.anchorA.style.top = posA.y + "px";
                hallway.anchorB.style.left = posB.x + "px";
                hallway.anchorB.style.top = posB.y + "px";

                const dx = posB.x - posA.x;
                const dy = posB.y - posA.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const midX = (posA.x + posB.x) / 2;
                const midY = (posA.y + posB.y) / 2;
                const thickness = 22;

                if (length < 5) {
                    hallway.element.style.width = "20px";
                    hallway.element.style.height = "20px";
                    hallway.element.style.left = (posA.x - 10) + "px";
                    hallway.element.style.top = (posA.y - 10) + "px";
                    hallway.element.style.transform = "rotate(0deg)";
                } else {
                    hallway.element.style.width = length + "px";
                    hallway.element.style.height = thickness + "px";
                    hallway.element.style.left = (midX - length / 2) + "px";
                    hallway.element.style.top = (midY - thickness / 2) + "px";
                    hallway.element.style.transform = `rotate(${angle}deg)`;
                }

                updateWallCut(hallway.wallA, hallway.roomA, posA);
                updateWallCut(hallway.wallB, hallway.roomB, posB);
            }

            function addHallway(roomA, roomB) {
                if (roomA === roomB) return false;
                for (let h of hallways) {
                    if ((h.roomA === roomA && h.roomB === roomB) || (h.roomA === roomB && h.roomB === roomA)) return false;
                }
                const hallway = createHallwayWithAnchors(roomA, roomB);
                hallways.push(hallway);
                renderConnectionList();
                updateConnectionLabels();
                saveState();
                return true;
            }

            function removeHallway(hallway) {
                hallway.element.remove();
                hallway.anchorA.remove();
                hallway.anchorB.remove();
                hallway.wallA.remove();
                hallway.wallB.remove();
                const idx = hallways.indexOf(hallway);
                if (idx !== -1) hallways.splice(idx, 1);
                renderConnectionList();
                updateConnectionLabels();
                saveState();
            }

            function updateAllHallways() {
                hallways.forEach(h => updateHallway(h));
            }

            function updateAllConnections() {
                updateAllDoors();
                updateAllHallways();
                updateConnectionLabels();
            }

            // ============================================================
            // RENDER CONNECTION LIST
            // ============================================================
            function renderConnectionList() {
                const container = document.getElementById("connectionList");
                const all = [...doors.map(d => ({ ...d, type: "door" })), ...hallways.map(h => ({ ...h, type: "hallway" }))];
                if (all.length === 0) {
                    container.innerHTML =
                        `<div style="color:var(--text-muted); font-size:12px; padding:6px 0;">no connections yet</div>`;
                    return;
                }
                let html = "";
                all.forEach((item, idx) => {
                    const nameA = item.roomA.name || "Room";
                    const nameB = item.roomB.name || "Room";
                    const typeLabel = item.type === "door" ? "🚪" : "🛤️";
                    html += `
                            <div class="connection-item">
                                <span>${typeLabel} ${escapeHtml(nameA)} ↔ ${escapeHtml(nameB)} <span class="connection-type">${item.type}</span></span>
                                <button data-idx="${idx}" data-type="${item.type}" class="conn-remove-btn">✕</button>
                            </div>
                        `;
                });
                container.innerHTML = html;

                container.querySelectorAll(".conn-remove-btn").forEach(btn => {
                    btn.addEventListener("click", (e) => {
                        const idx = parseInt(btn.dataset.idx, 10);
                        const type = btn.dataset.type;
                        if (type === "door" && doors[idx]) {
                            removeDoor(doors[idx]);
                        } else if (type === "hallway") {
                            const hallwayIdx = idx - doors.length;
                            if (hallways[hallwayIdx]) removeHallway(hallways[hallwayIdx]);
                        }
                        updateAllConnections();
                    });
                });
            }

            function escapeHtml(text) {
                const div = document.createElement("div");
                div.textContent = text;
                return div.innerHTML;
            }

            const defaultColors = ["#4f6bff", "#3bb273", "#e59f3b", "#b45cff", "#e05252", "#3fc1c9", "#f7a072"];

            function getColor(index) {
                return defaultColors[index % defaultColors.length];
            }

            // ============================================================
            // ROOM CRUD
            // ============================================================
            function updateAllRooms() {
                rooms.forEach(room => {
                    const el = room.element;
                    el.style.borderWidth = wallThickness + "px";
                    el.style.borderColor = wallColor;
                });
            }

            function renderRoom(room) {
                const el = room.element;
                el.style.left = room.x + "px";
                el.style.top = room.y + "px";
                el.style.width = room.width + "px";
                el.style.height = room.height + "px";
                el.style.background = room.color;
                el.style.borderWidth = wallThickness + "px";
                el.style.borderColor = wallColor;
                el.innerHTML = `
                        <span class="label">${escapeHtml(room.name)}</span>
                        <div class="handle"></div>
                    `;
            }

            function createRoom(x, y, w, h, name, color) {
                const el = document.createElement("div");
                el.className = "room";
                contentLayer.appendChild(el);

                const room = {
                    element: el,
                    name: name || "Room " + (rooms.length + 1),
                    x: x || 0,
                    y: y || 0,
                    width: Math.max(12, w || 60),
                    height: Math.max(12, h || 60),
                    color: color || getColor(rooms.length)
                };
                room.element.dataset.index = rooms.length;
                rooms.push(room);
                renderRoom(room);
                updateEmptyMessage();
                return room;
            }

            function deleteRoom(room) {
                if (!room) return;

                const toRemoveDoors = doors.filter(d => d.roomA === room || d.roomB === room);
                toRemoveDoors.forEach(d => removeDoor(d));
                const toRemoveHallways = hallways.filter(h => h.roomA === room || h.roomB === room);
                toRemoveHallways.forEach(h => removeHallway(h));

                room.element.remove();
                const idx = rooms.indexOf(room);
                if (idx !== -1) rooms.splice(idx, 1);
                rooms.forEach((r, i) => r.element.dataset.index = i);

                if (selectedRoom === room) {
                    selectedRoom = null;
                    updateProperties();
                }
                updateEmptyMessage();
                updateAllConnections();
                renderConnectionList();
                highlightConnectionsForRoom(null);
                updateMiniMap();
                saveState();
            }

            function duplicateRoom(room, offset = 30) {
                if (!room) return;
                const newRoom = createRoom(
                    room.x + offset,
                    room.y + offset,
                    room.width,
                    room.height,
                    room.name + " (copy)",
                    room.color
                );
                selectRoom(newRoom);
                updateMiniMap();
                saveState();
                showToast("📋 Room duplicated");
                return newRoom;
            }

            function selectRoom(room) {
                if (selectedRoom) {
                    selectedRoom.element.classList.remove("selected");
                }
                selectedRoom = room;
                if (selectedRoom) {
                    selectedRoom.element.classList.add("selected");
                    highlightConnectionsForRoom(room);
                } else {
                    highlightConnectionsForRoom(null);
                }
                updateProperties();
                updateEmptyMessage();
            }

            function updateEmptyMessage() {
                const msg = document.getElementById("emptyMessage");
                if (rooms.length === 0) {
                    msg.style.display = "block";
                } else {
                    msg.style.display = "none";
                }
            }

            function updateProperties() {
                const noSel = document.getElementById("noSelection");
                const props = document.getElementById("properties");

                if (!selectedRoom) {
                    noSel.style.display = "block";
                    props.style.display = "none";
                    return;
                }

                noSel.style.display = "none";
                props.style.display = "block";

                document.getElementById("roomName").value = selectedRoom.name;
                document.getElementById("roomColor").value = selectedRoom.color;
                document.getElementById("roomX").value = Math.round(selectedRoom.x);
                document.getElementById("roomY").value = Math.round(selectedRoom.y);
                document.getElementById("roomWidth").value = Math.round(selectedRoom.width);
                document.getElementById("roomHeight").value = Math.round(selectedRoom.height);
            }

            // ============================================================
            // MODE SWITCHING
            // ============================================================
            function setMode(newMode) {
                mode = newMode;
                document.getElementById("drawTool").classList.toggle("active", mode === "draw");
                document.getElementById("selectTool").classList.toggle("active", mode === "select");
                document.getElementById("doorTool").classList.toggle("active", mode === "door");
                document.getElementById("hallwayTool").classList.toggle("active", mode === "hallway");
                document.getElementById("drawToolSide").classList.toggle("active", mode === "draw");
                document.getElementById("selectToolSide").classList.toggle("active", mode === "select");
                document.getElementById("doorToolSide").classList.toggle("active", mode === "door");
                document.getElementById("hallwayToolSide").classList.toggle("active", mode === "hallway");

                workspace.style.cursor = mode === "draw" ? "crosshair" : (mode === "select" ? "default" : "pointer");

                connectionFirstRoom = null;
                document.querySelectorAll(".door.highlight, .hallway.highlight").forEach(el => el.classList.remove(
                "highlight"));
                if (mode === "draw") {
                    selectRoom(null);
                }
                contextMenu.style.display = "none";
            }

            // ============================================================
            // EVENT BINDING
            // ============================================================
            document.getElementById("drawTool").onclick = () => setMode("draw");
            document.getElementById("selectTool").onclick = () => setMode("select");
            document.getElementById("doorTool").onclick = () => setMode("door");
            document.getElementById("hallwayTool").onclick = () => setMode("hallway");
            document.getElementById("drawToolSide").onclick = () => setMode("draw");
            document.getElementById("selectToolSide").onclick = () => setMode("select");
            document.getElementById("doorToolSide").onclick = () => setMode("door");
            document.getElementById("hallwayToolSide").onclick = () => setMode("hallway");

            document.getElementById("undoBtn").onclick = undo;
            document.getElementById("redoBtn").onclick = redo;

            // ============================================================
            // KEYBOARD SHORTCUTS
            // ============================================================
            document.addEventListener("keydown", (e) => {
                if (e.ctrlKey && e.key === 'z') { e.preventDefault();
                    undo(); return; }
                if (e.ctrlKey && e.key === 'y') { e.preventDefault();
                    redo(); return; }
                if (e.ctrlKey && e.key === 'd') { e.preventDefault();
                    if (selectedRoom) duplicateRoom(selectedRoom);
                    return; }

                if (e.key === '1') { setMode("draw");
                    e.preventDefault(); return; }
                if (e.key === '2') { setMode("select");
                    e.preventDefault(); return; }
                if (e.key === '3') { setMode("door");
                    e.preventDefault(); return; }
                if (e.key === '4') { setMode("hallway");
                    e.preventDefault(); return; }

                if (e.key === "Delete") {
                    if (selectedRoom) {
                        deleteRoom(selectedRoom);
                        showToast("🗑 Room deleted");
                    }
                }

                if (e.key === 'Escape') {
                    contextMenu.style.display = 'none';
                    roomTooltip.style.display = 'none';
                    shortcutsModal.classList.remove("show");
                    shortcutsModal.setAttribute("aria-hidden", "true");
                }
            });

            // ============================================================
            // ROOM TOOLTIP (HOVER PREVIEW)
            // ============================================================
            let tooltipTimeout = null;

            workspace.addEventListener("mouseover", (e) => {
                const roomEl = e.target.closest(".room");
                if (!roomEl) {
                    roomTooltip.style.display = 'none';
                    clearTimeout(tooltipTimeout);
                    return;
                }

                const index = Number(roomEl.dataset.index);
                const room = rooms[index];
                if (!room) return;

                clearTimeout(tooltipTimeout);
                tooltipTimeout = setTimeout(() => {
                    tooltipName.textContent = "";
                    const swatch = document.createElement("span");
                    swatch.className = "color-swatch";
                    swatch.style.backgroundColor = room.color;
                    tooltipName.appendChild(swatch);
                    tooltipName.append(` ${room.name}`);
                    tooltipDetails.textContent =
                        `Size: ${Math.round(room.width)}×${Math.round(room.height)}  ·  #${rooms.indexOf(room) + 1}`;

                    let left = e.clientX + 16;
                    let top = e.clientY - 10;

                    roomTooltip.style.visibility = "hidden";
                    roomTooltip.style.display = "block";
                    const tipRect = roomTooltip.getBoundingClientRect();
                    if (left + tipRect.width > window.innerWidth) left = e.clientX - (tipRect.width + 10);
                    if (top + tipRect.height > window.innerHeight) top = window.innerHeight - (tipRect.height + 10);
                    if (top < 10) top = 10;

                    roomTooltip.style.left = left + 'px';
                    roomTooltip.style.top = top + 'px';
                    roomTooltip.style.visibility = "visible";
                }, 300);
            });

            workspace.addEventListener("mouseout", (e) => {
                const roomEl = e.target.closest(".room");
                if (!roomEl) {
                    clearTimeout(tooltipTimeout);
                    roomTooltip.style.display = 'none';
                }
            });

            // ============================================================
            // CONTEXT MENU
            // ============================================================
            let contextTargetRoom = null;

            workspace.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                const roomEl = e.target.closest(".room");
                if (!roomEl) {
                    contextMenu.style.display = 'none';
                    return;
                }

                const index = Number(roomEl.dataset.index);
                contextTargetRoom = rooms[index];
                if (!contextTargetRoom) return;

                contextMenu.style.left = e.clientX + 'px';
                contextMenu.style.top = e.clientY + 'px';
                contextMenu.style.display = 'block';

                const isSelected = contextTargetRoom === selectedRoom;
                const items = contextMenu.querySelectorAll('.menu-item');
                items.forEach(item => {
                    const action = item.dataset.action;
                    if (action === 'select') {
                        item.textContent = isSelected ? '✓ Selected' : '↖ Select';
                    }
                });
            });

            contextMenu.addEventListener("click", (e) => {
                const item = e.target.closest('.menu-item');
                if (!item) return;
                const action = item.dataset.action;

                if (!contextTargetRoom) return;

                switch (action) {
                    case 'select':
                        if (contextTargetRoom) {
                            selectRoom(contextTargetRoom);
                            showToast(`↖ Selected: ${contextTargetRoom.name}`);
                        }
                        break;
                    case 'duplicate':
                        if (contextTargetRoom) {
                            duplicateRoom(contextTargetRoom);
                        }
                        break;
                    case 'rename':
                        if (contextTargetRoom) {
                            const newName = prompt('Enter new name:', contextTargetRoom.name);
                            if (newName && newName.trim()) {
                                contextTargetRoom.name = newName.trim();
                                renderRoom(contextTargetRoom);
                                updateProperties();
                                renderConnectionList();
                                updateMiniMap();
                                saveState();
                                showToast(`✏️ Renamed to: ${contextTargetRoom.name}`);
                            }
                        }
                        break;
                    case 'color':
                        if (contextTargetRoom) {
                            const colorInput = document.createElement('input');
                            colorInput.type = 'color';
                            colorInput.value = contextTargetRoom.color;
                            colorInput.addEventListener('input', () => {
                                contextTargetRoom.color = colorInput.value;
                                renderRoom(contextTargetRoom);
                                updateProperties();
                                updateMiniMap();
                                saveState();
                            });
                            colorInput.click();
                            showToast('🎨 Pick a color');
                        }
                        break;
                    case 'delete':
                        if (contextTargetRoom) {
                            if (confirm(`Delete "${contextTargetRoom.name}"?`)) {
                                deleteRoom(contextTargetRoom);
                                showToast(`🗑 Deleted: ${contextTargetRoom.name}`);
                            }
                        }
                        break;
                }

                contextMenu.style.display = 'none';
                contextTargetRoom = null;
            });

            document.addEventListener("click", (e) => {
                if (!contextMenu.contains(e.target)) {
                    contextMenu.style.display = 'none';
                }
            });

            // ============================================================
            // DRAWING
            // ============================================================
            let tempRoom = null;

            workspace.addEventListener("mousedown", (e) => {
                if (e.button === 1 || e.button === 2) {
                    e.preventDefault();
                    isPanning = true;
                    panStartX = e.clientX;
                    panStartY = e.clientY;
                    panStartCamX = camera.x;
                    panStartCamY = camera.y;
                    contextMenu.style.display = 'none';
                    return;
                }

                if (e.button !== 0) return;

                const target = e.target;
                const roomEl = target.closest(".room");

                if (roomEl) return;

                if (mode === "select") {
                    selectRoom(null);
                    contextMenu.style.display = 'none';
                    return;
                }

                if (mode === "door" || mode === "hallway") {
                    connectionFirstRoom = null;
                    document.querySelectorAll(".room").forEach(el => el.style.boxShadow = "");
                    contextMenu.style.display = 'none';
                    return;
                }

                if (mode !== "draw") {
                    selectRoom(null);
                    contextMenu.style.display = 'none';
                    return;
                }

                const p = getMousePosition(e);
                startX = snapToGrid(p.x);
                startY = snapToGrid(p.y);

                const color = getColor(rooms.length);
                tempRoom = createRoom(startX, startY, 1, 1, "Room " + (rooms.length + 1), color);
                drawing = true;
                selectedRoom = tempRoom;
                updateProperties();
            });

            workspace.addEventListener("mousemove", (e) => {
                if (isPanning) {
                    const dx = e.clientX - panStartX;
                    const dy = e.clientY - panStartY;
                    camera.x = panStartCamX + dx;
                    camera.y = panStartCamY + dy;
                    updateCamera();
                    return;
                }

                if (!drawing || !tempRoom) return;
                const p = getMousePosition(e);
                let x = Math.min(startX, snapToGrid(p.x));
                let y = Math.min(startY, snapToGrid(p.y));
                let w = Math.abs(snapToGrid(p.x) - startX);
                let h = Math.abs(snapToGrid(p.y) - startY);
                w = Math.max(12, w);
                h = Math.max(12, h);
                tempRoom.x = x;
                tempRoom.y = y;
                tempRoom.width = w;
                tempRoom.height = h;
                renderRoom(tempRoom);
                updateProperties();
                scheduleMiniMapUpdate();
            });

            workspace.addEventListener("mouseup", (e) => {
                if (e.button === 1 || e.button === 2) {
                    isPanning = false;
                    return;
                }

                if (!drawing || !tempRoom) {
                    drawing = false;
                    return;
                }
                drawing = false;

                if (tempRoom.width < 18 || tempRoom.height < 18) {
                    deleteRoom(tempRoom);
                    tempRoom = null;
                    updateProperties();
                    updateEmptyMessage();
                    return;
                }

                setMode("select");
                selectRoom(tempRoom);
                tempRoom = null;
                updateEmptyMessage();
                updateAllConnections();
                updateMiniMap();
                saveState();
            });

            // ============================================================
            // ROOM CLICK HANDLER
            // ============================================================
            workspace.addEventListener("mousedown", (e) => {
                if (e.button !== 0) return;
                const roomEl = e.target.closest(".room");
                if (!roomEl) return;

                const index = Number(roomEl.dataset.index);
                const room = rooms[index];
                if (!room) return;

                if (mode === "door" || mode === "hallway") {
                    e.stopPropagation();
                    if (e.target.classList.contains("handle")) return;

                    if (!connectionFirstRoom) {
                        connectionFirstRoom = room;
                        room.element.style.boxShadow = "0 0 0 3px #ffd966, 0 0 20px #f5b042";
                        setTimeout(() => {
                            room.element.style.boxShadow = "";
                        }, 400);
                        return;
                    }

                    const roomA = connectionFirstRoom;
                    const roomB = room;
                    let ok = false;
                    if (mode === "door") {
                        ok = addDoor(roomA, roomB);
                    } else {
                        ok = addHallway(roomA, roomB);
                    }
                    if (ok) {
                        const allConns = mode === "door" ? doors : hallways;
                        const last = allConns[allConns.length - 1];
                        last.element.classList.add("highlight");
                        setTimeout(() => last.element.classList.remove("highlight"), 600);
                        updateAllConnections();
                        renderConnectionList();
                        updateMiniMap();
                        saveState();
                    } else {
                        alert(roomA === roomB ? "Can't connect a room to itself." :
                            "Connection already exists between these rooms.");
                    }
                    connectionFirstRoom = null;
                    document.querySelectorAll(".room").forEach(el => el.style.boxShadow = "");
                    return;
                }

                if (mode === "draw") return;

                if (e.target.classList.contains("handle")) {
                    e.stopPropagation();
                    resizeStart(e, room);
                    return;
                }

                e.stopPropagation();

                selectRoom(room);
                moveStart(e, room);
            });

            // ============================================================
            // MOVE LOGIC
            // ============================================================
            let moving = false;
            let dragOffX = 0,
                dragOffY = 0;
            let moveStartPos = null;

            function moveStart(e, room) {
                moving = true;
                const p = getMousePosition(e);
                dragOffX = p.x - room.x;
                dragOffY = p.y - room.y;
                moveStartPos = { room, x: room.x, y: room.y };

                document.addEventListener("mousemove", moveMove);
                document.addEventListener("mouseup", moveEnd);
            }

            function moveMove(e) {
                if (!moving || !moveStartPos) return;
                const p = getMousePosition(e);

                const dx = p.x - dragOffX - moveStartPos.x;
                const dy = p.y - dragOffY - moveStartPos.y;

                const newX = snapToGrid(moveStartPos.x + dx);
                const newY = snapToGrid(moveStartPos.y + dy);
                moveStartPos.room.x = Math.max(0, newX);
                moveStartPos.room.y = Math.max(0, newY);
                renderRoom(moveStartPos.room);

                updateProperties();
                scheduleConnectionRefresh();
                scheduleMiniMapUpdate();
            }

            function moveEnd() {
                moving = false;
                document.removeEventListener("mousemove", moveMove);
                document.removeEventListener("mouseup", moveEnd);
                if (moveStartPos) {
                    saveState();
                }
                moveStartPos = null;
            }

            // ============================================================
            // RESIZE LOGIC
            // ============================================================
            let resizing = false;
            let resizeStartX = 0,
                resizeStartY = 0;
            let origW = 0,
                origH = 0;

            function resizeStart(e, room) {
                resizing = true;
                const p = getMousePosition(e);
                resizeStartX = p.x;
                resizeStartY = p.y;
                origW = room.width;
                origH = room.height;
                document.addEventListener("mousemove", resizeMove);
                document.addEventListener("mouseup", resizeEnd);
            }

            function resizeMove(e) {
                if (!resizing || !selectedRoom) return;
                const p = getMousePosition(e);
                let w = Math.max(12, snapToGrid(origW + (p.x - resizeStartX)));
                let h = Math.max(12, snapToGrid(origH + (p.y - resizeStartY)));
                selectedRoom.width = w;
                selectedRoom.height = h;
                renderRoom(selectedRoom);
                updateProperties();
                scheduleConnectionRefresh();
                scheduleMiniMapUpdate();
            }

            function resizeEnd() {
                resizing = false;
                document.removeEventListener("mousemove", resizeMove);
                document.removeEventListener("mouseup", resizeEnd);
                saveState();
            }

            // ============================================================
            // PROPERTY INPUTS
            // ============================================================
            function bindNumberInput(id, prop) {
                const el = document.getElementById(id);
                el.addEventListener("input", () => {
                    if (!selectedRoom) return;
                    let val = parseFloat(el.value);
                    if (isNaN(val)) return;
                    if (prop === "width" || prop === "height") val = Math.max(12, val);
                    if (prop === "x" || prop === "y") val = Math.max(0, val);
                    selectedRoom[prop] = val;
                    renderRoom(selectedRoom);
                    updateAllConnections();
                    updateMiniMap();
                    saveState();
                });
            }

            bindNumberInput("roomX", "x");
            bindNumberInput("roomY", "y");
            bindNumberInput("roomWidth", "width");
            bindNumberInput("roomHeight", "height");

            document.getElementById("roomName").addEventListener("input", (e) => {
                if (!selectedRoom) return;
                selectedRoom.name = e.target.value || "Unnamed";
                renderRoom(selectedRoom);
                renderConnectionList();
                updateMiniMap();
                saveState();
            });

            document.getElementById("roomColor").addEventListener("input", (e) => {
                if (!selectedRoom) return;
                selectedRoom.color = e.target.value;
                renderRoom(selectedRoom);
                updateMiniMap();
                saveState();
            });

            // ============================================================
            // DELETE / CLEAR / EXPORT / IMPORT
            // ============================================================
            document.getElementById("deleteButton").onclick = () => {
                if (selectedRoom) {
                    deleteRoom(selectedRoom);
                    showToast("🗑 Room deleted");
                }
            };
            document.getElementById("deleteProperty").onclick = () => {
                if (selectedRoom) {
                    deleteRoom(selectedRoom);
                    showToast("🗑 Room deleted");
                }
            };

            document.getElementById("duplicateProperty").onclick = () => {
                if (selectedRoom) duplicateRoom(selectedRoom);
            };

            document.getElementById("clearButton").onclick = () => {
                if (rooms.length === 0 && doors.length === 0 && hallways.length === 0) return;
                if (!confirm("Delete all rooms and connections?")) return;
                rooms.forEach(r => r.element.remove());
                rooms.length = 0;
                doors.forEach(d => {
                    d.element.remove();
                    d.anchorA.remove();
                    d.anchorB.remove();
                    d.wallA.remove();
                    d.wallB.remove();
                });
                doors.length = 0;
                hallways.forEach(h => {
                    h.element.remove();
                    h.anchorA.remove();
                    h.anchorB.remove();
                    h.wallA.remove();
                    h.wallB.remove();
                });
                hallways.length = 0;
                document.querySelectorAll('.connection-label').forEach(el => el.remove());
                selectedRoom = null;
                updateProperties();
                updateEmptyMessage();
                updateAllConnections();
                renderConnectionList();
                highlightConnectionsForRoom(null);
                updateMiniMap();
                saveState();
                showToast("🗑 All cleared");
            };

            document.getElementById("exportBtn").onclick = exportLevel;
            document.getElementById("importBtn").onclick = () => {
                document.getElementById("fileInput").click();
            };
            document.getElementById("exportPngBtn").onclick = () => {
                window.PixelForgeCanvas.exportPng(workspace, `${currentProjectName || "pixel_forge_level"}.png`);
                showToast("🖼️ PNG exported");
            };
            document.getElementById("exportSvgBtn").onclick = () => {
                window.PixelForgeCanvas.exportSvg(workspace, `${currentProjectName || "pixel_forge_level"}.svg`);
                showToast("🧩 SVG exported");
            };
            document.getElementById("saveProjectBtn").onclick = () => {
                const nextName = prompt("Project name:", currentProjectName);
                if (nextName === null) return;
                if (nextName.trim()) setProjectName(nextName.trim());
                persistProject(false);
                showToast("💾 Project saved");
            };
            document.getElementById("loadProjectBtn").onclick = () => {
                if (loadPersistedProject()) {
                    showToast("📂 Loaded last saved project");
                }
            };
            document.getElementById("fileInput").addEventListener("change", (e) => {
                if (e.target.files.length > 0) {
                    importLevel(e.target.files[0]);
                    e.target.value = '';
                }
            });

            // ============================================================
            // ZOOM CONTROLS
            // ============================================================
            document.getElementById("zoomInBtn").onclick = () => {
                camera.zoom = Math.min(2, camera.zoom + 0.1);
                updateCamera();
            };
            document.getElementById("zoomOutBtn").onclick = () => {
                camera.zoom = Math.max(0.2, camera.zoom - 0.1);
                updateCamera();
            };
            document.getElementById("resetViewBtn").onclick = () => {
                camera.x = 0;
                camera.y = 0;
                camera.zoom = 1;
                updateCamera();
            };
            document.getElementById("fitViewBtn").onclick = () => {
                if (rooms.length === 0) return;
                let minX = Infinity,
                    minY = Infinity,
                    maxX = -Infinity,
                    maxY = -Infinity;
                rooms.forEach(r => {
                    minX = Math.min(minX, r.x);
                    minY = Math.min(minY, r.y);
                    maxX = Math.max(maxX, r.x + r.width);
                    maxY = Math.max(maxY, r.y + r.height);
                });
                const pad = 50;
                const width = maxX - minX + pad * 2;
                const height = maxY - minY + pad * 2;
                const workspaceRect = workspace.getBoundingClientRect();
                const scaleX = (workspaceRect.width - 40) / width;
                const scaleY = (workspaceRect.height - 40) / height;
                const zoom = Math.min(1, Math.min(scaleX, scaleY));
                camera.zoom = zoom;
                camera.x = (workspaceRect.width - width * zoom) / 2 - minX * zoom + pad * zoom / 2;
                camera.y = (workspaceRect.height - height * zoom) / 2 - minY * zoom + pad * zoom / 2;
                updateCamera();
                showToast("⊡ Fit to view");
            };

            // ============================================================
            // MOUSE WHEEL ZOOM
            // ============================================================
            workspace.addEventListener("wheel", (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.08 : 0.08;
                camera.zoom = Math.min(2, Math.max(0.2, camera.zoom + delta));
                updateCamera();
            }, { passive: false });

            // ============================================================
            // MINI-MAP
            // ============================================================
            function updateMiniMap() {
                const canvas = miniMapCanvas;
                const ctx = canvas.getContext('2d');
                canvas.width = canvas.clientWidth * 2;
                canvas.height = canvas.clientHeight * 2;

                if (rooms.length === 0) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                    ctx.fillStyle = isDark ? '#1a1d26' : '#e8ecf2';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = isDark ? '#434b5c' : '#8a94a8';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('🏚️ empty', canvas.width / 2, canvas.height / 2 + 4);
                    miniViewport.style.display = 'none';
                    return;
                }

                let minX = Infinity,
                    minY = Infinity,
                    maxX = -Infinity,
                    maxY = -Infinity;
                rooms.forEach(r => {
                    minX = Math.min(minX, r.x);
                    minY = Math.min(minY, r.y);
                    maxX = Math.max(maxX, r.x + r.width);
                    maxY = Math.max(maxY, r.y + r.height);
                });
                const pad = 20;
                minX -= pad;
                minY -= pad;
                maxX += pad;
                maxY += pad;
                const totalW = maxX - minX;
                const totalH = maxY - minY;

                const scaleX = canvas.width / totalW;
                const scaleY = canvas.height / totalH;
                const scale = Math.min(scaleX, scaleY) * 0.9;

                const offsetX = (canvas.width - totalW * scale) / 2 - minX * scale;
                const offsetY = (canvas.height - totalH * scale) / 2 - minY * scale;

                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = isDark ? '#1a1d26' : '#e8ecf2';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const allConns = [...doors, ...hallways];
                allConns.forEach(conn => {
                    const isDoor = doors.includes(conn);
                    const pA = getAnchorWorldPos(conn.roomA, conn.anchorAPos || { x: 0.5, y: 0.5 },
                        isDoor ? doorOffset : 0);
                    const pB = getAnchorWorldPos(conn.roomB, conn.anchorBPos || { x: 0.5, y: 0.5 },
                        isDoor ? doorOffset : 0);
                    const ax = pA.x * scale + offsetX;
                    const ay = pA.y * scale + offsetY;
                    const bx = pB.x * scale + offsetX;
                    const by = pB.y * scale + offsetY;
                    ctx.strokeStyle = isDoor ? '#d4b68a88' : '#6a7a8e88';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(bx, by);
                    ctx.stroke();
                });

                rooms.forEach(room => {
                    const x = room.x * scale + offsetX;
                    const y = room.y * scale + offsetY;
                    const w = room.width * scale;
                    const h = room.height * scale;

                    ctx.fillStyle = room.color || '#4f6bff';
                    ctx.fillRect(x, y, Math.max(2, w), Math.max(2, h));
                    ctx.strokeStyle = isDark ? '#ffffff44' : '#00000022';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, Math.max(2, w), Math.max(2, h));

                    if (w > 20 && h > 12) {
                        ctx.fillStyle = isDark ? '#ffffffcc' : '#000000cc';
                        ctx.font = `${Math.min(10, w/5)}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const name = room.name.length > 10 ? room.name.slice(0, 8) + '…' : room.name;
                        ctx.fillText(name, x + w / 2, y + h / 2);
                    }
                });

                const viewRect = workspace.getBoundingClientRect();
                const vx = -camera.x / camera.zoom * scale + offsetX;
                const vy = -camera.y / camera.zoom * scale + offsetY;
                const vw = viewRect.width / camera.zoom * scale;
                const vh = viewRect.height / camera.zoom * scale;

                miniViewport.style.display = 'block';
                miniViewport.style.left = (vx / (canvas.width / canvas.clientWidth)) + 'px';
                miniViewport.style.top = (vy / (canvas.height / canvas.clientHeight)) + 'px';
                miniViewport.style.width = (vw / (canvas.width / canvas.clientWidth)) + 'px';
                miniViewport.style.height = (vh / (canvas.height / canvas.clientHeight)) + 'px';
            }

            miniMapCanvas.addEventListener('click', (e) => {
                const rect = miniMapCanvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;

                if (rooms.length === 0) return;
                let minX = Infinity,
                    minY = Infinity,
                    maxX = -Infinity,
                    maxY = -Infinity;
                rooms.forEach(r => {
                    minX = Math.min(minX, r.x);
                    minY = Math.min(minY, r.y);
                    maxX = Math.max(maxX, r.x + r.width);
                    maxY = Math.max(maxY, r.y + r.height);
                });
                const pad = 20;
                minX -= pad;
                minY -= pad;
                maxX += pad;
                maxY += pad;
                const totalW = maxX - minX;
                const totalH = maxY - minY;

                const workspaceRect = workspace.getBoundingClientRect();
                const centerX = minX + totalW * x;
                const centerY = minY + totalH * y;

                camera.x = workspaceRect.width / 2 - centerX * camera.zoom;
                camera.y = workspaceRect.height / 2 - centerY * camera.zoom;
                updateCamera();
            });
            miniMapCanvas.addEventListener('keydown', (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    document.getElementById("fitViewBtn").click();
                }
            });

            // ============================================================
            // INIT
            // ============================================================
            function initDemo() {
                const r1 = createRoom(60, 60, 160, 100, "Great Hall", "#4f6bff");
                const r2 = createRoom(320, 80, 120, 140, "Library", "#3bb273");
                const r3 = createRoom(520, 60, 100, 80, "Armory", "#e59f3b");
                const r4 = createRoom(150, 250, 200, 90, "Throne Room", "#b45cff");
                const r5 = createRoom(480, 280, 140, 100, "Treasure Vault", "#e05252");
                const r6 = createRoom(700, 150, 120, 120, "Barracks", "#3fc1c9");
                addDoor(r1, r2);
                addHallway(r2, r3);
                addDoor(r1, r4);
                addHallway(r4, r5);
                addDoor(r3, r5);
                addDoor(r2, r6);
                addHallway(r5, r6);
                selectRoom(r1);
                setMode("select");
                updateAllConnections();
                renderConnectionList();
                updateCamera();
                updateMiniMap();
                saveState();
            }
            function applyAccessibilityDefaults() {
                workspace.tabIndex = 0;
                miniMapCanvas.tabIndex = 0;
                document.querySelectorAll("button").forEach((button) => {
                    if (!button.getAttribute("aria-label")) {
                        const label = button.title || button.textContent;
                        if (label) button.setAttribute("aria-label", label.trim());
                    }
                });
                document.querySelectorAll("input, canvas, main, aside").forEach((el) => {
                    if (!el.getAttribute("aria-label")) {
                        const fromLabel = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
                        const prevLabel = el.previousElementSibling && el.previousElementSibling.tagName === "LABEL"
                            ? el.previousElementSibling.textContent
                            : "";
                        const fallback = fromLabel?.textContent || prevLabel || el.id || el.tagName.toLowerCase();
                        el.setAttribute("aria-label", fallback.trim());
                    }
                });
            }

            document.getElementById("shortcutsBtn").addEventListener("click", () => {
                shortcutsModal.classList.add("show");
                shortcutsModal.setAttribute("aria-hidden", "false");
            });
            document.getElementById("closeShortcutsBtn").addEventListener("click", () => {
                shortcutsModal.classList.remove("show");
                shortcutsModal.setAttribute("aria-hidden", "true");
            });
            shortcutsModal.addEventListener("click", (event) => {
                if (event.target === shortcutsModal) {
                    shortcutsModal.classList.remove("show");
                    shortcutsModal.setAttribute("aria-hidden", "true");
                }
            });

            const restored = loadPersistedProject();
            if (!restored) initDemo();
            applyAccessibilityDefaults();
            window.PixelForgeTools.bindInstallPrompt("installBtn", setSaveStatus);
            window.PixelForgeTools.registerServiceWorker(setSaveStatus);
            setProjectName(currentProjectName);
            if (!restored) setSaveStatus("Ready");

            workspace.addEventListener("contextmenu", (e) => e.preventDefault());

            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(scheduleMiniMapUpdate, 200);
            });

            setInterval(() => {
                if (!moving && !resizing && !drawing) {
                    updateAllConnections();
                }
            }, 500);

            setInterval(scheduleMiniMapUpdate, 1000);
            setInterval(() => {
                if (!dirtySince) return;
                persistProject(true);
            }, 30000);
})();
