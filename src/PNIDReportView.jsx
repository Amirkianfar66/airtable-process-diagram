< !doctype html >
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <title>PNID Linelist Report</title>
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <style>
                :root {
                    --bg - dark: #6c6c6c;
                --bg-mid:  #e9e9e9;
                --grid-1:  #999;
                --grid-2:  #ccc;
                --grid-3:  #eee;
                --text-1:  #111;
                --text-2:  #333;
                --text-3:  #666;
                --radius: 8px;
    }
                html, body {
                    height: 100%;
                margin: 0;
                font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
                color: var(--text-1);
                background: #fff;
    }
                .page {
                    display: grid;
                grid-template-rows: auto auto 1fr;
                height: 100%;
    }

                /* Top controls */
                .toolbar {
                    display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 10px;
                border-bottom: 1px solid #eee;
                background: #fafafa;
    }
                .toolbar-right {margin - left: auto; display: flex; align-items: center; gap: 10px; color: var(--text-3); font-size: 12px; }
                .btn {
                    padding: 6px 10px;
                border-radius: var(--radius);
                border: 1px solid var(--text-1);
                background: var(--text-1);
                color: #fff;
                cursor: pointer;
    }
                .btn[disabled] {opacity: .5; cursor: not-allowed; }
                .btn-light {
                    padding: 6px 10px;
                border-radius: var(--radius);
                border: 1px solid #ddd;
                background: #fff;
                color: var(--text-1);
                cursor: pointer;
    }
                .input, .select {
                    padding: 6px 8px;
                border-radius: var(--radius);
                border: 1px solid #ddd;
                min-width: 220px;
    }

                /* Report header row (title/project/logo) */
                .report-chrome {
                    display: flex;
                align-items: center;
                gap: 16px;
                padding: 8px 10px;
                border-bottom: 1px solid #eee;
                background: #fff;
    }
                .report-title {
                    font - size: 26px;
                font-weight: 700;
                line-height: 1;
                margin-bottom: 2px;
    }
                .report-sub {font - size: 12px; color: var(--text-2); }
                .logo {height: 36px; object-fit: contain; }

                /* Report settings (collapsible) */
                details {padding: 0 10px; }
    details > summary {cursor: pointer; color: var(--text-2); padding: 8px 0; }
                .settings-grid {
                    display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 12px 0;
    }
                .labelled {
                    display: grid; grid-template-columns: 80px 1fr; align-items: center; gap: 6px;
                min-width: 320px;
    }

                /* Table */
                .wrap {overflow: auto; }
                table {
                    width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                font-size: 12px;
                border: 1px solid var(--grid-1);
                background: #fff;
    }
                thead tr:first-child th { /* group row */
                    background: var(--bg-dark);
                color: #fff;
                padding: 6px 8px;
                text-align: center;
                border-right: 1px solid var(--grid-1);
                border-bottom: 1px solid var(--grid-1);
                white-space: nowrap;
    }
                thead tr:nth-child(2) th { /* column row */
                    background: var(--bg-mid);
                color: #000;
                padding: 6px 8px;
                text-align: left;
                border-right: 1px solid var(--grid-2);
                border-bottom: 1px solid var(--grid-1);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
    }
                tbody td {
                    padding: 6px 8px;
                border-right: 1px solid var(--grid-3);
                border-bottom: 1px solid var(--grid-3);
                vertical-align: top;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
    }

                /* Empty state */
                .empty {padding: 16px; color: var(--text-3); }

                /* Print styles: keep header rows and colors */
                @media print {
                    body {-webkit - print - color - adjust: exact; print-color-adjust: exact; }
                .toolbar, details {display: none !important; }
                .wrap {overflow: visible; }
                table {page -break-inside: auto; }
                thead {display: table-header-group; }
                tfoot {display: table-footer-group; }
                tr    {page -break-inside: avoid; page-break-after: auto; }
    }
            </style>
            <!-- CSV parser -->
            <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
        </head>
        <body>
            <div class="page">
                <!-- Controls -->
                <div class="toolbar">
                    <button class="btn" id="btn-file">Load CSV</button>
                    <input type="file" id="file" accept=".csv" style="display:none">
                        <button class="btn-light" id="btn-dl" disabled>Download CSV</button>
                        <button class="btn-light" id="btn-clear" disabled>Clear</button>

                        <span style="margin-left:16px; font-size:12px; color:#555">Report URL</span>
                        <input class="input" id="url" placeholder="https://server/path/linelist.csv">
                            <button class="btn-light" id="btn-save-load">Save & Load</button>
                            <button class="btn-light" id="btn-refresh">Refresh</button>

                            <div class="toolbar-right">
                                <span id="meta"></span>
                                <span id="msg" style="color:crimson;"></span>
                            </div>
                        </div>

                        <!-- Report chrome -->
                        <div class="report-chrome">
                            <div style="flex:1">
                                <div class="report-title" id="titleText">Linelist</div>
                                <div class="report-sub"><b>Project</b>&nbsp;&nbsp;<span id="projectText">Project</span></div>
                            </div>
                            <img id="logoImg" class="logo" alt="logo" style="display:none" />
                            <button class="btn" id="btn-print" disabled>Print / Save PDF</button>
                        </div>

                        <!-- Settings -->
                        <details>
                            <summary>Report settings</summary>
                            <div class="settings-grid">
                                <label class="labelled">
                                    <span>Title</span>
                                    <input class="input" id="title" placeholder="Linelist">
                                </label>
                                <label class="labelled">
                                    <span>Project</span>
                                    <input class="input" id="project" placeholder="Project code/name">
                                </label>
                                <label class="labelled" style="min-width:520px">
                                    <span>Logo URL</span>
                                    <input class="input" id="logo" placeholder="https://.../logo.png">
                                </label>
                            </div>
                            <div style="font-size:12px; color:#666; margin-bottom:8px">
                                Column groups are pre-mapped to typical linelist headers. Any unmatched CSV columns appear under <b>Other</b>.
                            </div>
                        </details>

                        <!-- Table -->
                        <div class="wrap">
                            <div id="empty" class="empty">
                                No report loaded. Load a <b>CSV</b> exported from Plant 3D Report Creator (or paste a URL and click <b>Save & Load</b>).
                            </div>
                            <div id="tableHost" style="display:none"></div>
                            <div id="footer" style="padding:8px 12px; font-size:12px; color:#777; display:none"></div>
                        </div>
                </div>

                <script>
                    (function(){
  // Default Plant 3D-like groups (adjust as needed)
  const DEFAULT_GROUPS = [
                    {name: "Class",        cols: ["Pipe Class", "Tag"] },
                    {name: "Segment Size", cols: ["Size", "Size OD", "Size ID"] },
                    {name: "Finishing",    cols: ["Description", "Corrosion Allowance", "Insulation Type", "Insulation Thick", "Trace", "Painting"] },
                    {name: "P&ID",         cols: ["P&ID", "From", "To"] },
                    {name: "Design",       cols: ["Pressure Drop", "Insulation"] },
                    {name: "Operation",    cols: ["Operation Pressure", "Operation Temperature"] },
                    {name: "Fluid",        cols: ["Fluid Tag"] },
                    ];

                    // Elements
                    const btnFile = document.getElementById('btn-file');
                    const file    = document.getElementById('file');
                    const btnDl   = document.getElementById('btn-dl');
                    const btnClr  = document.getElementById('btn-clear');
                    const btnPrint= document.getElementById('btn-print');

                    const urlInput= document.getElementById('url');
                    const btnSaveLoad = document.getElementById('btn-save-load');
                    const btnRefresh  = document.getElementById('btn-refresh');

                    const titleEl = document.getElementById('title');
                    const projEl  = document.getElementById('project');
                    const logoEl  = document.getElementById('logo');

                    const titleText = document.getElementById('titleText');
                    const projectText = document.getElementById('projectText');
                    const logoImg = document.getElementById('logoImg');

                    const empty  = document.getElementById('empty');
                    const host   = document.getElementById('tableHost');
                    const footer = document.getElementById('footer');
                    const metaEl = document.getElementById('meta');
                    const msgEl  = document.getElementById('msg');

                    // State
                    let rows = [];
                    let columns = [];
                    let groups = loadJSON("pnid:groups") || DEFAULT_GROUPS;

                    // Load saved chrome
                    const savedTitle = localStorage.getItem("pnid:title") || "Linelist";
                    const savedProj  = localStorage.getItem("pnid:project") || "Project";
                    const savedLogo  = localStorage.getItem("pnid:logo") || "";

                    titleEl.value = savedTitle; titleText.textContent = savedTitle;
                    projEl.value  = savedProj;  projectText.textContent = savedProj;
                    logoEl.value  = savedLogo;  if (savedLogo) {logoImg.src = savedLogo; logoImg.style.display='block'; }

                    const savedUrl = localStorage.getItem("pnid:url") || "";
                    urlInput.value = savedUrl;

  // Handlers: chrome
  titleEl.addEventListener('input', e => {
    const val = e.target.value || "Linelist";
                    titleText.textContent = val;
                    localStorage.setItem("pnid:title", val);
  });
  projEl.addEventListener('input', e => {
    const val = e.target.value || "Project";
                    projectText.textContent = val;
                    localStorage.setItem("pnid:project", val);
  });
  logoEl.addEventListener('input', e => {
    const val = e.target.value.trim();
                    localStorage.setItem("pnid:logo", val);
                    if (val) {logoImg.src = val; logoImg.style.display='block'; }
                    else {logoImg.removeAttribute('src'); logoImg.style.display='none'; }
  });

  // File load
  btnFile.addEventListener('click', () => file.click());
  file.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
                    if (!f) return;
                    setMsg('');
                    Papa.parse(f, {
                        header: true,
                    skipEmptyLines: "greedy",
                    worker: true,
      complete: (res) => {
        const data = res.data || [];
                    const cols = uniqueCols(data);
                    setData(data, cols, {name: f.name, size: f.size, type: f.type, time: Date.now() });
                    file.value = "";
      },
      error: (err) => {setMsg(err?.message || String(err)); file.value = ""; }
    });
  });

  // URL load
  btnSaveLoad.addEventListener('click', () => {
    const u = urlInput.value.trim();
                    localStorage.setItem("pnid:url", u);
                    if (u) fetchCsv(u);
  });
  btnRefresh.addEventListener('click', () => { if (urlInput.value.trim()) fetchCsv(urlInput.value.trim()); });

                    // Clear & download
                    btnClr.addEventListener('click', clearData);
                    btnDl.addEventListener('click', downloadCsv);
  btnPrint.addEventListener('click', () => window.print());

                    // Auto-load by query (?url=...)
                    const qp = new URLSearchParams(location.search);
                    const qpUrl = qp.get('url');
                    if (qpUrl) {urlInput.value = qpUrl; localStorage.setItem("pnid:url", qpUrl); fetchCsv(qpUrl); }
                    else if (savedUrl) {fetchCsv(savedUrl); }

                    // ---- functions ----
                    function fetchCsv(u){
                        setMsg('');
                    fetch(u, {cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.text(); })
      .then(text => parseCsvText(text, {name: fileNameFromUrl(u), time: Date.now() }))
      .catch(err => setMsg(`Failed to load CSV. ${err.message}. If cross-origin, enable CORS on the server.`));
  }

                    function parseCsvText(text, meta){
                        Papa.parse(text, {
                            header: true,
                            skipEmptyLines: "greedy",
                            worker: true,
                            complete: (res) => {
                                const data = res.data || [];
                                const cols = uniqueCols(data);
                                setData(data, cols, meta);
                            },
                            error: (err) => setMsg(err?.message || String(err))
                        });
  }

                    function setData(data, cols, meta){
                        rows = data;
                    columns = cols;
                    // Persist
                    saveJSON("pnid:data", {rows, columns});
                    saveJSON("pnid:meta", meta);
                    // UI state
                    metaEl.textContent = meta ? `${meta.name || 'remote.csv'} • ${rows.length} rows` : `${rows.length} rows`;
                    empty.style.display = rows.length ? 'none' : 'block';
                    host.style.display  = rows.length ? 'block' : 'none';
                    footer.style.display= rows.length ? 'block' : 'none';
                    btnDl.disabled = !rows.length;
                    btnClr.disabled = !rows.length;
                    btnPrint.disabled = !rows.length;

                    renderReport();
  }

                    function clearData(){
                        rows = []; columns = [];
                    localStorage.removeItem("pnid:data");
                    localStorage.removeItem("pnid:meta");
                    host.innerHTML = "";
                    empty.style.display = 'block';
                    host.style.display  = 'none';
                    footer.style.display= 'none';
                    btnDl.disabled = true;
                    btnClr.disabled = true;
                    btnPrint.disabled = true;
                    metaEl.textContent = "";
                    setMsg('');
  }

                    function downloadCsv(){
    if (!rows.length) return;
                    const csv = Papa.unparse(rows);
                    const blob = new Blob([csv], {type: "text/csv" });
                    const url  = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    const meta = loadJSON("pnid:meta");
                    a.href = url;
                    a.download = ((meta && meta.name) ? meta.name.replace(/\.\w+$/, "") : "pnid_report") + ".csv";
                    document.body.appendChild(a); a.click(); a.remove();
                    URL.revokeObjectURL(url);
  }

                    function renderReport(){
    const layout = buildLayout(columns, groups);
                    host.innerHTML = ""; // clear

                    // Build table
                    const table = document.createElement('table');

                    // THEAD (two rows)
                    const thead = document.createElement('thead');
                    const trGroup = document.createElement('tr');
    layout.groups.forEach(g => {
      const th = document.createElement('th');
                    th.textContent = g.name;
                    th.colSpan = g.cols.length;
                    trGroup.appendChild(th);
    });
                    const trCols = document.createElement('tr');
    layout.groups.forEach(g => {
                        g.cols.forEach(col => {
                            const th = document.createElement('th');
                            th.textContent = col;
                            trCols.appendChild(th);
                        });
    });
                    thead.appendChild(trGroup);
                    thead.appendChild(trCols);
                    table.appendChild(thead);

                    // TBODY
                    const tbody = document.createElement('tbody');
    rows.forEach(r => {
      const tr = document.createElement('tr');
      layout.order.forEach(col => {
        const td = document.createElement('td');
                    td.textContent = (r[col] != null) ? String(r[col]) : "";
                    tr.appendChild(td);
      });
                    tbody.appendChild(tr);
    });
                    table.appendChild(tbody);

                    host.appendChild(table);

                    // Footer
                    const when = new Date().toLocaleString();
                    footer.textContent = `${rows.length} rows • Printed on ${when}`;
  }

                    function buildLayout(cols, groups){
    if (!cols || !cols.length) return {groups: [], order: [] };
                    const set = new Set(cols);
    // keep only existing cols in each group
    const normalized = (groups || DEFAULT_GROUPS).map(g => ({
                        name: g.name,
      cols: (g.cols || []).filter(c => set.has(c))
    })).filter(g => g.cols.length);

    // leftovers into "Other"
    const inGroups = new Set(normalized.flatMap(g => g.cols));
    const leftovers = cols.filter(c => !inGroups.has(c));
                    if (leftovers.length) normalized.push({name: "Other", cols: leftovers });

                    return {groups: normalized, order: normalized.flatMap(g => g.cols) };
  }

                    function uniqueCols(data){
    const s = new Set();
    (data || []).forEach(row => Object.keys(row || { }).forEach(k => s.add(k)));
                    return Array.from(s);
  }

                    function fileNameFromUrl(u){
    try { const p = new URL(u).pathname; return decodeURIComponent(p.split('/').pop() || 'remote.csv'); }
                    catch { return 'remote.csv'; }
  }

                    function setMsg(t){msgEl.textContent = t || ""; }

                    function saveJSON(key, val){localStorage.setItem(key, JSON.stringify(val)); }
                    function loadJSON(key){ try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }

                    // Restore previous data on load (if any)
                    const saved = loadJSON("pnid:data");
                    const meta  = loadJSON("pnid:meta");
                    if (saved && saved.rows && saved.columns) {
                        rows = saved.rows; columns = saved.columns;
                    setData(rows, columns, meta || {name: 'saved.csv', time: Date.now() });
  }
})();
                </script>
        </body>
    </html>
