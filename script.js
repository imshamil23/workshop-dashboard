/**
 * Employee Dashboard Application
 * Handles SPA navigation, Google Sheet data fetching, and dynamic rendering.
 */
const CONFIG = {
    // Google Sheet CSV Export URLs
    // NOTE: Using the same GID for Today/Total for now as placeholders. 
    // User should update these if they have 4 distinct sheets.
    urls: {
        advisor: {
            today: "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=244746706",
            total: "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=244746706" // Placeholder
        },
        tech: {
            today: "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=136202424",
            total: "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=136202424" // Placeholder
        }
    },
    refreshInterval: 30000, // 30 seconds
    scrollSpeed: 1 // Pixels per frame
};
const STATE = {
    currentType: null, // 'advisor' | 'tech'
    currentTime: null, // 'today' | 'total'
    data: [],
    scrollId: null,
    fetchInterval: null
};
const ELEMENTS = {
    landingView: document.getElementById('landingView'),
    dashboardView: document.getElementById('dashboardView'),
    pageTitle: document.getElementById('pageTitle'),
    tableHeader: document.getElementById('tableHeader'),
    tableBody: document.getElementById('tableBody'),
    clock: document.getElementById('clock')
};
/* --- APP CONTROLLER --- */
const app = {
    init: () => {
        app.updateClock();
        setInterval(app.updateClock, 1000);
    },
    loadView: async (type, time) => {
        STATE.currentType = type;
        STATE.currentTime = time;
        // 1. Update UI Title
        const typeLabel = type === 'advisor' ? 'Advisor' : 'Technician';
        const timeLabel = time === 'today' ? 'Today' : 'Total';
        ELEMENTS.pageTitle.textContent = `Malappuram ${typeLabel} ${timeLabel}`;
        // 2. Setup Headers
        app.setupTableStructure(type);
        // 3. Switch Views
        ELEMENTS.landingView.classList.add('hidden');
        ELEMENTS.dashboardView.classList.remove('hidden');
        // 4. Fetch Data immediately
        await app.fetchData();
        // 5. Start Polling
        if (STATE.fetchInterval) clearInterval(STATE.fetchInterval);
        STATE.fetchInterval = setInterval(app.fetchData, CONFIG.refreshInterval);
    },
    goHome: () => {
        // Stop Everything
        if (STATE.scrollId) cancelAnimationFrame(STATE.scrollId);
        if (STATE.fetchInterval) clearInterval(STATE.fetchInterval);
        // Reset View
        ELEMENTS.landingView.classList.remove('hidden');
        ELEMENTS.dashboardView.classList.add('hidden');
        ELEMENTS.tableBody.innerHTML = '';
        STATE.data = [];
    },
    setupTableStructure: (type) => {
        const header = ELEMENTS.tableHeader;
        if (type === 'advisor') {
            // Advisor Name	LOAD	LABOUR	VAS	MGA	CATEGORY	SCORE	PIC
            header.style.gridTemplateColumns = "50px 80px 2fr 1fr 1fr 1fr 1fr 1fr 1fr";
            header.innerHTML = `
                <div>Rank</div>
                <div style="text-align: center">Pic</div>
                <div>Advisor Name</div>
                <div>Load</div>
                <div>Labour</div>
                <div>VAS</div>
                <div>MGA</div>
                <div>Cat</div>
                <div style="text-align: right">Score</div>
            `;
        } else {
            // Technician Name	LOAD	LABOUR	PIC
            header.style.gridTemplateColumns = "50px 80px 3fr 1fr 1fr ";
            header.innerHTML = `
                <div>Rank</div>
                <div style="text-align: center">Pic</div>
                <div>Technician Name</div>
                <div>Load</div>
                <div>Labour</div>
            `;
        }
    },
    updateClock: () => {
        const now = new Date();
        ELEMENTS.clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
};
/* --- DATA HANDLING --- */
app.fetchData = async () => {
    const url = CONFIG.urls[STATE.currentType][STATE.currentTime];
    Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            let data = results.data;
            // Filter out empty names
            data = data.filter(row => {
                const name = row['Advisor Name'] || row['Technician Name'];
                return name && name.trim().length > 0;
            });
            // Parse Scores for sorting
            data.forEach(row => {
                // Ensure number for safe sorting
                row._sortScore = parseFloat(row['SCORE'] || row['LOAD'] || 0);
            });
            // Sort Descending
            data.sort((a, b) => b._sortScore - a._sortScore);
            STATE.data = data;
            app.renderTable();
        },
        error: (err) => console.error(err)
    });
};
/* --- RENDERING --- */
app.renderTable = () => {
    const container = ELEMENTS.tableBody;
    container.innerHTML = '';
    STATE.data.forEach((row, index) => {
        const rank = index + 1;
        const div = document.createElement('div');
        div.className = 'data-row';
        // Check if Advisor or Tech to decide columns
        if (STATE.currentType === 'advisor') {
            const picUrl = row['PIC'] || 'https://via.placeholder.com/40?text=A';
            div.style.gridTemplateColumns = "50px 80px 2fr 1fr 1fr 1fr 1fr 1fr 1fr";
            div.innerHTML = `
                <div class="rank-cell">#${rank}</div>
                <div class="pic-cell"><img src="${picUrl}" onerror="this.src='https://via.placeholder.com/40?text=U'"></div>
                <div style="font-weight:600">${row['Advisor Name'] || 'Unknown'}</div>
                <div>${row['LOAD'] || 0}</div>
                <div>${row['LABOUR'] || 0}</div>
                <div>${row['VAS'] || 0}</div>
                <div>${row['MGA'] || 0}</div>
                <div><span class="metric-pill">${row['CATEGORY'] || '-'}</span></div>
                <div class="score-cell" style="text-align: right">${row['SCORE'] || 0}</div>
            `;
        } else {
            const picUrl = row['PIC'] || 'https://via.placeholder.com/40?text=T';
            div.style.gridTemplateColumns = "50px 80px 3fr 1fr 1fr";
            div.innerHTML = `
                <div class="rank-cell">#${rank}</div>
                <div class="pic-cell"><img src="${picUrl}" onerror="this.src='https://via.placeholder.com/40?text=U'"></div>
                <div style="font-weight:600">${row['Technician Name'] || 'Unknown'}</div>
                <div>${row['LOAD'] || 0}</div>
                <div class="score-cell">${row['LABOUR'] || 0}</div>
            `;
        }
        container.appendChild(div);
    });
    // Reset Auto Scroll
    app.startAutoScroll();
};
/* --- AUTO SCROLL --- */
app.startAutoScroll = () => {
    if (STATE.scrollId) cancelAnimationFrame(STATE.scrollId);
    const container = ELEMENTS.tableBody;
    const parent = container.parentElement;
    // Remove existing clones
    const existingClones = container.querySelectorAll('.clone-set');
    existingClones.forEach(el => el.remove());
    // Only scroll if content > viewport
    if (container.scrollHeight <= parent.clientHeight) return;
    // Clone content for seamless looping
    const originalRows = Array.from(container.children);
    const cloneDiv = document.createElement('div');
    cloneDiv.className = 'clone-set';
    originalRows.forEach(row => {
        cloneDiv.appendChild(row.cloneNode(true));
    });
    // Add spacer
    const spacer = document.createElement('div');
    spacer.style.height = "20px";
    container.appendChild(spacer);
    container.appendChild(cloneDiv);
    let yPos = 0;
    function step() {
        yPos += CONFIG.scrollSpeed;
        // Reset when we've scrolled past the original height
        // We use half because we doubled the content
        if (yPos >= (container.scrollHeight / 2)) {
            yPos = 0;
        }
        container.style.transform = `translateY(-${yPos}px)`;
        STATE.scrollId = requestAnimationFrame(step);
    }
    step();
};
// Start
app.init();
