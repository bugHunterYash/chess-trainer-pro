/**
 * Human Chess Practice Trainer - Interactive Frontend Logic
 */

// Embedded crisp SVG chess pieces (standard cburnett)
const PIECE_SVGS = {
    'P': '<svg viewBox="0 0 45 45"><path d="m22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></svg>',
    'N': '<svg viewBox="0 0 45 45"><path d="m22 10c10.5 1 16.5 8 16 29h-23c0-9 10-6.5 8-21" fill="#fff" stroke="#000" stroke-width="1.5"/><path d="m24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0-.995 2.11-2 2-1.5-.5-1.5-2.5-.5-4 1.5-2.5 4.5-4.5 7-6 1.875-1.125 4.5-1.875 5.5-2 1-.125 2.5 0 2.5 0z" fill="#fff" stroke="#000" stroke-width="1.5"/><path d="m9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.5-13.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#000"/></svg>',
    'B': '<svg viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#fff"><path d="m9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="m15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="m25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="m17.5 26h10m-5-5v10m-4-19c3 3 7 3 10 0m-8 11.5c1.5 1 4.5 1 6 0"/></g></svg>',
    'R': '<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 39h27v-3h-27v3zm3-3v-11.5h21v11.5h-21zm-1-11.5h23l2-6h-27l2 6zm0-6v-5h4v2h3v-2h4v2h3v-2h4v2h3v-2h4v5h-25z"/><path d="m12 35.5h21m-20-4h19m-18-7.5h17m-17-4h17" stroke-linejoin="miter"/></g></svg>',
    'Q': '<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8.5 15.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm15.5-4a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm15.5 4a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm-24 5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm17 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="m9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-6-16-6 16-7-11-2 12zm0 0c0 4 6 6 13.5 6s13.5-2 13.5-6c0-2.5-6-4.5-13.5-4.5s-13.5 2-13.5 4.5z"/><path d="m11 38.5c3.5 1 19.5 1 23 0 0-2.5-3.5-4-11.5-4s-11.5 1.5-11.5 4zm-2 2c0 2 4 3 13.5 3s13.5-1 13.5-3-4-3-13.5-3-13.5 1-13.5 3z"/></g></svg>',
    'K': '<svg viewBox="0 0 45 45"><g fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22.5 11.63v7.37m-3.68-3.68h7.37m-8.19 16.68c-2.5 2.5-12.5 2.5-15 0-.5-1.5 0-2 0-2 0-2.5 2.5-4 2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zm8-20c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4-5.5-1.5-6-11.5 5-15.5 11 4 10.5 14 5 15.5 0 0 2.5 1.5 2.5 4 0 0 .5.5 0 2z" fill="#fff"/><path d="m11.5 37c5.5 3.5 15.5 3.5 21 0m-21-3c5.5 3 15.5 3 21 0m-20.5-6c5 3 14 3 20 0m-19.5-6c4.5 3 13.5 3 19 0"/></g></svg>',
    'p': '<svg viewBox="0 0 45 45"><path d="m22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#262626" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
    'n': '<svg viewBox="0 0 45 45"><path d="m22 10c10.5 1 16.5 8 16 29h-23c0-9 10-6.5 8-21" fill="#262626" stroke="#fff" stroke-width="1.5"/><path d="m24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0-.995 2.11-2 2-1.5-.5-1.5-2.5-.5-4 1.5-2.5 4.5-4.5 7-6 1.875-1.125 4.5-1.875 5.5-2 1-.125 2.5 0 2.5 0z" fill="#262626" stroke="#fff" stroke-width="1.5"/><path d="m9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.5-13.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#fff"/></svg>',
    'b': '<svg viewBox="0 0 45 45"><g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#262626"><path d="m9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="m15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="m25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="m17.5 26h10m-5-5v10m-4-19c3 3 7 3 10 0m-8 11.5c1.5 1 4.5 1 6 0"/></g></svg>',
    'r': '<svg viewBox="0 0 45 45"><g fill="#262626" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 39h27v-3h-27v3zm3-3v-11.5h21v11.5h-21zm-1-11.5h23l2-6h-27l2 6zm0-6v-5h4v2h3v-2h4v2h3v-2h4v2h3v-2h4v5h-25z"/><path d="m12 35.5h21m-20-4h19m-18-7.5h17m-17-4h17" stroke-linejoin="miter"/></g></svg>',
    'q': '<svg viewBox="0 0 45 45"><g fill="#262626" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8.5 15.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm15.5-4a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm15.5 4a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm-24 5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm17 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="m9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-6-16-6 16-7-11-2 12zm0 0c0 4 6 6 13.5 6s13.5-2 13.5-6c0-2.5-6-4.5-13.5-4.5s-13.5 2-13.5 4.5z"/><path d="m11 38.5c3.5 1 19.5 1 23 0 0-2.5-3.5-4-11.5-4s-11.5 1.5-11.5 4zm-2 2c0 2 4 3 13.5 3s13.5-1 13.5-3-4-3-13.5-3-13.5 1-13.5 3z"/></g></svg>',
    'k': '<svg viewBox="0 0 45 45"><g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22.5 11.63v7.37m-3.68-3.68h7.37m-8.19 16.68c-2.5 2.5-12.5 2.5-15 0-.5-1.5 0-2 0-2 0-2.5 2.5-4 2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zm8-20c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4-5.5-1.5-6-11.5 5-15.5 11 4 10.5 14 5 15.5 0 0 2.5 1.5 2.5 4 0 0 .5.5 0 2z" fill="#262626"/><path d="m11.5 37c5.5 3.5 15.5 3.5 21 0m-21-3c5.5 3 15.5 3 21 0m-20.5-6c5 3 14 3 20 0m-19.5-6c4.5 3 13.5 3 19 0"/></g></svg>'
};

