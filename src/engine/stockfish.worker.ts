/**
 * Stockfish Web Worker wrapper.
 * Acts as an isolated thread communicating via standard UCI protocol.
 */

// If Stockfish is loaded via importScripts inside worker:
try {
  // @ts-ignore
  importScripts('/engine/stockfish-19-lite-single.js');
} catch (err) {
  console.warn('Failed to import stockfish-19-lite-single.js directly in worker, falling back to asm:', err);
  try {
    // @ts-ignore
    importScripts('/engine/stockfish-19-asm.js');
  } catch (e) {
    console.error('All stockfish imports failed in worker:', e);
  }
}

export {};

