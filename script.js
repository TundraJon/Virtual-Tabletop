        const canvas = document.getElementById('battleMap'), ctx = canvas.getContext('2d');
        const menu = document.getElementById('contextMenu'), sidebar = document.getElementById('sidebar');
        
        let mapImg = new Image(), tokens = [], scale = 1.0, offset = {x:0, y:0};
        let mapLib = {}, tokenLib = {}, grid = { size: 0, x1: 0, y1: 0, x2: 0, y2: 0, ftPerSq: 5 };
        let calPoints = [null, null], currentMode = null, showPins = true;
        let isPinching = false, zoomCooldown = false, lastPinchDist = 0, lastPinchMid = {x:0, y:0}, touchStartPos = {x:0, y:0};
        let dragging = null, dragStartX = 0, dragStartY = 0, lastMove = null;
        let gridColor = "0, 255, 204", menuTimer = null;

        function init() {
            // Check persistence
            const savedMapDir = localStorage.getItem('mapDirName');
            const savedTokenDir = localStorage.getItem('tokenDirName');
            const mapCount = localStorage.getItem('mapCount');
            const tokenCount = localStorage.getItem('tokenCount');

            if(savedMapDir) {
                setStatus('mapStatus', `Last used: ${savedMapDir}`, true);
                document.getElementById('mapCountDisplay').innerText = `Loaded ${mapCount} items`;
                document.getElementById('mapSelect').innerHTML = '<option>-- SELECT MAP --</option>';
            }
            if(savedTokenDir) {
                setStatus('tokenStatus', `Last used: ${savedTokenDir}`, true);
                document.getElementById('tokenCountDisplay').innerText = `Loaded ${tokenCount} items`;
            }

            const container = document.getElementById('swatchContainer');
            const colors = ["255,255,255","0,0,0","255,50,50","50,150,255","50,255,50","255,255,50","255,150,0","0,255,204","180,50,255","255,100,200"];
            colors.forEach(c => {
                const s = document.createElement('div'); s.className = 'swatch'; s.style.backgroundColor = `rgb(${c})`;
                s.onclick = () => { gridColor = c; }; container.appendChild(s);
            });
            resize();
            requestAnimationFrame(animate);
            setTimeout(() => { document.getElementById('splash').style.opacity = '0'; }, 2000);
        }

        function setStatus(id, text, isGreen) {
            const el = document.getElementById(id);
            el.innerText = text; el.className = isGreen ? 'status-msg status-green' : 'status-msg status-red';
        }

        function animate() { draw(); requestAnimationFrame(animate); }
        function openTab(evt, tabId) {
            let contents = document.getElementsByClassName("sidebar-content");
            for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active");
            let buttons = document.getElementsByClassName("tab-btn");
            for (let i = 0; i < buttons.length; i++) buttons[i].classList.remove("active");
            document.getElementById(tabId).classList.add("active");
            evt.currentTarget.classList.add("active");
        }

        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.onresize = resize;
        function toggleSidebar() { sidebar.classList.toggle('minimized'); menu.style.display='none'; }

        function handleFolder(e, lib, type) {
            const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            if (files.length === 0) return;

            // Get the folder name from the first file path
            const folderPath = files[0].webkitRelativePath;
            const folderName = folderPath.split('/')[0];

            files.forEach(f => { lib[f.name.split('.')[0]] = URL.createObjectURL(f); });

            if(type === 'map') {
                const select = document.getElementById('mapSelect'); select.innerHTML = '<option>-- SELECT MAP --</option>';
                Object.keys(lib).sort().forEach(k => { 
                    const o = document.createElement('option'); o.value = k; o.innerText = k.toUpperCase(); select.appendChild(o); 
                });
                setStatus('mapStatus', `Last used: ${folderName}`, true);
                document.getElementById('mapCountDisplay').innerText = `Loaded ${files.length} items`;
                localStorage.setItem('mapDirName', folderName);
                localStorage.setItem('mapCount', files.length);
            } else {
                setStatus('tokenStatus', `Last used: ${folderName}`, true);
                document.getElementById('tokenCountDisplay').innerText = `Loaded ${files.length} items`;
                localStorage.setItem('tokenDirName', folderName);
                localStorage.setItem('tokenCount', files.length);
            }
        }
        document.getElementById('inputMapDir').onchange = (e) => handleFolder(e, mapLib, 'map');
        document.getElementById('inputTokenDir').onchange = (e) => handleFolder(e, tokenLib, 'token');

        function changeMap(n) { if(n.includes("First")) return; mapImg.src = mapLib[n]; calPoints=[null,null]; grid.size=0; mapImg.onload=fitToScreen; }
        
        function fitToScreen() {
            if (!mapImg.width) return;
            scale = Math.min(canvas.width / mapImg.width, canvas.height / mapImg.height);
            offset.x = (canvas.width - mapImg.width * scale) / 2;
            offset.y = (canvas.height - mapImg.height * scale) / 2;
        }

        function toggleMode(mode) { showPins = true; currentMode = (currentMode === mode) ? null : mode; updateUI(); }
        function updateUI() {
            const tl = document.getElementById('btnTL'), br = document.getElementById('btnBR');
            tl.innerText = (currentMode === 0) ? "PLACING TL" : (calPoints[0] ? "TL LOCKED" : "SET TL");
            br.innerText = (currentMode === 1) ? "PLACING BR" : (calPoints[1] ? "BR LOCKED" : "SET BR");
            updateSqDown();
        }

        function updateSqDown() {
            if(!calPoints[0] || !calPoints[1]) return;
            const dx = Math.abs(calPoints[1].x - calPoints[0].x), dy = Math.abs(calPoints[1].y - calPoints[0].y);
            document.getElementById('sqDownDisplay').innerText = `Squares Down: ${Math.round((dy / dx) * (parseInt(document.getElementById('sqCount').value) || 1))}`;
        }

        function applyCalibration() {
            if(!calPoints[0] || !calPoints[1]) return;
            grid.x1 = Math.min(calPoints[0].x, calPoints[1].x);
            grid.y1 = Math.min(calPoints[0].y, calPoints[1].y);
            grid.x2 = Math.max(calPoints[0].x, calPoints[1].x);
            grid.y2 = Math.max(calPoints[0].y, calPoints[1].y);
            grid.size = (grid.x2 - grid.x1) / (parseInt(document.getElementById('sqCount').value) || 1);
            showPins = false; currentMode = null; updateUI();
        }

        function draw() {
            ctx.clearRect(0,0,canvas.width, canvas.height); ctx.save();
            ctx.translate(offset.x, offset.y); ctx.scale(scale, scale);
            if (mapImg.complete) ctx.drawImage(mapImg, 0, 0);

            if(grid.size > 2) {
                ctx.strokeStyle = `rgba(${gridColor}, 0.3)`; ctx.lineWidth = 1 / scale; ctx.beginPath();
                for(let x = grid.x1; x <= grid.x2 + 0.1; x += grid.size) { ctx.moveTo(x, grid.y1); ctx.lineTo(x, grid.y2); }
                for(let y = grid.y1; y <= grid.y2 + 0.1; y += grid.size) { ctx.moveTo(grid.x1, y); ctx.lineTo(grid.x2, y); }
                ctx.stroke();
            }

            let activeMove = dragging ? { startX: dragStartX, startY: dragStartY, endX: dragging.x, endY: dragging.y } : 
                             (lastMove && Date.now() - lastMove.time < 1000 ? lastMove : null);
            
            if(activeMove && grid.size > 5) {
                const dist = Math.round((Math.hypot(activeMove.endX-activeMove.startX, activeMove.endY-activeMove.startY)/grid.size) * grid.ftPerSq);
                ctx.strokeStyle = "yellow"; ctx.setLineDash([5, 5]); ctx.lineWidth = 2/scale;
                ctx.beginPath(); ctx.moveTo(activeMove.startX, activeMove.startY); ctx.lineTo(activeMove.endX, activeMove.endY); ctx.stroke();
                ctx.setLineDash([]);
                let textY = (activeMove.endY < activeMove.startY) ? activeMove.startY + (30/scale) : activeMove.startY - (15/scale);
                ctx.fillStyle = "black"; ctx.fillRect(activeMove.startX - 5/scale, textY - 15/scale, 60/scale, 20/scale);
                ctx.fillStyle = "yellow"; ctx.font = `bold ${14/scale}px Arial`;
                ctx.fillText(`${dist} ft`, activeMove.startX, textY);
            }

            tokens.forEach(t => {
                ctx.save(); ctx.translate(t.x, t.y); const s = grid.size || 50;
                if (t.img.complete) ctx.drawImage(t.img, -s/2, -s/2, s, s);
                ctx.fillStyle = "black"; ctx.fillRect(-s/2, -s/1.5, s, 6/scale);
                ctx.fillStyle = (t.hp / t.maxHp > 0.5) ? "#00ff00" : (t.hp / t.maxHp > 0.2 ? "#ffff00" : "#ff0000");
                ctx.fillRect(-s/2, -s/1.5, s * Math.max(0, t.hp/t.maxHp), 6/scale);
                ctx.restore();
            });

            if (!isPinching && (showPins || currentMode !== null)) {
                calPoints.forEach((p, i) => {
                    if(!p) return;
                    ctx.fillStyle = i === 0 ? "#ff4444" : "#44ff44";
                    const radius = (currentMode === i ? 15 : 10) / scale;
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = "white"; ctx.lineWidth = 2/scale; ctx.stroke();
                });
            }
            ctx.restore();
        }

        canvas.ontouchstart = (e) => {
            clearTimeout(menuTimer);
            if (e.touches.length >= 2) {
                isPinching = true; zoomCooldown = true;
                lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                lastPinchMid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
                return;
            }
            const t = e.touches[0], p = { x: (t.clientX-offset.x)/scale, y: (t.clientY-offset.y)/scale, rx: t.clientX, ry: t.clientY };
            touchStartPos = {x: t.clientX, y: t.clientY};
            if (currentMode !== null) { calPoints[currentMode] = {x: p.x, y: p.y}; } 
            else {
                dragging = tokens.find(tk => Math.hypot(tk.x-p.x, tk.y-p.y) < (grid.size || 50)/2);
                if(dragging) { dragStartX = dragging.x; dragStartY = dragging.y; lastMove = null; }
                if(e.touches.length === 1) menuTimer = setTimeout(() => showMenu(p, dragging), 600);
            }
        };

        canvas.ontouchmove = (e) => {
            const t = e.touches[0];
            const moveDist = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y);
            if (moveDist > 10) { clearTimeout(menuTimer); if(dragging) menu.style.display = 'none'; }
            
            if (e.touches.length >= 2) {
                isPinching = true; zoomCooldown = true;
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                const mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
                const ds = dist / lastPinchDist;
                offset.x = mid.x - (mid.x - offset.x) * ds + (mid.x - lastPinchMid.x);
                offset.y = mid.y - (mid.y - offset.y) * ds + (mid.y - lastPinchMid.y);
                scale *= ds; lastPinchDist = dist; lastPinchMid = mid;
                return;
            }

            if (zoomCooldown) return;
            if (currentMode !== null) { calPoints[currentMode] = { x: (t.clientX-offset.x)/scale, y: (t.clientY-offset.y)/scale }; } 
            else if (dragging) { dragging.x = (t.clientX-offset.x)/scale; dragging.y = (t.clientY-offset.y)/scale; } 
            else { offset.x += (t.clientX-touchStartPos.x); offset.y += (t.clientY-touchStartPos.y); touchStartPos = {x:t.clientX, y:t.clientY}; }
        };

        canvas.ontouchend = (e) => {
            clearTimeout(menuTimer);
            if (e.touches.length < 2 && isPinching) setTimeout(() => { zoomCooldown = false; isPinching = false; }, 100); 
            if (e.touches.length === 0) {
                if (dragging && grid.size > 0) {
                    dragging.x = Math.floor((dragging.x - grid.x1) / grid.size) * grid.size + grid.x1 + (grid.size / 2);
                    dragging.y = Math.floor((dragging.y - grid.y1) / grid.size) * grid.size + grid.y1 + (grid.size / 2);
                    lastMove = { startX: dragStartX, startY: dragStartY, endX: dragging.x, endY: dragging.y, time: Date.now() };
                }
                isPinching = false; zoomCooldown = false;
            }
            dragging = null;
        };

        function showMenu(p, token) {
            menu.style.display = 'block'; menu.style.left = Math.min(p.rx, window.innerWidth - 230) + 'px'; 
            menu.style.top = Math.min(p.ry, window.innerHeight - 350) + 'px';
            let html = '';
            if(token) {
                html += `<div style="padding:15px; text-align:center; font-weight:bold; color:#00ffcc;">${token.baseName} (${token.instanceNum})</div>`;
                html += `<div id="hp-status" class="hp-display-row">${token.hp} / ${token.maxHp} HP</div>`;
                html += `<div class="hp-controls">
                            <button class="hp-btn" onclick="adjHP('${token.id}', -1)">-</button>
                            <button class="hp-btn" onclick="adjHP('${token.id}', 1)">+</button>
                         </div>`;
                html += `<div class="menu-item" onclick="changeHP('${token.id}')">EDIT HP MANUALLY</div>`;
                html += `<div class="menu-item" onclick="removeToken('${token.id}')" style="color:#ff4444">DELETE TOKEN</div>`;
            } else {
                html += '<div style="background:#111;padding:10px;font-size:10px;color:#00ffcc;text-align:center;">ADD TOKEN</div>';
                Object.keys(tokenLib).sort().forEach(k => { 
                    const count = tokens.filter(t => t.baseName === k).length;
                    html += `<div class="menu-item" onclick="addToken(${p.x}, ${p.y}, '${k}')">${k} ${count > 0 ? '('+count+')' : ''}</div>`; 
                });
            }
            menu.innerHTML = html;
        }

        function adjHP(id, amt) { 
            let t = tokens.find(tk => tk.id === id); 
            if(t) {
                t.hp = Math.min(t.maxHp, Math.max(0, t.hp + amt)); 
                const display = document.getElementById('hp-status');
                if(display) display.innerText = `${t.hp} / ${t.maxHp} HP`;
            }
        }
        
        function changeHP(id) {
            let t = tokens.find(tk => tk.id === id);
            let val = prompt("Change HP (e.g. -5, +10, or 25):", t.hp);
            if(val !== null) {
                if(val.startsWith('+') || val.startsWith('-')) t.hp += parseInt(val);
                else t.hp = parseInt(val);
                t.hp = Math.min(t.maxHp, Math.max(0, t.hp));
            }
            menu.style.display='none';
        }

        function removeToken(id) { tokens = tokens.filter(t => t.id !== id); menu.style.display='none'; }

        function addToken(x, y, n) { 
            let max = prompt(`Enter Max HP for ${n}:`, "20");
            if(max === null) return;
            const img = new Image(); img.src = tokenLib[n];
            let tX = x, tY = y;
            if(grid.size > 0) {
                tX = Math.floor((x - grid.x1) / grid.size) * grid.size + grid.x1 + (grid.size / 2);
                tY = Math.floor((y - grid.y1) / grid.size) * grid.size + grid.y1 + (grid.size / 2);
            }
            const instanceNum = tokens.filter(t => t.baseName === n).length + 1;
            tokens.push({id: "tk_"+Date.now(), x: tX, y: tY, img: img, baseName: n, instanceNum: instanceNum, hp: parseInt(max), maxHp: parseInt(max)});
            menu.style.display='none'; 
        }

        // ===== DICE ROLLER =====
        (function () {
            const MAX_PER_TERM = 20, MAX_TOTAL = 50, MAX_SIDES = 1000, ANIM_MAX = 12, HIST_MAX = 10, HIST_KEY = 'vttDiceHistory';
            const COLORS = { 2: '#d9b13b', 4: '#35c27a', 6: '#e0554b', 8: '#4b8fe3', 10: '#a853e0', 12: '#e58a3f', 20: '#00d9b0', 30: '#e04ba5', 100: '#bfd140' };
            const PAD = [2, 4, 6, 8, 10, 12, 20, 30, 100, 'X'];
            const el = (id) => document.getElementById(id);
            const tray = el('diceTray'), fab = el('diceFab'), closeBtn = el('diceClose'), stage = el('diceStage');
            const cv = el('diceCanvas'), dctx = cv.getContext('2d'), totalEl = el('diceTotal'), textEl = el('diceText'), moreEl = el('diceMore');
            const input = el('diceExpr'), msgEl = el('diceMsg'), padEl = el('dicePad'), rollBtn = el('diceRollBtn');
            const advBtn = el('diceAdv'), disBtn = el('diceDis'), clearBtn = el('diceClear');
            const modMinus = el('diceModMinus'), modPlus = el('diceModPlus'), modInput = el('diceMod');
            const previewEl = el('dicePreview'), histEl = el('diceHist'), histClear = el('diceHistClear');

            // ---- Engine: dice notation (adapted from QSheet's parser; every die uses crypto randomness) ----
            class DiceError extends Error {
                constructor(code, why, fix) { super(why || code); this.name = 'DiceError'; this.code = code; this.why = why || ''; this.fix = fix || ''; }
            }

            function randInt(sides) {
                const buf = new Uint32Array(1), limit = Math.floor(4294967296 / sides) * sides;
                do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
                return 1 + (buf[0] % sides);
            }

            // Returns { total, text, dice }. dice = [{ sides, value, kept }] in roll order.
            function rollDice(expr) {
                if (/\d\s+\d/.test(String(expr))) throw new DiceError('#VALUE!');
                const src = String(expr).toLowerCase().replace(/\s+/g, '');
                if (!src) throw new DiceError('#VALUE!');
                let i = 0, diceCount = 0;
                const allDice = [];
                const rest = () => src.slice(i);

                function primary() {
                    if (src[i] === '(') {
                        i++;
                        const e = sum();
                        if (src[i] !== ')') throw new DiceError('#VALUE!');
                        i++;
                        return { v: e.v, t: `(${e.t})` };
                    }
                    let m = /^(\d*)d(%|\d+)/.exec(rest());
                    if (m) {
                        i += m[0].length;
                        const n = m[1] === '' ? 1 : Number(m[1]), sides = m[2] === '%' ? 100 : Number(m[2]);
                        if (n < 1) throw new DiceError('#NUM!', 'A dice term needs at least 1 die');
                        if (n > MAX_PER_TERM) throw new DiceError('#NUM!', `${n} dice in one term; the limit is ${MAX_PER_TERM}`, `split it into terms of ${MAX_PER_TERM} or fewer, like ${MAX_PER_TERM}d${m[2]}+${Math.min(n - MAX_PER_TERM, MAX_PER_TERM)}d${m[2]}`);
                        if (sides < 2 || sides > MAX_SIDES) throw new DiceError('#NUM!', `A die needs 2 to ${MAX_SIDES} sides, not ${sides}`);
                        diceCount += n;
                        if (diceCount > MAX_TOTAL) throw new DiceError('#NUM!', `${diceCount} dice in all; the limit is ${MAX_TOTAL} in one roll`);
                        let keepMode = '', k = 0;
                        const km = /^(kh|kl|dh|dl)(\d*)/.exec(rest());
                        if (km) {
                            i += km[0].length;
                            keepMode = km[1];
                            k = km[2] === '' ? 1 : Number(km[2]);
                            if (k < 1 || k > n) throw new DiceError('#NUM!', `${km[0]} keeps or drops ${k}, but the term has ${n} dice`);
                        }
                        const dice = [];
                        for (let d = 0; d < n; d++) dice.push(randInt(sides));
                        const keep = dice.map(() => true);
                        if (keepMode) {
                            const order = dice.map((v, idx) => idx).sort((a, b) => dice[a] - dice[b] || a - b); // lowest first
                            const high = keepMode === 'kh' || keepMode === 'dl'; // keep the highest (kh), or drop the lowest (dl)
                            const chosen = keepMode[0] === 'k' ? k : n - k;      // how many are kept
                            const kept = high ? order.slice(n - chosen) : order.slice(0, chosen);
                            keep.fill(false);
                            kept.forEach(idx => { keep[idx] = true; });
                        }
                        dice.forEach((v, idx) => allDice.push({ sides: sides, value: v, kept: keep[idx] }));
                        const total = dice.reduce((a, v, idx) => a + (keep[idx] ? v : 0), 0);
                        return { v: total, t: `${n}d${m[2]}${keepMode ? keepMode + k : ''}[${dice.map((v, idx) => (keep[idx] ? v : `(${v})`)).join(',')}]` };
                    }
                    m = /^\d+(\.\d+)?/.exec(rest());
                    if (m) { i += m[0].length; return { v: Number(m[0]), t: m[0] }; }
                    throw new DiceError('#VALUE!');
                }
                function unary() {
                    if (src[i] === '-') { i++; const e = unary(); return { v: -e.v, t: `-${e.t}` }; }
                    if (src[i] === '+') { i++; return unary(); }
                    return primary();
                }
                function product() {
                    let left = unary();
                    while (src[i] === '*' || src[i] === '/') {
                        const op = src[i++], right = unary();
                        if (op === '/' && right.v === 0) throw new DiceError('#DIV/0!');
                        left = { v: op === '*' ? left.v * right.v : left.v / right.v, t: `${left.t} ${op === '*' ? '\u00d7' : '\u00f7'} ${right.t}` };
                    }
                    return left;
                }
                function sum() {
                    let left = product();
                    while (src[i] === '+' || src[i] === '-') {
                        const op = src[i++], right = product();
                        left = { v: op === '+' ? left.v + right.v : left.v - right.v, t: `${left.t} ${op} ${right.t}` };
                    }
                    return left;
                }
                const res = sum();
                if (i < src.length) throw new DiceError('#VALUE!');
                const total = Number(res.v.toPrecision(15));
                return { total, text: `${res.t} = ${total}`, dice: allDice };
            }

            function niceError(e) {
                if (!(e instanceof DiceError)) return 'Something went wrong with that roll.';
                if (e.code === '#DIV/0!') return "Can't divide by zero.";
                if (e.code === '#NUM!') return e.why + (e.fix ? ' - ' + e.fix : '') + '.';
                return "Can't read that. Try something like 3d6+2 or 4d6dl1.";
            }

            // ---- Colors and drawing ----
            function mixHex(hex, to, amt) {
                const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
                const f = (c) => Math.round(c + (to - c) * amt);
                return `rgb(${f(r)},${f(g)},${f(b)})`;
            }
            const colorFor = (sides) => COLORS[sides] || '#8da2b5';

            function shapePath(c, sides, r) {
                const poly = (pts) => { c.beginPath(); pts.forEach((p, idx) => idx ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); };
                const reg = (n, rad, off) => Array.from({ length: n }, (_, idx) => [Math.cos(off + idx * 2 * Math.PI / n) * rad, Math.sin(off + idx * 2 * Math.PI / n) * rad]);
                if (sides === 2) { c.beginPath(); c.arc(0, 0, r * 0.95, 0, Math.PI * 2); }
                else if (sides === 4) poly([[0, -r * 1.05], [r * 1.0, r * 0.8], [-r * 1.0, r * 0.8]]);
                else if (sides === 6) {
                    const q = r * 0.86, rad = r * 0.22;
                    c.beginPath(); c.moveTo(-q + rad, -q); c.arcTo(q, -q, q, q, rad); c.arcTo(q, q, -q, q, rad); c.arcTo(-q, q, -q, -q, rad); c.arcTo(-q, -q, q, -q, rad); c.closePath();
                }
                else if (sides === 8) poly([[0, -r * 1.1], [r * 0.82, 0], [0, r * 1.1], [-r * 0.82, 0]]);
                else if (sides === 10 || sides === 100) poly([[0, -r * 1.12], [r * 0.88, -r * 0.12], [0, r * 1.1], [-r * 0.88, -r * 0.12]]);
                else if (sides === 12) poly(reg(5, r * 1.02, -Math.PI / 2));
                else poly(reg(6, r * 1.02, -Math.PI / 2)); // d20, d30 and any other side count
            }

            function facetLines(c, sides, r) {
                const line = (x1, y1, x2, y2) => { c.moveTo(x1, y1); c.lineTo(x2, y2); };
                const regPts = (n, rad, off) => Array.from({ length: n }, (_, idx) => [Math.cos(off + idx * 2 * Math.PI / n) * rad, Math.sin(off + idx * 2 * Math.PI / n) * rad]);
                c.beginPath();
                if (sides === 2) { c.arc(0, 0, r * 0.72, 0, Math.PI * 2); }
                else if (sides === 4) { [[0, -r * 1.05], [r, r * 0.8], [-r, r * 0.8]].forEach(p => line(0, r * 0.2, p[0], p[1])); }
                else if (sides === 6) { const q = r * 0.6; c.rect(-q, -q, q * 2, q * 2); }
                else if (sides === 8) { line(0, -r * 1.1, 0, r * 1.1); line(-r * 0.82, 0, r * 0.82, 0); }
                else if (sides === 10 || sides === 100) { [[0, -r * 1.12], [r * 0.88, -r * 0.12], [0, r * 1.1], [-r * 0.88, -r * 0.12]].forEach(p => line(0, 0, p[0], p[1])); }
                else if (sides === 12) { regPts(5, r * 1.02, -Math.PI / 2).forEach(p => line(0, 0, p[0] * 0.55, p[1] * 0.55)); const inner = regPts(5, r * 0.55, -Math.PI / 2); inner.forEach((p, idx) => idx ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }
                else if (sides === 20) { const t = [0, 2, 4].map(idx => regPts(6, r * 1.02, -Math.PI / 2)[idx]); c.moveTo(t[0][0], t[0][1]); c.lineTo(t[1][0], t[1][1]); c.lineTo(t[2][0], t[2][1]); c.closePath(); }
                else { regPts(6, r * 1.02, -Math.PI / 2).forEach(p => line(0, 0, p[0], p[1])); const inner = regPts(6, r * 0.55, -Math.PI / 2); inner.forEach((p, idx) => idx ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }
                c.stroke();
            }

            function drawDie(c, x, y, size, sides, rot, sx, sy, label, alpha, glow) {
                const r = size / 2, base = colorFor(sides);
                c.save();
                c.translate(x, y); c.rotate(rot); c.scale(sx, sy);
                c.globalAlpha = alpha;
                if (glow) { c.shadowColor = glow === 'gold' ? 'rgba(255,205,60,0.95)' : 'rgba(255,60,40,0.9)'; c.shadowBlur = r * 1.1; }
                const g = c.createLinearGradient(-r, -r, r, r);
                g.addColorStop(0, mixHex(base, 255, 0.4)); g.addColorStop(0.5, base); g.addColorStop(1, mixHex(base, 0, 0.5));
                shapePath(c, sides, r);
                c.fillStyle = g; c.fill();
                c.shadowBlur = 0; c.shadowColor = 'transparent';
                c.lineWidth = Math.max(1.5, r * 0.07); c.lineJoin = 'round';
                c.strokeStyle = glow === 'gold' ? '#ffe28a' : glow === 'red' ? '#ff8a7a' : mixHex(base, 0, 0.65);
                c.stroke();
                c.lineWidth = Math.max(1, r * 0.04); c.strokeStyle = 'rgba(255,255,255,0.28)'; facetLines(c, sides, r);
                const gloss = c.createLinearGradient(-r, -r, r * 0.2, r * 0.3);
                gloss.addColorStop(0, 'rgba(255,255,255,0.32)'); gloss.addColorStop(1, 'rgba(255,255,255,0)');
                shapePath(c, sides, r); c.fillStyle = gloss; c.fill();
                const s = String(label), fs = r * (s.length <= 1 ? 1.0 : s.length === 2 ? 0.86 : s.length === 3 ? 0.66 : 0.5);
                c.font = `900 ${fs}px "Segoe UI", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
                const ty = sides === 4 ? r * 0.28 : 0;
                c.lineWidth = fs * 0.16; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineJoin = 'round'; c.strokeText(s, 0, ty);
                c.fillStyle = '#fff'; c.fillText(s, 0, ty);
                c.restore();
            }

            // ---- Stage / animation ----
            let scene = null, rafId = 0;
            const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            const clamp01 = (v) => Math.max(0, Math.min(1, v));

            function sizeCanvas() {
                const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
                const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
                if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
                dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                return { w, h };
            }

            function layoutItems(items, w, h) {
                const n = items.length;
                if (!n) return;
                const cols = Math.max(1, Math.ceil(Math.sqrt(n * w / h))), rows = Math.ceil(n / cols);
                const top = 44, area = h - top - 14; // top strip is kept clear for the total
                const cell = Math.min(w / cols, area / rows), size = Math.min(80, cell * 0.78);
                items.forEach((it, idx) => {
                    const row = Math.floor(idx / cols), inRow = Math.min(cols, n - row * cols), col = idx % cols;
                    it.size = size;
                    it.tx = w / 2 + (col - (inRow - 1) / 2) * (w / cols);
                    it.ty = top + area / rows * (row + 0.5);
                    it.x0 = w * (0.05 + Math.random() * 0.15); it.y0 = h + size;
                });
            }

            function buildScene(res) {
                const { w, h } = sizeCanvas();
                const items = res.dice.slice(0, ANIM_MAX).map((d, idx) => ({
                    sides: d.sides, value: d.value, kept: d.kept, idx,
                    delay: idx * 40, dur: 1000 + Math.random() * 200,
                    spin: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3) * Math.PI * 2,
                    rest: (Math.random() - 0.5) * 0.18, flips: 3 + Math.floor(Math.random() * 3), bounces: 2 + Math.floor(Math.random() * 2),
                    amp: 70 + Math.random() * 40, landed: false, glow: null
                }));
                layoutItems(items, w, h);
                const allLand = items.reduce((m, it) => Math.max(m, it.delay + it.dur), 0);
                return { items, particles: [], rings: [], allLand, res, t0: performance.now(), last: performance.now(), revealed: false, done: false, reduced: reducedMotion() };
            }

            function flicker(it, t) {
                const k = Math.floor(t / 70) + it.idx * 7;
                const x = Math.sin(k * 12.9898 + it.sides * 78.233) * 43758.5453;
                return 1 + Math.floor((x - Math.floor(x)) * it.sides);
            }

            function itemState(it, t) {
                const p = clamp01((t - it.delay) / it.dur), e = 1 - Math.pow(1 - p, 3);
                const hop = p < 1 ? it.amp * Math.abs(Math.sin(p * Math.PI * it.bounces)) * Math.pow(1 - p, 1.4) : 0;
                const q = (t - (it.delay + it.dur)) / 260;
                const pop = q >= 0 && q < 1 ? 1 + 0.22 * Math.sin(q * Math.PI) * (1 - q) : 1;
                const squash = 1 - 0.5 * Math.abs(Math.sin(p * Math.PI * it.flips)) * (1 - p);
                return {
                    p, hop, hopRatio: clamp01(hop / it.amp),
                    x: it.x0 + (it.tx - it.x0) * e, y: it.y0 + (it.ty - it.y0) * e - hop,
                    rot: it.spin * (1 - e) + it.rest, sx: squash * pop, sy: (1 - (1 - squash) * 0.25) * pop,
                    label: p < 1 ? flicker(it, t) : it.value
                };
            }

            function burst(sc, it, kind) {
                const st = { x: it.tx, y: it.ty };
                if (kind === 'gold') {
                    for (let k = 0; k < 44; k++) {
                        const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 280;
                        sc.particles.push({ x: st.x, y: st.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 700 + Math.random() * 500, age: 0, size: 1.5 + Math.random() * 3, color: Math.random() < 0.3 ? '#fff6c8' : '#ffc93c' });
                    }
                    sc.rings.push({ x: st.x, y: st.y, age: 0, life: 650, color: '255,210,70', base: it.size });
                } else {
                    for (let k = 0; k < 20; k++) {
                        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
                        sc.particles.push({ x: st.x, y: st.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 600 + Math.random() * 400, age: 0, size: 2 + Math.random() * 3, color: Math.random() < 0.5 ? '#ff4a3a' : '#7a1a14' });
                    }
                    sc.rings.push({ x: st.x, y: st.y, age: 0, life: 550, color: '255,70,50', base: it.size });
                }
            }

            function flash(cls) { stage.classList.remove('flash-red', 'flash-gold'); void stage.offsetWidth; stage.classList.add(cls); setTimeout(() => stage.classList.remove(cls), 800); }

            function reveal(sc) {
                sc.revealed = true;
                const res = sc.res;
                totalEl.classList.remove('rolling', 'gold', 'red');
                const kept20 = res.dice.filter(d => d.sides === 20 && d.kept);
                if (kept20.some(d => d.value === 20)) totalEl.classList.add('gold'); else if (kept20.some(d => d.value === 1)) totalEl.classList.add('red');
                totalEl.textContent = res.total;
                void totalEl.offsetWidth; totalEl.classList.add('pop');
                textEl.textContent = res.text;
                moreEl.innerHTML = '';
                res.dice.slice(ANIM_MAX).forEach(d => {
                    const chip = document.createElement('span');
                    chip.className = 'dchip' + (d.kept ? '' : ' dropped');
                    chip.style.background = colorFor(d.sides); chip.textContent = d.value;
                    moreEl.appendChild(chip);
                });
            }

            function step(t, dt) {
                const sc = scene;
                sc.items.forEach(it => {
                    if (!it.landed && t >= it.delay + it.dur) {
                        it.landed = true;
                        if (it.sides === 20 && it.kept && it.value === 20) { it.glow = 'gold'; if (!sc.reduced) { burst(sc, it, 'gold'); flash('flash-gold'); } }
                        else if (it.sides === 20 && it.kept && it.value === 1) { it.glow = 'red'; if (!sc.reduced) { burst(sc, it, 'red'); flash('flash-red'); } }
                    }
                });
                sc.particles.forEach(pt => { pt.age += dt * 1000; pt.vy += 620 * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; });
                sc.particles = sc.particles.filter(pt => pt.age < pt.life);
                sc.rings.forEach(rg => { rg.age += dt * 1000; });
                sc.rings = sc.rings.filter(rg => rg.age < rg.life);
                if (!sc.revealed && t >= sc.allLand) reveal(sc);
                if (t >= sc.allLand + 300 && !sc.particles.length && !sc.rings.length) sc.done = true;
            }

            function renderStage(t) {
                const { w, h } = sizeCanvas();
                dctx.clearRect(0, 0, w, h);
                const g = dctx.createRadialGradient(w / 2, h * 0.6, 8, w / 2, h * 0.6, Math.max(w, h) * 0.65);
                g.addColorStop(0, 'rgba(0,255,204,0.13)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                dctx.fillStyle = g; dctx.fillRect(0, 0, w, h);
                if (!scene) {
                    dctx.save(); dctx.translate(w / 2, h / 2 - 8); dctx.globalAlpha = 0.22; dctx.lineWidth = 2; dctx.strokeStyle = '#00ffcc';
                    shapePath(dctx, 20, 34); dctx.stroke(); facetLines(dctx, 20, 34); dctx.restore();
                    dctx.fillStyle = 'rgba(0,255,204,0.55)'; dctx.font = '700 11px "Segoe UI", Arial, sans-serif'; dctx.textAlign = 'center';
                    dctx.fillText('TAP DICE, THEN ROLL', w / 2, h / 2 + 52);
                    return;
                }
                const states = scene.items.map(it => ({ it, s: itemState(it, t) }));
                states.sort((a, b) => a.s.y - b.s.y);
                states.forEach(({ it, s }) => {
                    if (s.p <= 0) return;
                    const fy = it.ty + it.size * 0.56, k = 1 - s.hopRatio * 0.55;
                    dctx.save(); dctx.globalAlpha = 0.38 * k; dctx.fillStyle = '#000';
                    dctx.beginPath(); dctx.ellipse(s.x, fy, it.size * 0.42 * k, it.size * 0.1 * k, 0, 0, Math.PI * 2); dctx.fill(); dctx.restore();
                });
                states.forEach(({ it, s }) => {
                    if (s.p <= 0) return;
                    drawDie(dctx, s.x, s.y, it.size, it.sides, s.rot, s.sx, s.sy, s.label, it.kept || s.p < 1 ? 1 : 0.33, s.p >= 1 ? it.glow : null);
                });
                scene.rings.forEach(rg => {
                    const f = rg.age / rg.life; dctx.save(); dctx.strokeStyle = `rgba(${rg.color},${(1 - f).toFixed(3)})`; dctx.lineWidth = 3 * (1 - f) + 1;
                    dctx.beginPath(); dctx.arc(rg.x, rg.y, rg.base * (0.5 + f * 1.4), 0, Math.PI * 2); dctx.stroke(); dctx.restore();
                });
                scene.particles.forEach(pt => {
                    dctx.save(); dctx.globalAlpha = clamp01(1 - pt.age / pt.life); dctx.fillStyle = pt.color;
                    dctx.beginPath(); dctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); dctx.fill(); dctx.restore();
                });
            }

            function frame(now) {
                const t = now - scene.t0, dt = Math.min(0.05, (now - scene.last) / 1000);
                scene.last = now;
                step(t, dt); renderStage(t);
                if (!scene.done) rafId = requestAnimationFrame(frame);
            }

            function redraw() { if (!scene) renderStage(0); else if (scene.done) { const { w, h } = sizeCanvas(); layoutItems(scene.items, w, h); renderStage(1e9); } }

            function startRoll(res) {
                cancelAnimationFrame(rafId);
                stage.classList.remove('flash-red', 'flash-gold');
                scene = buildScene(res);
                totalEl.className = 'rolling'; totalEl.textContent = '\u00b7\u00b7\u00b7';
                textEl.textContent = ''; moreEl.innerHTML = '';
                if (scene.reduced) {
                    step(1e9, 0); renderStage(1e9);
                } else {
                    scene.t0 = performance.now(); scene.last = scene.t0;
                    rafId = requestAnimationFrame(frame);
                }
            }

            // ---- History ----
            function loadHist() { try { const a = JSON.parse(localStorage.getItem(HIST_KEY)); return Array.isArray(a) ? a.slice(0, HIST_MAX) : []; } catch (e) { return []; } }
            function saveHist(a) { try { localStorage.setItem(HIST_KEY, JSON.stringify(a)); } catch (e) { } }
            function renderHist() {
                const a = loadHist(); histEl.innerHTML = '';
                histClear.disabled = !a.length;
                if (!a.length) { const d = document.createElement('div'); d.className = 'hist-empty'; d.textContent = 'No rolls yet.'; histEl.appendChild(d); return; }
                a.forEach(h => {
                    const row = document.createElement('div'); row.className = 'hist-item';
                    const tot = document.createElement('div'); tot.className = 'hist-total'; tot.textContent = h.total;
                    const main = document.createElement('div'); main.className = 'hist-main';
                    const ex = document.createElement('div'); ex.className = 'hist-expr'; ex.textContent = h.expr;
                    const tx = document.createElement('div'); tx.className = 'hist-text'; tx.textContent = h.text;
                    main.appendChild(ex); main.appendChild(tx);
                    const tm = document.createElement('div'); tm.className = 'hist-time';
                    tm.textContent = new Date(h.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    row.appendChild(tot); row.appendChild(main); row.appendChild(tm); histEl.appendChild(row);
                });
            }

            // ---- Controls ----
            function getMod() { const v = parseInt(modInput.value, 10); return isNaN(v) ? 0 : Math.max(-99, Math.min(99, v)); }
            function setMod(v) { modInput.value = Math.max(-99, Math.min(99, v)); refresh(); }
            const fullExpr = (base) => { const m = getMod(); return m ? base + (m < 0 ? '-' : '+') + Math.abs(m) : base; };

            function refresh() {
                const base = input.value.trim();
                let ok = false, err = '';
                if (base) { try { rollDice(base); ok = true; } catch (e) { err = niceError(e); } }
                msgEl.textContent = err; input.classList.toggle('bad', !!err);
                previewEl.textContent = ok ? 'Rolls: ' + fullExpr(base) : '';
                rollBtn.disabled = !ok;
                const single = ok && /^1?d20$/.test(base.toLowerCase().replace(/\s+/g, ''));
                advBtn.disabled = !single; disBtn.disabled = !single;
                clearBtn.disabled = !input.value.length;
            }

            function doRoll(base) {
                base = (base || '').trim();
                if (!base) return;
                let res;
                const expr = fullExpr(base);
                try { res = rollDice(expr); } catch (e) { msgEl.textContent = niceError(e); return; }
                const hist = loadHist(); hist.unshift({ expr: expr, text: res.text, total: res.total, time: Date.now() });
                saveHist(hist.slice(0, HIST_MAX)); renderHist();
                startRoll(res);
            }

            function addDie(sides) {
                const S = String(sides), v = input.value;
                const re = new RegExp('(^|[^0-9a-z])(\\d*)d' + S + '(?![0-9])', 'i'), m = re.exec(v);
                if (m) {
                    const n = m[2] === '' ? 1 : parseInt(m[2], 10), idx = m.index + m[1].length;
                    input.value = v.slice(0, idx) + (n + 1) + v.slice(idx + m[2].length);
                } else {
                    const t = v.trim();
                    input.value = t === '' ? '1d' + S : (/[+\-*/(]$/.test(t) ? t + '1d' + S : t + '+1d' + S);
                }
                refresh();
            }

            PAD.forEach(s => {
                const b = document.createElement('button'); b.className = 'dpad-btn'; b.textContent = s === 'X' ? 'dX' : 'd' + s;
                b.style.setProperty('--c', s === 'X' ? '#8da2b5' : colorFor(s));
                b.addEventListener('click', () => {
                    if (s !== 'X') { addDie(s); return; }
                    const v = prompt('Number of sides (2 to ' + MAX_SIDES + '):', '7');
                    if (v === null) return;
                    const n = parseInt(v, 10);
                    if (isNaN(n) || n < 2 || n > MAX_SIDES) { msgEl.textContent = 'A die needs 2 to ' + MAX_SIDES + ' sides.'; return; }
                    addDie(n);
                });
                padEl.appendChild(b);
            });

            function openTray() {
                tray.classList.add('open'); tray.setAttribute('aria-hidden', 'false');
                document.getElementById('sidebar').classList.add('minimized');
                document.getElementById('contextMenu').style.display = 'none';
                setTimeout(redraw, 0);
            }
            function closeTray() { tray.classList.remove('open'); tray.setAttribute('aria-hidden', 'true'); }

            fab.addEventListener('click', () => { tray.classList.contains('open') ? closeTray() : openTray(); });
            closeBtn.addEventListener('click', closeTray);
            input.addEventListener('input', refresh);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !rollBtn.disabled) doRoll(input.value); });
            rollBtn.addEventListener('click', () => doRoll(input.value));
            advBtn.addEventListener('click', () => doRoll('2d20kh1'));
            disBtn.addEventListener('click', () => doRoll('2d20kl1'));
            clearBtn.addEventListener('click', () => { input.value = ''; refresh(); });
            modMinus.addEventListener('click', () => setMod(getMod() - 1));
            modPlus.addEventListener('click', () => setMod(getMod() + 1));
            modInput.addEventListener('input', refresh);
            modInput.addEventListener('change', () => setMod(getMod()));
            histClear.addEventListener('click', () => { saveHist([]); renderHist(); });
            window.addEventListener('resize', redraw);

            renderHist(); refresh(); redraw();
        })();

        window.onclick = (e) => { if(e.target.tagName !== 'BUTTON' && !e.target.classList.contains('menu-item')) menu.style.display = 'none'; };
        init();
