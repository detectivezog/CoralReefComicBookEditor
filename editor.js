let activeCell = null, activeDoodle = null, activeBar = null;
let history = [], historyStep = -1;
const canvas = document.getElementById('main-canvas');
const zoomSlider = document.getElementById('zoom-slider');
const divOverlay = document.getElementById('division-overlay');
const doodleOverlay = document.getElementById('doodle-overlay');

// --- 1. CORE IO & HISTORY ---
function saveState() {
    history = history.slice(0, historyStep + 1);
    history.push(canvas.innerHTML);
    historyStep++;
    setTimeout(() => {
        document.getElementById('csv-preview').value = `DATA:${canvas.innerHTML.replace(/\n/g, '').replace(/\s{2,}/g, ' ')}`;
    }, 100);
}
function undo() { if(historyStep > 0) { historyStep--; canvas.innerHTML = history[historyStep]; } }
function redo() { if(historyStep < history.length - 1) { historyStep++; canvas.innerHTML = history[historyStep]; } }
function resetCanvas() { if(confirm("Clear layout?")) { canvas.innerHTML = '<div class="cell" id="root" style="flex: 1 1 100%;"><div class="cell-padder" data-c1="#ffffff" data-c2="#e2e8f0" data-ang="135" style="background-image: linear-gradient(135deg, #ffffff, #e2e8f0);"></div></div>'; saveState(); } }
function resizeCanvas() { canvas.style.width = document.getElementById('canv-w').value + 'px'; canvas.style.height = document.getElementById('canv-h').value + 'px'; saveState(); }
zoomSlider.oninput = (e) => document.getElementById('canvas-scale-container').style.transform = `scale(${e.target.value})`;

function downloadCSV() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([document.getElementById('csv-preview').value], {type:'text/csv'})); a.download = document.getElementById('proj-name').value + ".csv"; a.click(); }
function loadCSVFromFile(el) {
    if(!el.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const raw = e.target.result;
        if(raw && raw.includes("DATA:")) { canvas.innerHTML = raw.split("DATA:")[1]; saveState(); }
    };
    reader.readAsText(el.files[0]);
    el.value = '';
}

