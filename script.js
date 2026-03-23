// Game state
let gameRunning = false;
let dropMaker;
let timerInterval;
let score = 0;
let timeLeft = 30;
let collisionFrame;
let currentMode = "easy";
let hasReachedTarget = false;

const gameContainer   = document.getElementById("game-container");
const dropLayer       = document.getElementById("drop-layer");
const collectorPointer = document.getElementById("collector-pointer");
const scoreDisplay    = document.getElementById("score");
const timeDisplay     = document.getElementById("time");
const modeSelect      = document.getElementById("mode-select");
const goalScoreDisplay = document.getElementById("goal-score");
const milestoneMessage = document.getElementById("milestone-message");
const gameOverScreen  = document.getElementById("game-over");
const gameOverMessage = document.getElementById("game-over-message");

const CONFETTI_COLORS = ["#FFC907", "#2E9DF7", "#4FCB53", "#FF902A", "#F5402C", "#F16061"];
const SOUND_BY_TYPE = {
  good: "Audio/chrisiex1-correct-156911.mp3",
  bad: "Audio/freesound_community-wronganswer-37702.mp3",
  win: "Audio/superpuyofans1234-winner-game-sound-404167.mp3",
  lose: "Audio/freesound_community-negative_beeps-6008.mp3",
};

const SOUND_VOLUME_BY_TYPE = {
  good: 0.45,
  bad: 0.5,
  win: 0.55,
  lose: 0.5,
};

const MODE_SETTINGS = {
  easy: {
    timeLimit: 30,
    targetScore: 20,
    spawnIntervalMs: 1000,
    badDropPenaltyMultiplier: 1,
    speedMode: "fixed",
    fixedDropDuration: 4,
  },
  normal: {
    timeLimit: 30,
    targetScore: 30,
    spawnIntervalMs: 600,
    badDropPenaltyMultiplier: 1,
    speedMode: "size-based",
    fastestDropDuration: 2.4,
    slowestDropDuration: 4.4,
  },
  hard: {
    timeLimit: 25,
    targetScore: 60,
    spawnIntervalMs: 400,
    badDropPenaltyMultiplier: 3,
    speedMode: "size-based",
    fastestDropDuration: 0.8,
    slowestDropDuration: 1.8,
  },
};

let pointerActive = false;
let pointerX = 0;
let pointerY = 0;

// Responsive base drop size: scales with viewport, clamped 30–60px
function getBaseSize() {
  return Math.min(Math.max(window.innerWidth * 0.05, 30), 60);
}

// Maps a pixel size to a whole number 1–5 (larger = higher rank)
function sizeToRank(size, minSize, maxSize) {
  return Math.round(1 + ((size - minSize) / (maxSize - minSize)) * 4);
}

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("play-again-btn").addEventListener("click", startGame);
document.getElementById("reset-btn").addEventListener("click", resetGame);
modeSelect.addEventListener("change", onModeChange);
gameContainer.addEventListener("mousemove", onMouseMove);
gameContainer.addEventListener("mouseenter", onMouseEnter);
gameContainer.addEventListener("mouseleave", onMouseLeave);
gameContainer.addEventListener("touchstart", onTouchTrack, { passive: false });
gameContainer.addEventListener("touchmove", onTouchTrack, { passive: false });

refreshModeUi();
collisionLoop();

function getCurrentModeSettings() {
  return MODE_SETTINGS[currentMode];
}

function refreshModeUi() {
  const settings = getCurrentModeSettings();
  goalScoreDisplay.textContent = settings.targetScore;
  setMilestoneMessage(`Reach ${settings.targetScore} points to win.`, "");
  if (!gameRunning) {
    timeDisplay.textContent = settings.timeLimit;
  }
}

function setMilestoneMessage(text, state) {
  milestoneMessage.textContent = text;
  milestoneMessage.classList.remove("success", "warning");
  if (state) milestoneMessage.classList.add(state);
}

function playCollectSound(soundType) {
  const filePath = SOUND_BY_TYPE[soundType];
  if (!filePath) {
    throw new Error("playCollectSound requires a soundType of 'good', 'bad', 'win', or 'lose'.");
  }

  const audio = new Audio(filePath);
  audio.preload = "auto";
  audio.volume = SOUND_VOLUME_BY_TYPE[soundType] ?? 0.5;
  audio.play().catch(() => {});
}

function onModeChange(event) {
  currentMode = event.target.value;
  resetGame();
}

function getDropDuration(size, minSize, maxSize) {
  const settings = getCurrentModeSettings();
  if (settings.speedMode === "fixed") {
    return settings.fixedDropDuration;
  }

  const sizeRatio = (size - minSize) / (maxSize - minSize);
  return settings.fastestDropDuration + (settings.slowestDropDuration - settings.fastestDropDuration) * sizeRatio;
}

function startGame() {
  const settings = getCurrentModeSettings();
  gameRunning = true;
  hasReachedTarget = false;
  score = 0;
  timeLeft = settings.timeLimit;
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeLeft;
  goalScoreDisplay.textContent = settings.targetScore;
  setMilestoneMessage(`Reach ${settings.targetScore} points to win.`, "");

  clearInterval(dropMaker);
  clearInterval(timerInterval);
  dropLayer.innerHTML = "";
  if (collisionFrame) cancelAnimationFrame(collisionFrame);
  gameOverScreen.querySelectorAll(".confetti-piece").forEach(el => el.remove());
  gameOverScreen.className = "game-over-screen hidden";

  dropMaker     = setInterval(createDrop, settings.spawnIntervalMs);
  timerInterval = setInterval(tickTimer, 1000);
  collisionLoop();
}

