let activeCell = null, activeDoodle = null, activeBar = null;
let history = [], historyStep = -1;
const canvas = document.getElementById('main-canvas');
const zoomSlider = document.getElementById('zoom-slider');
const divOverlay = document.getElementById('division-overlay');
const doodleOverlay = document.getElementById('doodle-overlay');

// --- 1. CORE IO, HISTORY, & FILE SYSTEM ---
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
        if(raw && raw.includes("DATA:")) { 
            canvas.innerHTML = raw.split("DATA:")[1]; 
            saveState(); 
        } else { alert("Invalid Studio HD CSV file."); }
    };
    reader.readAsText(el.files[0]);
    el.value = '';
}

// --- NATIVE OFFLINE PNG EXPORT ENGINE ---
async function exportPNG() {
    console.log("Stamping Rigorous 1:1 PNG...");
    const originalCanvas = document.getElementById('main-canvas');
    const width = parseInt(document.getElementById('canv-w').value);
    const height = parseInt(document.getElementById('canv-h').value);
    const zoom = parseFloat(document.getElementById('zoom-slider').value);

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

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
                const metrics = context.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    lines.push(line.trim());
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line.trim());
        }
        return lines;
    };
    
    const getGradientCoords = (w, h, ang) => {
        const anglePI = (ang - 90) * Math.PI / 180;
        const r = Math.sqrt(w*w + h*h) / 2;
        const x1 = w/2 - Math.cos(anglePI) * r;
        const y1 = h/2 - Math.sin(anglePI) * r;
        const x2 = w/2 + Math.cos(anglePI) * r;
        const y2 = h/2 + Math.sin(anglePI) * r;
        return { x1, y1, x2, y2 };
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
                const matches = style.backgroundImage.match(/(\d+)deg,\s*(rgb\(\d+,\s*\d+,\s*\d+\)),\s*(rgb\(\d+,\s*\d+,\s*\d+\))/);
                if(matches) {
                    const ang = parseInt(matches[1]);
                    const c1 = matches[2];
                    const c2 = matches[3];
                    const { x1, y1, x2, y2 } = getGradientCoords(w, h, ang);
                    const grad = ctx.createLinearGradient(x + x1, y + y1, x + x2, y + y2);
                    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, y, w, h);
                }
            }
        }

        if (el.classList.contains('cell-padder')) {
            if (style.backgroundImage.startsWith('linear-gradient')) {
                const matches = style.backgroundImage.match(/(\d+)deg,\s*(rgb\(\d+,\s*\d+,\s*\d+\)),\s*(rgb\(\d+,\s*\d+,\s*\d+\))/);
                if (matches) {
                    const ang = parseInt(matches[1]);
                    const c1 = matches[2];
                    const c2 = matches[3];
                    const { x1, y1, x2, y2 } = getGradientCoords(w, h, ang);
                    const grad = ctx.createLinearGradient(x + x1, y + y1, x + x2, y + y2);
                    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, y, w, h);
                }
            }
            
            if (style.backgroundImage.includes('url(')) {
                const url = style.backgroundImage.match(/url\(["']?([^"']*)["']?\)/)[1];
                const img = await getImg(url);
                if (img) {
                    ctx.save();
                    ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
                    const bgPos = style.backgroundPosition.split(' ');
                    const offX = (parseFloat(bgPos[0]) || 50) / 100;
                    const offY = (parseFloat(bgPos[1]) || 50) / 100;
                    const size = style.backgroundSize;
                    if (size === 'cover') {
                        const scale = Math.max(w / img.width, h / img.height);
                        const imgW = img.width * scale, imgH = img.height * scale;
                        const imgX = x + (w - imgW) * offX; 
                        const imgY = y + (h - imgH) * offY;
                        ctx.drawImage(img, imgX, imgY, imgW, imgH);
                    } else {
                         ctx.drawImage(img, x, y, w, h);
                    }
                    ctx.restore();
                }
            }
        }

        if (el.classList.contains('doodle')) {
            ctx.globalAlpha = parseFloat(style.opacity) || 1;
            const svg = el.querySelector('svg');
            if (svg) {
                const svgStyle = window.getComputedStyle(svg);
                if (svgStyle.filter.includes('drop-shadow')) {
                    const shadowMatch = svgStyle.filter.match(/drop-shadow\((.*?)\)/);
                    if (shadowMatch) {
                        const parts = shadowMatch[1].split(' ');
                        ctx.save();
                        ctx.shadowColor = parts[3];
                        ctx.shadowOffsetX = parseFloat(parts[0]);
                        ctx.shadowOffsetY = parseFloat(parts[1]);
                        ctx.shadowBlur = parseFloat(parts[2]);
                    }
                }
                const svgData = new XMLSerializer().serializeToString(svg);
                const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                const img = await getImg(svgUrl);
                if (img) ctx.drawImage(img, x, y, w, h);
                if (ctx.shadowColor !== 'rgba(0, 0, 0, 0)') ctx.restore();
            }

            const bgDiv = el.querySelector('.doodle-bg');
            if (bgDiv) {
                const bgStyle = window.getComputedStyle(bgDiv);
                if (bgStyle.backgroundImage.includes('url(')) {
                    const url = bgStyle.backgroundImage.match(/url\(["']?([^"']*)["']?\)/)[1];
                    const img = await getImg(url);
                    if (img) {
                        ctx.save();
                        ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
                        const bgPos = bgStyle.backgroundPosition.split(' ');
                        const offX = (parseFloat(bgPos[0]) || 50) / 100;
                        const offY = (parseFloat(bgPos[1]) || 50) / 100;
                        const scale = Math.max(w / img.width, h / img.height);
                        const imgW = img.width * scale, imgH = img.height * scale;
                        const imgX = x + (w - imgW) * offX; 
                        const imgY = y + (h - imgH) * offY;
                        ctx.drawImage(img, imgX, imgY, imgW, imgH);
                        ctx.restore();
                    }
                } else if (bgStyle.backgroundColor) {
                    ctx.fillStyle = bgStyle.backgroundColor;
                    ctx.fillRect(x, y, w, h);
                }
            }

            const txt = el.querySelector('.doodle-text');
            if (txt && txt.innerText) {
                const tStyle = window.getComputedStyle(txt);
                const tRect = txt.getBoundingClientRect();
                const textWidth = tRect.width / zoom;
                ctx.fillStyle = tStyle.color || "#000000";
                ctx.font = `${tStyle.fontStyle} ${tStyle.fontWeight} ${tStyle.fontSize} ${tStyle.fontFamily}`;
                ctx.textAlign = tStyle.textAlign || "center";
                ctx.textBaseline = "middle";
                const lines = wordWrap(ctx, txt.innerText, textWidth);
                const lineHeight = parseFloat(tStyle.lineHeight) || (parseFloat(tStyle.fontSize) * 1.2);
                const totalTextHeight = (lines.length - 1) * lineHeight;
                const textBlockY = (tRect.top - canvasRect.top) / zoom;
                const textBlockH = tRect.height / zoom;
                let startY = textBlockY + (textBlockH / 2) - (totalTextHeight / 2);
                let startX = (tRect.left - canvasRect.top) / zoom;
                if (ctx.textAlign === 'center') {
                    startX += textWidth / 2;
                } else if (ctx.textAlign === 'right') {
                    startX += textWidth;
                }
                lines.forEach((line, i) => {
                    ctx.fillText(line, startX, startY + (i * lineHeight));
                });
            }
            ctx.globalAlpha = 1;
        }

        for (const child of el.children) {
            await stampElement(child);
        }
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
    const c1 = document.getElementById('gutter-c1').value;
    const c2 = document.getElementById('gutter-c2').value;
    const ang = document.getElementById('gutter-angle').value;
    canvas.querySelectorAll('.cell').forEach(c => {
        if (c.children.length > 1 && c.querySelector('.resizer-bar')) { 
            c.style.gap = size; 
            c.style.backgroundImage = `linear-gradient(${ang}deg, ${c1}, ${c2})`;
        } else { 
            c.style.backgroundImage = "none";
            c.style.gap = '0px';
        }
    });
    saveState();
}

