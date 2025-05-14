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

function renderFiles(fileDataArr) {
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

  fileDataArr.sort((a, b) => a.name.localeCompare(b.name));
  fileDataArr.forEach((fileData, idx) => {
    const tps = extractTPS(fileData.data);
    const entities = groupEntities(fileData.data);
    const section = document.createElement('section');
    section.className = 'file-section';
    section.innerHTML = `
      <div class="file-header" data-idx="${idx}">
        <span class="filename"><i class="fa fa-file-csv"></i> ${fileData.name}</span>
        <span class="tps">TPS: <b>${tps}</b></span>
        <span class="toggle-btn" style="margin-left:auto;cursor:pointer;" title="Collapse"><i class="fa fa-chevron-up"></i></span>
      </div>
      <ul class="entity-list">
        ${entities.map((g, i) => `
          <li class="entity-group" data-idx="${idx}" data-entity="${i}">
            <span>${capitalize(g.name)} <span style="opacity:0.7;font-size:0.95em;">(${g.type})</span></span>
            <span>x${g.total} <i class="fa fa-chevron-down" style="margin-left:0.5em;font-size:0.9em;"></i></span>
            <div class="entity-details" id="details-${idx}-${i}">
              <ul>
                ${g.coords.map(c => `<li>${c.dimension} @ (${c.x}, ${c.y}, ${c.z}) <span style="opacity:0.7;">x${c.quantity}</span></li>`).join('')}
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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Initial render
renderWelcome();
