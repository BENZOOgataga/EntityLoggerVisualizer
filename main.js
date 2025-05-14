// Pegasus EntityLogger Visualizer - main.js
// All logic: upload, parsing, aggregation, rendering, interactivity

const app = document.getElementById('app');

function createWelcome() {
  return `
    <div id="welcome-outer">
      <div class="welcome">
        <div><i class="fa fa-cube"></i></div>
        <h1>Pegasus EntityLogger Visualizer</h1>
        <p>
          Upload one or more <b>Pegasus EntityLogger</b> CSV files.<br>
          These are generated every 2 minutes by the Pegasus mod for Minecraft Forge 1.20.1.<br>
          Drag and drop files, or click below to select.<br><br>
          <span style="font-size:0.95em;opacity:0.7;">(Use <code>/pegasus forcelogs</code> in-game to generate a file instantly)</span>
        </p>
        <div class="upload-area" id="upload-area">
          <input type="file" id="file-input" multiple accept=".csv" style="display:none;" />
          <button class="animated-btn upload-btn-centered" id="upload-btn">
            <i class="fa fa-upload"></i>
            <span style="margin-left:0.5em;">Select CSV Files</span>
          </button>
          <div class="upload-hint">or drag & drop files here</div>
        </div>
      </div>
    </div>
  `;
}

// --- Utility: Debounce ---
function debounce(fn, delay) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

// --- Utility: Parse timestamp from filename ---
function parseTimestamp(filename) {
  // Example: EntityLog_2025-05-14_12-22.csv
  const match = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2})/);
  if (match) {
    return new Date(match[1] + 'T' + match[2].replace('-', ':'));
  }
  return null;
}

// --- Utility: Save/Load session ---
function saveSession(state) {
  localStorage.setItem('pegasus_entitylogger_session', JSON.stringify(state));
}
function loadSession() {
  const s = localStorage.getItem('pegasus_entitylogger_session');
  return s ? JSON.parse(s) : null;
}
function clearSession() {
  localStorage.removeItem('pegasus_entitylogger_session');
}

function renderWelcome() {
  app.innerHTML = createWelcome();
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');

  uploadBtn.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', e => {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', e => {
    handleFiles(e.target.files);
  });

  // Add Restore/Clear session if available
  const session = loadSession();
  if (session) {
    const restoreDiv = document.createElement('div');
    restoreDiv.style.display = 'flex';
    restoreDiv.style.justifyContent = 'center';
    restoreDiv.style.margin = '2em 0 0 0';
    restoreDiv.innerHTML = `
      <button class="animated-btn upload-btn-centered" id="restore-session-btn"><i class="fa fa-history"></i> Restore Last Session</button>
      <button class="animated-btn upload-btn-centered" id="clear-session-btn" style="margin-left:1em;background:#232a2d;color:#e0e6e6;"><i class="fa fa-trash"></i> Clear Session</button>
    `;
    app.appendChild(restoreDiv);
    document.getElementById('restore-session-btn').onclick = () => {
      renderFiles(session.files, session);
    };
    document.getElementById('clear-session-btn').onclick = () => {
      clearSession();
      renderWelcome();
    };
  }
}

function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.name.endsWith('.csv'));
  if (!files.length) return;
  parseFiles(files);
}

let loadedFiles = [];

function parseFiles(files) {
  let parsedResults = [];
  let filesProcessed = 0;
  files.forEach(file => {
    Papa.parse(file, {
      complete: results => {
        parsedResults.push({
          name: file.name,
          data: results.data.filter((row, idx) => idx > 0 && row.length > 1) // skip first line
        });
        filesProcessed++;
        if (filesProcessed === files.length) {
          renderFiles(parsedResults);
        }
      },
      error: err => {
        alert('Error parsing ' + file.name + ': ' + err.message);
        filesProcessed++;
        if (filesProcessed === files.length) {
          renderFiles(parsedResults);
        }
      }
    });
  });
}

function handleAddFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.name.endsWith('.csv'));
  if (!files.length) return;
  let parsedResults = [];
  let filesProcessed = 0;
  files.forEach(file => {
    Papa.parse(file, {
      complete: results => {
        parsedResults.push({
          name: file.name,
          data: results.data.filter((row, idx) => idx > 0 && row.length > 1) // skip first line
        });
        filesProcessed++;
        if (filesProcessed === files.length) {
          // Merge with loadedFiles
          renderFiles(loadedFiles.concat(parsedResults));
        }
      },
      error: err => {
        alert('Error parsing ' + file.name + ': ' + err.message);
        filesProcessed++;
        if (filesProcessed === files.length) {
          renderFiles(loadedFiles.concat(parsedResults));
        }
      }
    });
  });
}