// --- 3. MASTER CLICK INTERCEPTOR ---
canvas.addEventListener('click', (e) => {
    if(e.target.closest('.doodle')) return; 
    if (e.target.classList.contains('resizer-bar')) {
        activeBar = e.target;
        divOverlay.style.display = 'block'; doodleOverlay.style.display = 'none';
        divOverlay.style.left = (e.clientX + 15) + 'px'; divOverlay.style.top = (e.clientY + 15) + 'px';
        document.getElementById('overlay-title').innerText = activeBar.classList.contains('resizer-v') ? 'VERT DIV' : 'HORIZ DIV';
        document.getElementById('overlay-ratio').value = parseFloat(activeBar.previousElementSibling.style.flexGrow) || 1;
        return;
    }
    divOverlay.style.display = 'none';
    if (activeDoodle) {
        activeDoodle.classList.remove('active-doodle');
        activeDoodle = null;
        doodleOverlay.style.display = 'none';
        document.getElementById('cell-panel').style.display = 'flex';
    }
    const cell = e.target.closest('.cell');
    if (!cell) return;
    selectCell(cell);
    const mode = document.querySelector('input[name="mode"]:checked').value;
    if (mode === 'split-v') split(cell, 'row');
    else if (mode === 'split-h') split(cell, 'column');
    else if (mode === 'delete' && cell.id !== 'root') deleteCell(cell);
});

