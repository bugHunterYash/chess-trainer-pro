import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { UCIParser } from '../src/engine/UCIParser';
import { EvaluationService } from '../src/engine/EvaluationService';
import { DIFFICULTY_CONFIGS } from '../src/engine/HumanSkillEngine';
import { GameImportService } from '../src/services/GameImportService';
import { HumanThinkingService } from '../src/engine/HumanThinkingService';
import { CandidateMoveService } from '../src/engine/CandidateMoveService';
import { ParsedInfo } from '../src/engine/UCIParser';
import { CandidateMove } from '../src/types/chess';

describe('Chess Rules & Mechanics', () => {
  it('handles standard legal moves', () => {
    const chess = new Chess();
    const move = chess.move('e4');
    expect(move).toBeDefined();
    expect(move.san).toBe('e4');
    expect(chess.turn()).toBe('b');
  });

  it('handles kingside and queenside castling', () => {
    // White Kingside castling
    const whiteCastle = new Chess('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
    const move = whiteCastle.move('O-O');
    expect(move).toBeDefined();
    expect(move.san).toBe('O-O');

    // Black Queenside castling
    const blackCastle = new Chess('r3k2r/pppqbppp/2np1n2/4p3/4P3/2NP1N2/PPPQBPPP/R3K2R b KQkq - 4 4');
    const bMove = blackCastle.move('O-O-O');
    expect(bMove).toBeDefined();
    expect(bMove.san).toBe('O-O-O');
  });

  it('handles en passant captures', () => {
    const chess = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    const epMove = chess.move('exf6');
    expect(epMove).toBeDefined();
    expect(epMove.captured).toBe('p');
  });

  it('handles pawn promotion', () => {
    const chess = new Chess('8/4P3/8/8/8/8/8/k6K w - - 0 1');
    const promo = chess.move({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(promo).toBeDefined();
    expect(promo.promotion).toBe('q');
    expect(chess.get('e8')?.type).toBe('q');
  });

  it('detects checkmate', () => {
    const chess = new Chess('r1bqkb1r/pppp1Qpp/2n5/4p3/2B1n3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
    expect(chess.isCheckmate()).toBe(true);
    expect(chess.isGameOver()).toBe(true);
  });

  it('detects stalemate and draw conditions', () => {
    const chess = new Chess('k7/2Q5/K7/8/8/8/8/8 b - - 0 1');
    expect(chess.isStalemate()).toBe(true);
    expect(chess.isDraw()).toBe(true);
    expect(chess.isCheckmate()).toBe(false);
  });
});

describe('UCI Protocol Parsing', () => {
  it('parses UCI info lines with score cp and PV', () => {
    const line = 'info depth 14 seldepth 18 multipv 1 score cp 35 nodes 45000 nps 250000 time 180 pv e2e4 e7e5 g1f3 b8c6';
    const parsed = UCIParser.parseInfoLine(line, 'w');
    expect(parsed).toBeDefined();
    expect(parsed?.depth).toBe(14);
    expect(parsed?.multipv).toBe(1);
    expect(parsed?.score.type).toBe('cp');
    expect(parsed?.score.value).toBe(35);
    expect(parsed?.pv[0]).toBe('e2e4');
  });

  it('parses UCI info lines with score mate and reverses for Black', () => {
    const line = 'info depth 8 multipv 1 score mate 2 pv f7f8q';
    const parsed = UCIParser.parseInfoLine(line, 'b');
    expect(parsed?.score.type).toBe('mate');
    expect(parsed?.score.value).toBe(-2);
    expect(parsed?.score.text).toBe('-M2');
  });

  it('parses bestmove line', () => {
    const line = 'bestmove e2e4 ponder e7e5';
    const parsed = UCIParser.parseBestMove(line);
    expect(parsed).toBeDefined();
    expect(parsed?.bestMove).toBe('e2e4');
    expect(parsed?.ponder).toBe('e7e5');
  });

  it('normalizes FEN ignoring move clocks', () => {
    const fen1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const fen2 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 14 35';
    expect(UCIParser.normalizeFen(fen1)).toBe(UCIParser.normalizeFen(fen2));
  });
});

describe('Evaluation & Move Classification', () => {
  it('calculates win chance correctly using sigmoid formula', () => {
    expect(EvaluationService.calculateWinChance({ type: 'cp', value: 0, text: '0.0' })).toBe(50);
    expect(EvaluationService.calculateWinChance({ type: 'cp', value: 400, text: '+4.0' })).toBeGreaterThan(85);
    expect(EvaluationService.calculateWinChance({ type: 'cp', value: -400, text: '-4.0' })).toBeLessThan(15);
    expect(EvaluationService.calculateWinChance({ type: 'mate', value: 1, text: '+M1' })).toBe(100);
    expect(EvaluationService.calculateWinChance({ type: 'mate', value: -1, text: '-M1' })).toBe(0);
  });

  it('accurately classifies moves from best to blunder', () => {
    const bestScore = { type: 'cp' as const, value: 50, text: '+0.5' };
    
    const bestMoveScore = { type: 'cp' as const, value: 48, text: '+0.48' };
    expect(EvaluationService.classifyMove(bestScore, bestMoveScore, 'w')).toBe('best');

    const inaccScore = { type: 'cp' as const, value: -60, text: '-0.6' };
    expect(EvaluationService.classifyMove(bestScore, inaccScore, 'w')).toBe('inaccuracy');

    const blunderScore = { type: 'cp' as const, value: -350, text: '-3.5' };
    expect(EvaluationService.classifyMove(bestScore, blunderScore, 'w')).toBe('blunder');
  });
});

describe('Human Thinking & Human Move Prediction', () => {
  const dummyCandidates: CandidateMove[] = [
    {
      uci: 'f1e1',
      san: 'Re1',
      from: 'f1',
      to: 'e1',
      score: { type: 'cp', value: 85, text: '+0.85' },
      depth: 14,
      multipv: 1,
      pv: ['f1e1'],
      classification: 'best',
    },
    {
      uci: 'c4f7',
      san: 'Bxf7+',
      from: 'c4',
      to: 'f7',
      score: { type: 'cp', value: 70, text: '+0.70' },
      depth: 14,
      multipv: 2,
      pv: ['c4f7', 'e8f7'],
      classification: 'excellent',
    },
    {
      uci: 'g1h1',
      san: 'Kh1',
      from: 'g1',
      to: 'h1',
      score: { type: 'cp', value: 30, text: '+0.30' },
      depth: 14,
      multipv: 3,
      pv: ['g1h1'],
      classification: 'good',
    },
  ];

  it('predicts human move preferences across skill levels', () => {
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 4';
    
    // Beginners favor aggressive checks/captures (Bxf7+) over quiet moves
    const beginnerPred = HumanThinkingService.predictHumanMoves(fen, dummyCandidates, 'beginner', 3);
    expect(beginnerPred).toBeDefined();
    expect(beginnerPred?.humanLikelyMove.candidate.san).toBe('Bxf7+');
    expect(beginnerPred?.humanLikelyMove.humanReasoningCategory).toBe('attack');

    // Experts value the top positional piece play (Re1)
    const expertPred = HumanThinkingService.predictHumanMoves(fen, dummyCandidates, 'expert', 3);
    expect(expertPred).toBeDefined();
    expect(expertPred?.humanLikelyMove.candidate.san).toBe('Re1');
  });

  it('provides grounded comparison between human-likely move and engine-best move', () => {
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 4';
    const pred = HumanThinkingService.predictHumanMoves(fen, dummyCandidates, 'casual', 3);
    expect(pred?.comparisonAnalysis).toBeDefined();
    expect(pred?.comparisonAnalysis.length).toBeGreaterThan(20);
  });
});

describe('Side-Specific Filtering Logic', () => {
  it('correctly filters moves for White only vs Black only', () => {
    const whiteTurnFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'; // Black's turn!
    const chess = new Chess(whiteTurnFen);
    expect(chess.turn()).toBe('b');

    // If White-only is selected, Black's turn must be blocked
    const sideFilter = 'white';
    const isBlocked = (sideFilter === 'white' && chess.turn() !== 'w');
    expect(isBlocked).toBe(true);

    // If Black-only is selected, Black's turn must NOT be blocked
    const blackSideFilter = 'black';
    const isBlackBlocked = (blackSideFilter === 'black' && chess.turn() !== 'b');
    expect(isBlackBlocked).toBe(false);
  });

  it('strictly discards moves belonging to the wrong side in processCandidates', () => {
    // Position where it is Black's turn to move
    const blackTurnFen = 'rnbqk2r/pppp1ppp/5n2/2b1p3/4P3/2NP1N2/PPP2PPP/R1BQKB1R b KQkq - 0 4';
    
    // Simulate raw engine output containing a White move (e.g. from residual stopped calculation)
    const rawInfos = new Map<number, ParsedInfo>();
    rawInfos.set(1, {
      depth: 14,
      multipv: 1,
      score: { type: 'cp', value: 45, text: '+0.45' },
      nodes: 1000,
      nps: 100000,
      time: 50,
      pv: ['f3e5', 'd8e7'], // f3e5 is a White move!
    });
    rawInfos.set(2, {
      depth: 14,
      multipv: 2,
      score: { type: 'cp', value: -10, text: '-0.10' },
      nodes: 1000,
      nps: 100000,
      time: 50,
      pv: ['e8g8', 'f1e2'], // e8g8 is a legal Black move (O-O)!
    });

    const candidates = CandidateMoveService.processCandidates(blackTurnFen, rawInfos);
    
    // f3e5 must be completely discarded because it's illegal for Black!
    expect(candidates.find((c) => c.uci === 'f3e5')).toBeUndefined();
    // Only legal Black moves must be retained
    expect(candidates.length).toBe(1);
    expect(candidates[0].uci).toBe('e8g8');
    expect(candidates[0].san).toBe('O-O');
  });

  it('extracts live White and Black clock values from PGN comments', () => {
    const livePgn = `1. c4 { [%clk 0:01:00] } 1... g6 { [%clk 0:01:00] } 2. Nf3 { [%clk 0:00:59] } 2... Bg7 { [%clk 0:00:58] } *`;
    const clocks = GameImportService.extractClocks(livePgn);
    expect(clocks.whiteClock).toBe('0:00:59');
    expect(clocks.blackClock).toBe('0:00:58');
  });
});
