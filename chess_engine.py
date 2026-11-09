import os
import math
import numpy as np
import chess
import chess.engine
import onnxruntime as ort
from lczerolens._codec import encode_input, encode_move

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')
STOCKFISH_PATH = os.path.join(BASE_DIR, 'engine', 'stockfish', 'stockfish-windows-x86-64-universal.exe')

AVAILABLE_LEVELS = [1100, 1300, 1500, 1700, 1900]

LEVEL_INFO = {
    1100: {"title": "Beginner Human (1100)", "desc": "Focuses on simple piece development, central pushes, and direct attacks. Misses subtle tactical replies and occasionally drops undefended pieces."},
    1300: {"title": "Casual Human (1300)", "desc": "Controls the center and active development, but struggles with prophylactic defense and multi-step combinations."},
    1500: {"title": "Intermediate Human (1500)", "desc": "Solid tactical vision, standard opening plans, active piece play. Avoids one-move blunders and creates natural attacking threats."},
    1700: {"title": "Advanced Human (1700)", "desc": "Strong positional understanding, solid piece coordination, reliable tactical defense and pawn break awareness."},
    1900: {"title": "Expert Human (1900)", "desc": "Tournament-grade calculation and refined plans. Plays human master-level chess without inhuman engine computer moves."}
}

