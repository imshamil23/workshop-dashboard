const CONFIG = {
    urls: {
        advisor: "PUT_YOUR_ADVISOR_CSV_URL_HERE",
        technician: "PUT_YOUR_TECHNICIAN_CSV_URL_HERE"
    },
    refreshInterval: 20000,
    scrollSpeed: 0.5,
    tabRotationInterval: 20000
};

const state = {
    data: { advisor: [], technician: [] },
    activeTab: "today",
    activeSheet: "advisor",
    lastTop: null
};

const el = {
    leaderboard: document.getElementById("mainLeaderboard"),
    topList: document.getElementById("topPerformersList"),
    total: document.getElementById("totalCount"),
    timer: document.getElementById("updateTimer"),
    sync: document.getElementById("lastSyncTime"),
    sound: document.getElementById("notificationSound"),
    tabs: document.querySelectorAll("[data-tab]"),
    sheets: document.querySelectorAll("[data-sheet]")
};

el.tabs.forEach(b => b.onclick = () => setTab(b.dataset.tab));
el.sheets.forEach(b => b.onclick = () => setSheet(b.dataset.sheet));

function setTab(tab) {
    state.activeTab = tab;
    el.tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    render();
}

function setSheet(sheet) {
    state.activeSheet = sheet;
    el.sheets.forEach(b => b.classList.toggle("active", b.dataset.sheet === sheet));
    render();
}

function fetchCSV(url) {
    return new Promise(res => {
        Papa.parse(url, {
            download: true,
            header: true,
            complete: r => res(r.data)
        });
    });
}

async function fetchData() {
    el.sync.textContent = "Syncing...";
    state.data.advisor = await fetchCSV(CONFIG.urls.advisor);
    state.data.technician = await fetchCSV(CONFIG.urls.technician);
    el.sync.textContent = "Synced: " + new Date().toLocaleTimeString();
    render();
}

function score(r) {
    if (state.activeTab === "today") {
        return (r["Today Load"] * 2) + (r["Today Labour"] * 3) + (+r["Today VAS"]);
    }
    return (r["Total Load"] * 2) + (r["Month Labour"] * 3) + (+r["Total VAS"]);
}

function render() {
    const data = state.data[state.activeSheet]
        .map(r => ({ ...r, s: score(r) }))
        .sort((a,b) => b.s - a.s);

    el.total.textContent = data.length;

    el.leaderboard.innerHTML = data.map((r,i) => `
        <div class="card">
            <div class="rank-badge">${i+1}</div>
            <div class="avatar">${r.Name?.[0] || "?"}</div>
            <div style="flex:1">
                <div>${r.Name}</div>
            </div>
            <div class="score-value">${Math.round(r.s)}</div>
        </div>
    `).join("");

    el.topList.innerHTML = data.slice(0,3).map((r,i)=>`
        <div class="card">
            <strong>#${i+1}</strong> ${r.Name} – ${Math.round(r.s)}
        </div>
    `).join("");

    if (data[0]?.Name !== state.lastTop) {
        state.lastTop = data[0]?.Name;
        el.sound.play().catch(()=>{});
    }
}

setInterval(fetchData, CONFIG.refreshInterval);
fetchData();
