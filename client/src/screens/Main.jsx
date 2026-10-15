import React, { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import LobbyRoom from "./LobbyRoom";
import Friends from "./Friends";
import FileBrowser from "./FileBrowser";
import { playSound, toggleSound, isSoundEnabled } from "../sounds";

const GAMES = [
  { id: "sc11", name: "Stronghold 1.1", icon: "1" },
  { id: "sc13", name: "Stronghold Crusader 1.3", icon: "2" },
  { id: "sc14", name: "Stronghold Crusader 1.4", icon: "3" },
  { id: "schd", name: "Stronghold HD", icon: "4" }
];

export default function Main({ user, onLogout }) {
  const [screen, setScreen] = useState("lobbies");
  const [lobbies, setLobbies] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [inLobby, setInLobby] = useState(null);
  const [toast, setToast] = useState(null);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [publicMessages, setPublicMessages] = useState([]);
  const [publicInput, setPublicInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeGameFilter, setActiveGameFilter] = useState("all");
  const [gamePath, setGamePath] = useState("");
  const publicEndRef = useRef(null);

  const [newName, setNewName] = useState("Lobby 1");
  const [newGame, setNewGame] = useState(GAMES[0].id);
  const [newMax, setNewMax] = useState(4);
  const [newPassword, setNewPassword] = useState("");

  // Carica percorso gioco salvato
  useEffect(() => {
    async function loadPath() {
      if (window.bradly && window.bradly.getGamePath) {
        const p = await window.bradly.getGamePath();
        setGamePath(p || "");
      }
    }
    loadPath();
  }, []);

  useEffect(() => {
    socket.on("connect", () => socket.emit("login", user.username));
    socket.on("lobbies", (list) => setLobbies(list));
    socket.on("online-users", setOnlineUsers);
    socket.on("lobby-joined", l => { setInLobby(l); playSound("join"); });
    socket.on("error-msg", msg => { showToast(msg, false); playSound("error"); });

    socket.on("public-chat-history", (msgs) => setPublicMessages(msgs));
    socket.on("public-chat-message", (msg) => {
      setPublicMessages(prev => [...prev, msg].slice(-200));
      playSound("message");
      if (screen !== "public") setUnreadCount(prev => prev + 1);
    });

    if (socket.connected) socket.emit("login", user.username);
    socket.emit("get-lobbies");

    return () => {
      socket.off("lobbies");
      socket.off("online-users");
      socket.off("lobby-joined");
      socket.off("error-msg");
      socket.off("public-chat-history");
      socket.off("public-chat-message");
    };
  }, [user.username]);

  useEffect(() => {
    if (publicEndRef.current) publicEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [publicMessages]);

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    playSound(ok ? "click" : "error");
    setTimeout(() => setToast(null), 3000);
  };

  const sendPublicMessage = () => {
    if (!publicInput.trim()) return;
    socket.emit("public-chat", { text: publicInput.trim() });
    setPublicInput("");
  };

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
    showToast("Percorso salvato!", true);
  };

  const createLobby = () => {
    if (!newName.trim()) { showToast("Inserisci un nome per la lobby", false); return; }
    socket.emit("create-lobby", {
      name: newName.trim(),
      game: newGame,
      maxPlayers: newMax,
      password: newPassword,
      username: user.username
    });
    setShowCreate(false);
    playSound("join");
  };

  const joinLobby = (id, hasPassword) => {
    let pwd = "";
    if (hasPassword) {
      pwd = prompt("Questa lobby richiede una password:");
      if (pwd === null) return;
    }
    socket.emit("join-lobby", { lobbyId: id, username: user.username, password: pwd });
  };

  const getGameName = (id) => (GAMES.find(g => g.id === id) || GAMES[0]).name;

  const handleToggleSound = () => {
    const newState = toggleSound();
    setSoundOn(newState);
    if (newState) playSound("click");
  };

  const filteredLobbies = activeGameFilter === "all" 
    ? lobbies 
    : lobbies.filter(l => l.game === activeGameFilter);

  if (inLobby) {
    return <LobbyRoom
      lobby={inLobby}
      user={user}
      onLeave={() => {
        socket.emit("leave-lobby", { lobbyId: inLobby.id, username: user.username });
        setInLobby(null);
        playSound("leave");
      }}
    />;
  }

  if (screen === "friends") {
    return <Friends user={user} onBack={() => setScreen("lobbies")} />;
  }

  return (
    <div className="main-layout">
      {toast && <div className={"toast " + (toast.ok ? "success" : "")}>{toast.msg}</div>}

      {showFileBrowser && (
        <FileBrowser
          title="Seleziona Stronghold.exe"
          onSelect={handleFileSelected}
          onCancel={() => setShowFileBrowser(false)}
        />
      )}

      {/* COLONNA SINISTRA */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user.avatar || "U"}</div>
            <div>
              <div className="sidebar-username">{user.username}</div>
              <div className="sidebar-status">Online</div>
            </div>
          </div>
        </div>

        {/* AZIONI RAPIDE: FILE + CREA LOBBY */}
        <div className="sidebar-section sidebar-actions">
          <button className="action-btn action-file" onClick={openFileBrowser}>
            <span className="action-icon">[+]</span>
            <span className="action-label">Sfoglia File</span>
            <span className="action-sub">Scegli .exe del gioco</span>
          </button>
          
          <button className="action-btn action-lobby" onClick={() => setShowCreate(true)}>
            <span className="action-icon">[L]</span>
            <span className="action-label">Crea Lobby</span>
            <span className="action-sub">Nuova partita multiplayer</span>
          </button>

          {gamePath && (
            <div className="game-path-info">
              <div className="game-path-label">GIOCO SELEZIONATO</div>
              <div className="game-path-value" title={gamePath}>
                {gamePath.split("\\").pop()}
              </div>
              <button className="game-path-change" onClick={openFileBrowser}>Cambia</button>
            </div>
          )}
        </div>

        {/* Filtro Giochi */}
        <div className="sidebar-section">
          <div className="sidebar-title">GIOCHI SUPPORTATI</div>
          <div className="game-filter-list">
            <div 
              className={"game-filter-item " + (activeGameFilter === "all" ? "active" : "")}
              onClick={() => setActiveGameFilter("all")}
            >
              <span>Tutti i giochi</span>
              <span className="game-count">{lobbies.length}</span>
            </div>
            {GAMES.map(g => {
              const count = lobbies.filter(l => l.game === g.id).length;
              return (
                <div 
                  key={g.id}
                  className={"game-filter-item " + (activeGameFilter === g.id ? "active" : "")}
                  onClick={() => setActiveGameFilter(g.id)}
                >
                  <span>{g.name}</span>
                  <span className="game-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">AMICI ONLINE ({onlineUsers.length})</div>
          {onlineUsers.slice(0, 10).map((u, i) => (
            <div key={i} className="friend-item">
              <div className="friend-dot"></div>
              <span>{u}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-section">
          <button className="btn-secondary" style={{ width: "100%", marginBottom: 8 }} onClick={() => setScreen("friends")}>
            Gestione Amici
          </button>
          <button className="btn-secondary" style={{ width: "100%", marginBottom: 8 }} onClick={handleToggleSound}>
            Suono: {soundOn ? "ON" : "OFF"}
          </button>
          {unreadCount > 0 && (
            <button className="btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={() => setUnreadCount(0)}>
              Chat ({unreadCount} nuovi)
            </button>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {/* COLONNA CENTRALE */}
      <div className="content">
        <div className="topbar">
          <div className="topbar-title">
            {activeGameFilter === "all" ? "Tutte le Lobby" : getGameName(activeGameFilter)}
            <span style={{ fontSize: 12, color: "#8b949e", marginLeft: 12 }}>({filteredLobbies.length})</span>
          </div>
          <div className="topbar-actions">
            <button className="btn-secondary" onClick={() => { socket.emit("get-lobbies"); playSound("click"); }}>Aggiorna</button>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Crea Lobby</button>
          </div>
        </div>
        <div className="content-body">
          {filteredLobbies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">-</div>
              <div>Nessuna lobby disponibile per questo gioco</div>
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>Crea la prima lobby</button>
              </div>
            </div>
          ) : (
            <div className="lobby-grid">
              {filteredLobbies.map(l => (
                <div key={l.id} className="lobby-card" onClick={() => joinLobby(l.id, l.hasPassword)}>
                  <div className="lobby-name">
                    {l.name} {l.hasPassword ? "[PASSWORD]" : ""}
                    {l.inGame ? <span style={{ color: "#f87171", fontSize: 11, marginLeft: 8 }}>IN CORSO</span> : null}
                  </div>
                  <div className="lobby-game">{getGameName(l.game)}</div>
                  <div className="lobby-meta">
                    <span>Host: {l.host}</span>
                    <span className="lobby-players">{l.players}/{l.maxPlayers}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="public-chat">
          <div className="public-chat-header">
            <span>CHAT GLOBALE</span>
            <span style={{ fontSize: 11, color: "#4ade80" }}>{onlineUsers.length} online</span>
          </div>
          <div className="public-chat-messages">
            {publicMessages.map((m, i) => (
              <div key={i} className={"public-msg" + (m.system ? " sys" : "")}>
                {m.system ? (
                  <span className="public-sys-text">-- {m.text} --</span>
                ) : (
                  <>
                    <span className="public-author">{m.sender}:</span>
                    <span className="public-text">{m.text}</span>
                  </>
                )}
              </div>
            ))}
            <div ref={publicEndRef} />
          </div>
          <div className="public-chat-input">
            <input
              value={publicInput}
              onChange={e => setPublicInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendPublicMessage()}
              placeholder="Scrivi nella chat globale..."
            />
            <button onClick={sendPublicMessage}>Invia</button>
          </div>
        </div>
      </div>

      {/* MODALE CREA LOBBY */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Crea Nuova Lobby</div>
            <label className="auth-label">GIOCO</label>
            <select className="auth-input" value={newGame} onChange={e => setNewGame(e.target.value)}>
              {GAMES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <label className="auth-label">NOME LOBBY</label>
            <input className="auth-input" value={newName} onChange={e => setNewName(e.target.value)} />
            <label className="auth-label">MAX GIOCATORI</label>
            <select className="auth-input" value={newMax} onChange={e => setNewMax(Number(e.target.value))}>
              {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <label className="auth-label">PASSWORD (OPZIONALE)</label>
            <input className="auth-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Lascia vuoto per pubblica" />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Annulla</button>
              <button className="btn-primary" onClick={createLobby}>Crea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}