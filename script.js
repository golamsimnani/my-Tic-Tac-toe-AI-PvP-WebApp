const board = document.getElementById('board');
const statusText = document.getElementById('status');
const restartBtn = document.getElementById('restartBtn');
const newGameBtn = document.getElementById('newGameBtn');
const toggleTheme = document.getElementById('toggleTheme');
const toggleAiBtn = document.getElementById('toggleAiBtn');
const togglePvPBtn = document.getElementById('togglePvPBtn');
const toggleEndlessBtn = document.getElementById('toggleEndlessBtn');
const difficultySelect = document.getElementById('difficulty');
const gridSizeSelect = document.getElementById('gridSize');
const playerXScoreEl = document.getElementById('playerXScore');
const playerOScoreEl = document.getElementById('playerOScore');
const aiScoreEl = document.getElementById('aiScore');

let gridSize = 3;
let cells = Array(gridSize * gridSize).fill(null);
let currentPlayer = 'X';
let gameActive = true;
let playerXScore = 0;
let playerOScore = 0;
let aiScore = 0;
let aiEnabled = true;
let pvpEnabled = false;
let endlessEnabled = false;
let aiWaitTimer = null;
let endlessTimer = null;
let winTimeout = null;

function getWinningCombos(size) {
  const combos = [];
  // Rows
  for (let r = 0; r < size; r++) combos.push([...Array(size)].map((_, i) => r * size + i));
  // Cols
  for (let c = 0; c < size; c++) combos.push([...Array(size)].map((_, i) => i * size + c));
  // Diagonals
  combos.push([...Array(size)].map((_, i) => i * size + i));
  combos.push([...Array(size)].map((_, i) => i * size + (size - 1 - i)));
  return combos;
}

let winningCombos = getWinningCombos(gridSize);

function renderBoard() {
  if (board.children.length !== cells.length) {
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;  
    cells.forEach((val, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;
      board.appendChild(cell);
    });
  }
  
  cells.forEach((val, i) => {
    const cell = board.children[i];
    if (val) cell.dataset.value = val;
    else delete cell.dataset.value;
    cell.textContent = val || '';
    cell.classList.remove('winner', 'draw', 'fade-out');
  });
}

function checkWinner(boardState = cells) {
  for (let combo of winningCombos) {
    const first = boardState[combo[0]];
    if (first && combo.every(i => boardState[i] === first)) {
      return { winner: first, combo };
    }
  }
  if (boardState.every(cell => cell)) return { winner: 'Draw' };
  return null;
}

function updateStatus(result) {
  clearTimeout(winTimeout);
  if (!result) {
    statusText.textContent = `Player ${currentPlayer}'s turn`;
    return;
  }
  gameActive = false;
  if (result.winner === 'Draw') {
    if (endlessEnabled) {
      triggerAutoEndless();
      return;
    }
    statusText.textContent = "It's a draw!";
    winTimeout = setTimeout(() => document.querySelectorAll('.cell').forEach(c => c.classList.add('draw')), 300);
  } else {
    statusText.textContent = `${result.winner === 'X' ? 'Player X' : (pvpEnabled ? 'Player O' : 'AI')} wins!`;
    if (result.winner === 'X') playerXScore++;
    else if (result.winner === 'O' && pvpEnabled) playerOScore++;
    else aiScore++;

    playerXScoreEl.textContent = playerXScore;
    playerOScoreEl.textContent = playerOScore;
    aiScoreEl.textContent = aiScore;
    
    saveScores();

    winTimeout = setTimeout(() => {
      if (!gameActive) {
        result.combo.forEach(i => {
          const el = document.querySelector(`[data-index="${i}"]`);
          if (el) el.classList.add('winner');
        });
      }
    }, 300);
      
    // Trigger Confetti!
    if (window.confetti) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: result.winner === 'X' ? ['#ff7675', '#ff4757'] : ['#0984e3', '#1e90ff']
      });
    }
  }
}

