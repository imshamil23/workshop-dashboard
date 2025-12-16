/**
 * Workshop Dashboard Logic
 * Handles Google Sheets fetching, scoring algorithms, and auto-scrolling UI.
 */
/* --- CONFIG --- */
const CONFIG = {
    urls: {
        advisor: "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=244746706",
        technician: "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=136202424"
    },
    refreshInterval: 20000,   // Data fetch interval (ms)
    scrollSpeed: 1,           // Pixels per frame (approx 60fps)
    tabRotationInterval: 20000 // Tab switch interval (ms)
};
/* --- STATE --- */
const state = {
    data: { advisor: [], technician: [] },
    activeTab: 'today',      // 'today' or 'till'
    activeSheet: 'advisor',  // 'advisor' or 'technician'
    lastTopPerformer: null,
    isScrolling: false
};
/* --- DOM ELEMENTS --- */
const elements = {
    mainLeaderboard: document.getElementById('mainLeaderboard'),
    topList: document.getElementById('topPerformersList'),
    tabs: document.querySelectorAll('[data-tab]'),
    subtabs: document.querySelectorAll('[data-sheet]'),
    updateTimer: document.getElementById('updateTimer'),
    totalCount: document.getElementById('totalCount'),
    lastSyncTime: document.getElementById('lastSyncTime'),
    notification: document.getElementById('notificationSound'),
    confettiContainer: document.body
};
/* --- CONFETTI --- */
function fireConfetti() {
    // Simple particle explosion
    const colors = ['#FFD700', '#FF3B30', '#00ff88', '#FFF'];
    const count = 100;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.style.position = 'fixed';
        p.style.width = Math.random() * 8 + 4 + 'px';
        p.style.height = Math.random() * 8 + 4 + 'px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.left = '50%';
        p.style.top = '50%';
        p.style.borderRadius = '50%';
        p.style.pointerEvents = 'none';
        p.style.opacity = 1;
        p.style.zIndex = 9999;
        // Random velocity
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 15 + 5;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        document.body.appendChild(p);
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        let alpha = 1;
        // Animation loop for this particle
        let particleVy = vy;
        function updateParticle() {
            x += vx;
            y += particleVy;
            particleVy += 0.5; // gravity
            alpha -= 0.01;
            p.style.transform = `translate(${x - window.innerWidth / 2}px, ${y - window.innerHeight / 2}px)`;
            p.style.opacity = alpha;
            if (alpha > 0) {
                requestAnimationFrame(updateParticle);
            } else {
                p.remove();
            }
        }
        requestAnimationFrame(updateParticle);
    }
}
/* --- INITIALIZATION --- */
async function init() {
    setupEventListeners();
    await fetchData();
    startAutoLoop();
    startRefreshTimer();
}
function setupEventListeners() {
    // Tab Clicks
    elements.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveTab(btn.dataset.tab);
            resetAutoRotation(); // User interaction pauses auto-rotation momentarily if we wanted
        });
    });
    elements.subtabs.forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveSheet(btn.dataset.sheet);
        });
    });
}
/* --- DATA FETCHING --- */
async function fetchData() {
    // Only show skeletons if we have no data yet
    if (state.data.advisor.length === 0) renderSkeletons();
    elements.lastSyncTime.textContent = "Syncing...";
    try {
        const [advisorData, techData] = await Promise.all([
            fetchCSV(CONFIG.urls.advisor),
            fetchCSV(CONFIG.urls.technician)
        ]);
        state.data.advisor = advisorData;
        state.data.technician = techData;
        elements.lastSyncTime.textContent = `Synced: ${new Date().toLocaleTimeString()}`;
        render();
    } catch (error) {
        console.error("Fetch Error:", error);
        elements.lastSyncTime.textContent = "Sync Failed";
    }
}
function fetchCSV(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
        });
    });
}
function startRefreshTimer() {
    setInterval(fetchData, CONFIG.refreshInterval);
    // Visual countdown
    let left = CONFIG.refreshInterval / 1000;
    setInterval(() => {
        left--;
        if (left < 0) left = CONFIG.refreshInterval / 1000;
        elements.updateTimer.textContent = `${left}s`;
    }, 1000);
}
/* --- STATE MANAGEMENT --- */
function setActiveTab(tab) {
    state.activeTab = tab;
    // Update UI Classes
    elements.tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    render();
}
function setActiveSheet(sheet) {
    state.activeSheet = sheet;
    // Update UI Classes
    elements.subtabs.forEach(b => b.classList.toggle('active', b.dataset.sheet === sheet));
    render();
}
/* --- SCORING ENGINE --- */
function calculateScore(row, mode) {
    // Helper to safely parse numbers
    const getVal = (key) => parseFloat(row[key]) || 0;
    let score = 0;
    /* NOTE: Adjust these keys if your CSV headers differ exactly */
    if (mode === 'today') {
        const load = getVal('Today Load');
        const labour = getVal('Today Labour');
        const vas = getVal('Today VAS');
        score = (load * 2) + (labour * 3) + vas;
    } else {
        const load = getVal('Total Load');
        const labour = getVal('Month Labour');
        const vas = getVal('Total VAS');
        score = (load * 2) + (labour * 3) + vas;
    }
    return Math.round(score);
}
/* --- RENDERING --- */
function render() {
    const rawData = state.data[state.activeSheet];
    if (!rawData || rawData.length === 0) return;
    // Process Data
    const processed = rawData
        .map(row => ({
            ...row,
            _score: calculateScore(row, state.activeTab),
            _initial: (row.Name && row.Name[0]) ? row.Name[0] : '?'
        }))
        .sort((a, b) => b._score - a._score); // Descending
    // Check for new #1
    if (processed[0] && processed[0].Name !== state.lastTopPerformer) {
        state.lastTopPerformer = processed[0].Name;
        playNotification();
        fireConfetti();
    }
    // Update Counts
    elements.totalCount.textContent = processed.length;
    // Render Lists
    renderLeaderboard(processed);
    renderTopPerformers(processed.slice(0, 5));
    // Reset Scroll
    setupAutoScroll();
}
function renderLeaderboard(data) {
    const html = data.map((item, index) => {
        const rank = index + 1;
        let label1, val1, label2, val2, label3, val3;
        if (state.activeTab === 'today') {
            label1 = 'Load'; val1 = item['Today Load'];
            label2 = 'Labour'; val2 = item['Today Labour'];
            label3 = 'VAS'; val3 = item['Today VAS'];
        } else {
            label1 = 'Total'; val1 = item['Total Load'];
            label2 = 'Mnth Lab'; val2 = item['Month Labour'];
            label3 = 'Tot VAS'; val3 = item['Total VAS'];
        }
        return `
            <div class="card animate-in" data-rank="${rank}" style="animation-delay: ${index * 0.05}s">
                <div class="rank-badge">${rank}</div>
                <div class="avatar">${item._initial}</div>
                <div class="card-info">
                    <div class="name">${item.Name}</div>
                    <div class="metrics">
                        <span class="metric-pill">${label1}: ${val1}</span>
                        <span class="metric-pill">${label2}: ${val2}</span>
                        <span class="metric-pill">${label3}: ${val3}</span>
                    </div>
                </div>
                <div class="score-box">
                    <span class="score-label">Score</span>
                    <span class="score-value">${item._score}</span>
                </div>
            </div>
        `;
    }).join('');
    elements.mainLeaderboard.innerHTML = html;
}
function renderTopPerformers(data) {
    const html = data.map((item, index) => {
        const rank = index + 1;
        const isGold = rank === 1 ? 'gold-border' : '';
        return `
            <div class="top-card ${isGold} animate-in">
                <div class="rank">#${rank}</div>
                <div class="avatar" style="width:40px;height:40px;font-size:14px;">${item._initial}</div>
                <div style="flex:1">
                    <div style="font-weight:600">${item.Name}</div>
                    <div style="font-size:12px;color:#888">Score: ${item._score}</div>
                </div>
            </div>
        `;
    }).join('');
    elements.topList.innerHTML = html;
}
function playNotification() {
    elements.notification.play().catch(e => console.log("Audio play blocked", e));
}
/* --- SKELETONS --- */
function renderSkeletons() {
    const skeletonHTML = Array(8).fill('<div class="card skeleton skeleton-card"></div>').join('');
    elements.mainLeaderboard.innerHTML = skeletonHTML;
    elements.topList.innerHTML = Array(3).fill('<div class="top-card skeleton" style="height:60px;margin-bottom:10px"></div>').join('');
}
/* --- AUTO SCROLL ENGINE --- */
let scrollReq;
function setupAutoScroll() {
    cancelAnimationFrame(scrollReq);
    const container = elements.mainLeaderboard;
    // We need to clone the content to make it seamless loop if content is taller than viewport
    // However, simplest seamless scroll for lists is often to just clone the list once below
    // Remove old clones
    const oldClones = container.querySelectorAll('.clone-set');
    oldClones.forEach(el => el.remove());
    // Basic Logic: If content height > viewport, scroll. 
    // Ideally we duplicate content inside the container
    // NOTE: For true seamless infinite scroll, we need a wrapper logic.
    // Simplifying: we will just scroll down then snap back or bounce.
    // Let's implement the standard "Duplicate and loop"
    const originalContent = Array.from(container.children);
    if (originalContent.length < 5) return; // Don't scroll if few items
    // Create a wrapper div to move
    // Actually, styles.css defines .scroll-container-mask which hides overflow
    // .scroll-content is what we move.
    // Let's duplicate content to ensure we can scroll smoothly
    const cloneDiv = document.createElement('div');
    cloneDiv.className = 'clone-set';
    cloneDiv.style.display = 'flex';
    cloneDiv.style.flexDirection = 'column';
    cloneDiv.style.gap = '12px';
    cloneDiv.innerHTML = container.innerHTML; // Clone
    container.appendChild(cloneDiv);
    let yPos = 0;
    function step() {
        yPos += CONFIG.scrollSpeed;
        // If we have scrolled past the height of the original content set
        // (approx half the new total height), reset to 0
        if (yPos >= (container.scrollHeight / 2)) {
            yPos = 0;
        }
        container.style.transform = `translateY(-${yPos}px)`;
        scrollReq = requestAnimationFrame(step);
    }
    step();
}
/* --- AUTO TAB ROTATION --- */
function startAutoLoop() {
    const loopSequence = [
        { tab: 'today', sheet: 'advisor' },
        { tab: 'today', sheet: 'technician' },
        { tab: 'till', sheet: 'advisor' },
        { tab: 'till', sheet: 'technician' }
    ];
    let idx = 0;
    setInterval(() => {
        idx = (idx + 1) % loopSequence.length;
        const next = loopSequence[idx];
        setActiveTab(next.tab);
        setActiveSheet(next.sheet);
    }, CONFIG.tabRotationInterval);
}
// Start
init();
