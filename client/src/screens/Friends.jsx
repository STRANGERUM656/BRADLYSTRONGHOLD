import React, { useState, useEffect } from "react";
import { socket } from "../socket";
import { playSound } from "../sounds";

export default function Friends({ user, onBack }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    socket.emit("get-friends", user.username);
    socket.on("friends-update", (list) => setFriends(list));
    socket.on("friend-requests", (reqs) => setRequests(reqs));
    socket.on("friend-request-received", (req) => {
      setRequests(prev => [...prev, req]);
      playSound("friend");
    });
    socket.on("friend-accepted", (data) => {
      setMsg(data.by + " ha accettato la tua richiesta!");
      playSound("friend");
      socket.emit("get-friends", user.username);
      setTimeout(() => setMsg(""), 3000);
    });
    socket.on("search-results", (r) => setResults(r));
    socket.on("error-msg", (m) => { setMsg(m); playSound("error"); setTimeout(() => setMsg(""), 3000); });

    return () => {
      socket.off("friends-update");
      socket.off("friend-requests");
      socket.off("friend-request-received");
      socket.off("friend-accepted");
      socket.off("search-results");
      socket.off("error-msg");
    };
  }, [user.username]);

  const doSearch = () => {
    if (!search.trim()) return;
    socket.emit("search-users", search.trim());
  };

  const sendRequest = (target) => {
    socket.emit("send-friend-request", { from: user.username, to: target });
    setMsg("Richiesta inviata a " + target);
    playSound("friend");
    setTimeout(() => setMsg(""), 3000);
  };

  const acceptRequest = (from) => {
    socket.emit("accept-friend-request", { me: user.username, from });
    setRequests(prev => prev.filter(r => r.username !== from));
    playSound("join");
  };

  const rejectRequest = (from) => {
    socket.emit("reject-friend-request", { me: user.username, from });
    setRequests(prev => prev.filter(r => r.username !== from));
    playSound("click");
  };

  const removeFriend = (target) => {
    if (!confirm("Rimuovere " + target + " dagli amici?")) return;
    socket.emit("remove-friend", { me: user.username, target });
    playSound("leave");
  };

  return (
    <div className="main-layout">
      {msg && <div className="toast success">{msg}</div>}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title" style={{ fontSize: 14, color: "#4ade80" }}>AMICI</div>
        </div>
        <div className="sidebar-section">
          <button className="btn-secondary" style={{ width: "100%" }} onClick={onBack}>
            Indietro
          </button>
        </div>
      </div>
      <div className="content">
        <div className="topbar">
          <div className="topbar-title">Amici ({friends.length})</div>
        </div>
        <div className="content-body">
          <div style={{ marginBottom: 24 }}>
            <label className="auth-label">CERCA UTENTI</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="auth-input"
                style={{ marginBottom: 0, flex: 1 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch()}
                placeholder="Nome utente..."
              />
              <button className="btn-primary" onClick={doSearch}>Cerca</button>
            </div>
            {results.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {results.map((r, i) => (
                  <div key={i} className="friend-item" style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div className={"friend-dot " + (r.online ? "" : "offline")}></div>
                      <span>{r.username}</span>
                    </div>
                    <button className="btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => sendRequest(r.username)}>
                      Aggiungi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {requests.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <label className="auth-label">RICHIESTE DI AMICIZIA ({requests.length})</label>
              {requests.map((r, i) => (
                <div key={i} className="friend-item" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="friend-dot"></div>
                    <span>{r.username}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => acceptRequest(r.username)}>Accetta</button>
                    <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => rejectRequest(r.username)}>Rifiuta</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <label className="auth-label">I TUOI AMICI</label>
          {friends.length === 0 ? (
            <div className="empty-state">
              <div>Nessun amico ancora. Cerca qualcuno e aggiungilo!</div>
            </div>
          ) : (
            friends.map((f, i) => (
              <div key={i} className="friend-item" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div className={"friend-dot " + (f.online ? "" : "offline")}></div>
                  <span>{f.username}</span>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>{f.online ? "online" : "offline"}</span>
                </div>
                <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => removeFriend(f.username)}>
                  Rimuovi
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}