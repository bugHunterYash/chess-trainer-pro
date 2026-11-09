import os
from flask import Flask, render_template, request, jsonify
import chess
from chess_engine import trainer, AVAILABLE_LEVELS, LEVEL_INFO

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html', levels=AVAILABLE_LEVELS, level_info=LEVEL_INFO)

@app.route('/api/levels', methods=['GET'])
def get_levels():
    return jsonify({
        "levels": AVAILABLE_LEVELS,
        "level_info": LEVEL_INFO
    })

@app.route('/api/suggest', methods=['POST'])
def suggest_move():
    data = request.get_json() or {}
    fen = data.get('fen', chess.STARTING_FEN)
    level = int(data.get('level', 1500))
    mode = data.get('mode', 'good_only')

    try:
        board = chess.Board(fen)
    except Exception as e:
        return jsonify({"error": f"Invalid FEN: {str(e)}"}), 400

    result = trainer.suggest_good_move(board, level=level, mode=mode)
    return jsonify(result)

@app.route('/api/play_move', methods=['POST'])
def play_move():
    """Bot makes a move based on its Maia human rating."""
    data = request.get_json() or {}
    fen = data.get('fen', chess.STARTING_FEN)
    level = int(data.get('level', 1500))

    try:
        board = chess.Board(fen)
    except Exception as e:
        return jsonify({"error": f"Invalid FEN: {str(e)}"}), 400

    if board.is_game_over():
        return jsonify({
            "is_game_over": True,
            "result": board.result()
        })

    # Pick move using Maia distribution with slight probabilistic sampling or top choice
    # For a human opponent, Maia's top move or weighted sample
    maia_moves, wdl, resolved_level = trainer.get_maia_distribution(board, level)
    if not maia_moves:
        return jsonify({"error": "No legal moves available."}), 400

    # Pick top move or top 2
    bot_move_obj = chess.Move.from_uci(maia_moves[0]["uci"])
    move_san = board.san(bot_move_obj)
    
    explanation = trainer.explain_move(board, bot_move_obj, maia_moves[0]["prob"], False)

    board.push(bot_move_obj)

    return jsonify({
        "fen": board.fen(),
        "move": {
            "uci": bot_move_obj.uci(),
            "san": move_san,
            "from_sq": bot_move_obj.uci()[:2],
            "to_sq": bot_move_obj.uci()[2:4],
            "concept": explanation["concept"]
        },
        "is_game_over": board.is_game_over(),
        "result": board.result() if board.is_game_over() else None
    })

@app.route('/api/validate_move', methods=['POST'])
def validate_move():
    data = request.get_json() or {}
    fen = data.get('fen', chess.STARTING_FEN)
    from_sq = data.get('from_sq')
    to_sq = data.get('to_sq')
    promotion = data.get('promotion', 'q')

    try:
        board = chess.Board(fen)
        uci_str = f"{from_sq}{to_sq}"
        move = chess.Move.from_uci(uci_str)

        # Check for promotion
        if not board.is_legal(move):
            promo_move = chess.Move.from_uci(f"{uci_str}{promotion.lower()}")
            if board.is_legal(promo_move):
                move = promo_move

        if not board.is_legal(move):
            return jsonify({"valid": False, "error": "Illegal move."})

        san = board.san(move)
        board.push(move)

        return jsonify({
            "valid": True,
            "fen": board.fen(),
            "san": san,
            "uci": move.uci(),
            "is_game_over": board.is_game_over(),
            "result": board.result() if board.is_game_over() else None
        })
    except Exception as e:
        return jsonify({"valid": False, "error": str(e)}), 400

if __name__ == '__main__':
    print("Starting Chess Practice Trainer on http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=False)