// --- 4. SPLIT & UN-SPLIT ---
function split(cell, dir) {
    if (cell.querySelector('.cell')) return; 
    cell.style.flexDirection = dir; cell.style.flex = "1 1 auto"; 
    const p = cell.querySelector('.cell-padder');
    const bg = p.style.backgroundImage;
    const bgSize = p.style.backgroundSize;
    const bgRep = p.style.backgroundRepeat;
    const bgPos = p.style.backgroundPosition;
    const dataAttrs = `data-c1="${p.getAttribute('data-c1')}" data-c2="${p.getAttribute('data-c2')}" data-ang="${p.getAttribute('data-ang')}"`;
    cell.innerHTML = `
        <div class="cell" style="flex: 1 1 50%;"><div class="cell-padder" ${dataAttrs} style="background-image:${bg}; background-size:${bgSize}; background-repeat:${bgRep}; background-position:${bgPos};"></div></div>
        <div class="resizer-bar ${dir === 'row' ? 'resizer-v' : 'resizer-h'}"></div>
        <div class="cell" style="flex: 1 1 50%;"><div class="cell-padder" ${dataAttrs} style="background-image:${bg}; background-size:${bgSize}; background-repeat:${bgRep}; background-position:${bgPos};"></div></div>`;
    attachResizerEvents(cell.querySelector('.resizer-bar')); 
    applyGutter(); saveState();
}

function deleteCell(cell) {
    const parent = cell.parentElement;
    if(parent && parent.id !== 'root') {
        const sibling = Array.from(parent.children).find(c => c.classList.contains('cell') && c !== cell);
        if(sibling) { 
            const grandParent = parent.parentElement;
            grandParent.insertBefore(sibling, parent);
            sibling.style.flex = parent.style.flex;
            parent.remove();
        }
    } else { cell.innerHTML = '<div class="cell-padder" data-c1="#ffffff" data-c2="#e2e8f0" data-ang="135" style="background-image: linear-gradient(135deg, #ffffff, #e2e8f0);"></div>'; }
    applyGutter(); saveState(); 
}

function attachResizerEvents(bar) {
    bar.onmousedown = (e) => {
        e.preventDefault(); e.stopPropagation();
        const prev = bar.previousElementSibling, next = bar.nextElementSibling;
        const isRow = bar.classList.contains('resizer-v');
        let zoom = parseFloat(zoomSlider.value);
        let startPos = isRow ? e.clientX : e.clientY;
        let startPrev = isRow ? prev.offsetWidth : prev.offsetHeight;
        let startNext = isRow ? next.offsetWidth : next.offsetHeight;
        const total = startPrev + startNext;
        document.onmousemove = (ev) => {
            let delta = ((isRow ? ev.clientX : ev.clientY) - startPos) / zoom;
            let newPrev = startPrev + delta;
            let newNext = startNext - delta;
            if (newPrev < 20 || newNext < 20) return;
            const prevGrow = newPrev / total;
            const nextGrow = newNext / total;
            prev.style.flex = `${prevGrow} 1 0%`; 
            next.style.flex = `${nextGrow} 1 0%`;
            if(divOverlay.style.display === 'block' && activeBar === bar) {
                document.getElementById('overlay-ratio').value = (prevGrow / nextGrow).toFixed(2);
            }
        };
        document.onmouseup = () => { 
            prev.style.flex = `0 0 ${prev.offsetWidth}px`;
            next.style.flex = `0 0 ${next.offsetHeight}px`;
            document.onmousemove = null; 
            document.onmouseup = null; 
            saveState(); 
        };
    };
}