function extractTPS(rows) {
  for (const row of rows) {
    if (row[0] && row[0].toUpperCase() === 'TPS') {
      return row[1];
    }
  }
  return '?';
}

function groupEntities(rows) {
  const groups = {};
  for (const row of rows) {
    if (!row[0] || row[0].toUpperCase() === 'TPS') continue;
    const [type, name, dimension, x, y, z, quantity] = row;
    const key = type + '|' + name;
    if (!groups[key]) {
      groups[key] = {
        type, name, total: 0, coords: []
      };
    }
    groups[key].total += parseInt(quantity || '1', 10);
    groups[key].coords.push({ dimension, x, y, z, quantity });
  }
  return Object.values(groups).sort((a, b) => b.total - a.total);
}

function renderFiles(fileDataArr, sessionState) {
  loadedFiles = fileDataArr;
  app.innerHTML = '';
  // Add 'Add More Files' button
  const addFilesDiv = document.createElement('div');
  addFilesDiv.style.display = 'flex';
  addFilesDiv.style.justifyContent = 'center';
  addFilesDiv.style.margin = '2em 0 1em 0';
  addFilesDiv.innerHTML = `
    <button class="animated-btn upload-btn-centered" id="add-files-btn" style="margin-bottom:0;">
      <i class="fa fa-plus"></i>
      <span style="margin-left:0.5em;">Add More Files</span>
    </button>
    <input type="file" id="add-files-input" multiple accept=".csv" style="display:none;" />
  `;
  app.appendChild(addFilesDiv);
  document.getElementById('add-files-btn').addEventListener('click', () => {
    document.getElementById('add-files-input').click();
  });
  document.getElementById('add-files-input').addEventListener('change', e => {
    handleAddFiles(e.target.files);
  });

  // If multiple files, add a merge button
  if (fileDataArr.length > 1) {
    const mergeDiv = document.createElement('div');
    mergeDiv.style.display = 'flex';
    mergeDiv.style.justifyContent = 'center';
    mergeDiv.style.margin = '0 0 2em 0';
    mergeDiv.innerHTML = `
      <button class="animated-btn upload-btn-centered" id="merge-files-btn" style="background:linear-gradient(90deg,#6ee7b7 60%,#60a5fa 100%);color:#1e2527;">
        <i class="fa fa-layer-group"></i>
        <span style="margin-left:0.5em;">Merge All Files</span>
      </button>
    `;
    app.appendChild(mergeDiv);
    document.getElementById('merge-files-btn').addEventListener('click', () => {
      // Merge all entity rows from all files
      let mergedRows = [];
      let tpsValues = [];
      fileDataArr.forEach(f => {
        // Extract TPS and filter out TPS lines from entity rows
        f.data.forEach(row => {
          if (row[0] && row[0].toUpperCase() === 'TPS') {
            if (!isNaN(parseFloat(row[1]))) tpsValues.push(parseFloat(row[1]));
          } else {
            mergedRows.push(row);
          }
        });
      });
      // Calculate average TPS
      let avgTPS = tpsValues.length ? (tpsValues.reduce((a, b) => a + b, 0) / tpsValues.length).toFixed(2) : '?';
      // Add a single averaged TPS line at the top
      mergedRows.unshift(['TPS', avgTPS, 0, 0, 0, 0, 0]);
      // Use a custom name for the merged file
      const mergedFileName = 'Pegasus_Merged_Entities.csv';
      const mergedFile = [{
        name: mergedFileName,
        data: mergedRows
      }];
      renderFiles(mergedFile);
      // Add export button for merged file
      setTimeout(() => addExportButton(mergedRows, mergedFileName), 0);
    });
  }

  // Save session on every render
  saveSession({
    files: loadedFiles,
    // TODO: add expanded/collapsed, search/filter state
  });

  // --- Timeline Graphs ---
  if (fileDataArr.length > 1 && fileDataArr.some(f => parseTimestamp(f.name))) {
    renderTimelineSection(fileDataArr);
  }

  fileDataArr.sort((a, b) => a.name.localeCompare(b.name));
  fileDataArr.forEach((fileData, idx) => {
    const tps = extractTPS(fileData.data);
    const entities = groupEntities(fileData.data);
    // --- Search bar ---
    const section = document.createElement('section');
    section.className = 'file-section';
    // --- Coordinate Filter Bar ---
    const coordFilterBar = `
      <div class="coord-filter-bar">
        <input type="number" class="coord-input" data-file-idx="${idx}" data-coord="xmin" placeholder="X min" />
        <input type="number" class="coord-input" data-file-idx="${idx}" data-coord="xmax" placeholder="X max" />
        <input type="number" class="coord-input" data-file-idx="${idx}" data-coord="ymin" placeholder="Y min" />
        <input type="number" class="coord-input" data-file-idx="${idx}" data-coord="ymax" placeholder="Y max" />
        <input type="number" class="coord-input" data-file-idx="${idx}" data-coord="zmin" placeholder="Z min" />
        <input type="number" class="coord-input" data-file-idx="${idx}" data-coord="zmax" placeholder="Z max" />
      </div>
    `;
    section.innerHTML = `
      <div class="file-header" data-idx="${idx}">
        <span class="filename"><i class="fa fa-file-csv"></i> ${fileData.name}</span>
        <span class="tps">TPS: <b>${tps}</b></span>
        <span class="toggle-btn" style="margin-left:auto;cursor:pointer;" title="Collapse"><i class="fa fa-chevron-up"></i></span>
      </div>
      ${coordFilterBar}
      <div class="search-bar">
        <input type="text" placeholder="Search entities..." data-file-idx="${idx}" class="entity-search-input" autocomplete="off" />
      </div>
      <ul class="entity-list" id="entity-list-${idx}">
        ${entities.map((g, i) => `
          <li class="entity-group" data-idx="${idx}" data-entity="${i}" tabindex="0">
            <span><span class="entity-dot ${g.type ? g.type.toLowerCase() : 'other'}"></span>${capitalize(g.name)} <span style="opacity:0.7;font-size:0.95em;">(${g.type})</span></span>
            <span>x${g.total} <i class="fa fa-chevron-down" style="margin-left:0.5em;font-size:0.9em;"></i></span>
            <div class="entity-details" id="details-${idx}-${i}">
              <ul>
                ${g.coords.map(c => `<li class="coord-li" data-x="${c.x}" data-y="${c.y}" data-z="${c.z}">${c.dimension} @ (${c.x}, ${c.y}, ${c.z}) <span style="opacity:0.7;">x${c.quantity}</span></li>`).join('')}
              </ul>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
    app.appendChild(section);
  });
  addFileSectionInteractivity();
  addEntityGroupInteractivity();
  addEntitySearchInteractivity();
  addCoordFilterInteractivity();
}