// Web Audio API Sound Synthesizer
class ChessAudio {
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    playMove() {
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(320, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.08);
        } catch (e) {}
    }
}
const audio = new ChessAudio();

// App State
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let currentFen = START_FEN;
let fenHistory = [START_FEN];
let moveHistory = [];
let selectedSquare = null;
let currentLevel = 1500;
let isFlipped = false;
let activeArrows = []; // {from, to, color}

// DOM Elements
const chessboardEl = document.getElementById('chessboard');
const arrowOverlayEl = document.getElementById('arrowOverlay');
const evalBarFill = document.getElementById('evalBarFill');
const evalBarText = document.getElementById('evalBarText');
const fenInput = document.getElementById('fenInput');
const currentLevelBadge = document.getElementById('currentLevelBadge');
const levelNamePill = document.getElementById('levelNamePill');
const levelDesc = document.getElementById('levelDesc');
const goodMoveFilter = document.getElementById('goodMoveFilter');

// Suggestions UI
const suggestTag = document.getElementById('suggestTag');
const suggestMoveSan = document.getElementById('suggestMoveSan');
const statPopularity = document.getElementById('statPopularity');
const statEval = document.getElementById('statEval');
const conceptText = document.getElementById('conceptText');
const adviceText = document.getElementById('adviceText');
const engineCompareBox = document.getElementById('engineCompareBox');
const engineEval = document.getElementById('engineEval');
const engineMoveSan = document.getElementById('engineMoveSan');
const engineWhyText = document.getElementById('engineWhyText');
const candidatesSection = document.getElementById('candidatesSection');
const candidatesList = document.getElementById('candidatesList');
const movesList = document.getElementById('movesList');
const moveCount = document.getElementById('moveCount');

// Level info text map
const LEVEL_DESCS = {
    1100: "Focuses on simple piece development, central pushes, and direct attacks. Misses subtle tactical replies and occasionally drops undefended pieces.",
    1300: "Controls the center and active development, but struggles with prophylactic defense and multi-step combinations.",
    1500: "Solid tactical vision, standard opening plans, active piece play. Avoids one-move blunders and creates natural attacking threats.",
    1700: "Strong positional understanding, solid piece coordination, reliable tactical defense and pawn break awareness.",
    1900: "Tournament-grade calculation and refined plans. Plays human master-level chess without inhuman engine computer moves."
};

// Initialize Board
function initBoard() {
    renderBoard();
    updateFenUI();
    setupEventListeners();
}

// Convert FEN position string to 8x8 matrix
function fenToBoard(fen) {
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    const board = [];
    for (let r = 0; r < 8; r++) {
        const row = [];
        for (let char of rows[r]) {
            if (/\d/.test(char)) {
                const emptyCount = parseInt(char);
                for (let i = 0; i < emptyCount; i++) row.push(null);
            } else {
                row.push(char);
            }
        }
        board.push(row);
    }
    return board;
}

// Render Chessboard Squares and Pieces
function renderBoard() {
    chessboardEl.innerHTML = '';
    const boardMatrix = fenToBoard(currentFen);

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const actualRow = isFlipped ? 7 - r : r;
            const actualCol = isFlipped ? 7 - c : c;

            const sqName = `${String.fromCharCode(97 + actualCol)}${8 - actualRow}`;
            const isLight = (actualRow + actualCol) % 2 === 0;

            const sqEl = document.createElement('div');
            sqEl.className = `square ${isLight ? 'light' : 'dark'}`;
            sqEl.dataset.square = sqName;

            if (selectedSquare === sqName) {
                sqEl.classList.add('selected');
            }

            const pieceChar = boardMatrix[actualRow][actualCol];
            if (pieceChar && PIECE_SVGS[pieceChar]) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = 'piece-svg';
                pieceDiv.innerHTML = PIECE_SVGS[pieceChar];
                sqEl.appendChild(pieceDiv);
            }

            sqEl.addEventListener('click', () => handleSquareClick(sqName));
            chessboardEl.appendChild(sqEl);
        }
    }
    drawArrows();
}

