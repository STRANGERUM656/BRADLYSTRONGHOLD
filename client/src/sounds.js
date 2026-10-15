// src/sounds.js - Sistema audio
const sounds = {
  click: new Audio("./sounds/click.wav"),
  join: new Audio("./sounds/join.wav"),
  leave: new Audio("./sounds/leave.wav"),
  message: new Audio("./sounds/message.wav"),
  friend: new Audio("./sounds/friend.wav"),
  start: new Audio("./sounds/start.wav"),
  error: new Audio("./sounds/error.wav")
};

Object.values(sounds).forEach(a => { a.volume = 0.3; });

let enabled = localStorage.getItem("bs_sound_enabled") !== "false";

export function playSound(name) {
  if (!enabled) return;
  const audio = sounds[name];
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {}
}

export function toggleSound() {
  enabled = !enabled;
  localStorage.setItem("bs_sound_enabled", enabled);
  return enabled;
}

export function isSoundEnabled() {
  return enabled;
}