// --- Coordinate Filter Interactivity ---
function addCoordFilterInteractivity() {
  const debounceFilter = debounce(function(idx) {
    const xMin = parseFloat(document.querySelector(`.coord-input[data-file-idx="${idx}"][data-coord="xmin"]`).value);
    const xMax = parseFloat(document.querySelector(`.coord-input[data-file-idx="${idx}"][data-coord="xmax"]`).value);
    const yMin = parseFloat(document.querySelector(`.coord-input[data-file-idx="${idx}"][data-coord="ymin"]`).value);
    const yMax = parseFloat(document.querySelector(`.coord-input[data-file-idx="${idx}"][data-coord="ymax"]`).value);
    const zMin = parseFloat(document.querySelector(`.coord-input[data-file-idx="${idx}"][data-coord="zmin"]`).value);
    const zMax = parseFloat(document.querySelector(`.coord-input[data-file-idx="${idx}"][data-coord="zmax"]`).value);
    const list = document.getElementById('entity-list-' + idx);
    if (!list) return;
    Array.from(list.children).forEach(li => {
      let show = false;
      const coordLis = li.querySelectorAll('.coord-li');
      coordLis.forEach(cl => {
        const x = parseFloat(cl.getAttribute('data-x'));
        const y = parseFloat(cl.getAttribute('data-y'));
        const z = parseFloat(cl.getAttribute('data-z'));
        let match = true;
        if (!isNaN(xMin) && x < xMin) match = false;
        if (!isNaN(xMax) && x > xMax) match = false;
        if (!isNaN(yMin) && y < yMin) match = false;
        if (!isNaN(yMax) && y > yMax) match = false;
        if (!isNaN(zMin) && z < zMin) match = false;
        if (!isNaN(zMax) && z > zMax) match = false;
        if (match) {
          show = true;
          cl.classList.add('coord-match');
          cl.classList.remove('coord-dim');
        } else {
          cl.classList.remove('coord-match');
          cl.classList.add('coord-dim');
        }
      });
      li.style.display = show ? '' : 'none';
    });
  }, 200);
  document.querySelectorAll('.coord-input').forEach(input => {
    input.addEventListener('input', function() {
      const idx = this.getAttribute('data-file-idx');
      debounceFilter(idx);
    });
  });
}

