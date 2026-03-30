const canvas = document.getElementById('canvas');
const layerRings = document.getElementById('layer-rings');
const layerPath = document.getElementById('layer-path');
const layerPoints = document.getElementById('layer-points');

// Controls
const ringsSlider = document.getElementById('ringsSlider');
const ringsValue = document.getElementById('ringsValue');
const linesOpacitySlider = document.getElementById('linesOpacitySlider');
const linesOpacityValue = document.getElementById('linesOpacityValue');
const sizeSlider = document.getElementById('sizeSlider');
const sizeValue = document.getElementById('sizeValue');
const rotationSlider = document.getElementById('rotationSlider');
const rotationValue = document.getElementById('rotationValue');
const transformGroup = document.getElementById('transform-group');
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
const btnClear = document.getElementById('btnClear');
const btnExport = document.getElementById('btnExport');

const pointOptions = document.getElementById('pointOptions');
const btnSharp = document.getElementById('btnSharp');
const btnLinked = document.getElementById('btnLinked');
const btnFree = document.getElementById('btnFree');
const btnDeletePoint = document.getElementById('btnDeletePoint');
const btnTheme = document.getElementById('btnTheme');
const iconSun = document.getElementById('iconSun');
const iconMoon = document.getElementById('iconMoon');

const btnCircle = document.getElementById('btnCircle');
const btnTriangle = document.getElementById('btnTriangle');
const btnSquare = document.getElementById('btnSquare');
const btnPentagon = document.getElementById('btnPentagon');
const btnHexagon = document.getElementById('btnHexagon');

// Application State
let state = {
    points: [], // Array of {x, y, h1: {x,y}, h2: {x,y}, type: 'sharp' | 'linked' | 'free'}
    isClosed: false,
    numRings: parseInt(ringsSlider.value, 10),
    transformScale: 1.0,
    transformRotation: 0,
    linesOpacity: 1.0,
};

// Selection and Dragging State
let history = [];
let historyIndex = -1;
let dragTargetIndex = -1;
let dragType = null; // 'point', 'h1', 'h2'
let dragStartCoords = null; 
let dragStartPt = null;
let selectedPointIndex = -1;
let lastClickTime = 0;
let lastClickIndex = -1;

// Init
if (localStorage.getItem('labyrinth-theme') === 'light') applyTheme('light');
saveState();
attachEventListeners();
render();

// =======================
// State Management
// =======================

function saveState() {
    const clone = JSON.parse(JSON.stringify(state));
    history.splice(historyIndex + 1);
    history.push(clone);
    historyIndex++;
    updateButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        state = JSON.parse(JSON.stringify(history[historyIndex]));
        selectedPointIndex = -1;
        updateUIFromState();
        render();
        updateButtons();
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        state = JSON.parse(JSON.stringify(history[historyIndex]));
        selectedPointIndex = -1;
        updateUIFromState();
        render();
        updateButtons();
    }
}

function clearCanvas() {
    state.points = [];
    state.isClosed = false;
    selectedPointIndex = -1;
    saveState();
    render();
}

function updateButtons() {
    btnUndo.disabled = historyIndex <= 0;
    btnRedo.disabled = historyIndex >= history.length - 1;
}

function updateUIFromState() {
    ringsSlider.value = state.numRings;
    ringsValue.innerText = state.numRings;
    const sizePct = Math.round(state.transformScale * 100);
    sizeSlider.value = sizePct;
    sizeValue.innerText = sizePct + '%';
    rotationSlider.value = state.transformRotation;
    rotationValue.innerText = state.transformRotation + '°';
    const opPct = Math.round(state.linesOpacity * 100);
    linesOpacitySlider.value = opPct;
    linesOpacityValue.innerText = opPct + '%';

    if (selectedPointIndex > -1 && selectedPointIndex < state.points.length) {
        pointOptions.style.opacity = '1';
        pointOptions.style.pointerEvents = 'all';
        const type = state.points[selectedPointIndex].type || 'free';
        btnSharp.classList.toggle('active', type === 'sharp');
        btnLinked.classList.toggle('active', type === 'linked');
        btnFree.classList.toggle('active', type === 'free');
    } else {
        pointOptions.style.opacity = '0.5';
        pointOptions.style.pointerEvents = 'none';
        btnSharp.classList.remove('active');
        btnLinked.classList.remove('active');
        btnFree.classList.remove('active');
    }
}

