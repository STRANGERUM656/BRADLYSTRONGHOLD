const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ============ STORAGE ============
const users = {};
const lobbies = {};
const onlineUsers = {};
const userSockets = {};
const publicChat = [];

// Timeout per giocatori offline (2 minuti di grazia)
const OFFLINE_GRACE_MS = 120000;

// ============ REST ============
app.get("/", (req, res) => res.json({
  status: "ok",
  users: Object.keys(users).length,
  lobbies: Object.keys(lobbies).length,
  online: Object.keys(onlineUsers).length,
  publicMessages: publicChat.length
}));

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Campi mancanti" });
  if (users[username]) return res.status(400).json({ error: "Username gia' esistente" });
  const hash = await bcrypt.hash(password, 10);
  users[username] = {
    id: uuidv4(),
    username,
    password: hash,
    avatar: username.charAt(0).toUpperCase(),
    friends: [],
    friendRequests: [],
    createdAt: Date.now()
  };
  console.log("[REGISTER]", username);
  res.json({ ok: true, user: { id: users[username].id, username } });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user) return res.status(400).json({ error: "Utente non trovato" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "Password errata" });
  console.log("[LOGIN]", username);
  res.json({
    ok: true,
    user: { id: user.id, username: user.username, avatar: user.avatar, friends: user.friends }
  });
});