// Handle Square Click & Move Attempt
async function handleSquareClick(sqName) {
    if (!selectedSquare) {
        // Select piece to move
        const boardMatrix = fenToBoard(currentFen);
        const col = sqName.charCodeAt(0) - 97;
        const row = 8 - parseInt(sqName[1]);
        const piece = boardMatrix[row][col];
        if (piece) {
            selectedSquare = sqName;
            renderBoard();
        }
    } else {
        if (selectedSquare === sqName) {
            // Deselect
            selectedSquare = null;
            renderBoard();
            return;
        }

        const fromSq = selectedSquare;
        const toSq = sqName;
        selectedSquare = null;

        // Validate move with server
        try {
            const res = await fetch('/api/validate_move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: currentFen, from_sq: fromSq, to_sq: toSq })
            });
            const data = await res.json();
            if (data.valid) {
                audio.playMove();
                fenHistory.push(currentFen);
                currentFen = data.fen;
                moveHistory.push(data.san);
                updateHistoryUI();
                renderBoard();
                clearArrows();

                // Auto suggest or analyze for next move
                fetchSuggestion();
            } else {
                renderBoard();
            }
        } catch (e) {
            renderBoard();
        }
    }
}

// Fetch Move Suggestion
async function fetchSuggestion() {
    suggestTag.textContent = "Calculating...";
    const filter = goodMoveFilter.checked ? "good_only" : "realistic";

    try {
        const res = await fetch('/api/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: currentFen, level: currentLevel, mode: filter })
        });
        const data = await res.json();
        if (data.error) {
            suggestTag.textContent = "Finished";
            conceptText.textContent = data.error;
            return;
        }

        // Display Suggestion
        suggestTag.textContent = `Human ${data.level}`;
        const sugg = data.suggested_move;
        suggestMoveSan.textContent = sugg.san;
        statPopularity.textContent = `Human Pick: ${sugg.human_popularity}`;
        statEval.textContent = `Eval: ${sugg.eval}`;

        conceptText.textContent = sugg.concept;
        adviceText.textContent = sugg.advice;

        // Position Eval Bar
        const evalVal = parseFloat(data.position_eval) || 0.0;
        updateEvalBar(evalVal);

        // Arrows
        activeArrows = [];
        // Human Move Arrow (Green)
        activeArrows.push({
            from: sugg.from_sq,
            to: sugg.to_sq,
            color: '#10b981'
        });

        // Stockfish Engine comparison
        if (data.engine_comparison) {
            engineCompareBox.style.display = 'block';
            const eng = data.engine_comparison;
            engineMoveSan.textContent = eng.engine_move_san;
            engineEval.textContent = `Score: ${eng.engine_eval} (Diff: ${eng.eval_difference})`;
            engineWhyText.textContent = `${eng.engine_concept} ${eng.why_engine}`;

            // Engine Arrow (Cyan)
            activeArrows.push({
                from: eng.engine_move_uci.substring(0, 2),
                to: eng.engine_move_uci.substring(2, 4),
                color: '#06b6d4'
            });
        } else {
            engineCompareBox.style.display = 'none';
        }

        // Top candidate moves
        if (data.human_candidates && data.human_candidates.length > 0) {
            candidatesSection.style.display = 'block';
            candidatesList.innerHTML = '';
            data.human_candidates.forEach(c => {
                const item = document.createElement('div');
                item.className = `candidate-item ${c.is_chosen ? 'chosen' : ''}`;
                item.innerHTML = `<span class="cand-san">${c.san}</span><span class="cand-prob">${c.prob_percent}%</span>`;
                candidatesList.appendChild(item);
            });
        }

        drawArrows();
    } catch (e) {
        suggestTag.textContent = "Error";
    }
}

// Draw Move Arrows onto SVG Overlay
function drawArrows() {
    arrowOverlayEl.innerHTML = `
        <defs>
            <marker id="arrow-green" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>
            <marker id="arrow-cyan" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
            </marker>
        </defs>
    `;

    activeArrows.forEach(arr => {
        const p1 = squareToPercent(arr.from);
        const p2 = squareToPercent(arr.to);
        const marker = arr.color === '#06b6d4' ? 'url(#arrow-cyan)' : 'url(#arrow-green)';

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);
        line.setAttribute('stroke', arr.color);
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('opacity', '0.85');
        line.setAttribute('marker-end', marker);

        arrowOverlayEl.appendChild(line);
    });
}

