// Game state
let gameRunning = false;
let dropMaker;
let timerInterval;
let score = 0;
let timeLeft = 30;
let collisionFrame;

const gameContainer   = document.getElementById("game-container");
const dropLayer       = document.getElementById("drop-layer");
const collectorPointer = document.getElementById("collector-pointer");
const scoreDisplay    = document.getElementById("score");
const timeDisplay     = document.getElementById("time");
const gameOverScreen  = document.getElementById("game-over");
const gameOverMessage = document.getElementById("game-over-message");

const CONFETTI_COLORS = ["#FFC907", "#2E9DF7", "#4FCB53", "#FF902A", "#F5402C", "#F16061"];

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
gameContainer.addEventListener("mousemove", onMouseMove);
gameContainer.addEventListener("mouseenter", onMouseEnter);
gameContainer.addEventListener("mouseleave", onMouseLeave);
gameContainer.addEventListener("touchstart", onTouchTrack, { passive: false });
gameContainer.addEventListener("touchmove", onTouchTrack, { passive: false });

collisionLoop();

function startGame() {
  gameRunning = true;
  score = 0;
  timeLeft = 30;
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeLeft;

  clearInterval(dropMaker);
  clearInterval(timerInterval);
  dropLayer.innerHTML = "";
  if (collisionFrame) cancelAnimationFrame(collisionFrame);
  gameOverScreen.querySelectorAll(".confetti-piece").forEach(el => el.remove());
  gameOverScreen.className = "game-over-screen hidden";

  dropMaker     = setInterval(createDrop, 1000);
  timerInterval = setInterval(tickTimer, 1000);
  collisionLoop();
}

function resetGame() {
  gameRunning = false;
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  if (collisionFrame) cancelAnimationFrame(collisionFrame);
  score = 0;
  timeLeft = 30;
  scoreDisplay.textContent = score;
  timeDisplay.textContent = timeLeft;
  dropLayer.innerHTML = "";
  gameOverScreen.querySelectorAll(".confetti-piece").forEach(el => el.remove());
  gameOverScreen.className = "game-over-screen hidden";
}

function tickTimer() {
  timeLeft--;
  timeDisplay.textContent = timeLeft;
  if (timeLeft <= 0) endGame();
}

function endGame() {
  gameRunning = false;
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  if (collisionFrame) cancelAnimationFrame(collisionFrame);
  dropLayer.innerHTML = "";

  const won = score > 30;
  gameOverMessage.textContent = won
    ? `Congratulations! You scored ${score} points!\nClean water for everyone! 🎉`
    : `You scored ${score} points. You need more than 30 to win — try again!`;

  gameOverScreen.className = won ? "game-over-screen win" : "game-over-screen lose";

  if (won) spawnConfetti();
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

  const gameWidth = dropLayer.offsetWidth;
  drop.style.left = `${Math.random() * Math.max(gameWidth - size, 0)}px`;
  drop.style.animationDuration = "4s";
  drop.style.setProperty("--drop-distance", `${gameContainer.offsetHeight + 40}px`);
  drop.dataset.rank = String(sizeToRank(size, MIN_SIZE, MAX_SIZE));

  drop.addEventListener("animationend", () => drop.remove());
  dropLayer.appendChild(drop);
}

function collectDrop(drop) {
  if (!gameRunning || !drop.isConnected) return;

  const rank = parseInt(drop.dataset.rank || "1", 10);
  const isBad = drop.dataset.isBad === "1";

  if (isBad) {
    score = Math.max(0, score - rank);
  } else {
    score += (6 - rank);
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