class ChessTrainerEngine:
    def __init__(self):
        self.sessions = {}
        self.sf_engine = None

    def get_session(self, level: int):
        """Lazy load ONNX model on demand to keep startup instant."""
        if level not in AVAILABLE_LEVELS:
            level = min(AVAILABLE_LEVELS, key=lambda x: abs(x - level))

        if level not in self.sessions:
            path = os.path.join(MODELS_DIR, f'maia-{level}.onnx')
            if not os.path.exists(path):
                raise FileNotFoundError(f"Model file not found: {path}")
            
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            self.sessions[level] = ort.InferenceSession(path, sess_options=opts)

        return self.sessions[level], level

    def get_stockfish(self):
        """Lazy init Stockfish engine."""
        if self.sf_engine is None and os.path.exists(STOCKFISH_PATH):
            try:
                self.sf_engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
                self.sf_engine.configure({"Threads": 2, "Hash": 32})
            except Exception as e:
                print(f"Stockfish init error: {e}")
                self.sf_engine = None
        return self.sf_engine

    def evaluate_position_stockfish(self, board: chess.Board, time_limit: float = 0.15, multipv: int = 3):
        sf = self.get_stockfish()
        if not sf or board.is_game_over():
            return 0.0, []

        try:
            info_list = sf.analyse(board, chess.engine.Limit(time=time_limit), multipv=multipv)
            moves_eval = []
            main_eval = 0.0

            # If multipv==1, sf.analyse might return a dict rather than list
            if isinstance(info_list, dict):
                info_list = [info_list]

            for i, info in enumerate(info_list):
                if 'pv' not in info or not info['pv']:
                    continue
                move = info['pv'][0]
                score_obj = info['score'].relative
                
                if score_obj.is_mate():
                    mate_in = score_obj.mate()
                    cp = 10000 if mate_in > 0 else -10000
                    text_score = f"M{abs(mate_in)}" if mate_in > 0 else f"-M{abs(mate_in)}"
                else:
                    cp = score_obj.score()
                    text_score = f"{cp / 100.0:+.2f}"

                eval_val = cp / 100.0 if not score_obj.is_mate() else (100.0 if cp > 0 else -100.0)
                if i == 0:
                    main_eval = eval_val

                moves_eval.append({
                    "uci": move.uci(),
                    "san": board.san(move),
                    "cp": cp,
                    "eval": eval_val,
                    "text_score": text_score,
                    "pv": [m.uci() for m in info['pv'][:4]]
                })
            return main_eval, moves_eval
        except Exception as e:
            print(f"Stockfish analysis error: {e}")
            return 0.0, []

    def get_maia_distribution(self, board: chess.Board, level: int = 1500):
        session, resolved_lvl = self.get_session(level)
        if board.is_game_over():
            return [], [0.33, 0.33, 0.33], resolved_lvl

        planes = encode_input(board).unsqueeze(0).numpy().astype(np.float32)
        outputs = session.run(None, {'/input/planes': planes})
        policy = outputs[0][0]
        wdl = outputs[1][0].tolist()

        legal_moves = list(board.legal_moves)
        if not legal_moves:
            return [], wdl, resolved_lvl

        logits = []
        for m in legal_moves:
            idx = encode_move(board, m)
            logits.append(float(policy[idx]))

        logits = np.array(logits, dtype=np.float64)
        max_logit = np.max(logits)
        exp_logits = np.exp(logits - max_logit)
        probs = exp_logits / np.sum(exp_logits)

        move_list = []
        for m, prob, logit in zip(legal_moves, probs, logits):
            move_list.append({
                "uci": m.uci(),
                "san": board.san(m),
                "prob": float(prob),
                "percent": round(float(prob) * 100, 1),
                "logit": float(logit)
            })

        move_list.sort(key=lambda x: x["prob"], reverse=True)
        return move_list, wdl, resolved_lvl

    def explain_move(self, board: chess.Board, move: chess.Move, human_prob: float, is_engine_best: bool):
        piece = board.piece_at(move.from_square)
        captured = board.piece_at(move.to_square)
        is_capture = board.is_capture(move)
        is_castling = board.is_castling(move)
        to_square_name = chess.square_name(move.to_square)
        san = board.san(move)

        center_squares = [chess.E4, chess.D4, chess.E5, chess.D5]
        extended_center = [chess.C4, chess.F4, chess.C5, chess.F5, chess.E3, chess.D3, chess.E6, chess.D6]

        reasons = []

        if is_castling:
            reasons.append("Tucks the King into safety and connects the rooks.")
        elif piece:
            p_type = piece.piece_type
            if p_type == chess.PAWN:
                if move.to_square in center_squares:
                    reasons.append(f"Directly stakes claim in the center on {to_square_name}.")
                elif move.to_square in extended_center:
                    reasons.append(f"Builds central influence and solidifies pawn structure.")
                elif move.promotion:
                    reasons.append("Promotes pawn into a powerful queen!")
                else:
                    reasons.append(f"Advances pawn on {to_square_name} to gain territory.")

            elif p_type == chess.KNIGHT:
                if move.to_square in center_squares or move.to_square in extended_center:
                    reasons.append(f"Develops knight to an active central square on {to_square_name}.")
                else:
                    reasons.append(f"Repositions knight toward active play.")

            elif p_type == chess.BISHOP:
                reasons.append(f"Activates the bishop along the diagonal targeting {to_square_name}.")

            elif p_type == chess.ROOK:
                file_idx = chess.square_file(move.to_square)
                reasons.append(f"Places rook on the open {chess.FILE_NAMES[file_idx]}-file.")

            elif p_type == chess.QUEEN:
                reasons.append("Positions queen actively with multi-diagonal control.")

            elif p_type == chess.KING:
                reasons.append("Improves king position for safety or endgame activity.")

        if is_capture:
            cap_type_name = chess.piece_name(captured.piece_type) if captured else "piece"
            reasons.append(f"Captures {cap_type_name} on {to_square_name}, winning material or reducing pressure.")

        board.push(move)
        if board.is_check():
            reasons.append("Delivers check to keep the initiative.")
        board.pop()

        concept = " ".join(reasons) if reasons else f"Solid piece placement on {to_square_name}."

        if human_prob > 0.35:
            advice = f"High human consensus ({human_prob*100:.0f}% of players): this is the most natural, intuitive plan."
        elif human_prob > 0.15:
            advice = f"Solid human alternative ({human_prob*100:.0f}% preference): very playable without engine memorization."
        else:
            advice = f"Tactical option ({human_prob*100:.0f}% human pick): solid practical idea."

        return {
            "concept": concept,
            "advice": advice,
            "san": san
        }

    def suggest_good_move(self, board: chess.Board, level: int = 1500, mode: str = "good_only"):
        if board.is_game_over():
            return {"error": "Game is already over."}

        # 1. Get Maia human distribution
        maia_moves, wdl, resolved_level = self.get_maia_distribution(board, level)
        if not maia_moves:
            return {"error": "No legal moves."}

        # 2. Get Stockfish evaluation & top engine moves
        main_eval, sf_moves = self.evaluate_position_stockfish(board, time_limit=0.15, multipv=3)
        sf_best_move_uci = sf_moves[0]["uci"] if sf_moves else None
        sf_eval_map = {m["uci"]: m["eval"] for m in sf_moves}

        chosen_candidate = None
        blunder_prevented = False

        if mode == "good_only" and sf_moves:
            best_sf_eval = sf_moves[0]["eval"]
            # Look down Maia's sorted list for a move that doesn't drop > 1.3 pawns
            for cand in maia_moves:
                cand_uci = cand["uci"]
                cand_move = chess.Move.from_uci(cand_uci)
                
                if cand_uci in sf_eval_map:
                    cand_eval = sf_eval_map[cand_uci]
                else:
                    # Quick verification
                    try:
                        board.push(cand_move)
                        sub_eval, _ = self.evaluate_position_stockfish(board, time_limit=0.08, multipv=1)
                        cand_eval = -sub_eval
                        board.pop()
                    except:
                        cand_eval = best_sf_eval - 0.2

                if (best_sf_eval - cand_eval) <= 1.3:
                    chosen_candidate = cand
                    chosen_candidate["eval"] = cand_eval
                    break
                else:
                    blunder_prevented = True

        if not chosen_candidate:
            chosen_candidate = maia_moves[0]
            chosen_candidate["eval"] = sf_eval_map.get(chosen_candidate["uci"], main_eval)

        chosen_move_obj = chess.Move.from_uci(chosen_candidate["uci"])
        is_same_as_engine = (chosen_candidate["uci"] == sf_best_move_uci)

        explanation = self.explain_move(
            board, 
            chosen_move_obj, 
            chosen_candidate["prob"], 
            is_same_as_engine
        )

        sf_comparison = None
        if sf_moves and not is_same_as_engine:
            sf_top = sf_moves[0]
            sf_move_obj = chess.Move.from_uci(sf_top["uci"])
            sf_explain = self.explain_move(board, sf_move_obj, 0.0, True)
            
            diff = round(sf_top["eval"] - chosen_candidate["eval"], 2)
            sf_comparison = {
                "engine_move_uci": sf_top["uci"],
                "engine_move_san": sf_top["san"],
                "engine_eval": sf_top["text_score"],
                "eval_difference": f"{diff:+.2f}",
                "engine_concept": sf_explain["concept"],
                "why_engine": "Stockfish's move relies on computer calculation depth. The suggested human move is much more natural and practical to find and play in human games."
            }

        top_candidates = []
        for c in maia_moves[:4]:
            top_candidates.append({
                "uci": c["uci"],
                "san": c["san"],
                "prob_percent": c["percent"],
                "is_chosen": c["uci"] == chosen_candidate["uci"]
            })

        return {
            "fen": board.fen(),
            "level": resolved_level,
            "level_info": LEVEL_INFO.get(resolved_level, {}),
            "mode": mode,
            "suggested_move": {
                "uci": chosen_candidate["uci"],
                "san": chosen_candidate["san"],
                "from_sq": chosen_candidate["uci"][:2],
                "to_sq": chosen_candidate["uci"][2:4],
                "human_popularity": f"{chosen_candidate['percent']}%",
                "eval": f"{chosen_candidate['eval']:+.2f}",
                "concept": explanation["concept"],
                "advice": explanation["advice"],
                "is_engine_best": is_same_as_engine,
                "blunder_prevented": blunder_prevented
            },
            "position_eval": f"{main_eval:+.2f}",
            "wdl": {
                "win": round(wdl[0] * 100, 1),
                "draw": round(wdl[1] * 100, 1),
                "loss": round(wdl[2] * 100, 1)
            },
            "engine_comparison": sf_comparison,
            "human_candidates": top_candidates
        }

    def close(self):
        if self.sf_engine:
            try:
                self.sf_engine.quit()
            except:
                pass

trainer = ChessTrainerEngine()