// --- NATIVE OFFLINE PNG EXPORT ENGINE ---
async function exportPNG() {
    console.log("Stamping PNG with Gutter-Matched Frame...");
    const originalCanvas = document.getElementById('main-canvas');
    const width = parseInt(document.getElementById('canv-w').value);
    const height = parseInt(document.getElementById('canv-h').value);
    const zoom = parseFloat(document.getElementById('zoom-slider').value);
    const frameSize = parseInt(document.getElementById('canv-frame').value) || 0;

    // Pull Global Gutter Colors for the Frame
    const gutC1 = document.getElementById('gutter-c1').value;
    const gutC2 = document.getElementById('gutter-c2').value;
    const gutAng = parseInt(document.getElementById('gutter-angle').value);

    const out = document.createElement('canvas');
    out.width = width + (frameSize * 2);
    out.height = height + (frameSize * 2);
    const ctx = out.getContext('2d');

    const getGradientCoords = (w, h, ang) => {
        const anglePI = (ang - 90) * Math.PI / 180;
        const r = Math.sqrt(w*w + h*h) / 2;
        return { x1: w/2 - Math.cos(anglePI) * r, y1: h/2 - Math.sin(anglePI) * r, x2: w/2 + Math.cos(anglePI) * r, y2: h/2 + Math.sin(anglePI) * r };
    };

    // 1. Fill Frame with Gutter Gradient
    const { x1, y1, x2, y2 } = getGradientCoords(out.width, out.height, gutAng);
    const frameGrad = ctx.createLinearGradient(x1, y1, x2, y2);
    frameGrad.addColorStop(0, gutC1);
    frameGrad.addColorStop(1, gutC2);
    ctx.fillStyle = frameGrad;
    ctx.fillRect(0, 0, out.width, out.height);

    ctx.translate(frameSize, frameSize);

    const imgCache = new Map();
    const getImg = (src) => new Promise(res => {
        if (imgCache.has(src)) return res(imgCache.get(src));
        const img = new Image();
        img.onload = () => { imgCache.set(src, img); res(img); };
        img.onerror = () => res(null);
        img.src = src;
    });

    const wordWrap = (context, text, maxWidth) => {
        const lines = [];
        const paragraphs = text.split('\n');
        for (const paragraph of paragraphs) {
            let line = '';
            const words = paragraph.split(' ');
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                if (context.measureText(testLine).width > maxWidth && n > 0) {
                    lines.push(line.trim()); line = words[n] + ' ';
                } else { line = testLine; }
            }
            lines.push(line.trim());
        }
        return lines;
    };

    const stampElement = async (el) => {
        const rect = el.getBoundingClientRect();
        const canvasRect = originalCanvas.getBoundingClientRect();
        const x = (rect.left - canvasRect.left) / zoom;
        const y = (rect.top - canvasRect.top) / zoom;
        const w = rect.width / zoom;
        const h = rect.height / zoom;

        if (w < 1 || h < 1 || el.classList.contains('resizer') || el.classList.contains('resizer-bar')) return;
        const style = window.getComputedStyle(el);

        if (el.classList.contains('cell')) {
            if (style.backgroundImage.startsWith('linear-gradient')) {
                const m = style.backgroundImage.match(/(\d+)deg,\s*(rgb\(\d+,\s*\d+,\s*\d+\)),\s*(rgb\(\d+,\s*\d+,\s*\d+\))/);
                if(m) {
                    const { x1, y1, x2, y2 } = getGradientCoords(w, h, parseInt(m[1]));
                    const grad = ctx.createLinearGradient(x + x1, y + y1, x + x2, y + y2);
                    grad.addColorStop(0, m[2]); grad.addColorStop(1, m[3]);
                    ctx.fillStyle = grad; ctx.fillRect(x, y, w, h);
                }
            }
        }

        if (el.classList.contains('cell-padder')) {
            if (style.backgroundImage.startsWith('linear-gradient')) {
                const m = style.backgroundImage.match(/(\d+)deg,\s*(rgb\(\d+,\s*\d+,\s*\d+\)),\s*(rgb\(\d+,\s*\d+,\s*\d+\))/);
                if (m) {
                    const { x1, y1, x2, y2 } = getGradientCoords(w, h, parseInt(m[1]));
                    const grad = ctx.createLinearGradient(x + x1, y + y1, x + x2, y + y2);
                    grad.addColorStop(0, m[2]); grad.addColorStop(1, m[3]);
                    ctx.fillStyle = grad; ctx.fillRect(x, y, w, h);
                }
            }
            if (style.backgroundImage.includes('url(')) {
                const img = await getImg(style.backgroundImage.match(/url\(["']?([^"']*)["']?\)/)[1]);
                if (img) {
                    ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
                    const bP = style.backgroundPosition.split(' ');
                    const oX = (parseFloat(bP[0]) || 50) / 100, oY = (parseFloat(bP[1]) || 50) / 100;
                    const scale = Math.max(w / img.width, h / img.height);
                    const iW = img.width * scale, iH = img.height * scale;
                    ctx.drawImage(img, x + (w - iW) * oX, y + (h - iH) * oY, iW, iH);
                    ctx.restore();
                }
            }
        }

        if (el.classList.contains('doodle')) {
            ctx.globalAlpha = parseFloat(style.opacity) || 1;
            const svg = el.querySelector('svg');
            if (svg) {
                const sS = window.getComputedStyle(svg);
                if (sS.filter.includes('drop-shadow')) {
                    const sm = sS.filter.match(/drop-shadow\((.*?)\)/);
                    if (sm) {
                        const p = sm[1].split(' ');
                        ctx.save(); ctx.shadowColor = p[3]; ctx.shadowOffsetX = parseFloat(p[0]); ctx.shadowOffsetY = parseFloat(p[1]); ctx.shadowBlur = parseFloat(p[2]);
                    }
                }
                const img = await getImg('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg)))));
                if (img) ctx.drawImage(img, x, y, w, h);
                if (ctx.shadowColor !== 'rgba(0, 0, 0, 0)') ctx.restore();
            }

            const bgD = el.querySelector('.doodle-bg');
            if (bgD) {
                const bS = window.getComputedStyle(bgD);
                if (bS.backgroundImage.includes('url(')) {
                    const img = await getImg(bS.backgroundImage.match(/url\(["']?([^"']*)["']?\)/)[1]);
                    if (img) {
                        ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
                        const bP = bS.backgroundPosition.split(' ');
                        const oX = (parseFloat(bP[0]) || 50) / 100, oY = (parseFloat(bP[1]) || 50) / 100;
                        const scale = Math.max(w / img.width, h / img.height);
                        const iW = img.width * scale, iH = img.height * scale;
                        ctx.drawImage(img, x + (w - iW) * oX, y + (h - iH) * oY, iW, iH);
                        ctx.restore();
                    }
                } else if (bS.backgroundColor) { ctx.fillStyle = bS.backgroundColor; ctx.fillRect(x, y, w, h); }
            }

            const txt = el.querySelector('.doodle-text');
            if (txt && txt.innerText) {
                const tS = window.getComputedStyle(txt);
                const tR = txt.getBoundingClientRect();
                const tW = tR.width / zoom;
                ctx.fillStyle = tS.color || "#000000";
                ctx.font = `${tS.fontStyle} ${tS.fontWeight} ${tS.fontSize} ${tS.fontFamily}`;
                ctx.textAlign = tS.textAlign || "center"; ctx.textBaseline = "middle";
                const lines = wordWrap(ctx, txt.innerText, tW);
                const lH = parseFloat(tS.lineHeight) || (parseFloat(tS.fontSize) * 1.2);
                const tBH = tR.height / zoom;
                const bSY = ((tR.top - canvasRect.top) / zoom) + (tBH - (lines.length * lH)) / 2;
                let sX = (tR.left - canvasRect.left) / zoom;
                if (ctx.textAlign === 'center') sX += tW / 2; else if (ctx.textAlign === 'right') sX += tW;
                lines.forEach((line, i) => { ctx.fillText(line, sX, bSY + (i * lH) + (lH / 2)); });
            }
            ctx.globalAlpha = 1;
        }
        for (const child of el.children) await stampElement(child);
    };

    await stampElement(originalCanvas);
    const link = document.createElement('a');
    link.download = (document.getElementById('proj-name').value || 'StudioExport') + '.png';
    link.href = out.toDataURL("image/png");
    link.click();
}