// =======================
// Mathematical Helpers
// =======================

function distToSegment(p, v, w) {
    const l2 = (w.x - v.x)*(w.x - v.x) + (w.y - v.y)*(w.y - v.y);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
}

// Samples the cubic bezier between p1→p2 (using their handles) and returns
// the minimum distance from point p to the actual curve.
function distToBezier(p, p1, p2, samples = 30) {
    let minDist = Infinity;
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const mt = 1 - t;
        const x = mt*mt*mt*p1.x + 3*mt*mt*t*p1.h2.x + 3*mt*t*t*p2.h1.x + t*t*t*p2.x;
        const y = mt*mt*mt*p1.y + 3*mt*mt*t*p1.h2.y + 3*mt*t*t*p2.h1.y + t*t*t*p2.y;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < minDist) minDist = d;
    }
    return minDist;
}

// =======================
// Event Listeners
// =======================

function attachEventListeners() {
    ringsSlider.addEventListener('input', (e) => {
        let val = parseInt(e.target.value, 10);
        if (val % 2 !== 0) val += 1;
        ringsValue.innerText = val;
        state.numRings = val;
        render();
    });
    ringsSlider.addEventListener('change', saveState);

    linesOpacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        linesOpacityValue.innerText = val + '%';
        state.linesOpacity = val / 100;
        render();
    });
    linesOpacitySlider.addEventListener('change', saveState);

    sizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        sizeValue.innerText = val + '%';
        state.transformScale = val / 100;
        render();
    });
    sizeSlider.addEventListener('change', saveState);

    rotationSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        rotationValue.innerText = val + '°';
        state.transformRotation = val;
        render();
    });
    rotationSlider.addEventListener('change', saveState);

    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);
    btnClear.addEventListener('click', clearCanvas);
    btnExport.addEventListener('click', exportSVG);

    btnSharp.addEventListener('click', () => setTypeForSelected('sharp'));
    btnLinked.addEventListener('click', () => setTypeForSelected('linked'));
    btnFree.addEventListener('click', () => setTypeForSelected('free'));
    btnDeletePoint.addEventListener('click', deleteSelectedPoint);
    btnTheme.addEventListener('click', toggleTheme);

    window.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPointIndex > -1) {
            // Don't fire when typing in an input
            if (document.activeElement.tagName === 'INPUT') return;
            deleteSelectedPoint();
        }
    });

    btnCircle.addEventListener('click', () => generateShape('circle'));
    btnTriangle.addEventListener('click', () => generateShape('triangle'));
    btnSquare.addEventListener('click', () => generateShape('square'));
    btnPentagon.addEventListener('click', () => generateShape('pentagon'));
    btnHexagon.addEventListener('click', () => generateShape('hexagon'));

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);
}