function clearArrows() {
    activeArrows = [];
    arrowOverlayEl.innerHTML = '';
}

// Convert chess square (e.g. "e4") to SVG percentage coordinates (0 to 100)
function squareToPercent(sq) {
    let col = sq.charCodeAt(0) - 97;
    let row = 8 - parseInt(sq[1]);

    if (isFlipped) {
        col = 7 - col;
        row = 7 - row;
    }

    const x = col * 12.5 + 6.25;
    const y = row * 12.5 + 6.25;
    return { x, y };
}

// Update Eval Bar
function updateEvalBar(evalVal) {
    // Clamped between -8 and +8 for visual display
    const clamped = Math.max(-8, Math.min(8, evalVal));
    // 0 is 50%, +8 is 95%, -8 is 5%
    const pct = 50 + (clamped / 8) * 45;
    evalBarFill.style.height = `${pct}%`;
    evalBarText.textContent = evalVal > 0 ? `+${evalVal.toFixed(1)}` : evalVal.toFixed(1);
}

// Update Move History UI
function updateHistoryUI() {
    if (moveHistory.length === 0) {
        movesList.innerHTML = '<span class="placeholder-text">Moves will appear here...</span>';
        moveCount.textContent = '0 moves';
        return;
    }

    movesList.innerHTML = '';
    moveCount.textContent = `${moveHistory.length} moves`;

    for (let i = 0; i < moveHistory.length; i += 2) {
        const turnNum = Math.floor(i / 2) + 1;
        const wMove = moveHistory[i];
        const bMove = moveHistory[i + 1] || '';
        const turnSpan = document.createElement('div');
        turnSpan.className = 'history-turn';
        turnSpan.textContent = `${turnNum}. ${wMove} ${bMove}`.trim();
        movesList.appendChild(turnSpan);
    }
    movesList.scrollTop = movesList.scrollHeight;
    updateFenUI();
}

function updateFenUI() {
    fenInput.value = currentFen;
}

// Setup Buttons and Event Listeners
function setupEventListeners() {
    // Level selection
    document.querySelectorAll('.btn-level').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-level').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLevel = parseInt(btn.dataset.level);
            currentLevelBadge.textContent = `Rating: ${currentLevel}`;
            levelNamePill.textContent = `${currentLevel}`;
            levelDesc.textContent = LEVEL_DESCS[currentLevel] || "";
            fetchSuggestion();
        });
    });

    // Suggest Good Move Button
    document.getElementById('btnSuggest').addEventListener('click', fetchSuggestion);

    // AI Play Move Button
    document.getElementById('btnPlayBot').addEventListener('click', async () => {
        try {
            suggestTag.textContent = "AI Playing...";
            const res = await fetch('/api/play_move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: currentFen, level: currentLevel })
            });
            const data = await res.json();
            if (data.move) {
                audio.playMove();
                fenHistory.push(currentFen);
                currentFen = data.fen;
                moveHistory.push(data.move.san);
                updateHistoryUI();
                renderBoard();
                fetchSuggestion();
            }
        } catch (e) {}
    });

    // Flip Board Button
    document.getElementById('btnFlip').addEventListener('click', () => {
        isFlipped = !isFlipped;
        renderBoard();
    });

    // Undo Move Button
    document.getElementById('btnTakeback').addEventListener('click', () => {
        if (fenHistory.length > 1) {
            currentFen = fenHistory.pop();
            moveHistory.pop();
            updateHistoryUI();
            renderBoard();
            fetchSuggestion();
        }
    });

    // Reset Board Button
    document.getElementById('btnReset').addEventListener('click', () => {
        currentFen = START_FEN;
        fenHistory = [START_FEN];
        moveHistory = [];
        clearArrows();
        updateHistoryUI();
        renderBoard();
        fetchSuggestion();
    });

    // Load FEN Button
    document.getElementById('btnLoadFen').addEventListener('click', () => {
        const val = fenInput.value.trim();
        if (val) {
            currentFen = val;
            fenHistory.push(val);
            renderBoard();
            fetchSuggestion();
        }
    });

    // Copy FEN Button
    document.getElementById('btnCopyFen').addEventListener('click', () => {
        navigator.clipboard.writeText(currentFen);
        const originalText = document.getElementById('btnCopyFen').textContent;
        document.getElementById('btnCopyFen').textContent = "Copied!";
        setTimeout(() => {
            document.getElementById('btnCopyFen').textContent = originalText;
        }, 1500);
    });

    // Good Move Filter Toggle
    goodMoveFilter.addEventListener('change', fetchSuggestion);
}

// Start application
document.addEventListener('DOMContentLoaded', () => {
    initBoard();
    // initial suggestion for starting position
    setTimeout(fetchSuggestion, 400);
});

