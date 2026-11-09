let lastLiveState = {
  moves: [],
  fen: '',
  orientation: 'white',
  whiteClock: '',
  blackClock: '',
  timestamp: 0,
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      lastLiveState = {
        moves: Array.isArray(data.moves) ? data.moves : [],
        fen: data.fen || '',
        orientation: data.orientation || 'white',
        whiteClock: data.whiteClock || '',
        blackClock: data.blackClock || '',
        timestamp: Date.now(),
      };
      return res.status(200).json({ status: 'ok', movesCount: lastLiveState.moves.length });
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  if (req.method === 'GET') {
    return res.status(200).json(lastLiveState);
  }

  return res.status(405).end();
}