function applyTheme(mode) {
    if (mode === 'light') {
        document.body.classList.add('light');
        iconSun.style.display = 'block';
        iconMoon.style.display = 'none';
    } else {
        document.body.classList.remove('light');
        iconSun.style.display = 'none';
        iconMoon.style.display = 'block';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light');
    const next = isLight ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('labyrinth-theme', next);
    render();
}

function deleteSelectedPoint() {
    if (selectedPointIndex < 0 || selectedPointIndex >= state.points.length) return;
    state.points.splice(selectedPointIndex, 1);
    if (state.points.length < 3) state.isClosed = false;
    selectedPointIndex = -1;
    saveState();
    updateUIFromState();
    render();
}

function setTypeForSelected(type) {
    if (selectedPointIndex > -1) {
        const pt = state.points[selectedPointIndex];
        pt.type = type;

        if (type === 'sharp') {
            pt.h1.x = pt.x; pt.h1.y = pt.y;
            pt.h2.x = pt.x; pt.h2.y = pt.y;
        } else if (type === 'linked') {
            // Mirror h2 from h1
            if (pt.h1.x === pt.x && pt.h1.y === pt.y) {
                // If it was sharp previously, pull handles out defaultly
                pt.h1.x = pt.x - 30; pt.h1.y = pt.y;
            }
            pt.h2.x = pt.x + (pt.x - pt.h1.x);
            pt.h2.y = pt.y + (pt.y - pt.h1.y);
        } else if (type === 'free') {
            if (pt.h1.x === pt.x && pt.h1.y === pt.y) {
                pt.h1.x = pt.x - 30; pt.h1.y = pt.y;
                pt.h2.x = pt.x + 30; pt.h2.y = pt.y;
            }
        }
        
        saveState();
        updateUIFromState();
        render();
    }
}

function generateShape(type) {
    if (state.points.length > 0) {
        if (!confirm("This will replace your current shape. Continue?")) return;
    }

    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2 || 300;
    const cy = rect.height / 2 || 300;
    const r = Math.min(cx, cy) * 0.6; 

    let newPts = [];

    if (type === 'circle') {
        const magic = r * 0.552284749831;
        newPts = [
            { x: cx, y: cy - r, h1: { x: cx - magic, y: cy - r }, h2: { x: cx + magic, y: cy - r }, type: 'linked' },
            { x: cx + r, y: cy, h1: { x: cx + r, y: cy - magic }, h2: { x: cx + r, y: cy + magic }, type: 'linked' },
            { x: cx, y: cy + r, h1: { x: cx + magic, y: cy + r }, h2: { x: cx - magic, y: cy + r }, type: 'linked' },
            { x: cx - r, y: cy, h1: { x: cx - r, y: cy + magic }, h2: { x: cx - r, y: cy - magic }, type: 'linked' } 
        ];
    } else {
        let sides = 4;
        if (type === 'triangle') sides = 3;
        else if (type === 'square') sides = 4;
        else if (type === 'pentagon') sides = 5;
        else if (type === 'hexagon') sides = 6;

        // Start pointing up for aesthetic symmetry
        const startAngle = -Math.PI / 2; 
        for (let i = 0; i < sides; i++) {
            const angle = startAngle + (i * 2 * Math.PI / sides);
            const px = cx + Math.cos(angle) * r;
            const py = cy + Math.sin(angle) * r;
            newPts.push({
                x: px, y: py,
                h1: { x: px, y: py },
                h2: { x: px, y: py },
                type: 'sharp'
            });
        }
    }

    state.points = newPts;
    state.isClosed = true; // Auto-close generated shapes
    selectedPointIndex = -1;
    saveState();
    updateUIFromState();
    render();
}

// =======================
// Interaction Logic
// =======================

function getSVGCoords(e) {
    const pt = canvas.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = transformGroup.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
}

function handleMouseDown(e) {
    if (e.button !== 0) return; 
    
    if (e.target.classList.contains('handle')) {
        dragTargetIndex = parseInt(e.target.getAttribute('data-index'), 10);
        dragType = e.target.getAttribute('data-type');
        dragStartCoords = getSVGCoords(e);
        const ref = state.points[dragTargetIndex];
        dragStartPt = { 
            h1: {x: ref.h1.x, y: ref.h1.y}, 
            h2: {x: ref.h2.x, y: ref.h2.y} 
        };
        return;
    }

    if (e.target.classList.contains('point')) {
        const pointIdx = parseInt(e.target.getAttribute('data-index'), 10);
        
        const now = Date.now();
        if (lastClickIndex === pointIdx && now - lastClickTime < 300) {
            state.points.splice(pointIdx, 1);
            if (selectedPointIndex === pointIdx) selectedPointIndex = -1;
            else if (selectedPointIndex > pointIdx) selectedPointIndex--;
            lastClickIndex = -1;
            saveState();
            updateUIFromState();
            render();
            return;
        }
        lastClickTime = now;
        lastClickIndex = pointIdx;

        dragTargetIndex = pointIdx;
        dragType = 'point';
        selectedPointIndex = dragTargetIndex;
        dragStartCoords = getSVGCoords(e);
        const ref = state.points[dragTargetIndex];
        dragStartPt = {
            x: ref.x, y: ref.y,
            h1: {x: ref.h1.x, y: ref.h1.y},
            h2: {x: ref.h2.x, y: ref.h2.y}
        };
        updateUIFromState();
        render(); 
        return;
    }

    const coords = getSVGCoords(e);

    // Always try to insert a node on the nearest path segment when clicking
    // near enough — works anywhere on the shape, not just the thin border line.
    if (state.points.length > 1) {
        let minDst = Infinity;
        let insertIdx = -1;
        const len = state.points.length;
        for (let i = 0; i < len; i++) {
            if (!state.isClosed && i === len - 1) break;
            const p1 = state.points[i];
            const p2 = state.points[(i + 1) % len];
            const d = distToBezier(coords, p1, p2);
            if (d < minDst) { minDst = d; insertIdx = i + 1; }
        }
        if (insertIdx !== -1 && minDst < 20) {
            state.points.splice(insertIdx, 0, {
                x: coords.x, y: coords.y,
                h1: {x: coords.x - 30, y: coords.y},
                h2: {x: coords.x + 30, y: coords.y},
                type: 'linked'
            });
            selectedPointIndex = insertIdx;
            saveState();
            updateUIFromState();
            render();
            return;
        }
    }

    if (!state.isClosed) {
        state.points.push({
            x: coords.x, y: coords.y,
            h1: {x: coords.x - 30, y: coords.y},
            h2: {x: coords.x + 30, y: coords.y},
            type: 'linked'
        });
        selectedPointIndex = state.points.length - 1;
        saveState();
        updateUIFromState();
        render();
    } else {
        selectedPointIndex = -1;
        updateUIFromState();
        render();
    }
}

function handleMouseMove(e) {
    if (dragTargetIndex > -1 && dragStartCoords) {
        const coords = getSVGCoords(e);
        const dx = coords.x - dragStartCoords.x;
        const dy = coords.y - dragStartCoords.y;
        const pt = state.points[dragTargetIndex];
        
        if (dragType === 'point') {
            pt.x = dragStartPt.x + dx;
            pt.y = dragStartPt.y + dy;
            pt.h1.x = dragStartPt.h1.x + dx;
            pt.h1.y = dragStartPt.h1.y + dy;
            pt.h2.x = dragStartPt.h2.x + dx;
            pt.h2.y = dragStartPt.h2.y + dy;
        } else if (dragType === 'h1') {
            pt.h1.x = dragStartPt.h1.x + dx;
            pt.h1.y = dragStartPt.h1.y + dy;
            if (pt.type === 'linked') {
                pt.h2.x = pt.x + (pt.x - pt.h1.x);
                pt.h2.y = pt.y + (pt.y - pt.h1.y);
            }
        } else if (dragType === 'h2') {
            pt.h2.x = dragStartPt.h2.x + dx;
            pt.h2.y = dragStartPt.h2.y + dy;
            if (pt.type === 'linked') {
                pt.h1.x = pt.x + (pt.x - pt.h2.x);
                pt.h1.y = pt.y + (pt.y - pt.h2.y);
            }
        }
        render();
    }
}

function handleMouseUp(e) {
    if (dragTargetIndex > -1) {
        dragTargetIndex = -1;
        dragStartCoords = null;
        dragType = null;
        saveState(); 
        updateUIFromState();
    }
}

function handleContextMenu(e) {
    e.preventDefault(); 
    if (!state.isClosed && state.points.length > 2) {
        state.isClosed = true;
        saveState();
        render();
    }
}

// =======================
// Geometry & Rendering
// =======================

function getBezierPath(pts, isClosed) {
    if (pts.length === 0) return "";
    let pathStr = `M ${pts[0].x},${pts[0].y} `;
    
    for (let i = 1; i < pts.length; i++) {
        const prev = pts[i-1];
        const curr = pts[i];
        pathStr += `C ${prev.h2.x},${prev.h2.y} ${curr.h1.x},${curr.h1.y} ${curr.x},${curr.y} `;
    }
    
    if (isClosed && pts.length > 2) {
        const prev = pts[pts.length - 1];
        const curr = pts[0];
        pathStr += `C ${prev.h2.x},${prev.h2.y} ${curr.h1.x},${curr.h1.y} ${curr.x},${curr.y} Z`;
    }
    return pathStr;
}

function render() {
    layerPoints.innerHTML = '';
    layerPath.innerHTML = '';
    layerRings.innerHTML = '';

    if (state.points.length === 0) {
        transformGroup.removeAttribute('transform');
        return;
    }

    // Apply size and rotation transform centred on the shape
    const tcx = state.points.reduce((s, p) => s + p.x, 0) / state.points.length;
    const tcy = state.points.reduce((s, p) => s + p.y, 0) / state.points.length;
    const s = state.transformScale;
    const r = state.transformRotation;
    transformGroup.setAttribute('transform',
        `translate(${tcx},${tcy}) rotate(${r}) scale(${s}) translate(${-tcx},${-tcy})`);

    // Compensate stroke widths for the transform scale so all lines stay
    // at a fixed visual pixel width regardless of how large the shape is.
    const lineW_svg = 2 / state.transformScale;

    // 1. Draw main path
    const mainPathStr = getBezierPath(state.points, state.isClosed);
    const exteriorColor = `rgba(136,136,136,${state.linesOpacity})`;
    layerPath.innerHTML = `<path d="${mainPathStr}" class="main-path ${!state.isClosed ? 'incomplete-path' : ''}" style="fill:none; stroke-width:${lineW_svg}; stroke:${exteriorColor}" />`;

    // 2. Draw inset rings using SVG stroke trick for perfectly uniform lane widths.
    // Instead of scaling (which distorts irregular shapes), we draw the same path
    // N times with decreasing stroke widths, clipped to the shape interior.
    // The browser's native stroke renderer handles Bezier curves perfectly.
    if (state.isClosed && state.points.length > 2) {
        const cx = state.points.reduce((s, p) => s + p.x, 0) / state.points.length;
        const cy = state.points.reduce((s, p) => s + p.y, 0) / state.points.length;
        // Use average distance from centroid to estimate the interior "radius",
        // giving us a stroke width that fills the interior with equal-width lanes.
        const avgRadius = state.points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / state.points.length;
        const totalStrokeW = avgRadius * 2;
        const laneW = totalStrokeW / state.numRings;

        const accentColor = '#ffffff';
        const o = state.linesOpacity;
        const gapColor = `rgba(68,68,68,${o})`;

        let html = `<defs><clipPath id="shape-clip"><path d="${mainPathStr}" /></clipPath></defs>`;
        html += `<g clip-path="url(#shape-clip)">`;

        // Step 1: flood the entire interior with the accent color.
        html += `<path d="${mainPathStr}" fill="none" stroke="${accentColor}" stroke-width="${totalStrokeW}" stroke-linejoin="round" stroke-linecap="round" />`;

        // Step 2: for each lane boundary (N-1 of them), carve a dark gap then restore
        // the accent inside it. Processing outermost-to-innermost keeps strokes in
        // strictly decreasing order so each new layer only affects the inner region.
        // Each gap is centred at visual depth i * laneW/2 from the outer boundary.
        // lineW_svg is already scale-compensated so the gap stays at a fixed pixel width.
        for (let i = state.numRings - 1; i >= 1; i--) {
            html += `<path d="${mainPathStr}" fill="none" stroke="${gapColor}"   stroke-width="${i * laneW + lineW_svg}" stroke-linejoin="round" stroke-linecap="round" />`;
            html += `<path d="${mainPathStr}" fill="none" stroke="${accentColor}" stroke-width="${i * laneW - lineW_svg}" stroke-linejoin="round" stroke-linecap="round" />`;
        }

        html += `</g>`;
        layerRings.innerHTML = html;
    }

    // 3. Draw Handles for Selected Point First (if not sharp)
    if (selectedPointIndex > -1 && selectedPointIndex < state.points.length) {
        const pt = state.points[selectedPointIndex];
        
        if (pt.type !== 'sharp') {
            layerPoints.innerHTML += `<line x1="${pt.x}" y1="${pt.y}" x2="${pt.h1.x}" y2="${pt.h1.y}" class="handle-line" />`;
            layerPoints.innerHTML += `<line x1="${pt.x}" y1="${pt.y}" x2="${pt.h2.x}" y2="${pt.h2.y}" class="handle-line" />`;
            
            layerPoints.innerHTML += `<circle cx="${pt.h1.x}" cy="${pt.h1.y}" r="4" class="handle" data-index="${selectedPointIndex}" data-type="h1" />`;
            layerPoints.innerHTML += `<circle cx="${pt.h2.x}" cy="${pt.h2.y}" r="4" class="handle" data-index="${selectedPointIndex}" data-type="h2" />`;
        }
    }

    // 4. Draw Anchor Points
    // Each point gets a large transparent hit zone so it's easy to grab,
    // plus a smaller visible circle on top for aesthetics.
    state.points.forEach((pt, i) => {
        const isSelected = i === selectedPointIndex;

        const hitZone = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        hitZone.setAttribute("cx", pt.x);
        hitZone.setAttribute("cy", pt.y);
        hitZone.setAttribute("r", 14);
        hitZone.setAttribute("fill", "transparent");
        hitZone.setAttribute("stroke", "none");
        hitZone.setAttribute("pointer-events", "all");
        hitZone.setAttribute("class", `point ${isSelected ? 'selected' : ''} ${pt.type === 'sharp' ? 'sharp-node' : ''}`);
        hitZone.setAttribute("data-index", i);
        layerPoints.appendChild(hitZone);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", pt.x);
        circle.setAttribute("cy", pt.y);
        circle.setAttribute("r", isSelected ? 6 : 4);
        circle.setAttribute("class", `point ${isSelected ? 'selected' : ''} ${pt.type === 'sharp' ? 'sharp-node' : ''}`);
        circle.setAttribute("data-index", i);
        circle.setAttribute("pointer-events", "none");
        layerPoints.appendChild(circle);
    });
}

// =======================
// Export
// =======================

function exportSVG() {
    const clonedSvg = canvas.cloneNode(true);
    const pointsLayer = clonedSvg.querySelector('#layer-points');
    if(pointsLayer) pointsLayer.remove();

    const applyStylesToExport = (node, fill, stroke, sWidth, dash = 'none') => {
        if (!node) return;
        node.setAttribute('fill', fill);
        node.setAttribute('stroke', stroke);
        node.setAttribute('stroke-width', sWidth);
        if (dash !== 'none') node.setAttribute('stroke-dasharray', dash);
    };

    const exteriorPath = clonedSvg.querySelector('.main-path');
    if (exteriorPath) {
        applyStylesToExport(exteriorPath, "none", "#888888", "3");
        exteriorPath.setAttribute('stroke-linejoin', 'round');
        exteriorPath.setAttribute('stroke-linecap', 'round');
        exteriorPath.removeAttribute('style'); // remove inline fill:none so the attribute takes over
    }

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clonedSvg);
    
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const svgBlob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "labyrinth-pattern.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
}
