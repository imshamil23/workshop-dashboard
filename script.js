const SHEET_ID = "148f8oGqJL5u3ujLdwRzm05x7TKpPoqQikyltXa1zTCw";

function loadSheet(sheetName) {
  const url = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(sheetName)}`;

  fetch(url)
    .then(res => res.json())
    .then(data => renderTable(data));
}

function renderTable(data) {
  const thead = document.querySelector("#dataTable thead");
  const tbody = document.querySelector("#dataTable tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (data.length === 0) return;

  // Headers
  let headerRow = "<tr>";
  Object.keys(data[0]).forEach(col => {
    headerRow += `<th>${col}</th>`;
  });
  headerRow += "</tr>";
  thead.innerHTML = headerRow;

  // Rows
  data.forEach(row => {
    let tr = "<tr>";
    Object.values(row).forEach(val => {
      if (String(val).startsWith("http")) {
        tr += `<td><img src="${val}" /></td>`;
      } else {
        tr += `<td>${val}</td>`;
      }
    });
    tr += "</tr>";
    tbody.innerHTML += tr;
  });
}

// Load default page
loadSheet("MALAPPURAM ADVISOR TODAY");

// Auto refresh every 20 seconds
setInterval(() => {
  const active = document.querySelector(".tabs button:hover");
  if (active) active.click();
}, 20000);
