// src/games.js - Configurazione giochi Stronghold
export const GAMES = [
  {
    id: "stronghold-11",
    name: "Stronghold 1.1",
    icon: "🏰",
    year: "2001",
    defaultPath: "C:\\\\Users\\\\blafe\\\\Documents\\\\Stronghold.exe",
    description: "Stronghold originale - campagna e schermaglia"
  },
  {
    id: "stronghold-13",
    name: "Stronghold Crusader 1.3",
    icon: "⚔️",
    year: "2002",
    defaultPath: "C:\\\\Program Files (x86)\\\\Firefly Studios\\\\Stronghold Crusader\\\\Stronghold Crusader.exe",
    description: "Stronghold Crusader - Crociate"
  },
  {
    id: "stronghold-14",
    name: "Stronghold Crusader 1.4",
    icon: "🔥",
    year: "2008",
    defaultPath: "C:\\\\Users\\\\blafe\\\\OpenSHC\\\\_original\\\\Stronghold_Crusader_Extreme.exe",
    description: "Stronghold Crusader 1.4 - Extreme Edition"
  },
  {
    id: "stronghold-hd",
    name: "Stronghold HD",
    icon: "🌟",
    year: "2012",
    defaultPath: "",
    description: "Remaster HD del primo Stronghold"
  }
];

export function getGame(id) {
  return GAMES.find(g => g.id === id) || GAMES[0];
}

export function getGameName(id) {
  const g = getGame(id);
  return g.name;
}