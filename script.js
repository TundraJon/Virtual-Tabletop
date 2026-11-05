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

        window.onclick = (e) => { if(e.target.tagName !== 'BUTTON' && !e.target.classList.contains('menu-item')) menu.style.display = 'none'; };
        init();
