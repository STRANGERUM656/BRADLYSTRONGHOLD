import React, { useState } from "react";
import { getServerUrl } from "../socket";

export default function Register({ onRegister, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const doRegister = async () => {
    if (!username.trim() || !password.trim()) { setError("Compila tutti i campi"); return; }
    if (password !== confirm) { setError("Le password non coincidono"); return; }
    if (password.length < 4) { setError("Password troppo corta (min 4 caratteri)"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(getServerUrl() + "/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Errore di registrazione"); setLoading(false); return; }
      const loginRes = await fetch(getServerUrl() + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const loginData = await loginRes.json();
      localStorage.setItem("bs_user", JSON.stringify(loginData.user));
      onRegister(loginData.user);
    } catch (e) {
      setError("Server non raggiungibile");
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">🎮</div>
        <div className="auth-title">Crea Account</div>
        <div className="auth-subtitle">Unisciti a BradlyStronghold</div>
        {error && <div className="auth-error">{error}</div>}
        <label className="auth-label">USERNAME</label>
        <input className="auth-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Scegli un username" />
        <label className="auth-label">PASSWORD</label>
        <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Scegli una password" />
        <label className="auth-label">CONFERMA</label>
        <input className="auth-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Ripeti la password" />
        <button className="auth-button" onClick={doRegister} disabled={loading}>{loading ? "Creazione..." : "Crea Account"}</button>
        <div className="auth-link">Hai già un account? <a onClick={onBack}>Accedi</a></div>
      </div>
    </div>
  );
}
