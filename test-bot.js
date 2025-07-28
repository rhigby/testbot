const { io } = require("socket.io-client");
const fetch = require("node-fetch");

const SERVER_URL = "https://acrophobia-backend-2.onrender.com";
const ROOM = "room1";
const PASSWORD = "bot123";

const { getWordForLetter } = require("./themeLoader");

// Adjective and Noun word bank
const roomSettings = {
   Eighties: {
    displayName: "80's Theme",
    filterProfanity: true,
    theme: "eighties"
  },
   Ninties: {
    displayName: "90's Theme",
    filterProfanity: true,
    theme: "ninties"
  },
  CleanFun: {
    displayName: "Clean Fun",
    filterProfanity: true,
    theme: "general"
  },
  SportsArena: {
    displayName: "Sports Arena",
    filterProfanity: true,
    theme: "sports"
  },
   AnythingGoes: {
    displayName: "Anything Goes",
    filterProfanity: false,
    theme: "anything"
  },
    LateNight: {
    displayName: "Late Night",
    filterProfanity: false,
    theme: "anything"
  },
   TheCouch: {
    displayName: "The Couch",
    filterProfanity: false,
    theme: "anything"
  }
};

function getWordForLetter(letter, index) {
  const upper = letter.toUpperCase();
  const bank = wordBank[upper];

  if (!bank) return upper;

  const pool = index % 2 === 0 ? bank.adjectives : bank.nouns;
  return pool[Math.floor(Math.random() * pool.length)];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


function launchBot(username, roomName) {
  process.env.ROOM = roomName;
  runBot(username, roomName);
}

async function runBot(username) {
  let token;
  let currentAcronym = null;

  try {
    const loginRes = await fetch(`${SERVER_URL}/api/login-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: PASSWORD }),
    });
    const data = await loginRes.json();
    token = data.token;
  } catch {
    console.log(`[${username}] Login failed, registering instead`);
  }

  const socket = io(SERVER_URL, {
    auth: token ? { token } : {},
    transports: ["websocket"]
  });

  let canSubmit = false;
  let hasVoted = false;
  
  const settings = roomSettings[ROOM] || {};
  const currentTheme = settings.theme || "eighties";
  
  socket.on("connect", () => {
    console.log(`[${username}] Connected`);
    if (!token) {
      socket.emit("register", {
        username,
        email: `${username}@test.com`,
        password: PASSWORD
      }, async (res) => {
        if (res.success) {
          console.log(`[${username}] Registered`);
          const loginRes = await fetch(`${SERVER_URL}/api/login-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password: PASSWORD }),
          });
          const data = await loginRes.json();
          token = data.token;
          socket.auth = { token };
          socket.disconnect();
          socket.connect();
        } else {
          console.error(`[${username}] Registration failed: ${res.message}`);
        }
      });
    } else {
      socket.emit("join_room", { room: ROOM });
    }
  });

  socket.on("phase", (phase) => {
    canSubmit = phase === "submit" || phase === "faceoff_submit";
    hasVoted = false;
    console.log(`[${username}] Phase changed to: ${phase}`);
  });

  socket.on("acronym", (acronym) => {
    currentAcronym = acronym;
  });

  socket.on("acronym_ready", async () => {
    if (!canSubmit || !currentAcronym) return;
    const letters = currentAcronym.toUpperCase().split("");
    const words = letters.map((letter, index) => getWordForLetter(letter, index, currentTheme));
    const answer = words.join(" ");

    setTimeout(() => {
      socket.emit("submit_entry", { room: ROOM, text: answer });
      console.log(`[${username}] Submitted: ${answer} [from ${currentAcronym}]`);
      canSubmit = false;
    }, rand(1000, 3000));
  });

  socket.on("entries", (entries) => {
    if (hasVoted) return;
    const others = entries.filter(e => e.username !== username);
    if (others.length > 0) {
      const pick = others[Math.floor(Math.random() * others.length)];
      hasVoted = true;
      setTimeout(() => {
        socket.emit("vote_entry", { room: ROOM, entryId: pick.id });
        console.log(`[${username}] Voted for: ${pick.text}`);
      }, rand(1000, 3000));
    }
  });

  socket.on("disconnect", () => {
    console.log(`[${username}] Disconnected`);
  });
}

module.exports = { launchBot };






