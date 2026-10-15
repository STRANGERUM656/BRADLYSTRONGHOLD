import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import { playSound } from "../sounds";
import FileBrowser from "./FileBrowser";

export default function LobbyRoom({ lobby: initialLobby, user, onLeave }) {
  const [lobby, setLobby] = useState(initialLobby);
  const [input, setInput] = useState("");
  const [gamePath, setGamePath] = useState("");
  const [launching, setLaunching] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const onUpdate = (l) => {
      const prevCount = (lobby.players || []).filter(p => !p.offline).length;
      const newCount = (l.players || []).filter(p => !p.offline).length;
      if (newCount > prevCount) playSound("join");
      else if (newCount < prevCount) playSound("leave");
      setLobby(l);
    };
    const onMsg = (m) => {
      setLobby(prev => ({ ...prev, messages: [...(prev.messages || []), m] }));
      playSound("message");
    };
    const onStart = (data) => {
      playSound("start");
      if (window.bradly && window.bradly.launchGame) window.bradly.launchGame(gamePath);
    };
    const onError = (m) => { playSound("error"); alert(m); };
    const onClosed = (data) => { alert(data.reason || "La lobby e' stata chiusa"); onLeave(); };
    const onKicked = (data) => { alert(data.reason || "Sei stato espulso"); onLeave(); };
    socket.on("lobby-update", onUpdate);
    socket.on("chat-message", onMsg);
    socket.on("lobby-start", onStart);
    socket.on("error-msg", onError);
    socket.on("lobby-closed", onClosed);
    socket.on("kicked", onKicked);
    return () => {
      socket.off("lobby-update", onUpdate);
      socket.off("chat-message", onMsg);
      socket.off("lobby-start", onStart);
      socket.off("error-msg", onError);
      socket.off("lobby-closed", onClosed);
      socket.off("kicked", onKicked);
    };
  }, [gamePath, lobby.players]);

  useEffect(() => {
    async function loadPath() {
      if (window.bradly && window.bradly.getGamePath) {
        const p = await window.bradly.getGamePath();
        setGamePath(p || "");
      }
    }
    loadPath();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lobby.messages]);

  const send = () => {
    if (!input.trim()) return;
    socket.emit("chat-message", { lobbyId: lobby.id, username: user.username, text: input.trim() });
    setInput("");
  };

  const toggleReady = () => socket.emit("toggle-ready", { lobbyId: lobby.id, username: user.username });

  const openFileBrowser = () => {
    if (!window.bradly || !window.bradly.listDirectory) {
      alert("File browser disponibile solo nell'app desktop");
      return;
    }
    setShowFileBrowser(true);
  };

  const handleFileSelected = async (path) => {
    setShowFileBrowser(false);
    if (window.bradly && window.bradly.setGamePath) {
      await window.bradly.setGamePath(path);
    }
    setGamePath(path);
    playSound("click");
  };

  const startGame = async () => {
    if (!window.bradly) { alert("Funzione solo nell'app desktop"); return; }
    if (!gamePath) { alert("Seleziona prima il percorso di Stronghold.exe"); return; }
    const notReady = (lobby.players || []).filter(p => p.username !== lobby.host && !p.ready && !p.offline);
    if (notReady.length > 0) {
      alert("In attesa di: " + notReady.map(p => p.username).join(", "));
      return;
    }
    setLaunching(true);
    playSound("start");
    const result = await window.bradly.launchGame(gamePath);
    setLaunching(false);
    if (!result.ok) { alert("Errore: " + result.error); return; }
    socket.emit("start-game", { lobbyId: lobby.id, hostIP: "26.150.162.84" });
  };

  const closeLobby = () => {
    if (!confirm("Chiudere la lobby per tutti?")) return;
    socket.emit("close-lobby", { lobbyId: lobby.id });
    onLeave();
  };

  const kickPlayer = (target) => {
    if (!confirm("Espellere " + target + "?")) return;
    socket.emit("kick-player", { lobbyId: lobby.id, target });
  };

  const me = (lobby.players || []).find(p => p.username === user.username);
  const isHost = lobby.host === user.username;
  const onlinePlayers = (lobby.players || []).filter(p => !p.offline);
  const readyCount = onlinePlayers.filter(p => p.ready).length;
  const totalCount = onlinePlayers.length;

  return (
    <div className="main-layout">
      {showFileBrowser && (
        <FileBrowser
          title="Seleziona Stronghold.exe"
          onSelect={handleFileSelected}
          onCancel={() => setShowFileBrowser(false)}
        />
      )}

      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title" style={{ fontSize: 14, color: "#c49b4f", marginBottom: 8, fontFamily: "Cinzel, serif" }}>{lobby.name}</div>
          <div style={{ fontSize: 12, color: "#8b949e" }}>Host: {lobby.host}</div>
          <div style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>Pronti: {readyCount}/{totalCount}</div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">GIOCATORI ({totalCount}/{lobby.maxPlayers})</div>
          {(lobby.players || []).map((p, i) => (
            <div key={i} className={"player-row" + (p.offline ? " offline" : "")}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={"ready-dot " + (p.ready && !p.offline ? "ready" : "") + (p.offline ? " offline" : "")}></span>
                <span>
                  {p.username === user.username ? p.username + " (tu)" : p.username}
                  {p.offline ? " [OFFLINE]" : ""}
                  {p.username === lobby.host ? " [HOST]" : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {!p.offline && <span className={"ready-badge " + (p.ready ? "" : "not-ready-badge")}>
                  {p.ready ? "PRONTO" : "IN ATTESA"}
                </span>}
                {isHost && p.username !== user.username && (
                  <button
                    onClick={() => kickPlayer(p.username)}
                    title="Espelli"
                    style={{ background: "#7f1d1d", color: "#fecaca", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer", fontSize: 10 }}
                  >X</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!isHost && (
          <div className="sidebar-section">
            <button
              className={"btn-ready " + (me?.ready ? "is-ready" : "")}
              style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: "bold" }}
              onClick={toggleReady}
            >
              {me?.ready ? "PRONTO (clicca per annullare)" : "SONO PRONTO"}
            </button>
          </div>
        )}

        {isHost && (
          <>
            <div className="sidebar-section">
              <div className="sidebar-title">PERCORSO GIOCO</div>
              <div style={{ fontSize: 10, color: "#8b949e", wordBreak: "break-all", marginBottom: 8, fontFamily: "monospace" }}>{gamePath || "Non impostato"}</div>
              <button className="btn-secondary" style={{ width: "100%", fontSize: 11, marginBottom: 6 }} onClick={openFileBrowser}>
                Sfoglia file...
              </button>
            </div>
            <div className="sidebar-section">
              <button className="btn-primary" style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: "bold", marginBottom: 6 }} onClick={startGame} disabled={launching}>
                {launching ? "Avvio..." : "AVVIA PARTITA"}
              </button>
              <button
                onClick={closeLobby}
                style={{ width: "100%", padding: "10px", fontSize: 12, fontWeight: "bold", background: "#7f1d1d", color: "#fecaca", border: "1px solid #991b1b", borderRadius: 8, cursor: "pointer", fontFamily: "Cinzel, serif", letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                Chiudi Lobby
              </button>
            </div>
          </>
        )}

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLeave}>
            {isHost ? "Chiudi e Esci" : "Esci dalla lobby"}
          </button>
        </div>
      </div>
      <div className="content">
        <div className="topbar">
          <div className="topbar-title" style={{ fontFamily: "Cinzel, serif" }}>Chat Lobby</div>
          <div className="topbar-actions">
            <span style={{ fontSize: 12, color: "#8b949e" }}>{readyCount}/{totalCount} pronti</span>
          </div>
        </div>
        <div className="content-body" style={{ display: "flex", flexDirection: "column", padding: 0 }}>
          <div className="chat-messages">
            {(lobby.messages || []).map((m, i) => (
              <div key={i} className="chat-msg">
                <span className="chat-sender">{m.sender}:</span>
                <span>{m.text}</span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="chat-input-row">
            <input className="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Scrivi un messaggio..." />
            <button className="btn-primary" onClick={send}>Invia</button>
          </div>
        </div>
      </div>
    </div>
  );
}