// ============ SOCKET.IO ============
io.on("connection", (socket) => {
  console.log("[CONNECT]", socket.id);

  // ============ LOGIN ============
  socket.on("login", (username) => {
    if (!users[username]) return;
    onlineUsers[socket.id] = username;
    userSockets[username] = socket.id;
    socket.username = username;
    socket.join("global");
    
    // Riconnetti alle lobby dove era presente
    Object.values(lobbies).forEach(lobby => {
      const player = lobby.players.find(p => p.username === username);
      if (player) {
        player.offline = false;
        player.offlineAt = null;
        socket.join("lobby-" + lobby.id);
        io.to("lobby-" + lobby.id).emit("lobby-update", lobby);
        console.log("[RECONNECT]", username, "->", lobby.name);
      }
    });
    
    io.emit("online-users", Object.values(onlineUsers));
    socket.emit("public-chat-history", publicChat.slice(-50));
    socket.emit("friend-requests", users[username].friendRequests.map(uname => {
      const u = users[uname];
      return u ? { username: u.username, avatar: u.avatar } : null;
    }).filter(Boolean));
    broadcastLobbies();
    console.log("[ONLINE]", username);
  });

  // ============ CHAT PUBBLICA ============
  socket.on("public-chat", (data) => {
    if (!socket.username) return;
    const msg = {
      sender: socket.username,
      avatar: users[socket.username] ? users[socket.username].avatar : "?",
      text: data.text,
      time: Date.now()
    };
    publicChat.push(msg);
    if (publicChat.length > 200) publicChat = publicChat.slice(-200);
    io.emit("public-chat-message", msg);
  });

  // ============ LOBBY ============
  function broadcastLobbies() {
    const list = Object.values(lobbies).map(l => ({
      id: l.id,
      name: l.name,
      game: l.game,
      host: l.host,
      players: l.players.filter(p => !p.offline).length,
      totalPlayers: l.players.length,
      maxPlayers: l.maxPlayers,
      hasPassword: !!l.password,
      inGame: l.inGame || false,
      createdAt: l.createdAt
    }));
    io.emit("lobbies", list);
  }

  socket.on("get-lobbies", broadcastLobbies);

  socket.on("create-lobby", (data) => {
    const id = uuidv4().slice(0, 8);
    lobbies[id] = {
      id,
      name: data.name,
      game: data.game,
      host: data.username,
      players: [{ username: data.username, ready: true, offline: false, isHost: true }],
      maxPlayers: data.maxPlayers,
      password: data.password || null,
      messages: [],
      inGame: false,
      createdAt: Date.now()
    };
    socket.join("lobby-" + id);
    socket.emit("lobby-joined", lobbies[id]);
    broadcastLobbies();
    io.emit("public-chat-message", {
      sender: "SYSTEM",
      avatar: "S",
      text: data.username + " ha creato la lobby '" + data.name + "' (" + data.game + ")",
      time: Date.now(),
      system: true
    });
    console.log("[CREATE LOBBY]", data.name, "by", data.username);
  });

  // CHIUSURA MANUALE (solo host)
  socket.on("close-lobby", (data) => {
    const lobby = lobbies[data.lobbyId];
    if (!lobby) return;
    if (lobby.host !== socket.username) return socket.emit("error-msg", "Solo l'host puo' chiudere la lobby");
    
    io.to("lobby-" + data.lobbyId).emit("lobby-closed", { reason: "L'host ha chiuso la lobby" });
    io.emit("public-chat-message", {
      sender: "SYSTEM",
      avatar: "S",
      text: "Lobby '" + lobby.name + "' chiusa dall'host",
      time: Date.now(),
      system: true
    });
    delete lobbies[data.lobbyId];
    broadcastLobbies();
    console.log("[CLOSE LOBBY]", data.lobbyId);
  });

  socket.on("join-lobby", (data) => {
    const lobby = lobbies[data.lobbyId];
    if (!lobby) return socket.emit("error-msg", "Lobby non trovata");
    if (lobby.password && lobby.password !== data.password) return socket.emit("error-msg", "Password errata");
    if (lobby.players.filter(p => !p.offline).length >= lobby.maxPlayers) return socket.emit("error-msg", "Lobby piena");
    if (lobby.inGame) return socket.emit("error-msg", "Partita in corso");
    
    const existing = lobby.players.find(p => p.username === data.username);
    if (existing) {
      // Riconnessione
      existing.offline = false;
      existing.offlineAt = null;
    } else {
      lobby.players.push({ username: data.username, ready: false, offline: false });
    }
    
    socket.join("lobby-" + data.lobbyId);
    io.to("lobby-" + data.lobbyId).emit("lobby-update", lobby);
    socket.emit("lobby-joined", lobby);
    broadcastLobbies();
    console.log("[JOIN]", data.username, "->", lobby.name);
  });

  socket.on("leave-lobby", (data) => {
    const lobby = lobbies[data.lobbyId];
    if (!lobby) return;
    
    // Se è l'host che esce volontariamente, chiudi la lobby
    if (lobby.host === data.username) {
      io.to("lobby-" + data.lobbyId).emit("lobby-closed", { reason: "L'host ha lasciato la lobby" });
      delete lobbies[data.lobbyId];
      socket.leave("lobby-" + data.lobbyId);
      broadcastLobbies();
      console.log("[HOST LEFT - LOBBY CLOSED]", data.lobbyId);
      return;
    }
    
    lobby.players = lobby.players.filter(p => p.username !== data.username);
    socket.leave("lobby-" + data.lobbyId);
    if (lobby.players.length === 0) {
      delete lobbies[data.lobbyId];
    } else {
      io.to("lobby-" + data.lobbyId).emit("lobby-update", lobby);
    }
    broadcastLobbies();
  });

  socket.on("chat-message", (data) => {
    const lobby = lobbies[data.lobbyId];
    if (!lobby) return;
    const msg = { sender: data.username, text: data.text, time: Date.now() };
    lobby.messages.push(msg);
    if (lobby.messages.length > 200) lobby.messages = lobby.messages.slice(-200);
    io.to("lobby-" + data.lobbyId).emit("chat-message", msg);
  });

  socket.on("toggle-ready", (data) => {
    const lobby = lobbies[data.lobbyId];
    if (!lobby) return;
    const p = lobby.players.find(p => p.username === data.username);
    if (p) p.ready = !p.ready;
    io.to("lobby-" + data.lobbyId).emit("lobby-update", lobby);
    broadcastLobbies();
  });

  socket.on("start-game", (data) => {
    const lobby = lobbies[data.lobbyId];
    if (!lobby || lobby.host !== socket.username) return;
    const notReady = lobby.players.filter(p => p.username !== lobby.host && !p.ready && !p.offline);
    if (notReady.length > 0) {
      return socket.emit("error-msg", "Giocatori non pronti: " + notReady.map(p => p.username).join(", "));
    }
    lobby.inGame = true;
    io.to("lobby-" + data.lobbyId).emit("lobby-start", { hostIP: data.hostIP });
    broadcastLobbies();
    console.log("[START]", lobby.name);
  });

  socket.on("kick-player", (data) => {
    const lobby = lobbies[data.lobbyId];
    if (!lobby || lobby.host !== socket.username) return;
    if (data.target === socket.username) return;
    lobby.players = lobby.players.filter(p => p.username !== data.target);
    const targetSocket = userSockets[data.target];
    if (targetSocket) {
      io.to(targetSocket).emit("kicked", { lobbyId: data.lobbyId, reason: "Sei stato espulso" });
    }
    io.to("lobby-" + data.lobbyId).emit("lobby-update", lobby);
    broadcastLobbies();
  });

  // ============ AMICI ============
  socket.on("send-friend-request", (data) => {
    const { from, to } = data;
    if (from === to) return socket.emit("error-msg", "Non puoi aggiungere te stesso");
    if (!users[to]) return socket.emit("error-msg", "Utente non trovato");
    if (!users[from]) return socket.emit("error-msg", "Devi prima fare login");
    if (users[from].friends.includes(to)) return socket.emit("error-msg", "Siete gia' amici");
    if (users[to].friendRequests.includes(from)) return socket.emit("error-msg", "Richiesta gia' inviata");
    users[to].friendRequests.push(from);
    const toSocketId = userSockets[to];
    if (toSocketId) {
      io.to(toSocketId).emit("friend-request-received", { username: from, avatar: users[from].avatar });
    }
    socket.emit("friend-request-sent", { to });
  });

  socket.on("accept-friend-request", (data) => {
    const { me, from } = data;
    if (!users[me] || !users[from]) return;
    users[me].friendRequests = users[me].friendRequests.filter(u => u !== from);
    if (!users[me].friends.includes(from)) users[me].friends.push(from);
    if (!users[from].friends.includes(me)) users[from].friends.push(me);
    socket.emit("friends-update", users[me].friends.map(u => ({
      username: u, avatar: users[u] ? users[u].avatar : "?", online: Object.values(onlineUsers).includes(u)
    })));
    const fromSocketId = userSockets[from];
    if (fromSocketId) {
      io.to(fromSocketId).emit("friends-update", users[from].friends.map(u => ({
        username: u, avatar: users[u] ? users[u].avatar : "?", online: Object.values(onlineUsers).includes(u)
      })));
      io.to(fromSocketId).emit("friend-accepted", { by: me });
    }
  });

  socket.on("reject-friend-request", (data) => {
    const { me, from } = data;
    if (!users[me]) return;
    users[me].friendRequests = users[me].friendRequests.filter(u => u !== from);
  });

  socket.on("get-friends", (username) => {
    const user = users[username];
    if (!user) return;
    socket.emit("friends-update", user.friends.map(uname => ({
      username: uname, avatar: users[uname] ? users[uname].avatar : "?", online: Object.values(onlineUsers).includes(uname)
    })));
  });

  socket.on("search-users", (query) => {
    const q = (query || "").toLowerCase();
    const results = Object.values(users)
      .filter(u => u.username.toLowerCase().includes(q))
      .filter(u => u.username !== socket.username)
      .slice(0, 10)
      .map(u => ({
        username: u.username, avatar: u.avatar, online: Object.values(onlineUsers).includes(u.username)
      }));
    socket.emit("search-results", results);
  });

  socket.on("remove-friend", (data) => {
    const { me, target } = data;
    if (!users[me] || !users[target]) return;
    users[me].friends = users[me].friends.filter(u => u !== target);
    users[target].friends = users[target].friends.filter(u => u !== me);
    socket.emit("friends-update", users[me].friends.map(u => ({
      username: u, avatar: users[u] ? users[u].avatar : "?", online: Object.values(onlineUsers).includes(u)
    })));
    const targetSocket = userSockets[target];
    if (targetSocket) {
      io.to(targetSocket).emit("friends-update", users[target].friends.map(u => ({
        username: u, avatar: users[u] ? users[u].avatar : "?", online: Object.values(onlineUsers).includes(u)
      })));
    }
  });

  // ============ DISCONNECT CON GRACE PERIOD ============
  socket.on("disconnect", () => {
    const username = onlineUsers[socket.id];
    delete onlineUsers[socket.id];
    if (username && userSockets[username] === socket.id) delete userSockets[username];
    
    // NON rimuovere il giocatore dalla lobby - marcalo solo come offline
    Object.values(lobbies).forEach(lobby => {
      const player = lobby.players.find(p => p.username === username);
      if (player) {
        player.offline = true;
        player.offlineAt = Date.now();
        io.to("lobby-" + lobby.id).emit("lobby-update", lobby);
        console.log("[OFFLINE IN LOBBY]", username, "->", lobby.name);
        
        // Programma la rimozione dopo 2 minuti di inattività
        setTimeout(() => {
          const l = lobbies[lobby.id];
          if (!l) return;
          const p = l.players.find(p => p.username === username);
          if (p && p.offline && (Date.now() - p.offlineAt) >= OFFLINE_GRACE_MS) {
            l.players = l.players.filter(x => x.username !== username);
            if (l.players.length === 0) {
              delete lobbies[l.id];
              console.log("[LOBBY DELETED - EMPTY]", l.id);
            } else {
              if (l.host === username) {
                const newHost = l.players.find(x => !x.offline) || l.players[0];
                l.host = newHost.username;
                l.players.forEach(x => x.isHost = x.username === l.host);
                newHost.ready = true;
              }
              io.to("lobby-" + l.id).emit("lobby-update", l);
            }
            broadcastLobbies();
          }
        }, OFFLINE_GRACE_MS + 1000);
      }
    });
    
    io.emit("online-users", Object.values(onlineUsers));
    broadcastLobbies();
    console.log("[DISCONNECT]", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("============================================");
  console.log("  BRADLYSTRONGHOLD SERVER v6.1.0");
  console.log("  http://0.0.0.0:" + PORT);
  console.log("  Lobby PERSISTENTI + Grace Period 2min");
  console.log("============================================");
});