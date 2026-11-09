// ==UserScript==
// @name         Chess Trainer Pro - Lichess 0ms Sync
// @namespace    https://chess-trainer-pro.vercel.app/
// @version      1.0.0
// @description  Zero-latency real-time live board sync between Lichess and Chess Trainer Pro
// @author       bugHunterYash
// @match        https://lichess.org/*
// @grant        GM_xmlhttpRequest
// @connect      chess-trainer-pro.vercel.app
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  console.log('%c[Chess Trainer Pro] Userscript Active ♟️', 'color: #10b981; font-weight: bold; font-size: 14px;');

  const TARGET_URL = 'https://chess-trainer-pro.vercel.app/api/live-sync';
  const LOCAL_URL = 'http://127.0.0.1:3000/api/live-sync';

  let lastSyncedKey = '';
  let syncTimeout = null;

  function extractFenFromBoard() {
    const board = document.querySelector('cg-board');
    if (!board) return null;

    const rect = board.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const squareSize = rect.width / 8;

    const cgWrapBlack = document.querySelector('cg-wrap.orientation-black, cg-container.orientation-black, .cg-wrap.orientation-black');
    const cgWrapWhite = document.querySelector('cg-wrap.orientation-white, cg-container.orientation-white, .cg-wrap.orientation-white');

    let isBlack = false;
    if (cgWrapBlack) {
      isBlack = true;
    } else if (cgWrapWhite) {
      isBlack = false;
    } else {
      const bottomClock = document.querySelector('.rclock-bottom');
      if (bottomClock?.classList?.contains('rclock-black')) isBlack = true;
      else if (bottomClock?.classList?.contains('rclock-white')) isBlack = false;
    }

    const pieces = board.querySelectorAll('piece');
    let whiteYSum = 0, whiteCount = 0;
    let blackYSum = 0, blackCount = 0;

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

    if (whiteCount >= 6 && blackCount >= 6) {
      isBlack = (blackYSum / blackCount) > (whiteYSum / whiteCount);
    }

    const orientation = isBlack ? 'black' : 'white';
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

    const moveNodes = document.querySelectorAll(
      'tview2 u8t, tview2 kwdb, tview2 move, rm6 u8t, rm6 kwdb, .rmoves u8t, .rmoves kwdb, l4x u8t, l4x kwdb, .round__app u8t, .round__app kwdb'
    );
    const moves = [];
    for (const n of moveNodes) {
      let t = (n.textContent || '').trim();
      t = t.replace(/^[0-9]+\.+/, '').trim();
      t = t.replace(/[?!#+]+$/, '').trim();
      if (t && t.length <= 7 && !/^[0-9]+$/.test(t) && !t.includes('(') && !t.includes(')')) {
        moves.push(t);
      }
    }

    let turn = 'w';
    if (moves.length > 0) {
      turn = moves.length % 2 === 1 ? 'b' : 'w';
    } else {
      const whiteClockRunning = !!document.querySelector('.rclock-white.running, .rclock-white .running');
      const blackClockRunning = !!document.querySelector('.rclock-black.running, .rclock-black .running');
      if (blackClockRunning) turn = 'b';
      else if (whiteClockRunning) turn = 'w';
    }

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

    const bottomTime = document.querySelector('.rclock-bottom .time, .rclock-bottom')?.textContent?.trim() || '';
    const topTime = document.querySelector('.rclock-top .time, .rclock-top')?.textContent?.trim() || '';
    const whiteClock = isBlack ? topTime : bottomTime;
    const blackClock = isBlack ? bottomTime : topTime;

    return { fen, moves, orientation, whiteClock, blackClock };
  }

  function sendPayload(url, payload) {
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      GM_xmlhttpRequest({
        method: 'POST',
        url: url,
        headers: { 'Content-Type': 'application/json' },
        data: payload,
      });
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});
    }
  }

  function syncToTrainer() {
    const data = extractFenFromBoard();
    if (!data || !data.fen) return;

    const currentKey = `${data.fen}|${data.moves.length}|${data.whiteClock}|${data.blackClock}`;
    if (currentKey === lastSyncedKey) return;
    lastSyncedKey = currentKey;

    const payload = JSON.stringify(data);
    sendPayload(TARGET_URL, payload);
    sendPayload(LOCAL_URL, payload);
  }

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

  setInterval(syncToTrainer, 500);
})();