function applyOverlayRatio() { 
    if(!activeBar) return; 
    const ratio = parseFloat(document.getElementById('overlay-ratio').value) || 1;
    activeBar.previousElementSibling.style.flex = `${ratio} 1 0%`; 
    activeBar.nextElementSibling.style.flex = `1 1 0%`; 
    saveState(); 
}

// --- 5. CELL PROPERTIES SYNC ---
function selectCell(cell) {
    if(activeDoodle) activeDoodle.classList.remove('active-doodle');
    if(activeCell) activeCell.classList.remove('selected-cell');
    activeCell = cell; activeCell.classList.add('selected-cell');
    document.getElementById('cell-panel').style.display = 'flex'; 
    doodleOverlay.style.display = 'none';
    const p = cell.querySelector('.cell-padder');
    if(p) { 
        document.getElementById('cell-pad').value = parseInt(p.style.margin) || 0; 
        document.getElementById('cell-c1').value = p.getAttribute('data-c1') || '#ffffff';
        document.getElementById('cell-c2').value = p.getAttribute('data-c2') || '#e2e8f0';
        document.getElementById('cell-angle').value = p.getAttribute('data-ang') || '135';
        document.getElementById('cell-repeat').value = p.style.backgroundRepeat || 'no-repeat';
        document.getElementById('cell-bg-size').value = p.style.backgroundSize || 'cover';
        const bgPos = (p.style.backgroundPosition || "50% 50%").split(' ');
        document.getElementById('cell-bg-x').value = parseInt(bgPos[0]) || 50;
        document.getElementById('cell-bg-y').value = parseInt(bgPos[1]) || 50;
    }
}

function applyCellStyle() {
    if(!activeCell) return;
    const p = activeCell.querySelector('.cell-padder');
    if(!p) return;
    p.style.margin = document.getElementById('cell-pad').value + 'px';
    const c1 = document.getElementById('cell-c1').value, c2 = document.getElementById('cell-c2').value, ang = document.getElementById('cell-angle').value;
    p.setAttribute('data-c1', c1); p.setAttribute('data-c2', c2); p.setAttribute('data-ang', ang);
    const currentBg = p.style.backgroundImage;
    if(!currentBg || !currentBg.includes('url(')) {
        p.style.backgroundImage = `linear-gradient(${ang}deg, ${c1}, ${c2})`;
    }
    p.style.backgroundRepeat = document.getElementById('cell-repeat').value;
    p.style.backgroundSize = document.getElementById('cell-bg-size').value;
    p.style.backgroundPosition = `${document.getElementById('cell-bg-x').value}% ${document.getElementById('cell-bg-y').value}%`;
    saveState();
}