// --- 2. GRID & GUTTER ---
function applyGutter() {
    const size = document.getElementById('gutter-size').value + 'px';
    const c1 = document.getElementById('gutter-c1').value, c2 = document.getElementById('gutter-c2').value, ang = document.getElementById('gutter-angle').value;
    canvas.querySelectorAll('.cell').forEach(c => {
        if (c.children.length > 1 && c.querySelector('.resizer-bar')) { 
            c.style.gap = size; c.style.backgroundImage = `linear-gradient(${ang}deg, ${c1}, ${c2})`;
        } else { c.style.backgroundImage = "none"; c.style.gap = '0px'; }
    });
    saveState();
}

// --- 3. INTERCEPTOR ---
canvas.addEventListener('click', (e) => {
    if(e.target.closest('.doodle')) return; 
    if (e.target.classList.contains('resizer-bar')) {
        activeBar = e.target; divOverlay.style.display = 'block'; doodleOverlay.style.display = 'none';
        divOverlay.style.left = (e.clientX + 15) + 'px'; divOverlay.style.top = (e.clientY + 15) + 'px';
        document.getElementById('overlay-ratio').value = parseFloat(activeBar.previousElementSibling.style.flexGrow) || 1;
        return;
    }
    divOverlay.style.display = 'none';
    if (activeDoodle) { activeDoodle.classList.remove('active-doodle'); activeDoodle = null; doodleOverlay.style.display = 'none'; document.getElementById('cell-panel').style.display = 'flex'; }
    const cell = e.target.closest('.cell');
    if (!cell) return;
    selectCell(cell);
    const mode = document.querySelector('input[name="mode"]:checked').value;
    if (mode === 'split-v') split(cell, 'row'); else if (mode === 'split-h') split(cell, 'column'); else if (mode === 'delete' && cell.id !== 'root') deleteCell(cell);
});

