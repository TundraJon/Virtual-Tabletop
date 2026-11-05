        const canvas = document.getElementById('battleMap'), ctx = canvas.getContext('2d');
        const menu = document.getElementById('contextMenu'), sidebar = document.getElementById('sidebar');
        
        let mapImg = new Image(), tokens = [], scale = 1.0, offset = {x:0, y:0};
        let mapLib = {}, tokenLib = {}, grid = { size: 0, x1: 0, y1: 0, x2: 0, y2: 0, ftPerSq: 5 };
        let calPoints = [null, null], currentMode = null, showPins = true;
        let isPinching = false, zoomCooldown = false, lastPinchDist = 0, lastPinchMid = {x:0, y:0}, touchStartPos = {x:0, y:0};
        let dragging = null, dragStartX = 0, dragStartY = 0, lastMove = null;
        let gridColor = "0, 255, 204", menuTimer = null, curMapName = '', mapFiles = {}, tokenFiles = {};

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

            files.forEach(f => { const k = f.name.split('.')[0]; lib[k] = URL.createObjectURL(f); (lib === mapLib ? mapFiles : tokenFiles)[k] = f; });

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

        function changeMap(n) { if(n.includes("First")) return; mapImg.src = mapLib[n]; calPoints=[null,null]; grid.size=0; mapImg.onload = () => { curMapName = n; fitToScreen(); if (window.boardHooks) boardHooks.mapLoaded(n); }; }
        
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
            if (window.boardHooks) boardHooks.gridApplied();
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
            const MAX_PER_TERM = 20, MAX_TOTAL = 50, MAX_SIDES = 1000, MAX_EXTRA = 20, ANIM_MAX = 12, HIST_MAX = 10, HIST_KEY = 'vttDiceHistory';
            const COLORS = { 2: '#d9b13b', 4: '#35c27a', 6: '#e0554b', 8: '#4b8fe3', 10: '#a853e0', 12: '#e58a3f', 20: '#00d9b0', 30: '#e04ba5', 100: '#bfd140' };
            const el = (id) => document.getElementById(id);
            const tray = el('diceTray'), fab = el('diceFab'), closeBtn = el('diceClose'), stage = el('diceStage');
            const cv = el('diceCanvas'), dctx = cv.getContext('2d'), totalEl = el('diceTotal'), textEl = el('diceText'), moreEl = el('diceMore');
            const input = el('diceExpr'), msgEl = el('diceMsg'), keysEl = el('diceKeys'), scrollEl = el('diceScroll'), kbBtn = el('diceKb'), rollBtn = el('diceRollBtn');
            const advBtn = el('diceAdv'), disBtn = el('diceDis'), clearBtn = el('diceClear'), delBtn = el('diceDel');
            const modMinus = el('diceModMinus'), modPlus = el('diceModPlus'), modInput = el('diceMod');
            const histEl = el('diceHist'), histClear = el('diceHistClear');

            // ---- Engine: dice notation (adapted from QSheet's parser; every die uses crypto randomness) ----
            class DiceError extends Error {
                constructor(code, why, fix) { super(why || code); this.name = 'DiceError'; this.code = code; this.why = why || ''; this.fix = fix || ''; }
            }

            let dryRun = false; // validation passes roll every die as 1 and use no randomness
            function randInt(sides) {
                if (dryRun) return 1;
                const buf = new Uint32Array(1), limit = Math.floor(4294967296 / sides) * sides;
                do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
                return 1 + (buf[0] % sides);
            }

            // Which of `values` are kept. mode: kh, kl, dh or dl; k: how many. Ties keep the later one when keeping highest.
            function pickKept(values, mode, k) {
                const n = values.length;
                const order = values.map((v, idx) => idx).sort((a, b) => values[a] - values[b] || a - b); // lowest first
                const high = mode === 'kh' || mode === 'dl'; // keep the highest (kh), or drop the lowest (dl)
                const chosen = mode[0] === 'k' ? k : n - k;  // how many are kept
                const kept = high ? order.slice(n - chosen) : order.slice(0, chosen);
                const keep = values.map(() => false);
                kept.forEach(idx => { keep[idx] = true; });
                return keep;
            }

            const tensText = (v) => (v === 0 ? '00' : String(v));

            // Returns { total, text, dice }. dice = [{ sides, value, kept, kind?, extra? }] in roll order.
            // kind is 'tens' or 'ones' for percentile dice; extra marks dice added by an explosion.
            function rollDice(expr, dry) {
                dryRun = !!dry;
                try { return parseRoll(expr); } finally { dryRun = false; }
            }

            function parseRoll(expr) {
                if (/\d\s+\d/.test(String(expr))) throw new DiceError('#VALUE!'); // "3d6 4" is not "3d64"
                const src = String(expr).toLowerCase().replace(/\s+/g, '');
                if (!src) throw new DiceError('#VALUE!');
                let i = 0, diceCount = 0;
                const rest = () => src.slice(i);

                // kh / kl / dh / dl with an optional number, plus the shorthands k (keep highest) and dN (drop lowest N)
                function keepDrop() {
                    let m = /^(kh|kl|dh|dl)(\d*)/.exec(rest()), mode;
                    if (m) { mode = m[1]; }
                    else if ((m = /^k(\d*)/.exec(rest()))) { mode = 'kh'; }
                    else if ((m = /^d(\d+)/.exec(rest()))) { mode = 'dl'; }
                    else return null;
                    const digits = m[m.length - 1];
                    i += m[0].length;
                    return { mode, k: digits === '' ? 1 : Number(digits), raw: m[0] };
                }

                // minN / maxN: a floor or ceiling on a dice term or group
                function clamps(node) {
                    let m;
                    while ((m = /^(min|max)(\d+)/.exec(rest()))) {
                        i += m[0].length;
                        const lim = Number(m[2]);
                        node.v = m[1] === 'min' ? Math.max(node.v, lim) : Math.min(node.v, lim);
                        node.t += m[1] + lim;
                    }
                    return node;
                }

                function group() {
                    const close = src[i] === '(' ? ')' : '}';
                    i++;
                    const items = [sum()];
                    while (src[i] === ',') { i++; items.push(sum()); }
                    if (src[i] !== close) throw new DiceError('#VALUE!');
                    i++;
                    const kd = keepDrop();
                    let node;
                    if (kd) {
                        if (items.length < 2) throw new DiceError('#VALUE!', `${kd.raw} compares items separated by commas`, 'use a group like (1d8,1d6)kh1');
                        if (kd.k < 1 || kd.k > items.length) throw new DiceError('#NUM!', `${kd.raw} keeps or drops ${kd.k}, but the group has ${items.length} items`);
                        const keep = pickKept(items.map(x => x.v), kd.mode, kd.k);
                        items.forEach((x, idx) => { if (!keep[idx]) x.dice.forEach(d => { d.kept = false; }); });
                        node = {
                            v: items.reduce((a, x, idx) => a + (keep[idx] ? x.v : 0), 0),
                            t: `(${items.map(x => x.t).join(', ')})${kd.mode}${kd.k}[${items.map((x, idx) => (keep[idx] ? x.v : `(${x.v})`)).join(',')}]`,
                            dice: [].concat(...items.map(x => x.dice))
                        };
                    } else {
                        if (items.length > 1) throw new DiceError('#VALUE!', 'A group of items separated by commas needs kh, kl, dh or dl after it', 'like (1d8,1d6)kh1');
                        node = { v: items[0].v, t: `(${items[0].t})`, dice: items[0].dice };
                    }
                    return clamps(node);
                }

                function diceTerm(m) {
                    i += m[0].length;
                    const n = m[1] === '' ? 1 : Number(m[1]), sides = m[2] === '%' ? 100 : Number(m[2]);
                    if (n < 1) throw new DiceError('#NUM!', 'A dice term needs at least 1 die');
                    if (n > MAX_PER_TERM) throw new DiceError('#NUM!', `${n} dice in one term; the limit is ${MAX_PER_TERM}`, `split it into terms of ${MAX_PER_TERM} or fewer, like ${MAX_PER_TERM}d${m[2]}+${Math.min(n - MAX_PER_TERM, MAX_PER_TERM)}d${m[2]}`);
                    if (sides < 2 || sides > MAX_SIDES) throw new DiceError('#NUM!', `A die needs 2 to ${MAX_SIDES} sides, not ${sides}`);
                    diceCount += n;
                    if (diceCount > MAX_TOTAL) throw new DiceError('#NUM!', `${diceCount} dice in all; the limit is ${MAX_TOTAL} in one roll`);
                    const pct = sides === 100; // d100 and d% roll a tens die and a ones die
                    let bp = '', bpExtra = 0, bpRaw = '';
                    const bm = /^([bp])(\d*)/.exec(rest());
                    if (bm) {
                        if (!pct) throw new DiceError('#VALUE!', 'Bonus and penalty dice (b, p) only work on d100', 'like d100b');
                        i += bm[0].length; bp = bm[1]; bpRaw = bm[0]; bpExtra = bm[2] === '' ? 1 : Number(bm[2]);
                        if (n !== 1) throw new DiceError('#NUM!', 'Bonus and penalty dice work on a single d100', `use d100${bp}, not ${n}d100${bp}`);
                        if (bpExtra < 1 || bpExtra > 10) throw new DiceError('#NUM!', 'Use 1 to 10 bonus or penalty dice');
                    }
                    let tensN = 0, tRaw = '';
                    const tm = /^t(\d*)/.exec(rest());
                    if (tm) {
                        if (!pct) throw new DiceError('#VALUE!', 'The tens-dice form (t) only works on d100', 'like d100t3kl');
                        if (bm) throw new DiceError('#VALUE!', 'Use either b/p or t, not both', 'like d100b or d100t2kl');
                        if (tm[1] === '') throw new DiceError('#VALUE!', 'd100t needs the number of tens dice', 'like d100t3kl');
                        i += tm[0].length; tensN = Number(tm[1]); tRaw = tm[0];
                        if (n !== 1) throw new DiceError('#NUM!', 'The tens-dice form works on a single d100', `use d100t${tensN}kl, not ${n}d100t${tensN}kl`);
                        if (tensN < 2 || tensN > 11) throw new DiceError('#NUM!', 'Use 2 to 11 tens dice');
                    }
                    let explode = false;
                    if (src[i] === '!') {
                        if (pct) throw new DiceError('#NUM!', "Exploding dice (!) don't work on d100");
                        explode = true; i++;
                    }
                    const kd = keepDrop();
                    if (tensN) {
                        if (!kd) throw new DiceError('#VALUE!', `d100${tRaw} needs kl or kh after it`, `like d100${tRaw}kl`);
                        const keptCount = kd.mode[0] === 'k' ? kd.k : tensN - kd.k;
                        if (keptCount !== 1) throw new DiceError('#NUM!', `${kd.raw} would keep ${Math.max(keptCount, 0)} of the ${tensN} tens dice; exactly one must be kept`, 'use kl or kh');
                    } else if (kd && (kd.k < 1 || kd.k > n)) throw new DiceError('#NUM!', `${kd.raw} keeps or drops ${kd.k}, but the term has ${n} dice`);

                    // Roll: every unit is one value that keep/drop can keep or drop
                    const units = [];
                    if (bp || tensN) {
                        const count = bp ? bpExtra + 1 : tensN;
                        const sel = bp ? { mode: bp === 'b' ? 'kl' : 'kh', k: 1 } : kd; // bonus keeps the lowest result, penalty the highest
                        const ones = randInt(10) - 1, tens = [];
                        for (let t = 0; t < count; t++) tens.push((randInt(10) - 1) * 10);
                        const results = tens.map(tv => (tv + ones) || 100);
                        const chosen = pickKept(results, sel.mode, sel.k).indexOf(true);
                        const keepsLowest = sel.mode === 'kl' || sel.mode === 'dh';
                        const dice = tens.map((tv, idx) => ({ sides: 100, value: tv, kept: idx === chosen, kind: 'tens' }));
                        dice.push({ sides: 10, value: ones, kept: true, kind: 'ones' });
                        units.push({ v: results[chosen], dice, text: `tens ${tens.map((tv, idx) => (idx === chosen ? tensText(tv) : `(${tensText(tv)})`)).join(',')} keep ${keepsLowest ? 'lowest' : 'highest'}; ones ${ones}` });
                    } else if (pct) {
                        for (let d = 0; d < n; d++) {
                            const tv = (randInt(10) - 1) * 10, ov = randInt(10) - 1;
                            units.push({ v: (tv + ov) || 100, dice: [{ sides: 100, value: tv, kept: true, kind: 'tens' }, { sides: 10, value: ov, kept: true, kind: 'ones' }], text: `tens ${tensText(tv)}, ones ${ov}` });
                        }
                    } else {
                        let extras = 0;
                        for (let d = 0; d < n; d++) {
                            let v = randInt(sides);
                            units.push({ v, dice: [{ sides, value: v, kept: true }], text: String(v) });
                            while (explode && v === sides && extras < MAX_EXTRA) {
                                extras++; v = randInt(sides);
                                units.push({ v, dice: [{ sides, value: v, kept: true, extra: true }], text: String(v) });
                            }
                        }
                    }
                    const keep = (kd && !tensN) ? pickKept(units.map(u => u.v), kd.mode, kd.k) : units.map(() => true);
                    units.forEach((u, idx) => { if (!keep[idx]) u.dice.forEach(d => { d.kept = false; }); });
                    const total = units.reduce((a, u, idx) => a + (keep[idx] ? u.v : 0), 0);
                    const inner = units.map((u, idx) => (keep[idx] ? u.text : `(${u.text})`)).join(pct ? '; ' : ',');
                    return clamps({
                        v: total,
                        t: `${n}d${m[2]}${bpRaw}${tRaw}${explode ? '!' : ''}${tensN ? kd.raw : (kd ? kd.mode + kd.k : '')}[${inner}]`,
                        dice: [].concat(...units.map(u => u.dice))
                    });
                }

                function primary() {
                    if (src[i] === '(' || src[i] === '{') return group();
                    const m = /^(\d*)d(%|\d+)/.exec(rest());
                    if (m) return diceTerm(m);
                    const num = /^\d+(\.\d+)?/.exec(rest());
                    if (num) { i += num[0].length; return { v: Number(num[0]), t: num[0], dice: [] }; }
                    throw new DiceError('#VALUE!');
                }
                function unary() {
                    if (src[i] === '-') { i++; const e = unary(); return { v: -e.v, t: `-${e.t}`, dice: e.dice }; }
                    if (src[i] === '+') { i++; return unary(); }
                    return primary();
                }
                function product() {
                    let left = unary();
                    while (src[i] === '*' || src[i] === '/') {
                        const op = src[i++], right = unary();
                        if (op === '/' && right.v === 0) throw new DiceError('#DIV/0!');
                        left = { v: op === '*' ? left.v * right.v : left.v / right.v, t: `${left.t} ${op === '*' ? '\u00d7' : '\u00f7'} ${right.t}`, dice: left.dice.concat(right.dice) };
                    }
                    return left;
                }
                function sum() {
                    let left = product();
                    while (src[i] === '+' || src[i] === '-') {
                        const op = src[i++], right = product();
                        left = { v: op === '+' ? left.v + right.v : left.v - right.v, t: `${left.t} ${op} ${right.t}`, dice: left.dice.concat(right.dice) };
                    }
                    return left;
                }
                const res = sum();
                if (i < src.length) {
                    if (src[i] === ',') throw new DiceError('#VALUE!', 'A comma only works inside a group ending in kh, kl, dh or dl', 'like (1d8,1d6)kh1');
                    throw new DiceError('#VALUE!');
                }
                const total = Number(res.v.toPrecision(15));
                return { total, text: `${res.t} = ${total}`, dice: res.dice };
            }

            function niceError(e) {
                if (!(e instanceof DiceError)) return 'Something went wrong with that roll.';
                if (e.code === '#DIV/0!') return "Can't divide by zero.";
                if (e.why) return e.why + (e.fix ? ' - ' + e.fix : '') + '.';
                return "Can't read that. Try something like 3d6+2 or 4d6dl1.";
            }

            // ---- Colors and drawing ----
            function mixHex(hex, to, amt) {
                const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
                const f = (c) => Math.round(c + (to - c) * amt);
                return `rgb(${f(r)},${f(g)},${f(b)})`;
            }
            const colorFor = (sides) => COLORS[sides] || '#8da2b5';
            const dieLabel = (d) => (d.kind === 'tens' ? tensText(d.value) : String(d.value));

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
                    sides: d.sides, value: d.value, kept: d.kept, kind: d.kind, idx,
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
                const f = x - Math.floor(x);
                if (it.kind === 'tens') return tensText(Math.floor(f * 10) * 10);
                if (it.kind === 'ones') return Math.floor(f * 10);
                return 1 + Math.floor(f * it.sides);
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
                    label: p < 1 ? flicker(it, t) : dieLabel(it)
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
                    chip.style.background = colorFor(d.sides); chip.textContent = dieLabel(d);
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
            // ---- The final modifier is the box's trailing +N or -N ----
            const OPERATOR_END = /[+\-*/(,{]$/;
            function trailingMod(v) { // a final +N or -N, after something that is not an operator
                const m = /([+-])(\d+)$/.exec(v);
                if (!m) return null;
                const before = v.slice(0, m.index);
                if (before === '' || OPERATOR_END.test(before)) return null;
                return { start: m.index, value: (m[1] === '-' ? -1 : 1) * Number(m[2]) };
            }
            const modOf = (v) => { const t = trailingMod(v); return t ? t.value : 0; };
            function setBox(v, pos) { input.value = v; input.setSelectionRange(pos, pos); refresh(); }
            function applyMod(n) { // set the box's modifier to n (0 removes it); false if the box cannot take one
                const v = input.value, t = trailingMod(v), base = t ? v.slice(0, t.start) : v;
                if (base === '' || OPERATOR_END.test(base)) return false;
                const nv = base + (n === 0 ? '' : (n < 0 ? '-' : '+') + Math.abs(n));
                setBox(nv, selStart() === v.length ? nv.length : Math.min(selStart(), nv.length));
                return true;
            }

            // ---- Dice term at the cursor, and advantage / disadvantage on it ----
            const caret = () => (typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length);
            const SUFFIX = '(?:(?:kh|kl|dh|dl)\\d*|k\\d*|d\\d+)?(?:(?:min|max)\\d+)*';
            // The smallest dice term (with its modifiers) or ( ) / { } group, with its suffix, that holds the cursor
            function termAt(str, pos) {
                const cands = [], re = new RegExp('(\\d*)d(?:%|\\d+)(?:[bp]\\d*|t\\d+)?!?' + SUFFIX, 'gi');
                let m;
                while ((m = re.exec(str))) {
                    if (m[0].length === 0) { re.lastIndex++; continue; }
                    if (m.index > 0 && (str[m.index - 1] === ')' || str[m.index - 1] === '}')) continue; // a shorthand like )d1 is a suffix, not a die
                    cands.push({ start: m.index, end: m.index + m[0].length });
                }
                const stack = [];
                for (let idx = 0; idx < str.length; idx++) {
                    const ch = str[idx];
                    if (ch === '(' || ch === '{') stack.push(idx);
                    else if (ch === ')' || ch === '}') {
                        const st = stack.pop();
                        if (st === undefined) continue;
                        cands.push({ start: st, end: idx + 1 + new RegExp('^' + SUFFIX, 'i').exec(str.slice(idx + 1))[0].length });
                    }
                }
                const hit = cands.filter(c => pos >= c.start && pos <= c.end).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
                return hit ? { start: hit.start, end: hit.end, text: str.slice(hit.start, hit.end) } : null;
            }
            const LONE_DIE = /^1?d(\d+|%)([+-]\d+)?$/; // one die, with an optional trailing modifier
            // 1dN becomes 2dNkh1 (or kl1); any other term T becomes (T, T)kh1 (or kl1)
            function advText(term, mode) {
                const m = /^1?d(\d+|%)$/.exec(term);
                return m ? '2d' + m[1] + mode + '1' : '(' + term + ', ' + term + ')' + mode + '1';
            }
            function advDis(mode) {
                const compact = input.value.toLowerCase().replace(/\s+/g, '');
                const lone = LONE_DIE.exec(compact);
                if (!rollBtn.disabled && lone) { doRoll('2d' + lone[1] + mode + '1' + (lone[2] || '')); return; } // one die alone: roll it now, box unchanged
                const t = termAt(input.value, caret());
                if (!t) return;
                const rep = advText(t.text.toLowerCase().replace(/\s+/g, ''), mode);
                input.value = input.value.slice(0, t.start) + rep + input.value.slice(t.end);
                const np = t.start + rep.length;
                input.setSelectionRange(np, np);
                refresh();
            }

            // The red error message waits 700 ms after the last change, so half-built expressions do not flash errors. ROLL still disables at once.
            let msgTimer = 0, pendingErr = '';
            function setMsg(err) {
                if (!err) { clearTimeout(msgTimer); pendingErr = ''; msgEl.textContent = ''; input.classList.remove('bad'); return; }
                if (err === pendingErr) return; // already showing, or waiting to show, this message
                pendingErr = err; clearTimeout(msgTimer);
                msgEl.textContent = ''; input.classList.remove('bad');
                msgTimer = setTimeout(() => { msgEl.textContent = err; input.classList.add('bad'); }, 700);
            }
            function refresh() {
                const base = input.value.trim();
                let ok = false, err = '';
                if (base) { try { rollDice(base, true); ok = true; } catch (e) { err = niceError(e); } }
                setMsg(err);
                rollBtn.disabled = !ok;
                const canAdv = (ok && LONE_DIE.test(base.toLowerCase().replace(/\s+/g, ''))) || !!termAt(input.value, caret());
                const tm = trailingMod(input.value), modBase = tm ? input.value.slice(0, tm.start) : input.value;
                const canMod = modBase !== '' && !OPERATOR_END.test(modBase);
                modMinus.disabled = !canMod; modPlus.disabled = !canMod; modInput.disabled = !canMod;
                if (document.activeElement !== modInput) modInput.value = String(canMod ? modOf(input.value) : 0);
                advBtn.disabled = !canAdv; disBtn.disabled = !canAdv;
                clearBtn.disabled = !input.value.length;
            }

            function doRoll(base) {
                base = (base || '').trim();
                if (!base) return;
                let res;
                const expr = base;
                try { res = rollDice(expr); } catch (e) { msgEl.textContent = niceError(e); return; }
                const hist = loadHist(); hist.unshift({ expr: expr, text: res.text, total: res.total, time: Date.now() });
                saveHist(hist.slice(0, HIST_MAX)); renderHist();
                startRoll(res);
                scrollEl.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); // bring the dice into view
            }

            // ---- On-screen keypad: every key inserts exactly what it says, at the cursor ----
            const KEY_ROWS = [
                { keys: [['d'], ['d2'], ['d4'], ['d6'], ['d8'], ['d10'], ['d12'], ['d20'], ['d100']] },
                { keys: [['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0']] },
                { keys: [['+'], ['\u2212', '-'], ['*'], ['/'], ['('], [')'], [','], ['!']] },
                { keys: [['B', 'b'], ['P', 'p'], ['T', 't'], ['MIN', 'min'], ['MAX', 'max'], ['KH', 'kh'], ['KL', 'kl'], ['DH', 'dh'], ['DL', 'dl']] },
                { keys: [['4D6KH3', '4d6kh3']], quick: true }
            ];
            const selStart = () => (typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length);
            const selEnd = () => (typeof input.selectionEnd === 'number' ? input.selectionEnd : selStart());
            function setCaret(pos) { input.focus({ preventScroll: true }); input.setSelectionRange(pos, pos); refresh(); }
            function insertText(txt) {
                const v = input.value, s = selStart(), e = selEnd();
                input.value = v.slice(0, s) + txt + v.slice(e);
                setCaret(s + txt.length);
            }
            function backspace() {
                const v = input.value, s = selStart(), e = selEnd();
                if (s !== e) { input.value = v.slice(0, s) + v.slice(e); setCaret(s); }
                else if (s > 0) { input.value = v.slice(0, s - 1) + v.slice(s); setCaret(s - 1); }
            }
            // Memory for the digit keys: a mark is (box text, cursor) right after a tap, and only counts while both are unchanged.
            let afterDie = null, typingRun = null;
            const isMark = (m) => !!m && m.value === input.value && selStart() === selEnd() && selStart() === m.pos;
            const markDie = () => { afterDie = { value: input.value, pos: selStart() }; typingRun = null; };
            function digitKey(d) {
                const v = input.value, s = selStart();
                const plus = isMark(afterDie) && s > 0 && !OPERATOR_END.test(v.charAt(s - 1)); // a digit right after a die key starts a new term
                insertText(plus ? '+' + d : d);
                typingRun = { value: input.value, pos: selStart() }; afterDie = null;
            }
            // A die key (d2 to d100). Tapping it again raises that die's count; a different die gets a + in front.
            function dieKey(S) {
                const v = input.value, s = selStart(), e = selEnd(), tag = 'd' + S;
                if (s !== e) { insertText(tag); markDie(); return; }                          // replacing a selection
                const before = v.slice(0, s), after = v.slice(s);
                if (isMark(typingRun) && /(^|[+\-*/(,{])\d+$/.test(before)) { insertText(tag); markDie(); return; } // a count was just typed: 2 then d6 gives 2d6
                const m = new RegExp('(^|[^0-9a-z)}])(\\d*)d' + S + '(?![0-9a-z!%])', 'i').exec(v); // a plain term of this die already in the box
                if (m) {
                    const n = m[2] === '' ? 1 : parseInt(m[2], 10), idx = m.index + m[1].length;
                    const nv = v.slice(0, idx) + (n + 1) + v.slice(idx + m[2].length);
                    input.value = nv;
                    setCaret(s === v.length ? nv.length : (idx + m[2].length <= s ? s + (nv.length - v.length) : s));
                    markDie(); return;
                }
                const t = trailingMod(v);
                if (t && s === v.length) {                                                       // a modifier is set: build the new term before it
                    const head = v.slice(0, t.start), term = (OPERATOR_END.test(head) ? '' : '+') + '1' + tag;
                    input.value = head + term + v.slice(t.start);
                    setCaret(head.length + term.length); markDie(); return;
                }
                const prev = before.slice(-1), next = after.charAt(0);                          // otherwise add a new term, with a + where one is needed
                insertText((before === '' || OPERATOR_END.test(prev) ? '' : '+') + '1' + tag + (next !== '' && /[0-9a-z(]/i.test(next) ? '+' : ''));
                markDie();
            }
            KEY_ROWS.forEach(row => {
                const r = document.createElement('div'); r.className = 'krow'; r.style.setProperty('--cols', row.keys.length);
                row.keys.forEach(k => {
                    const label = k[0], b = document.createElement('button');
                    b.type = 'button'; b.className = 'dkey'; b.textContent = label;
                    if (label.length >= 3) b.classList.add('long');
                    const dm = /^d(\d+)$/.exec(label);
                    if (dm) { b.classList.add('dice'); b.style.setProperty('--c', colorFor(Number(dm[1]))); b.addEventListener('click', () => dieKey(Number(dm[1]))); }
                    else if (/^[0-9]$/.test(label)) b.addEventListener('click', () => digitKey(label));
                    else if (row.quick) b.addEventListener('click', () => { insertText(k[1]); markDie(); });
                    else b.addEventListener('click', () => insertText(k.length > 1 ? k[1] : label));
                    if (row.quick) b.classList.add('quick');
                    r.appendChild(b);
                });
                keysEl.appendChild(r);
            });
            delBtn.addEventListener('click', backspace);
            delBtn.addEventListener('mousedown', (e) => e.preventDefault());
            keysEl.addEventListener('mousedown', (e) => e.preventDefault()); // keep the cursor in the box when a key is pressed
            kbBtn.addEventListener('click', () => { // show or hide the phone keyboard
                const on = input.getAttribute('inputmode') === 'none';
                input.setAttribute('inputmode', on ? 'text' : 'none');
                kbBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
                kbBtn.setAttribute('aria-label', on ? 'Hide phone keyboard' : 'Show phone keyboard');
                input.blur(); input.focus({ preventScroll: true });
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
            document.addEventListener('selectionchange', () => { if (document.activeElement === input) refresh(); });
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !rollBtn.disabled) doRoll(input.value); });
            rollBtn.addEventListener('click', () => doRoll(input.value));
            advBtn.addEventListener('click', () => advDis('kh'));
            disBtn.addEventListener('click', () => advDis('kl'));
            clearBtn.addEventListener('click', () => { input.value = ''; refresh(); });
            modMinus.addEventListener('click', () => { const c = modOf(input.value); if (c > -99) applyMod(c - 1); });
            modPlus.addEventListener('click', () => { const c = modOf(input.value); if (c < 99) applyMod(c + 1); });
            modInput.addEventListener('input', () => { const n = parseInt(modInput.value, 10); if (!isNaN(n)) applyMod(Math.max(-99, Math.min(99, n))); });
            modInput.addEventListener('change', () => { modInput.value = String(modOf(input.value)); });
            histClear.addEventListener('click', () => { saveHist([]); renderHist(); });
            window.addEventListener('resize', redraw);

            renderHist(); refresh(); redraw();
        })();

        // ===== BOARD STORAGE: grid memory by map name =====
        window.boardHooks = window.boardHooks || {};
        (function () {
            const GRIDS_KEY = 'vttGrids', MAX_GRIDS = 200;
            const statusEl = document.getElementById('gridMemStatus');
            const getAll = () => { try { const o = JSON.parse(localStorage.getItem(GRIDS_KEY)); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } };
            function putAll(o) { // keep at most MAX_GRIDS records, dropping the oldest; false if the browser refused to save
                try {
                    const keys = Object.keys(o);
                    if (keys.length > MAX_GRIDS) keys.sort((a, b) => (o[a].t || 0) - (o[b].t || 0)).slice(0, keys.length - MAX_GRIDS).forEach(k => delete o[k]);
                    localStorage.setItem(GRIDS_KEY, JSON.stringify(o)); return true;
                } catch (e) { return false; }
            }
            let key = ''; // map file name plus pixel size, so a different image with the same name never gets this grid
            const keyFor = (name, w, h) => name + '|' + w + 'x' + h;
            const say = (t) => { statusEl.textContent = t; };
            const okRec = (r) => r && [r.x1, r.y1, r.x2, r.y2, r.size, r.sq, r.ft].every(Number.isFinite) && Array.isArray(r.cal) && r.cal.length === 2 && r.cal.every(c => c && Number.isFinite(c.x) && Number.isFinite(c.y));

            boardHooks.setMap = (name, w, h) => { key = keyFor(name, w, h); say(okRec(getAll()[key]) ? 'Saved grid loaded' : 'No saved grid for this map'); };
            boardHooks.mapLoaded = (name) => {
                key = keyFor(name, mapImg.naturalWidth, mapImg.naturalHeight);
                const r = getAll()[key];
                if (!okRec(r)) { say('No saved grid for this map'); return; }
                grid.x1 = r.x1; grid.y1 = r.y1; grid.x2 = r.x2; grid.y2 = r.y2; grid.size = r.size;
                calPoints = [{ x: r.cal[0].x, y: r.cal[0].y }, { x: r.cal[1].x, y: r.cal[1].y }];
                document.getElementById('sqCount').value = r.sq;
                document.getElementById('ftPerSq').value = r.ft; grid.ftPerSq = r.ft;
                showPins = false; currentMode = null; updateUI(); say('Saved grid loaded');
            };
            boardHooks.gridApplied = () => {
                if (!key || !(grid.size > 0) || !calPoints[0] || !calPoints[1]) return;
                const o = getAll();
                o[key] = { x1: grid.x1, y1: grid.y1, x2: grid.x2, y2: grid.y2, size: grid.size, cal: [{ x: calPoints[0].x, y: calPoints[0].y }, { x: calPoints[1].x, y: calPoints[1].y }], sq: parseInt(document.getElementById('sqCount').value, 10) || 1, ft: Number(grid.ftPerSq) || 5, t: Date.now() };
                say(putAll(o) ? 'Grid saved for this map' : 'Grid applied (this browser would not save it)');
            };
            document.getElementById('ftPerSq').addEventListener('change', () => { // keep the saved feet-per-square in step
                const o = getAll();
                if (key && okRec(o[key])) { o[key].ft = Number(grid.ftPerSq) || 5; o[key].t = Date.now(); putAll(o); }
            });
            document.getElementById('btnForgetGrid').addEventListener('click', () => {
                const o = getAll();
                if (key && o[key]) { delete o[key]; putAll(o); }
                grid.size = 0; calPoints = [null, null]; showPins = true; currentMode = null;
                document.getElementById('sqDownDisplay').textContent = 'Squares Down: --';
                updateUI(); say('No saved grid for this map');
            });
        })();

        // ===== BOARD STORAGE: autosave of the board, with the current map and board tokens =====
        (function () {
            const BOARD_KEY = 'vttBoard', DB_NAME = 'vttBoardImages', STORE = 'images', MAX_TOKENS = 200;
            const $ = (id) => document.getElementById(id);
            const infoEl = $('autoInfo'), noteEl = $('autoNote');
            let restoring = false, touching = false, lastJson = '', persistAsked = false, lastSaveAt = 0, imgBytes = 0, known = { w: 0, h: 0 };
            let storedMap = null, storedTokens = new Set(), imgChain = Promise.resolve();
            const fromStore = { maps: new Set(), tokens: new Set() }; // library names that exist only because they were restored from storage

            // ---- the stored images (IndexedDB): the current map and the tokens on the board only ----
            let dbp = null;
            const openDb = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
            const req = (mode, fn) => openDb().then(db => new Promise((res, rej) => { const tx = db.transaction(STORE, mode), r = fn(tx.objectStore(STORE)); tx.oncomplete = () => res(r && r.result); tx.onerror = tx.onabort = () => rej(tx.error); }));
            const idbGet = (k) => req('readonly', s => s.get(k)), idbPut = (k, v) => req('readwrite', s => s.put(v, k)), idbDel = (k) => req('readwrite', s => s.delete(k));
            const idbKeys = () => req('readonly', s => s.getAllKeys()), idbAll = () => req('readonly', s => s.getAll()), idbClear = () => req('readwrite', s => s.clear());

            // ---- the board's state ----
            function capture() {
                return {
                    v: 1,
                    map: curMapName ? { name: curMapName, w: mapImg.naturalWidth || known.w, h: mapImg.naturalHeight || known.h } : null,
                    grid: { x1: grid.x1, y1: grid.y1, x2: grid.x2, y2: grid.y2, size: grid.size, ftPerSq: Number(grid.ftPerSq) || 5 },
                    cal: calPoints.map(c => (c ? { x: c.x, y: c.y } : null)),
                    sq: parseInt($('sqCount').value, 10) || 25, gridColor: gridColor,
                    view: { scale: scale, x: offset.x, y: offset.y },
                    tokens: tokens.map(t => ({ id: t.id, x: t.x, y: t.y, baseName: t.baseName, instanceNum: t.instanceNum, hp: t.hp, maxHp: t.maxHp }))
                };
            }
            // Turns anything (a stored board, a saved board, an imported file) into a safe state object, or null
            function cleanState(o) {
                if (!o || typeof o !== 'object' || o.v !== 1) return null;
                const n = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
                const str = (v, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
                const g = o.grid || {}, vw = o.view || {};
                const out = {
                    v: 1, map: null,
                    grid: { x1: n(g.x1, 0), y1: n(g.y1, 0), x2: n(g.x2, 0), y2: n(g.y2, 0), size: Math.max(0, n(g.size, 0)), ftPerSq: n(g.ftPerSq, 5) },
                    cal: [0, 1].map(i => { const c = Array.isArray(o.cal) ? o.cal[i] : null; return c && Number.isFinite(c.x) && Number.isFinite(c.y) ? { x: c.x, y: c.y } : null; }),
                    sq: Math.max(1, Math.round(n(o.sq, 25))),
                    gridColor: typeof o.gridColor === 'string' && /^[0-9, ]{5,20}$/.test(o.gridColor) ? o.gridColor : '0, 255, 204',
                    view: { scale: Math.min(100, Math.max(0.01, n(vw.scale, 1))), x: n(vw.x, 0), y: n(vw.y, 0) },
                    tokens: []
                };
                if (o.map && str(o.map.name, 120)) out.map = { name: o.map.name, w: Math.max(0, Math.round(n(o.map.w, 0))), h: Math.max(0, Math.round(n(o.map.h, 0))) };
                if (Array.isArray(o.tokens)) o.tokens.slice(0, MAX_TOKENS).forEach((t, i) => {
                    if (!t || !str(t.baseName, 80)) return;
                    const maxHp = Math.max(1, Math.round(n(t.maxHp, 20)));
                    out.tokens.push({ id: str(t.id, 60) || ('tk_' + Date.now() + '_' + i), x: n(t.x, 0), y: n(t.y, 0), baseName: t.baseName, instanceNum: Math.max(1, Math.round(n(t.instanceNum, 1))), maxHp: maxHp, hp: Math.min(maxHp, Math.max(0, Math.round(n(t.hp, maxHp)))) });
                });
                return out;
            }
            function rebuildMapSelect(selected) {
                const sel = $('mapSelect'); sel.innerHTML = '<option>-- SELECT MAP --</option>';
                Object.keys(mapLib).sort().forEach(k => { const o = document.createElement('option'); o.value = k; o.innerText = k.toUpperCase(); sel.appendChild(o); });
                if (selected) sel.value = selected;
            }
            const note = (t) => { noteEl.textContent = t || ''; };

            // Puts a clean state on the board. src.mapBlob / src.tokenBlobs hold stored images; otherwise the loaded libraries are used.
            function applyState(st, src) {
                src = src || {};
                note('');
                tokens = st.tokens.map(t => {
                    const img = new Image();
                    let url = tokenLib[t.baseName];
                    if (!url && src.tokenBlobs && src.tokenBlobs[t.baseName]) { url = URL.createObjectURL(src.tokenBlobs[t.baseName]); tokenLib[t.baseName] = url; fromStore.tokens.add(t.baseName); }
                    if (url) img.src = url;
                    return { id: t.id, x: t.x, y: t.y, img: img, baseName: t.baseName, instanceNum: t.instanceNum, hp: t.hp, maxHp: t.maxHp };
                });
                grid.x1 = st.grid.x1; grid.y1 = st.grid.y1; grid.x2 = st.grid.x2; grid.y2 = st.grid.y2; grid.size = st.grid.size; grid.ftPerSq = st.grid.ftPerSq;
                calPoints = [st.cal[0] ? { x: st.cal[0].x, y: st.cal[0].y } : null, st.cal[1] ? { x: st.cal[1].x, y: st.cal[1].y } : null];
                $('sqCount').value = st.sq; $('ftPerSq').value = st.grid.ftPerSq; gridColor = st.gridColor;
                scale = st.view.scale; offset = { x: st.view.x, y: st.view.y };
                showPins = !(grid.size > 0); currentMode = null;
                $('sqDownDisplay').textContent = 'Squares Down: --'; updateUI();
                known = { w: st.map ? st.map.w : 0, h: st.map ? st.map.h : 0 };
                if (!st.map) { mapImg = new Image(); curMapName = ''; rebuildMapSelect(); return { map: 'none' }; }
                const name = st.map.name; let url = null;
                if (src.mapBlob) { url = URL.createObjectURL(src.mapBlob); if (!mapLib[name]) fromStore.maps.add(name); mapLib[name] = url; }
                else if (mapLib[name]) url = mapLib[name];
                curMapName = name;
                if (url) {
                    rebuildMapSelect(name);
                    mapImg = new Image();
                    mapImg.onload = () => { known = { w: mapImg.naturalWidth, h: mapImg.naturalHeight }; if (boardHooks.setMap) boardHooks.setMap(name, known.w, known.h); };
                    mapImg.src = url;
                    return { map: 'shown' };
                }
                mapImg = new Image(); rebuildMapSelect();
                if (boardHooks.setMap) boardHooks.setMap(name, known.w, known.h);
                note('Map image missing: load your map folder and pick "' + name + '".');
                return { map: 'missing' };
            }

            // ---- saving ----
            function syncImages() {
                imgChain = imgChain.then(async () => {
                    const st = capture(), names = new Set(st.tokens.map(t => t.baseName));
                    if (st.map && st.map.name !== storedMap && mapFiles[st.map.name]) { await idbPut('map', mapFiles[st.map.name]); await idbPut('mapName', st.map.name); storedMap = st.map.name; }
                    else if (!st.map && storedMap) { await idbDel('map'); await idbDel('mapName'); storedMap = null; }
                    for (const nm of names) if (!storedTokens.has(nm) && tokenFiles[nm]) { await idbPut('token:' + nm, tokenFiles[nm]); storedTokens.add(nm); }
                    for (const nm of Array.from(storedTokens)) if (!names.has(nm)) { await idbDel('token:' + nm); storedTokens.delete(nm); }
                    imgBytes = (await idbAll()).reduce((a, v) => a + ((v && v.size) || 0), 0);
                }).catch(() => {});
                return imgChain;
            }
            function showInfo() {
                const t = lastSaveAt ? new Date(lastSaveAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'not yet';
                infoEl.textContent = 'Stored images: ' + (imgBytes < 1048576 ? Math.round(imgBytes / 1024) + ' KB' : (imgBytes / 1048576).toFixed(1) + ' MB') + ' (' + (storedMap ? 'map' : 'no map') + ' + ' + storedTokens.size + ' token' + (storedTokens.size === 1 ? '' : 's') + '). Last autosave: ' + t + '.';
            }
            function tick() { // runs twice a second; saves only when the board changed and no finger is on the map
                if (restoring || touching || dragging || isPinching) return;
                let json; try { json = JSON.stringify(capture()); } catch (e) { return; }
                if (json === lastJson) return;
                try { localStorage.setItem(BOARD_KEY, json); } catch (e) { note('Autosave is not available in this browser.'); lastJson = json; return; }
                lastJson = json; lastSaveAt = Date.now();
                try { localStorage.setItem(BOARD_KEY + 'At', String(lastSaveAt)); } catch (e) {}
                if (!persistAsked && navigator.storage && navigator.storage.persist) { persistAsked = true; try { navigator.storage.persist().catch(() => {}); } catch (e) {} }
                syncImages().then(showInfo);
            }

            // ---- restoring ----
            async function restore() {
                let raw = null; try { raw = localStorage.getItem(BOARD_KEY); } catch (e) {}
                if (!raw) return;
                let st = null; try { st = cleanState(JSON.parse(raw)); } catch (e) {}
                if (!st) return;
                restoring = true;
                try { lastSaveAt = Number(localStorage.getItem(BOARD_KEY + 'At')) || 0; } catch (e) {}
                try {
                    const src = { mapBlob: null, tokenBlobs: {} };
                    try {
                        storedMap = (await idbGet('mapName')) || null; src.mapBlob = storedMap ? ((await idbGet('map')) || null) : null;
                        for (const k of (await idbKeys())) if (String(k).startsWith('token:')) { src.tokenBlobs[String(k).slice(6)] = await idbGet(k); storedTokens.add(String(k).slice(6)); }
                        if (!src.mapBlob) storedMap = null;
                    } catch (e) {}
                    applyState(st, src);
                    lastJson = JSON.stringify(capture());
                } finally { restoring = false; }
                try { imgBytes = (await idbAll()).reduce((a, v) => a + ((v && v.size) || 0), 0); } catch (e) {}
                showInfo();
            }

            // ---- new board ----
            async function newBoard() {
                if (!confirm('Start a new board? This clears the autosaved map, tokens and grid.')) return;
                restoring = true;
                tokens = []; grid.x1 = grid.y1 = grid.x2 = grid.y2 = 0; grid.size = 0; calPoints = [null, null]; showPins = true; currentMode = null;
                mapImg = new Image(); curMapName = ''; known = { w: 0, h: 0 }; scale = 1; offset = { x: 0, y: 0 };
                fromStore.maps.forEach(k => delete mapLib[k]); fromStore.tokens.forEach(k => delete tokenLib[k]); fromStore.maps.clear(); fromStore.tokens.clear();
                rebuildMapSelect(); $('mapSelect').selectedIndex = 0;
                $('sqDownDisplay').textContent = 'Squares Down: --'; $('gridMemStatus').textContent = ''; updateUI(); note('');
                try { localStorage.removeItem(BOARD_KEY); localStorage.removeItem(BOARD_KEY + 'At'); } catch (e) {}
                try { await idbClear(); } catch (e) {}
                storedMap = null; storedTokens = new Set(); imgBytes = 0; lastJson = ''; lastSaveAt = 0;
                restoring = false; showInfo(); note('New board started.');
            }

            // Picking a map clears the "map missing" note, and remembers its size
            const prevLoaded = boardHooks.mapLoaded;
            boardHooks.mapLoaded = (n) => { known = { w: mapImg.naturalWidth, h: mapImg.naturalHeight }; note(''); prevLoaded(n); };
            boardHooks.captureState = capture; boardHooks.cleanState = cleanState; boardHooks.applyState = applyState; boardHooks.restoreAutosave = restore;
            boardHooks.note = note;
            canvas.addEventListener('touchstart', () => { touching = true; }, { passive: true });
            canvas.addEventListener('touchend', (e) => { touching = e.touches.length > 0; });
            canvas.addEventListener('touchcancel', () => { touching = false; });
            $('btnNewBoard').addEventListener('click', newBoard);
            setInterval(tick, 500);
            showInfo();
        })();

        window.onclick = (e) => { if(e.target.tagName !== 'BUTTON' && !e.target.classList.contains('menu-item')) menu.style.display = 'none'; };
        init();
        if (window.boardHooks && boardHooks.restoreAutosave) boardHooks.restoreAutosave();
