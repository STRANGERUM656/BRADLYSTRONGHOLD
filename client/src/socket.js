import { io } from "socket.io-client";

const SERVER_URL = localStorage.getItem("bs_server_url") || "http://26.150.162.84:3000";

export const socket = io(SERVER_URL, { autoConnect: false });

export function connectSocket() {
  if (!socket.connected) socket.connect();
}

export function getServerUrl() {
  return localStorage.getItem("bs_server_url") || "http://26.150.162.84:3000";
}

export function setServerUrl(url) {
  localStorage.setItem("bs_server_url", url);
}