// --- 4. SPLIT/DELETE ---
function split(cell, dir) {
    if (cell.querySelector('.cell')) return; 
    cell.style.flexDirection = dir; cell.style.flex = "1 1 auto"; 
    const p = cell.querySelector('.cell-padder');
    const dataAttrs = `data-c1="${p.getAttribute('data-c1')}" data-c2="${p.getAttribute('data-c2')}" data-ang="${p.getAttribute('data-ang')}"`;
    cell.innerHTML = `
        <div class="cell" style="flex: 1 1 50%;"><div class="cell-padder" ${dataAttrs} style="background-image:${p.style.backgroundImage}; background-size:${p.style.backgroundSize}; background-position:${p.style.backgroundPosition};"></div></div>
        <div class="resizer-bar ${dir === 'row' ? 'resizer-v' : 'resizer-h'}"></div>
        <div class="cell" style="flex: 1 1 50%;"><div class="cell-padder" ${dataAttrs} style="background-image:${p.style.backgroundImage}; background-size:${p.style.backgroundSize}; background-position:${p.style.backgroundPosition};"></div></div>`;
    attachResizerEvents(cell.querySelector('.resizer-bar')); applyGutter(); saveState();
}
function deleteCell(cell) {
    const parent = cell.parentElement;
    if(parent && parent.id !== 'root') {
        const sib = Array.from(parent.children).find(c => c.classList.contains('cell') && c !== cell);
        if(sib) { parent.parentElement.insertBefore(sib, parent); sib.style.flex = parent.style.flex; parent.remove(); }
    } else { cell.innerHTML = '<div class="cell-padder" data-c1="#ffffff" data-c2="#e2e8f0" data-ang="135" style="background-image: linear-gradient(135deg, #ffffff, #e2e8f0);"></div>'; }
    applyGutter(); saveState(); 
}
function attachResizerEvents(bar) {
    bar.onmousedown = (e) => {
        e.preventDefault(); e.stopPropagation();
        const prev = bar.previousElementSibling, next = bar.nextElementSibling, isRow = bar.classList.contains('resizer-v'), zoom = parseFloat(zoomSlider.value);
        let sP = isRow ? e.clientX : e.clientY, sPrev = isRow ? prev.offsetWidth : prev.offsetHeight, sNext = isRow ? next.offsetWidth : next.offsetHeight, total = sPrev + sNext;
        document.onmousemove = (ev) => {
            let d = ((isRow ? ev.clientX : ev.clientY) - sP) / zoom;
            if (sPrev + d < 20 || sNext - d < 20) return;
            prev.style.flex = `${(sPrev + d) / total} 1 0%`; next.style.flex = `${(sNext - d) / total} 1 0%`;
            if(divOverlay.style.display === 'block' && activeBar === bar) document.getElementById('overlay-ratio').value = ((sPrev + d) / (sNext - d)).toFixed(2);
        };
        document.onmouseup = () => { prev.style.flex = `0 0 ${prev.offsetWidth}px`; next.style.flex = `0 0 ${next.offsetHeight}px`; document.onmousemove = null; document.onmouseup = null; saveState(); };
    };
}
function applyOverlayRatio() { if(!activeBar) return; const r = parseFloat(document.getElementById('overlay-ratio').value) || 1; activeBar.previousElementSibling.style.flex = `${r} 1 0%`; activeBar.nextElementSibling.style.flex = `1 1 0%`; saveState(); }

// --- 5. CELL SYNC ---
function selectCell(cell) {
    if(activeDoodle) activeDoodle.classList.remove('active-doodle');
    if(activeCell) activeCell.classList.remove('selected-cell');
    activeCell = cell; activeCell.classList.add('selected-cell');
    document.getElementById('cell-panel').style.display = 'flex'; doodleOverlay.style.display = 'none';
    const p = cell.querySelector('.cell-padder');
    if(p) { 
        document.getElementById('cell-pad').value = parseInt(p.style.margin) || 0; 
        document.getElementById('cell-c1').value = p.getAttribute('data-c1') || '#ffffff';
        document.getElementById('cell-c2').value = p.getAttribute('data-c2') || '#e2e8f0';
        document.getElementById('cell-angle').value = p.getAttribute('data-ang') || '135';
        document.getElementById('cell-bg-size').value = p.style.backgroundSize || 'cover';
        const bP = (p.style.backgroundPosition || "50% 50%").split(' ');
        document.getElementById('cell-bg-x').value = parseInt(bP[0]) || 50; document.getElementById('cell-bg-y').value = parseInt(bP[1]) || 50;
    }
}
function applyCellStyle() {
    if(!activeCell) return; const p = activeCell.querySelector('.cell-padder'); if(!p) return;
    p.style.margin = document.getElementById('cell-pad').value + 'px';
    const c1 = document.getElementById('cell-c1').value, c2 = document.getElementById('cell-c2').value, ang = document.getElementById('cell-angle').value;
    p.setAttribute('data-c1', c1); p.setAttribute('data-c2', c2); p.setAttribute('data-ang', ang);
    if(!p.style.backgroundImage.includes('url(')) p.style.backgroundImage = `linear-gradient(${ang}deg, ${c1}, ${c2})`;
    p.style.backgroundSize = document.getElementById('cell-bg-size').value;
    p.style.backgroundPosition = `${document.getElementById('cell-bg-x').value}% ${document.getElementById('cell-bg-y').value}%`;
    saveState();
}
function uploadCellBG(el) {
    if(!activeCell || !el.files[0]) return;
    const r = new FileReader(); r.onload = (e) => { activeCell.querySelector('.cell-padder').style.backgroundImage = `url('${e.target.result}')`; saveState(); };
    r.readAsDataURL(el.files[0]); el.value = '';
}
function clearCellBG() { if(activeCell) { activeCell.querySelector('.cell-padder').style.backgroundImage = ''; applyCellStyle(); } }