function uploadCellBG(el) {
    if(!activeCell || !el.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => { 
        const p = activeCell.querySelector('.cell-padder');
        p.style.backgroundImage = `url('${e.target.result}')`; 
        saveState(); 
    };
    reader.readAsDataURL(el.files[0]);
    el.value = '';
}
function clearCellBG() {
    if(!activeCell) return;
    const p = activeCell.querySelector('.cell-padder');
    p.style.backgroundImage = ''; 
    applyCellStyle();
}

// --- 6. DOODLES & SHAPES ---
function getShapeSVG(type) {
    const base = 'fill="white" stroke="black" stroke-width="2" vector-effect="non-scaling-stroke"';
    if(type === 'ellipse') return `<ellipse cx="50" cy="50" rx="48" ry="48" ${base}/>`;
    if(type === 'box') return `<rect x="2" y="2" width="96" height="96" rx="10" ry="10" ${base}/>`;
    if(type === 'cloud') return `<path d="M 25 60 A 20 20 0 0 1 40 25 A 25 25 0 0 1 75 35 A 15 15 0 0 1 85 60 Q 95 60 95 75 Q 95 90 75 90 L 25 90 Q 5 90 5 75 Q 5 60 25 60 Z" ${base}/>`;
    if(type === 'spiky') return `<polygon points="50,5 60,30 90,20 70,45 95,65 65,70 70,95 50,75 30,95 35,70 5,65 30,45 10,20 40,30" ${base}/>`;
    return '';
}

function addDoodleImgFromFile(el) {
    if(!activeCell) return alert("Select a cell first.");
    if(!el.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => { addDoodle('img', e.target.result); };
    reader.readAsDataURL(el.files[0]);
    el.value = '';
}

function addDoodle(type, imgData = null) {
    if(!activeCell) return alert("Select a cell first.");
    const padder = activeCell.querySelector('.cell-padder');
    if (!padder) return;
    const d = document.createElement('div');
    d.className = 'doodle';
    d.style.left = '20px'; d.style.top = '20px';
    d.style.width = '200px'; d.style.height = '150px';
    d.style.zIndex = '10';
    let bgHTML = '';
    let textContent = type === 'img' ? '' : 'New Text...';
    if (type === 'text') {
        bgHTML = `<div class="doodle-bg" style="background: rgba(255,255,255,0.85); border: 1px solid #ccc;"></div>`;
    } else if (type === 'bubble') {
        bgHTML = `<svg class="bubble-svg" data-shape="ellipse" viewBox="0 0 100 100" preserveAspectRatio="none">${getShapeSVG('ellipse')}</svg>`;
        d.dataset.isShape = "true";
    } else if (type === 'img' && imgData) {
        bgHTML = `<div class="doodle-bg" style="background-image: url('${imgData}'); background-size: cover; background-position: 50% 50%;"></div>`;
    }
    d.innerHTML = `
        ${bgHTML}
        <div class="doodle-text" contenteditable="false">${textContent}</div>
        <div class="resizer"></div>`;
    attachDoodleEvents(d);
    padder.appendChild(d);
    document.querySelector('input[value="doodle-transform"]').checked = true;
    selectDoodle(d);
    saveState();
}

function attachDoodleEvents(d) {
    d.onmousedown = (e) => {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        if (mode !== 'doodle-transform') return;
        e.stopPropagation(); divOverlay.style.display = 'none';
        selectDoodle(d);
        let isResizing = e.target.classList.contains('resizer');
        let zoom = parseFloat(zoomSlider.value);
        let startX = e.clientX, startY = e.clientY;
        let startW = d.offsetWidth, startH = d.offsetHeight;
        let startL = d.offsetLeft, startT = d.offsetTop;
        document.onmousemove = (ev) => {
            ev.preventDefault();
            if (isResizing) {
                d.style.width = Math.max(40, startW + (ev.clientX - startX) / zoom) + 'px';
                d.style.height = Math.max(40, startH + (ev.clientY - startY) / zoom) + 'px';
            } else {
                d.style.left = startL + (ev.clientX - startX) / zoom + 'px';
                d.style.top = startT + (ev.clientY - startY) / zoom + 'px';
            }
            updateDoodleOverlayDims();
            // Optional: update overlay position while dragging
            // selectDoodle(d);
        };
        document.onmouseup = () => { document.onmousemove = null; document.onmouseup = null; saveState(); };
    };
    const txtNode = d.querySelector('.doodle-text');
    txtNode.addEventListener('click', (e) => { 
        if(document.querySelector('input[name="mode"]:checked').value === 'doodle-transform') {
            txtNode.contentEditable = 'true';
            txtNode.focus();
            e.stopPropagation();
        }
    });
    txtNode.addEventListener('blur', () => { 
        txtNode.contentEditable = 'false'; 
        syncDoodleText(); 
        saveState(); 
    });
    txtNode.addEventListener('input', syncDoodleText);
}

function selectDoodle(d) {
    if(activeCell) activeCell.classList.remove('selected-cell');
    if(activeDoodle && activeDoodle !== d) activeDoodle.classList.remove('active-doodle');
    activeDoodle = d; activeDoodle.classList.add('active-doodle');
    document.getElementById('cell-panel').style.display = 'none';
    const overlay = document.getElementById('doodle-overlay');
    overlay.style.display = 'block';
    const workspace = document.getElementById('workspace').getBoundingClientRect();
    const rect = d.getBoundingClientRect();
    let leftPos = (rect.right - workspace.left) + 10; 
    let topPos = (rect.bottom - workspace.top) + 10;
    if (leftPos + 220 > workspace.width) {
        leftPos = (rect.left - workspace.left) - 230;
    }
    if (topPos + 250 > workspace.height) {
        topPos = (rect.top - workspace.top) - 260;
    }
    overlay.style.left = Math.max(10, leftPos) + 'px'; 
    overlay.style.top = Math.max(10, topPos) + 'px';
    const txtNode = d.querySelector('.doodle-text');
    document.getElementById('doodle-text-input').value = txtNode.innerText;
    document.getElementById('doodle-fs').value = parseInt(window.getComputedStyle(txtNode).fontSize) || 14;
    document.getElementById('doodle-z').value = parseInt(d.style.zIndex) || 10;
    document.getElementById('doodle-op').value = d.style.opacity || 1;
    if(d.dataset.isShape === "true") {
        document.getElementById('shape-selector-container').style.display = 'flex';
        const svg = d.querySelector('.bubble-svg');
        if(svg) document.getElementById('doodle-shape').value = svg.dataset.shape || 'ellipse';
    } else {
        document.getElementById('shape-selector-container').style.display = 'none';
    }
    const bgDiv = d.querySelector('.doodle-bg');
    const posRow = document.getElementById('doodle-bg-pos-row');
    if (bgDiv && bgDiv.style.backgroundImage.includes('url')) {
        posRow.style.display = 'flex';
        const bgPos = (bgDiv.style.backgroundPosition || "50% 50%").split(' ');
        document.getElementById('doodle-bg-x').value = parseInt(bgPos[0]) || 50;
        document.getElementById('doodle-bg-y').value = parseInt(bgPos[1]) || 50;
    } else {
        posRow.style.display = 'none';
    }
    updateDoodleOverlayDims();
}

function updateDoodleOverlayDims() {
    if(!activeDoodle) return;
    document.getElementById('doodle-w').value = parseInt(activeDoodle.style.width);
    document.getElementById('doodle-h').value = parseInt(activeDoodle.style.height);
}
function applyDoodleDims() {
    if(!activeDoodle) return;
    activeDoodle.style.width = document.getElementById('doodle-w').value + 'px';
    activeDoodle.style.height = document.getElementById('doodle-h').value + 'px';
    saveState();
}
function applyDoodleBGPos() {
    if(!activeDoodle) return;
    const bgDiv = activeDoodle.querySelector('.doodle-bg');
    if(!bgDiv) return;
    bgDiv.style.backgroundPosition = `${document.getElementById('doodle-bg-x').value}% ${document.getElementById('doodle-bg-y').value}%`;
    saveState();
}
function changeDoodleShape() {
    if(!activeDoodle || activeDoodle.dataset.isShape !== "true") return;
    const shape = document.getElementById('doodle-shape').value;
    const svg = activeDoodle.querySelector('.bubble-svg');
    if(svg) { svg.dataset.shape = shape; svg.innerHTML = getShapeSVG(shape); saveState(); }
}
function syncDoodleText() { 
    if(!activeDoodle) return; 
    const txtNode = activeDoodle.querySelector('.doodle-text');
    const input = document.getElementById('doodle-text-input');
    if (txtNode.innerText !== input.value) {
        txtNode.innerText = input.value;
    }
}
function styleDoodleText(prop, val) {
    if(!activeDoodle) return;
    const txtNode = activeDoodle.querySelector('.doodle-text');
    if(prop === 'fontWeight') txtNode.style.fontWeight = txtNode.style.fontWeight === 'bold' ? 'normal' : 'bold';
    else if(prop === 'fontStyle') txtNode.style.fontStyle = txtNode.style.fontStyle === 'italic' ? 'normal' : 'italic';
    else txtNode.style[prop] = val;
    saveState();
}
function applyDoodleProps() { 
    if(!activeDoodle) return; 
    activeDoodle.style.zIndex = document.getElementById('doodle-z').value; 
    activeDoodle.style.opacity = document.getElementById('doodle-op').value;
    saveState(); 
}
function deleteActiveDoodle() { if(activeDoodle) { activeDoodle.remove(); activeDoodle = null; doodleOverlay.style.display = 'none'; saveState(); } }

const observer = new MutationObserver(() => {
    document.querySelectorAll('.resizer-bar').forEach(b => { if(!b.onmousedown) attachResizerEvents(b); });
    document.querySelectorAll('.doodle').forEach(d => { if(!d.onmousedown) attachDoodleEvents(d); });
});
observer.observe(canvas, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', () => {
    saveState();
    applyGutter();
});