function minimax(boardState, depth, isMaximizing, alpha = -Infinity, beta = Infinity) {
  const winner = checkWinner(boardState);
  if (winner?.winner === 'O') return { score: 10 - depth };
  if (winner?.winner === 'X') return { score: depth - 10 };
  if (winner?.winner === 'Draw') return { score: 0 };

  let bestMove;
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let i = 0; i < boardState.length; i++) {
      if (!boardState[i]) {
        boardState[i] = 'O';
        const evalScore = minimax(boardState, depth + 1, false, alpha, beta).score;
        boardState[i] = null;
        if (evalScore > maxEval) {
          maxEval = evalScore;
          bestMove = i;
        }
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
    }
    return { score: maxEval, index: bestMove };
  } else {
    let minEval = Infinity;
    for (let i = 0; i < boardState.length; i++) {
      if (!boardState[i]) {
        boardState[i] = 'X';
        const evalScore = minimax(boardState, depth + 1, true, alpha, beta).score;
        boardState[i] = null;
        if (evalScore < minEval) {
          minEval = evalScore;
          bestMove = i;
        }
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
    }
    return { score: minEval, index: bestMove };
  }
}

function aiMove() {
  if (!aiEnabled || pvpEnabled || !gameActive) return;
  const empty = cells.map((val, i) => val ? null : i).filter(i => i !== null);
  if (empty.length === 0) return;

  let move;
  const difficulty = difficultySelect.value;
  let smartProbability = 0;

  if (difficulty === 'easy') {
    smartProbability = 0.3; // 30% chance to be smart
  } else if (difficulty === 'medium') {
    smartProbability = 0.7; // 70% chance to be smart
  } else {
    smartProbability = 1.0; // 100% smart
  }

  const playSmart = Math.random() < smartProbability;

  if (playSmart) {
    if (gridSize === 3) {
      move = minimax(cells, 0, true).index;
    } else {
      move = findBestMove(empty);
    }
  } else {
    move = empty[Math.floor(Math.random() * empty.length)];
  }

  if (move !== undefined && move !== null) {
    cells[move] = 'O';
    renderBoard();
    const result = checkWinner();
    if (!result) currentPlayer = 'X';
    updateStatus(result);
  }
}

