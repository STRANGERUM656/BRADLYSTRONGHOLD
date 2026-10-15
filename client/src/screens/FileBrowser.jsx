import React, { useState, useEffect } from "react";

export default function FileBrowser({ onSelect, onCancel, title = "Seleziona file" }) {
  const [drives, setDrives] = useState([]);
  const [quickPaths, setQuickPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showOnlyExe, setShowOnlyExe] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    if (!window.bradly) return;
    const d = await window.bradly.getDrives();
    const q = await window.bradly.getQuickPaths();
    setDrives(d || []);
    setQuickPaths(q || []);
    if (d && d.length > 0) navigateTo(d[0]);
  }

  async function navigateTo(dirPath) {
    if (!window.bradly) return;
    setLoading(true);
    setError("");
    setSearchResults(null);
    setSelectedFile(null);
    const result = await window.bradly.listDirectory(dirPath);
    setLoading(false);
    if (result.ok) {
      setCurrentPath(result.path);
      setFolders(result.folders || []);
      setFiles(result.files || []);
    } else {
      setError(result.error || "Errore lettura cartella");
    }
  }

  async function goUp() {
    if (!window.bradly || !currentPath) return;
    const r = await window.bradly.getParent(currentPath);
    if (r.ok && r.parent) navigateTo(r.parent);
  }

  async function doSearch() {
    if (!searchQuery.trim() || !currentPath) return;
    setLoading(true);
    setSearchResults([]);
    const r = await window.bradly.searchFiles({ rootPath: currentPath, query: searchQuery, maxDepth: 4 });
    setLoading(false);
    if (r.ok) setSearchResults(r.results || []);
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(2) + " GB";
  }

  function handleFileClick(file) {
    setSelectedFile(file);
  }

  function handleFileDoubleClick(file) {
    onSelect(file.path);
  }

  function confirmSelection() {
    if (selectedFile) onSelect(selectedFile.path);
  }

  const displayFiles = (searchResults !== null ? searchResults : files).filter(f => {
    if (!showOnlyExe) return true;
    return f.ext === ".exe";
  });

  const breadcrumbs = currentPath.split(/[\\/]/).filter(Boolean);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="filebrowser-modal" onClick={e => e.stopPropagation()}>
        <div className="filebrowser-header">
          <div className="filebrowser-title">{title}</div>
          <button className="filebrowser-close" onClick={onCancel}>X</button>
        </div>

        <div className="filebrowser-toolbar">
          <button className="fb-btn" onClick={goUp} disabled={!currentPath}>Su</button>
          <button className="fb-btn" onClick={() => navigateTo(currentPath)} disabled={!currentPath}>Aggiorna</button>
          <input
            className="fb-search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Cerca file in questa cartella..."
          />
          <button className="fb-btn-primary" onClick={doSearch}>Cerca</button>
          <label className="fb-check">
            <input type="checkbox" checked={showOnlyExe} onChange={e => setShowOnlyExe(e.target.checked)} />
            <span>Solo .exe</span>
          </label>
        </div>

        <div className="filebrowser-breadcrumb">
          {breadcrumbs.map((seg, i) => {
            const isDrive = i === 0;
            const partial = breadcrumbs.slice(0, i + 1).join("\\");
            const full = isDrive ? partial + "\\" : "\\" + partial.replace(/^([A-Z]):/, "$1:");
            return (
              <span key={i} className="bc-item" onClick={() => navigateTo(full)}>
                {seg}{i < breadcrumbs.length - 1 ? "\\" : ""}
              </span>
            );
          })}
        </div>

        <div className="filebrowser-body">
          <aside className="filebrowser-sidebar">
            <div className="fb-sidebar-title">PERCORSI RAPIDI</div>
            {quickPaths.map((p, i) => (
              <div key={i} className="fb-quick-item" onClick={() => navigateTo(p.path)}>
                {p.label}
              </div>
            ))}
            <div className="fb-sidebar-title" style={{ marginTop: 16 }}>DRIVE</div>
            {drives.map((d, i) => (
              <div key={i} className="fb-quick-item" onClick={() => navigateTo(d)}>
                {d}
              </div>
            ))}
          </aside>

          <main className="filebrowser-main">
            {error && <div className="fb-error">{error}</div>}
            {loading && <div className="fb-loading">Caricamento...</div>}

            {!loading && !error && (
              <div className="fb-list">
                {searchResults === null && folders.map((f, i) => (
                  <div key={i} className="fb-item folder" onDoubleClick={() => navigateTo(f.path)}>
                    <span className="fb-icon">[DIR]</span>
                    <span className="fb-name">{f.name}</span>
                  </div>
                ))}

                {displayFiles.map((f, i) => (
                  <div
                    key={i}
                    className={"fb-item file" + (selectedFile && selectedFile.path === f.path ? " selected" : "")}
                    onClick={() => handleFileClick(f)}
                    onDoubleClick={() => handleFileDoubleClick(f)}
                  >
                    <span className="fb-icon">[FILE]</span>
                    <span className="fb-name">{f.name}</span>
                    <span className="fb-size">{formatSize(f.size)}</span>
                  </div>
                ))}

                {folders.length === 0 && displayFiles.length === 0 && (
                  <div className="fb-empty">Cartella vuota o nessun file .exe</div>
                )}
              </div>
            )}
          </main>
        </div>

        <div className="filebrowser-footer">
          {selectedFile && (
            <div className="fb-selected">
              <strong>Selezionato:</strong> {selectedFile.name}
            </div>
          )}
          <div className="fb-actions">
            <button className="fb-btn" onClick={onCancel}>Annulla</button>
            <button className="fb-btn-primary" onClick={confirmSelection} disabled={!selectedFile}>
              Seleziona questo file
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}