function resetGame() {
  const settings = getCurrentModeSettings();
  gameRunning = false;
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  if (collisionFrame) cancelAnimationFrame(collisionFrame);
  score = 0;
  hasReachedTarget = false;
  timeLeft = settings.timeLimit;
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeLeft;
  goalScoreDisplay.textContent = settings.targetScore;
  setMilestoneMessage(`Reach ${settings.targetScore} points to win.`, "");
  dropLayer.innerHTML = "";
  gameOverScreen.querySelectorAll(".confetti-piece").forEach(el => el.remove());
  gameOverScreen.className = "game-over-screen hidden";
  pointerActive = false;
  collectorPointer.classList.add("hidden");
}

function tickTimer() {
  timeLeft--;
  timeDisplay.textContent = timeLeft;
  if (timeLeft <= 0) endGame();
}

function endGame() {
  const settings = getCurrentModeSettings();
  gameRunning = false;
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  if (collisionFrame) cancelAnimationFrame(collisionFrame);
  dropLayer.innerHTML = "";

  const won = score >= settings.targetScore;
  gameOverMessage.textContent = won
    ? `Congratulations! You scored ${score} points!\nClean water for everyone! 🎉`
    : `You scored ${score} points. You need ${settings.targetScore} or more to win — try again!`;

  gameOverScreen.className = won ? "game-over-screen win" : "game-over-screen lose";

  if (won) {
    spawnConfetti();
    setTimeout(() => playCollectSound("win"), 200);
  } else {
    playCollectSound("lose");
  }
}

function createDrop() {
  if (!gameRunning) return;

  const BASE     = getBaseSize();
  const MIN_SIZE = BASE * 0.5;
  const MAX_SIZE = BASE * 1.3;

  const drop = document.createElement("div");
  const size = BASE * (Math.random() * 0.8 + 0.5);
  drop.style.width = drop.style.height = `${size}px`;

  const isBad = Math.random() < 0.3;
  drop.className = isBad ? "water-drop bad-drop" : "water-drop";
  drop.dataset.isBad = isBad ? "1" : "0";
  const rank = sizeToRank(size, MIN_SIZE, MAX_SIZE);

  const gameWidth = dropLayer.offsetWidth;
  drop.style.left = `${Math.random() * Math.max(gameWidth - size, 0)}px`;
  drop.style.animationDuration = `${getDropDuration(size, MIN_SIZE, MAX_SIZE)}s`;
  drop.style.setProperty("--drop-distance", `${gameContainer.offsetHeight + 40}px`);
  drop.dataset.rank = String(rank);

  drop.addEventListener("animationend", () => drop.remove());
  dropLayer.appendChild(drop);
}

function collectDrop(drop) {
  if (!gameRunning || !drop.isConnected) return;

  const settings = getCurrentModeSettings();
  const rank = parseInt(drop.dataset.rank || "1", 10);
  const isBad = drop.dataset.isBad === "1";

  if (isBad) {
    const penalty = rank * settings.badDropPenaltyMultiplier;
    score = Math.max(0, score - penalty);
    playCollectSound("bad");
  } else {
    score += (6 - rank);
    playCollectSound("good");
  }

  if (score >= settings.targetScore && !hasReachedTarget) {
    hasReachedTarget = true;
    setMilestoneMessage("Milestone reached! Keep your score above the goal!", "success");
  } else if (score < settings.targetScore && hasReachedTarget) {
    hasReachedTarget = false;
    setMilestoneMessage("Milestone lost! Try and get back to the goal.", "warning");
  }

  scoreDisplay.textContent = score;
  drop.remove();
}

function collisionLoop() {
  if (gameRunning && pointerActive) {
    const pointerRect = collectorPointer.getBoundingClientRect();
    const drops = dropLayer.querySelectorAll(".water-drop");

    drops.forEach((drop) => {
      const dropRect = drop.getBoundingClientRect();
      const overlap = !(
        pointerRect.right < dropRect.left ||
        pointerRect.left > dropRect.right ||
        pointerRect.bottom < dropRect.top ||
        pointerRect.top > dropRect.bottom
      );

      if (overlap) collectDrop(drop);
    });
  }

  collisionFrame = requestAnimationFrame(collisionLoop);
}

function updatePointerPosition(clientX, clientY) {
  const rect = gameContainer.getBoundingClientRect();
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);

  pointerX = x;
  pointerY = y;
  collectorPointer.style.left = `${pointerX}px`;
  collectorPointer.style.top = `${pointerY}px`;
  collectorPointer.classList.remove("hidden");
}

function onMouseEnter(event) {
  // Keep mobile's last pressed marker behavior by ignoring synthetic mouse events.
  if (event.pointerType === "touch") return;
  pointerActive = true;
  updatePointerPosition(event.clientX, event.clientY);
}

function onMouseMove(event) {
  if (event.pointerType === "touch") return;
  pointerActive = true;
  updatePointerPosition(event.clientX, event.clientY);
}

function onMouseLeave(event) {
  if (event.pointerType === "touch") return;
  // Keep marker visible at the nearest edge when cursor exits the play area.
  pointerActive = true;
  updatePointerPosition(event.clientX, event.clientY);
}

function onTouchTrack(event) {
  if (!gameRunning) return;
  if (!event.touches.length) return;
  event.preventDefault();
  const touch = event.touches[0];
  pointerActive = true;
  updatePointerPosition(touch.clientX, touch.clientY);
}

function spawnConfetti() {
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left             = `${Math.random() * 100}%`;
    piece.style.background       = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.width            = `${8 + Math.random() * 8}px`;
    piece.style.height           = piece.style.width;
    piece.style.borderRadius     = Math.random() > 0.5 ? "50%" : "2px";
    piece.style.animationDelay   = `${Math.random() * 1.8}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 2}s`;
    gameOverScreen.appendChild(piece);
  }
}
