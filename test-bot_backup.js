// test-bot.js
const { io } = require("socket.io-client");
const axios = require("axios");

const BACKEND_URL = "https://acrophobia-backend-2.onrender.com";
const ROOM = "room2";
const PASSWORD = "bot123";

async function runBot(username) {
  let token;
  try {
    const loginRes = await axios.post(`${BACKEND_URL}/api/login-token`, {
      username,
      password: PASSWORD
    });
    token = loginRes.data.token;
  } catch (err) {
    console.log(`[${username}] Login failed, will register via socket`);
  }

  const socket = io(BACKEND_URL, {
    auth: token ? { token } : {},
    transports: ["websocket"]
  });

  let canSubmit = false;
	let votePhaseActive = false;
	let hasVoted = false;
	let votedEntryId = null;
	let latestEntries = [];

  socket.on("connect", () => {
    console.log(`[${username}] Connected via socket`);

    if (!token) {
      socket.emit(
        "register",
        {
          username,
          email: `${username}@test.com`,
          password: PASSWORD
        },
        async (res) => {
          if (res.success) {
            console.log(`[${username}] Registered successfully`);
            const loginRes = await axios.post(`${BACKEND_URL}/api/login-token`, {
              username,
              password: PASSWORD
            });
            token = loginRes.data.token;
            socket.auth = { token };
            socket.disconnect();
            socket.connect();
          } else {
            console.error(`[${username}] Registration failed:`, res.message);
          }
        }
      );
    } else {
      socket.emit("join_room", { room: ROOM, username });
    }
  });

  socket.on("phase", (newPhase) => {
  console.log(`[${username}] Phase changed to: ${newPhase}`);

  canSubmit = newPhase === "submit" || newPhase === "faceoff_submit";
  votePhaseActive = newPhase === "vote" || newPhase === "faceoff_vote";

  if (votePhaseActive) {
    hasVoted = false;
    votedEntryId = null;
    tryVote(); // ✅ attempt to vote if entries already arrived
  }
});

let currentAcronym = null;

socket.on("acronym", (acronym) => {
  if (!acronym || acronym.length < 1) return;

  const upperAcronym = acronym.toUpperCase();
  if (!/^[A-Z]+$/.test(upperAcronym)) {
    console.warn(`[${username}] Invalid acronym: ${acronym}`);
    return;
  }

  currentAcronym = upperAcronym;
});

socket.on("acronym_ready", () => {
  if (!canSubmit || !currentAcronym) return;

  const answer = currentAcronym
    .split("")
    .map(letter => randomWord(letter))
    .join(" ");

  canSubmit = false;

  setTimeout(() => {
    socket.emit("submit_entry", { room: ROOM, text: answer });
    console.log(`[${username}] Submitted: ${answer} [from ${currentAcronym}]`);
  }, rand(1000, 3000));
});



  socket.on("entries", (entries) => {
  latestEntries = entries;
  tryVote(); // try voting if in vote phase
});

function tryVote() {
  if (!votePhaseActive || hasVoted || !latestEntries.length) return;

  const voteable = latestEntries.filter(e => e.username !== username);
  if (voteable.length === 0) return;

  const choice = voteable[Math.floor(Math.random() * voteable.length)];
  hasVoted = true;
  votedEntryId = choice.id;

  setTimeout(() => {
    socket.emit("vote_entry", { room: ROOM, entryId: choice.id });
    console.log(`[${username}] Voted for: ${choice.text}`);
  }, rand(1000, 3000));
}

socket.on("disconnect", () => {
  console.log(`[${username}] Disconnected`);

  // Attempt reconnect with backoff
  setTimeout(() => {
    console.log(`[${username}] Attempting reconnect...`);
    runBot(username); // Recursively restart bot logic
  }, rand(3000, 5000)); // Add jitter to prevent all bots reconnecting at once
});
}

function randomWord(letter) {
  const wordList = {
    A: ["Awesome", "Angry", "Ancient", "Agile", "Awkward", "Adorable"],
    B: ["Brave", "Big", "Bouncy", "Bold", "Bizarre", "Bright"],
    C: ["Cool", "Clever", "Crazy", "Creative", "Charming", "Curious"],
    D: ["Dizzy", "Daring", "Dusty", "Dramatic", "Determined", "Dull"],
    E: ["Epic", "Eager", "Eerie", "Energetic", "Eccentric", "Elegant"],
    F: ["Funky", "Fierce", "Fast", "Flaky", "Fearless", "Friendly"],
    G: ["Grumpy", "Gentle", "Golden", "Goofy", "Gigantic", "Gallant"],
    H: ["Happy", "Hungry", "Heroic", "Hilarious", "Hopeful", "Hot"],
    I: ["Icy", "Incredible", "Intense", "Invisible", "Idealistic", "Illusive"],
    J: ["Jumpy", "Jolly", "Jagged", "Joyful", "Juicy", "Jealous"],
    K: ["Kind", "Kooky", "Keen", "Klutzy", "Knockout", "Knowledgeable"],
    L: ["Loud", "Lazy", "Loyal", "Lucky", "Lively", "Loopy"],
    M: ["Moody", "Mighty", "Magic", "Mad", "Massive", "Mysterious"],
    N: ["Nifty", "Noisy", "Nervous", "Noble", "Nutty", "Nasty"],
    O: ["Odd", "Old", "Open", "Outgoing", "Obnoxious", "Optimistic"],
    P: ["Proud", "Playful", "Pink", "Powerful", "Puzzled", "Prickly"],
    Q: ["Quick", "Quiet", "Quirky", "Quaint", "Queasy", "Quizzical"],
    R: ["Rough", "Rapid", "Radical", "Ruthless", "Rusty", "Rowdy"],
    S: ["Silly", "Sharp", "Sneaky", "Spunky", "Sleepy", "Savage"],
    T: ["Tough", "Tiny", "Tired", "Tenacious", "Tricky", "Terrific"],
    U: ["Ugly", "Unique", "Untamed", "Unreal", "Upset", "Unlucky"],
    V: ["Vast", "Vivid", "Valiant", "Vain", "Velvety", "Violent"],
    W: ["Wild", "Witty", "Wobbly", "Weird", "Wacky", "Wise"],
    X: ["Xeno", "Xenial", "Xtreme", "Xenophobic", "Xyloid", "X-rated"],
    Y: ["Young", "Yellow", "Yawning", "Yearning", "Yummy", "Yappy"],
    Z: ["Zany", "Zesty", "Zealous", "Zippy", "Zombie", "Zigzag"]
  };

  const upper = letter.toUpperCase();
  const options = wordList[upper];

  if (!options) return "Mystery";
  return options[Math.floor(Math.random() * options.length)];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Launch bots
runBot("Bot1");
runBot("Bot2");
runBot("Bot3");
runBot("Bot4");