function findBestMove(emptyCells) {
  for (let i of emptyCells) {
    const testBoard = [...cells];
    testBoard[i] = 'O';
    if (checkWinner(testBoard)?.winner === 'O') return i;
  }
  for (let i of emptyCells) {
    const testBoard = [...cells];
    testBoard[i] = 'X';
    if (checkWinner(testBoard)?.winner === 'X') return i;
  }
  const centers = gridSize % 2 === 1 
    ? [Math.floor((gridSize * gridSize) / 2)] 
    : [
        (gridSize / 2 - 1) * gridSize + (gridSize / 2 - 1),
        (gridSize / 2 - 1) * gridSize + (gridSize / 2),
        (gridSize / 2) * gridSize + (gridSize / 2 - 1),
        (gridSize / 2) * gridSize + (gridSize / 2)
      ];
  for (let c of centers) {
    if (emptyCells.includes(c)) return c;
  }
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

board.addEventListener('click', e => {
  if (!e.target.classList.contains('cell')) return;
  const i = e.target.dataset.index;

  if (!gameActive || cells[i]) return;
  if (currentPlayer === 'X') {
    cells[i] = 'X';
    currentPlayer = 'O';
  } else if (pvpEnabled && currentPlayer === 'O') {
    cells[i] = 'O';
    currentPlayer = 'X';
  } else return;
  renderBoard();
  let result = checkWinner();
  updateStatus(result);
  if (!result && aiEnabled && !pvpEnabled) {
    clearTimeout(aiWaitTimer);
    aiWaitTimer = setTimeout(aiMove, 400);
  }
});

restartBtn.onclick = () => {
  clearTimeout(aiWaitTimer);
  clearTimeout(endlessTimer);
  cells = Array(gridSize * gridSize).fill(null);
  currentPlayer = 'X';
  gameActive = true;
  winningCombos = getWinningCombos(gridSize);
  // Remove existing styles to reset animations properly
  document.querySelectorAll('.cell').forEach(c => {
    c.classList.remove('winner', 'draw', 'fade-out');
    delete c.dataset.value;
    c.textContent = '';
  });
  renderBoard();
  updateStatus();
};

function saveScores() {
  localStorage.setItem('ttt_scores', JSON.stringify({ playerXScore, playerOScore, aiScore }));
}

function loadScores() {
  const saved = localStorage.getItem('ttt_scores');
  if (saved) {
    const scores = JSON.parse(saved);
    playerXScore = scores.playerXScore || 0;
    playerOScore = scores.playerOScore || 0;
    aiScore = scores.aiScore || 0;
    playerXScoreEl.textContent = playerXScore;
    playerOScoreEl.textContent = playerOScore;
    aiScoreEl.textContent = aiScore;
  }
}

function saveTheme(isDark) {
  localStorage.setItem('ttt_theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
  const saved = localStorage.getItem('ttt_theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
  }
}

function updateModeUI() {
  toggleAiBtn.textContent = `AI: ${aiEnabled ? 'ON' : 'OFF'}`;
  togglePvPBtn.textContent = `PvP: ${pvpEnabled ? 'ON' : 'OFF'}`;
  const playerOBox = playerOScoreEl.parentElement;
  const aiBox = aiScoreEl.parentElement;
  playerOBox.style.display = pvpEnabled ? 'block' : 'none';
  aiBox.style.display = aiEnabled ? 'block' : 'none';
}

toggleAiBtn.onclick = () => {
  if (!aiEnabled) {
    aiEnabled = true;
    pvpEnabled = false;
  } else {
    aiEnabled = false;
    pvpEnabled = true;
  }
  updateModeUI();
  restartBtn.click();
};

togglePvPBtn.onclick = () => {
  if (!pvpEnabled) {
    pvpEnabled = true;
    aiEnabled = false;
  } else {
    pvpEnabled = false;
    aiEnabled = true;
  }
  updateModeUI();
  restartBtn.click();
};

toggleEndlessBtn.onclick = () => {
  endlessEnabled = !endlessEnabled;
  toggleEndlessBtn.textContent = `Endless: ${endlessEnabled ? 'ON' : 'OFF'}`;
  restartBtn.click();
};

function triggerAutoEndless() {
  const marksToRemove = gridSize === 3 ? 2 : (gridSize === 4 ? 4 : 6);
  
  statusText.textContent = `Endless! Auto-removing pieces...`;
  
  let xIndices = cells.map((v, i) => v === 'X' ? i : -1).filter(i => i !== -1);
  let oIndices = cells.map((v, i) => v === 'O' ? i : -1).filter(i => i !== -1);
  
  xIndices.sort(() => Math.random() - 0.5);
  oIndices.sort(() => Math.random() - 0.5);
  
  const toRemove = [
    ...xIndices.slice(0, marksToRemove),
    ...oIndices.slice(0, Math.min(marksToRemove, oIndices.length))
  ];
  
  toRemove.forEach(idx => {
    cells[idx] = null;
    const cellEl = document.querySelector(`[data-index="${idx}"]`);
    if(cellEl) cellEl.classList.add('fade-out');
  });
  
  endlessTimer = setTimeout(() => {
    renderBoard();
    gameActive = true;
    let result = checkWinner();
    updateStatus(result);
    if (!result && currentPlayer === 'O' && aiEnabled && !pvpEnabled) {
      clearTimeout(aiWaitTimer);
      aiWaitTimer = setTimeout(aiMove, 400);
    }
  }, 600);
}

gridSizeSelect.onchange = () => {
  gridSize = parseInt(gridSizeSelect.value);
  document.getElementById("board").style.setProperty("--grid-size", gridSize);
  restartBtn.click();
};

// Navbar toggle
const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");

menuToggle.onclick = (e) => {
  e.stopPropagation(); // prevent closing immediately when button clicked
  navbar.classList.toggle("show");
  menuToggle.textContent = navbar.classList.contains("show") ? "✖ Close" : "☰ Menu";
};

// Close navbar when clicking outside
document.addEventListener("click", (e) => {
  if (navbar.classList.contains("show") && !navbar.contains(e.target) && e.target !== menuToggle) {
    navbar.classList.remove("show");
    menuToggle.textContent = "☰ Menu";
  }
});

newGameBtn.onclick = () => {
  playerXScore = 0;
  playerOScore = 0;
  aiScore = 0;
  playerXScoreEl.textContent = '0';
  playerOScoreEl.textContent = '0';
  aiScoreEl.textContent = '0';
  saveScores();
  restartBtn.click();
};

toggleTheme.onclick = () => {
  document.body.classList.toggle('dark');
  saveTheme(document.body.classList.contains('dark'));
};

loadTheme();
loadScores();
updateModeUI();
renderBoard();
updateStatus();