// --- 6. DOODLES ---
function getShapeSVG(type) {
    const b = 'fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"';
    if(type === 'ellipse') return `<ellipse cx="50" cy="50" rx="48" ry="48" ${b}/>`;
    if(type === 'box') return `<rect x="2" y="2" width="96" height="96" rx="10" ry="10" ${b}/>`;
    if(type === 'cloud') return `<path d="M 25 60 A 20 20 0 0 1 40 25 A 25 25 0 0 1 75 35 A 15 15 0 0 1 85 60 Q 95 60 95 75 Q 95 90 75 90 L 25 90 Q 5 90 5 75 Q 5 60 25 60 Z" ${b}/>`;
    if(type === 'spiky') return `<polygon points="50,5 60,30 90,20 70,45 95,65 65,70 70,95 50,75 30,95 35,70 5,65 30,45 10,20 40,30" ${b}/>`;
    return '';
}
function addDoodleImgFromFile(el) {
    if(!activeCell || !el.files[0]) return;
    const r = new FileReader(); r.onload = (e) => { addDoodle('img', e.target.result); };
    r.readAsDataURL(el.files[0]); el.value = '';
}
function addDoodle(type, imgD = null) {
    if(!activeCell) return alert("Select cell.");
    const p = activeCell.querySelector('.cell-padder'), d = document.createElement('div');
    if(!p) return; d.className = 'doodle'; d.style.left = '20px'; d.style.top = '20px'; d.style.width = '200px'; d.style.height = '150px'; d.style.zIndex = '10';
    let bH = '', tC = type === 'img' ? '' : 'New Text...';
    if (type === 'text') bH = `<div class="doodle-bg" style="background:rgba(255,255,255,0.85); border:1px solid #ccc;"></div>`;
    else if (type === 'bubble') { bH = `<svg class="bubble-svg" data-shape="ellipse" viewBox="0 0 100 100" preserveAspectRatio="none">${getShapeSVG('ellipse')}</svg>`; d.dataset.isShape = "true"; }
    else if (type === 'img' && imgD) bH = `<div class="doodle-bg" style="background-image:url('${imgD}'); background-size:cover; background-position:50% 50%;"></div>`;
    d.innerHTML = `${bH}<div class="doodle-text" contenteditable="false">${tC}</div><div class="resizer"></div>`;
    attachDoodleEvents(d); p.appendChild(d); selectDoodle(d); saveState();
}
function attachDoodleEvents(d) {
    d.onmousedown = (e) => {
        if (document.querySelector('input[name="mode"]:checked').value !== 'doodle-transform') return;
        e.stopPropagation(); selectDoodle(d);
        let isR = e.target.classList.contains('resizer'), zoom = parseFloat(zoomSlider.value), sX = e.clientX, sY = e.clientY, sW = d.offsetWidth, sH = d.offsetHeight, sL = d.offsetLeft, sT = d.offsetTop;
        document.onmousemove = (ev) => {
            ev.preventDefault();
            if (isR) { d.style.width = Math.max(40, sW + (ev.clientX - sX)/zoom) + 'px'; d.style.height = Math.max(40, sH + (ev.clientY - sY)/zoom) + 'px'; }
            else { d.style.left = sL + (ev.clientX - sX)/zoom + 'px'; d.style.top = sT + (ev.clientY - sY)/zoom + 'px'; }
            updateDoodleOverlayDims();
        };
        document.onmouseup = () => { document.onmousemove = null; document.onmouseup = null; saveState(); };
    };
    const tN = d.querySelector('.doodle-text');
    tN.addEventListener('click', (e) => { if(document.querySelector('input[name="mode"]:checked').value === 'doodle-transform') { tN.contentEditable = 'true'; tN.focus(); e.stopPropagation(); } });
    tN.addEventListener('blur', () => { tN.contentEditable = 'false'; syncDoodleText(); saveState(); });
    tN.addEventListener('input', syncDoodleText);
}
function selectDoodle(d) {
    if(activeCell) activeCell.classList.remove('selected-cell');
    if(activeDoodle && activeDoodle !== d) activeDoodle.classList.remove('active-doodle');
    activeDoodle = d; activeDoodle.classList.add('active-doodle');
    document.getElementById('cell-panel').style.display = 'none';
    const o = document.getElementById('doodle-overlay'), w = document.getElementById('workspace').getBoundingClientRect(), r = d.getBoundingClientRect();
    o.style.display = 'block';
    let lP = (r.right - w.left) + 10, tP = (r.bottom - w.top) + 10;
    if (lP + 220 > w.width) lP = (r.left - w.left) - 230; if (tP + 250 > w.height) tP = (r.top - w.top) - 260;
    o.style.left = Math.max(10, lP) + 'px'; o.style.top = Math.max(10, tP) + 'px';
    const tN = d.querySelector('.doodle-text');
    document.getElementById('doodle-text-input').value = tN.innerText;
    document.getElementById('doodle-fs').value = parseInt(window.getComputedStyle(tN).fontSize) || 14;
    document.getElementById('doodle-z').value = parseInt(d.style.zIndex) || 10;
    document.getElementById('doodle-op').value = d.style.opacity || 1;
    document.getElementById('shape-selector-container').style.display = d.dataset.isShape === "true" ? 'flex' : 'none';
    if(d.dataset.isShape === "true") document.getElementById('doodle-shape').value = d.querySelector('.bubble-svg').dataset.shape || 'ellipse';
    const bgD = d.querySelector('.doodle-bg'), posR = document.getElementById('doodle-bg-pos-row');
    if (bgD && bgD.style.backgroundImage.includes('url')) {
        posR.style.display = 'flex'; const bP = (bgD.style.backgroundPosition || "50% 50%").split(' ');
        document.getElementById('doodle-bg-x').value = parseInt(bP[0]) || 50; document.getElementById('doodle-bg-y').value = parseInt(bP[1]) || 50;
    } else posR.style.display = 'none';
    updateDoodleOverlayDims();
}
function updateDoodleOverlayDims() { if(!activeDoodle) return; document.getElementById('doodle-w').value = parseInt(activeDoodle.style.width); document.getElementById('doodle-h').value = parseInt(activeDoodle.style.height); }
function applyDoodleDims() { if(!activeDoodle) return; activeDoodle.style.width = document.getElementById('doodle-w').value + 'px'; activeDoodle.style.height = document.getElementById('doodle-h').value + 'px'; saveState(); }
function applyDoodleBGPos() { if(activeDoodle && activeDoodle.querySelector('.doodle-bg')) { activeDoodle.querySelector('.doodle-bg').style.backgroundPosition = `${document.getElementById('doodle-bg-x').value}% ${document.getElementById('doodle-bg-y').value}%`; saveState(); } }
function changeDoodleShape() { if(activeDoodle && activeDoodle.dataset.isShape === "true") { const s = document.getElementById('doodle-shape').value, svg = activeDoodle.querySelector('.bubble-svg'); svg.dataset.shape = s; svg.innerHTML = getShapeSVG(s); saveState(); } }
function syncDoodleText() { if(activeDoodle) { const tN = activeDoodle.querySelector('.doodle-text'), i = document.getElementById('doodle-text-input'); if (tN.innerText !== i.value) tN.innerText = i.value; } }
function styleDoodleText(p, v) { if(activeDoodle) { const tN = activeDoodle.querySelector('.doodle-text'); if(p === 'fontWeight') tN.style.fontWeight = tN.style.fontWeight === 'bold' ? 'normal' : 'bold'; else if(p === 'fontStyle') tN.style.fontStyle = tN.style.fontStyle === 'italic' ? 'normal' : 'italic'; else tN.style[p] = v; saveState(); } }
function applyDoodleProps() { if(activeDoodle) { activeDoodle.style.zIndex = document.getElementById('doodle-z').value; activeDoodle.style.opacity = document.getElementById('doodle-op').value; saveState(); } }
function deleteActiveDoodle() { if(activeDoodle) { activeDoodle.remove(); activeDoodle = null; doodleOverlay.style.display = 'none'; saveState(); } }

const obs = new MutationObserver(() => { document.querySelectorAll('.resizer-bar').forEach(b => { if(!b.onmousedown) attachResizerEvents(b); }); document.querySelectorAll('.doodle').forEach(d => { if(!d.onmousedown) attachDoodleEvents(d); }); });
obs.observe(canvas, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => { saveState(); applyGutter(); });