// --- Heatmap Interactivity ---
function addHeatmapInteractivity() {
  document.querySelectorAll('.heatmap-toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.getAttribute('data-file-idx');
      const container = document.getElementById('heatmap-canvas-container-' + idx);
      if (container.style.display === 'none') {
        renderHeatmap(idx, container);
        container.style.display = '';
      } else {
        container.style.display = 'none';
        container.innerHTML = '';
      }
    });
  });
}

function renderHeatmap(idx, container) {
  // Get all entity coords for this file
  const file = loadedFiles[idx];
  const entities = groupEntities(file.data);
  // Collect all coords by dimension
  const dims = {};
  entities.forEach(g => {
    g.coords.forEach(c => {
      if (!dims[c.dimension]) dims[c.dimension] = [];
      dims[c.dimension].push({ x: parseFloat(c.x), z: parseFloat(c.z), name: g.name, type: g.type, quantity: parseInt(c.quantity||'1',10) });
    });
  });
  // Dimension selector
  const dimKeys = Object.keys(dims);
  let selectedDim = dimKeys[0];
  container.innerHTML = `<div style="margin-bottom:0.5em;">
    <label style="margin-right:0.7em;">Dimension:</label>
    <select id="heatmap-dim-select-${idx}">
      ${dimKeys.map(d => `<option value="${d}">${d}</option>`).join('')}
    </select>
  </div>
  <canvas id="heatmap-canvas-${idx}" width="420" height="320" style="background:#1e2527;border-radius:8px;"></canvas>`;
  document.getElementById(`heatmap-dim-select-${idx}`).addEventListener('change', function() {
    selectedDim = this.value;
    drawHeatmapCanvas(idx, dims[selectedDim], `heatmap-canvas-${idx}`);
  });
  drawHeatmapCanvas(idx, dims[selectedDim], `heatmap-canvas-${idx}`);
}

function drawHeatmapCanvas(idx, points, canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!points || !points.length) return;
  // Find bounds
  let minX = Math.min(...points.map(p=>p.x)), maxX = Math.max(...points.map(p=>p.x));
  let minZ = Math.min(...points.map(p=>p.z)), maxZ = Math.max(...points.map(p=>p.z));
  if (minX === maxX) { minX -= 10; maxX += 10; }
  if (minZ === maxZ) { minZ -= 10; maxZ += 10; }
  // Draw points as density blobs
  points.forEach(p => {
    const px = ((p.x-minX)/(maxX-minX))*canvas.width;
    const pz = ((p.z-minZ)/(maxZ-minZ))*canvas.height;
    const r = Math.max(3, Math.log2(p.quantity+1)*3);
    const grad = ctx.createRadialGradient(px,pz,1,px,pz,r);
    grad.addColorStop(0, 'rgba(96,165,250,0.7)');
    grad.addColorStop(1, 'rgba(96,0,250,0.05)');
    ctx.beginPath();
    ctx.arc(px,pz,r,0,2*Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
  });
}

