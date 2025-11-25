/********************************************************
 * CONFIG – Your Google Sheet CSV URLs
 ********************************************************/
const ADVISOR_CSV_URL =
  "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=244746706";

const TECHNICIAN_CSV_URL =
  "https://docs.google.com/spreadsheets/d/148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw/export?format=csv&gid=136202424";

/********************************************************
 * CONSTANTS
 ********************************************************/
const REFRESH_INTERVAL = 20000; // 20 seconds

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
let activeTab = "today";       // today | till
let activeSheet = "advisor";   // advisor | technician

let lastTop = null;
let scrollAnimation = null;

/********************************************************
 * EVENT LISTENERS
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
 * CSV FETCHER
 ********************************************************/
function fetchCSV(url) {
  return new Promise(resolve => {
    Papa.parse(url, {
      download: true,
      header: true,
      complete: results => resolve(results.data)
    });
  });
}

/********************************************************
 * MAIN REFRESH FUNCTION
 ********************************************************/
async function refreshData() {
  try {
    const [advisor, technician] = await Promise.all([
      fetchCSV(ADVISOR_CSV_URL),
      fetchCSV(TECHNICIAN_CSV_URL)
    ]);

    window._latest = { advisor, technician };

    leftFooter.textContent = "Updated";
    rightFooter.textContent = `Advisor: ${advisor.length} | Technician: ${technician.length}`;
    lastUpdatedEl.textContent = "Last update: " + new Date().toLocaleTimeString();

    render();
  } catch (err) {
    console.error("Error loading CSV:", err);
    leftFooter.textContent = "CSV Error!";
  }
}

/********************************************************
 * SCORE FUNCTION
 ********************************************************/
function calcScore(row, mode) {
  if (mode === "today") {
    return (
      (parseFloat(row["Today Load"]) || 0) * 2 +
      (parseFloat(row["Today Labour"]) || 0) * 3 +
      (parseFloat(row["Today VAS"]) || 0)
    );
  } else {
    return (
      (parseFloat(row["Total Load"]) || 0) * 2 +
      (parseFloat(row["Month Labour"]) || 0) * 3 +
      (parseFloat(row["Total VAS"]) || 0)
    );
  }
}

/********************************************************
 * RENDER FUNCTION
 ********************************************************/
function render() {
  if (!window._latest) return;

  let rows = window._latest[activeSheet];

  const mode = activeTab === "today" ? "today" : "till";

  rows = rows
    .map(r => ({
      ...r,
      _score: calcScore(r, mode)
    }))
    .sort((a, b) => b._score - a._score);

  // LEFT LIST — FULL EMPLOYEE LIST
  listLeft.innerHTML = rows
    .map((r, i) => renderCard(r, i + 1))
    .join("");

  // RIGHT LIST — TOP 5
  topList.innerHTML = rows
    .slice(0, 5)
    .map((r, i) => renderTop(r, i + 1))
    .join("");

  // SOUND ALERT WHEN RANK #1 CHANGES
  if (rows.length && rows[0].Name !== lastTop) {
    lastTop = rows[0].Name;
    beep.play().catch(() => {});
  }

  setupScroll();
}

/********************************************************
 * CARD HTML
 ********************************************************/
function renderCard(r, rank) {
  return `
    <div class="card ${rank === 1 ? "glow" : ""}">
      ${rankBadge(rank)}
      <div class="photo">${(r.Name || "?")[0]}</div>

      <div class="info">
        <div class="name">${r.Name || "Unknown"}</div>

        <div class="meta">
          <span class="metric">Load: ${r["Today Load"]}</span>
          <span class="metric">Labour: ${r["Today Labour"]}</span>
          <span class="metric">VAS: ${r["Today VAS"]}</span>
          <span class="metric">Score: ${Math.round(r._score)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderTop(r, rank) {
  return `
    <div class="card" style="padding:8px;">
      <div style="font-weight:bold; width:34px">${rank}</div>
      <div class="photo">${r.Name[0]}</div>

      <div class="info">
        <div class="name">${r.Name}</div>
        <div class="meta">Score: ${Math.round(r._score)}</div>
      </div>
    </div>
  `;
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
 * CONTINUOUS VERTICAL SCROLL
 ********************************************************/
function setupScroll() {
  cancelAnimationFrame(scrollAnimation);

  const list = listLeft;
  const wrap = listWrapLeft;

  // Remove previous clone
  const oldClone = wrap.querySelector(".clone");
  if (oldClone) oldClone.remove();

  const clone = list.cloneNode(true);
  clone.classList.add("clone");
  wrap.appendChild(clone);

  let pos = 0;
  const speed = 30; // px per second

  function animate() {
    pos += speed / 60;

    if (pos >= list.scrollHeight) pos = 0;

    list.style.transform = `translateY(-${pos}px)`;
    clone.style.transform = `translateY(-${pos}px)`;

    scrollAnimation = requestAnimationFrame(animate);
  }

  animate();
}

/********************************************************
 * START REFRESH LOOP
 ********************************************************/
refreshData();
setInterval(refreshData, REFRESH_INTERVAL);
// --- IGNORE ---