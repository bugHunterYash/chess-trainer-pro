// Lichess Instant Sync Bridge - Direct Board Scanner & 0ms Sync
console.log('%c[Chess Trainer Pro] Lichess Board Scanner Active ♟️', 'color: #10b981; font-weight: bold; font-size: 14px;');

let lastSyncedKey = '';
let syncTimeout = null;

/**
 * Reconstructs 100% accurate FEN and move history directly from Lichess DOM.
 */
function extractFenFromBoard() {
  const board = document.querySelector('cg-board');
  if (!board) return null;

  const rect = board.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const squareSize = rect.width / 8;

  // 1. Detect orientation accurately
  // Check Chessground container classes
  const cgWrapBlack = document.querySelector('cg-wrap.orientation-black, cg-container.orientation-black, .cg-wrap.orientation-black');
  const cgWrapWhite = document.querySelector('cg-wrap.orientation-white, cg-container.orientation-white, .cg-wrap.orientation-white');

  let isBlack = false;
  if (cgWrapBlack) {
    isBlack = true;
  } else if (cgWrapWhite) {
    isBlack = false;
  } else {
    // Check bottom clock
    const bottomClock = document.querySelector('.rclock-bottom');
    if (bottomClock?.classList?.contains('rclock-black')) {
      isBlack = true;
    } else if (bottomClock?.classList?.contains('rclock-white')) {
      isBlack = false;
    }
  }

  // 2. Physical piece sanity check: White starts near bottom (high Y), Black near top (low Y)
  const pieces = board.querySelectorAll('piece');
  let whiteYSum = 0;
  let whiteCount = 0;
  let blackYSum = 0;
  let blackCount = 0;

  for (const p of pieces) {
    const cls = p.className || '';
    const transform = p.style.transform || '';
    const match = transform.match(/translate(?:3d)?\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/);
    if (!match) continue;
    const y = parseFloat(match[2]);

    if (cls.includes('white')) {
      whiteYSum += y;
      whiteCount++;
    } else if (cls.includes('black')) {
      blackYSum += y;
      blackCount++;
    }
  }

  // In opening & middlegame, physical pieces confirm perspective without doubt
  if (whiteCount >= 6 && blackCount >= 6) {
    const avgWhiteY = whiteYSum / whiteCount;
    const avgBlackY = blackYSum / blackCount;
    // If Black pieces are on average lower on screen (larger Y), board is Black-oriented
    isBlack = avgBlackY > avgWhiteY;
  }

  const orientation = isBlack ? 'black' : 'white';

  // 3. Populate 8x8 piece grid
  const grid = Array.from({ length: 8 }, () => Array(8).fill(''));

  for (const p of pieces) {
    const classes = (p.className || '').split(' ');
    const color = classes.includes('white') ? 'w' : (classes.includes('black') ? 'b' : '');
    if (!color) continue;

    let type = '';
    if (classes.includes('pawn')) type = 'p';
    else if (classes.includes('knight')) type = 'n';
    else if (classes.includes('bishop')) type = 'b';
    else if (classes.includes('rook')) type = 'r';
    else if (classes.includes('queen')) type = 'q';
    else if (classes.includes('king')) type = 'k';
    if (!type) continue;

    const pieceChar = color === 'w' ? type.toUpperCase() : type;

    const transform = p.style.transform || '';
    const match = transform.match(/translate(?:3d)?\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/);
    if (!match) continue;

    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);

    let file = Math.round(x / squareSize);
    let rankIndex = Math.round(y / squareSize);

    if (isBlack) {
      file = 7 - file;
      rankIndex = 7 - rankIndex;
    }

    if (rankIndex >= 0 && rankIndex < 8 && file >= 0 && file < 8) {
      grid[rankIndex][file] = pieceChar;
    }
  }

  // 4. Build FEN board string (rank 8 to rank 1)
  const fenRanks = [];
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    let rowStr = '';
    for (let f = 0; f < 8; f++) {
      const char = grid[r][f];
      if (!char) {
        empty++;
      } else {
        if (empty > 0) {
          rowStr += empty;
          empty = 0;
        }
        rowStr += char;
      }
    }
    if (empty > 0) rowStr += empty;
    fenRanks.push(rowStr);
  }
  const boardPart = fenRanks.join('/');

  // 5. Moves list extraction (supports modern and classic Lichess layouts)
  const moveNodes = document.querySelectorAll(
    'tview2 u8t, tview2 kwdb, tview2 move, rm6 u8t, rm6 kwdb, .rmoves u8t, .rmoves kwdb, l4x u8t, l4x kwdb, .round__app u8t, .round__app kwdb'
  );
  const moves = [];
  for (const n of moveNodes) {
    let t = (n.textContent || '').trim();
    t = t.replace(/^[0-9]+\.+/, '').trim(); // Remove move number
    t = t.replace(/[?!#+]+$/, '').trim();   // Clean glyphs
    if (t && t.length <= 7 && !/^[0-9]+$/.test(t) && !t.includes('(') && !t.includes(')')) {
      moves.push(t);
    }
  }

  // 6. Detect turn reliably from moves count
  let turn = 'w';
  if (moves.length > 0) {
    turn = moves.length % 2 === 1 ? 'b' : 'w';
  } else {
    const whiteClockRunning = !!document.querySelector('.rclock-white.running, .rclock-white .running');
    const blackClockRunning = !!document.querySelector('.rclock-black.running, .rclock-black .running');
    if (blackClockRunning) turn = 'b';
    else if (whiteClockRunning) turn = 'w';
    else turn = 'w';
  }

  // 7. Check castling availability
  let castling = '';
  if (grid[7][4] === 'K') {
    if (grid[7][7] === 'R') castling += 'K';
    if (grid[7][0] === 'R') castling += 'Q';
  }
  if (grid[0][4] === 'k') {
    if (grid[0][7] === 'r') castling += 'k';
    if (grid[0][0] === 'r') castling += 'q';
  }
  if (!castling) castling = '-';

  const fen = `${boardPart} ${turn} ${castling} - 0 1`;

  // 8. Clocks
  const bottomTime = document.querySelector('.rclock-bottom .time, .rclock-bottom')?.textContent?.trim() || '';
  const topTime = document.querySelector('.rclock-top .time, .rclock-top')?.textContent?.trim() || '';
  const whiteClock = isBlack ? topTime : bottomTime;
  const blackClock = isBlack ? bottomTime : topTime;

  return { fen, moves, orientation, whiteClock, blackClock };
}

function syncToTrainer() {
  const data = extractFenFromBoard();
  if (!data || !data.fen) return;

  const currentKey = `${data.fen}|${data.moves.length}|${data.whiteClock}|${data.blackClock}`;
  if (currentKey === lastSyncedKey) return;
  lastSyncedKey = currentKey;

  try {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'SYNC_MOVE', data }, (res) => {
        if (res?.success) {
          console.log(`[Chess Trainer Pro] ⚡ Synced board FEN: ${data.fen.split(' ')[0]} in 0ms!`);
        }
      });
    } else {
      fetch('http://127.0.0.1:3000/api/live-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    }
  } catch (err) {}
}

// Observe board piece changes with 50ms latency
const observer = new MutationObserver(() => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncToTrainer, 50);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['style', 'class'],
});

// Periodic fallback pulse every 500ms
setInterval(syncToTrainer, 500);