// --- Timeline Section ---
function renderTimelineSection(fileDataArr) {
  // Parse timestamps and TPS
  const timelineData = fileDataArr.map(f => {
    const ts = parseTimestamp(f.name);
    return {
      name: f.name,
      ts,
      tps: parseFloat(extractTPS(f.data)),
      entities: groupEntities(f.data)
    };
  }).filter(d => d.ts);
  if (!timelineData.length) return;
  timelineData.sort((a,b)=>a.ts-b.ts);
  // TPS chart
  const timelineDiv = document.createElement('div');
  timelineDiv.className = 'timeline-section';
  timelineDiv.innerHTML = `
    <h2 style="text-align:center;margin-bottom:0.5em;">Timeline</h2>
    <canvas id="timeline-tps-chart" width="600" height="180"></canvas>
    <canvas id="timeline-entity-chart" width="600" height="220" style="margin-top:1.5em;"></canvas>
  `;
  app.insertBefore(timelineDiv, app.children[2] || null);
  // TPS chart
  new Chart(document.getElementById('timeline-tps-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: timelineData.map(d=>d.ts.toLocaleString()),
      datasets: [{
        label: 'TPS',
        data: timelineData.map(d=>d.tps),
        borderColor: '#6ee7b7',
        backgroundColor: 'rgba(110,231,183,0.2)',
        tension: 0.2
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 25 } }
    }
  });
  // Top 5 entity trends
  const allCounts = {};
  timelineData.forEach(d => {
    d.entities.forEach(e => {
      if (!allCounts[e.name]) allCounts[e.name] = Array(timelineData.length).fill(0);
    });
  });
  timelineData.forEach((d, i) => {
    d.entities.forEach(e => {
      allCounts[e.name][i] = e.total;
    });
  });
  const top5 = Object.entries(allCounts).sort((a,b)=>{
    const sumA = a[1].reduce((x,y)=>x+y,0);
    const sumB = b[1].reduce((x,y)=>x+y,0);
    return sumB-sumA;
  }).slice(0,5);
  new Chart(document.getElementById('timeline-entity-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: timelineData.map(d=>d.ts.toLocaleString()),
      datasets: top5.map(([name,counts],i)=>({
        label: capitalize(name),
        data: counts,
        borderColor: ['#60a5fa','#6ee7b7','#fbbf24','#f472b6','#a78bfa'][i%5],
        backgroundColor: 'rgba(96,165,250,0.1)',
        tension: 0.2
      }))
    },
    options: {
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function addFileSectionInteractivity() {
  document.querySelectorAll('.file-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      section.classList.toggle('collapsed');
      const icon = header.querySelector('.toggle-btn i');
      icon.className = section.classList.contains('collapsed') ? 'fa fa-chevron-down' : 'fa fa-chevron-up';
    });
  });
}

function addEntityGroupInteractivity() {
  document.querySelectorAll('.entity-group').forEach(group => {
    group.addEventListener('click', e => {
      // Prevent file section collapse if clicking entity
      e.stopPropagation();
      const idx = group.getAttribute('data-idx');
      const entityIdx = group.getAttribute('data-entity');
      const details = document.getElementById(`details-${idx}-${entityIdx}`);
      details.classList.toggle('expanded');
      const icon = group.querySelector('i.fa-chevron-down, i.fa-chevron-up');
      if (details.classList.contains('expanded')) {
        icon.className = 'fa fa-chevron-up';
      } else {
        icon.className = 'fa fa-chevron-down';
      }
    });
  });
}

function addEntitySearchInteractivity() {
  document.querySelectorAll('.entity-search-input').forEach(input => {
    input.addEventListener('input', function() {
      const idx = this.getAttribute('data-file-idx');
      const filter = this.value.trim().toLowerCase();
      const list = document.getElementById('entity-list-' + idx);
      if (!list) return;
      Array.from(list.children).forEach(li => {
        const name = li.querySelector('span').innerText.toLowerCase();
        li.style.display = name.includes(filter) ? '' : 'none';
      });
    });
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function addExportButton(rows, filename) {
  let exportDiv = document.createElement('div');
  exportDiv.style.display = 'flex';
  exportDiv.style.justifyContent = 'center';
  exportDiv.style.margin = '0 0 2em 0';
  exportDiv.innerHTML = `
    <button class="animated-btn upload-btn-centered" id="export-merged-btn" style="background:linear-gradient(90deg,#60a5fa 60%,#6ee7b7 100%);color:#1e2527;">
      <i class="fa fa-download"></i>
      <span style="margin-left:0.5em;">Export Merged CSV</span>
    </button>
  `;
  app.insertBefore(exportDiv, app.children[1] || null);
  document.getElementById('export-merged-btn').addEventListener('click', () => {
    let csvContent = rows.map(row => row.join(",")).join("\r\n");
    let blob = new Blob([csvContent], { type: 'text/csv' });
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Initial render
renderWelcome();
