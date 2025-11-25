/********************************************************
 * GOOGLE SHEET CSV URLS
 ********************************************************/
const ADVISOR_CSV_URL =
  "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=244746706";

const TECHNICIAN_CSV_URL =
  "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=136202424";

const REFRESH_INTERVAL = 20000;

/********************************************************
 * DOM ELEMENTS
 ********************************************************/
const tabs = document.querySelectorAll(".tab");
const subtabs = document.querySelectorAll(".subtab");
const listLeft = document.getElementById("listLeft");
const listWrapLeft = document.getElementById("listWrapLeft");
const topList = document.getElementById("topList");
const leftFooter = document.getElementById("leftFooter");
const rightFooter = document.getElementById("rightFooter");
const lastUpdatedEl = document.getElementById("lastUpdated");
const beep = document.getElementById("topBeep");

/********************************************************
 * STATE
 ********************************************************/
let activeTab = "today";
let activeSheet = "advisor";
let lastTop = null;
let scrollAnimation;

/********************************************************
 * EVENTS
 ********************************************************/
tabs.forEach(tab =>
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeTab = tab.dataset.tab;
    render();
  })
);

subtabs.forEach(sub =>
  sub.addEventListener("click", () => {
    subtabs.forEach(s => s.classList.remove("active"));
    sub.classList.add("active");
    activeSheet = sub.dataset.sheet;
    render();
  })
);

/********************************************************
 * FETCH CSV
 ********************************************************/
function fetchCSV(url) {
  return new Promise(resolve => {
    Papa.parse(url, {
      download: true,
      header: true,
      complete: result => resolve(result.data),
    });
  });
}

/********************************************************
 * REFRESH DATA
 ********************************************************/
async function refreshData() {
  const [advisor, technician] = await Promise.all([
    fetchCSV(ADVISOR_CSV_URL),
    fetchCSV(TECHNICIAN_CSV_URL)
  ]);

  window._data = { advisor, technician };

  leftFooter.textContent = "Updated";
  rightFooter.textContent = `Advisor: ${advisor.length} | Technician: ${technician.length}`;
  lastUpdatedEl.textContent = "Updated at " + new Date().toLocaleTimeString();

  render();
}

/********************************************************
 * SCORE CALCULATION
 ********************************************************/
function score(r, mode) {
  if (mode === "today") {
    return (
      (parseFloat(r["Today Load"]) || 0) * 2 +
      (parseFloat(r["Today Labour"]) || 0) * 3 +
      (parseFloat(r["Today VAS"]) || 0)
    );
  }

  return (
    (parseFloat(r["Total Load"]) || 0) * 2 +
    (parseFloat(r["Month Labour"]) || 0) * 3 +
    (parseFloat(r["Total VAS"]) || 0)
  );
}

/********************************************************
 * RENDER UI
 ********************************************************/
function render() {
  if (!window._data) return;

  let rows = window._data[activeSheet];
  const mode = activeTab;

  rows = rows
    .map(r => ({ ...r, _score: score(r, mode) }))
    .sort((a, b) => b._score - a._score);

  listLeft.innerHTML = rows.map((r, i) => card(r, i + 1)).join("");
  topList.innerHTML = rows.slice(0, 5).map((r, i) => topCard(r, i + 1)).join("");

  if (rows[0] && rows[0].Name !== lastTop) {
    beep.play().catch(() => {});
    lastTop = rows[0].Name;
  }

  setupScroll();
}

/********************************************************
 * CARD HTML
 ********************************************************/
function card(r, rank) {
  return `
    <div class="card ${rank === 1 ? "glow" : ""}">
      ${rankBadge(rank)}
      <div class="photo">${r.Name?.[0] || "?"}</div>
      <div>
        <div class="name">${r.Name}</div>
        <div class="meta">
          <span class="metric">Load: ${r["Today Load"]}</span>
          <span class="metric">Labour: ${r["Today Labour"]}</span>
          <span class="metric">VAS: ${r["Today VAS"]}</span>
          <span class="metric">Score: ${Math.round(r._score)}</span>
        </div>
      </div>
    </div>`;
}

/********************************************************
 * TOP CARD HTML
 ********************************************************/
function topCard(r, rank) {
  return `
    <div class="card" style="padding:8px;">
      <div style="font-weight:bold; width:34px">${rank}</div>
      <div class="photo">${r.Name?.[0] || "?"}</div>
      <div>
        <div class="name">${r.Name}</div>
        <div class="meta">Score: ${Math.round(r._score)}</div>
      </div>
    </div>`;
}

/********************************************************
 * RANK BADGES
 ********************************************************/
function rankBadge(rank) {
  if (rank === 1) return `<div class="badge gold">🥇</div>`;
  if (rank === 2) return `<div class="badge silver">🥈</div>`;
  if (rank === 3) return `<div class="badge bronze">🥉</div>`;
  return "";
}

/********************************************************
 * AUTOSCROLL
 ********************************************************/
function setupScroll() {
  cancelAnimationFrame(scrollAnimation);

  const list = listLeft;
  const wrap = listWrapLeft;

  const oldClone = wrap.querySelector(".clone");
  if (oldClone) oldClone.remove();

  const clone = list.cloneNode(true);
  clone.classList.add("clone");
  wrap.appendChild(clone);

  let pos = 0;
  const speed = 30;

  function loop() {
    pos += speed / 60;
    if (pos >= list.scrollHeight) pos = 0;

    list.style.transform = `translateY(-${pos}px)`;
    clone.style.transform = `translateY(-${pos}px)`;

    scrollAnimation = requestAnimationFrame(loop);
  }

  loop();
}

/********************************************************
 * AUTO START
 ********************************************************/
refreshData();
setInterval(refreshData, REFRESH_INTERVAL);

/********************************************************
 * AUTO TAB ROTATION (NO CLICK NEEDED)
 ********************************************************/
let autoIndex = 0;
const autoTabs = [
  { tab: "today", sheet: "advisor" },
  { tab: "today", sheet: "technician" },
  { tab: "till", sheet: "advisor" },
  { tab: "till", sheet: "technician" },
];

function autoRotateTabs() {
  autoIndex = (autoIndex + 1) % autoTabs.length;

  activeTab = autoTabs[autoIndex].tab;
  activeSheet = autoTabs[autoIndex].sheet;

  // Update visual tab UI
  tabs.forEach(t => t.classList.remove("active"));
  subtabs.forEach(s => s.classList.remove("active"));

  document.querySelector(`.tab[data-tab="${activeTab}"]`).classList.add("active");
  document.querySelector(`.subtab[data-sheet="${activeSheet}"]`).classList.add("active");

  render();
}

setInterval(autoRotateTabs, 20000); // change tab every 20 sec


