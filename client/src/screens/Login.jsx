import React, { useState } from "react";
import { getServerUrl } from "../socket";

export default function Login({ onLogin, onRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    if (!username.trim() || !password.trim()) { setError("Compila tutti i campi"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(getServerUrl() + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Errore di login"); setLoading(false); return; }
      localStorage.setItem("bs_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) {
      setError("Server non raggiungibile. Contatta l'host o avvia il server.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">🏰</div>
        <div className="auth-title">BradlyStronghold</div>
        <div className="auth-subtitle">Accedi per hostare o unirti a partite</div>
        {error && <div className="auth-error">{error}</div>}
        <label className="auth-label">USERNAME</label>
        <input
          className="auth-input"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doLogin()}
          placeholder="Inserisci username"
        />
        <label className="auth-label">PASSWORD</label>
        <input
          className="auth-input"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doLogin()}
          placeholder="Inserisci password"
        />
        <button className="auth-button" onClick={doLogin} disabled={loading}>
          {loading ? "Accesso..." : "Accedi"}
        </button>
        <div className="auth-link">
          Non hai un account? <a onClick={onRegister}>Registrati</a>
        </div>
      </div>
    </div>
  );
}