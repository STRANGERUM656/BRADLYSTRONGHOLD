import React, { useState, useEffect } from "react";
import Login from "./screens/Login";
import Register from "./screens/Register";
import Main from "./screens/Main";
import { socket, connectSocket, setServerUrl } from "./socket";

const DEFAULT_SERVER = "http://26.150.162.84:3000";

export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Imposta URL server di default se non presente
    if (!localStorage.getItem("bs_server_url")) {
      setServerUrl(DEFAULT_SERVER);
    }
    // Connessione automatica al server
    connectSocket();

    // Auto-login se già loggato
    const saved = localStorage.getItem("bs_user");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
        setScreen("main");
      } catch (e) {
        localStorage.removeItem("bs_user");
      }
    }
  }, []);

  return (
    <div className="app">
      {screen === "login" && (
        <Login
          onLogin={(u) => { setUser(u); setScreen("main"); }}
          onRegister={() => setScreen("register")}
        />
      )}
      {screen === "register" && (
        <Register
          onRegister={(u) => { setUser(u); setScreen("main"); }}
          onBack={() => setScreen("login")}
        />
      )}
      {screen === "main" && (
        <Main
          user={user}
          onLogout={() => {
            setUser(null);
            localStorage.removeItem("bs_user");
            setScreen("login");
          }}
        />
      )}
    </div>
  );
}