import type { GameRules, GameState, Move, Player } from '../types.js';

interface MCTSNode {
  state: GameState;
  move: Move | null;       // move that led to this state
  parent: MCTSNode | null;
  children: MCTSNode[];
  wins: number;
  visits: number;
  untriedMoves: Move[];
}

const UCT_C = Math.SQRT2;

function uctScore(node: MCTSNode, parentVisits: number): number {
  if (node.visits === 0) return Infinity;
  return node.wins / node.visits + UCT_C * Math.sqrt(Math.log(parentVisits) / node.visits);
}

function selectChild(node: MCTSNode): MCTSNode {
  return node.children.reduce((best, child) =>
    uctScore(child, node.visits) > uctScore(best, node.visits) ? child : best
  );
}

function expand(node: MCTSNode, rules: GameRules): MCTSNode {
  const moveIdx = Math.floor(Math.random() * node.untriedMoves.length);
  const move = node.untriedMoves.splice(moveIdx, 1)[0]!;
  const currentPlayer = node.state.currentPlayer;
  const result = rules.applyMove(node.state, move, currentPlayer);
  const child: MCTSNode = {
    state: result.ok ? result.state : node.state,
    move,
    parent: node,
    children: [],
    wins: 0,
    visits: 0,
    untriedMoves: result.ok ? rules.getLegalMoves(result.state) : [],
  };
  node.children.push(child);
  return child;
}

function simulate(state: GameState, rules: GameRules): Player | null {
  let current = state;
  let steps = 0;
  while (steps++ < 200) {
    const terminal = rules.checkTerminal(current);
    if (terminal) return terminal.winner;
    const moves = rules.getLegalMoves(current);
    if (moves.length === 0) return null;
    const move = moves[Math.floor(Math.random() * moves.length)]!;
    const result = rules.applyMove(current, move, current.currentPlayer);
    if (!result.ok) return null;
    current = result.state;
  }
  return null; // timeout = treat as draw
}

function backpropagate(node: MCTSNode, winner: Player | null, aiPlayer: Player): void {
  let n: MCTSNode | null = node;
  while (n) {
    n.visits++;
    if (winner === aiPlayer) n.wins++;
    else if (winner === null) n.wins += 0.5; // draw is half a win
    n = n.parent;
  }
}

/**
 * Run MCTS for `iterations` simulations and return the best move.
 * Iterations: 100 = easy, 500 = medium, 2000 = hard
 */
export function mctsGetMove(state: GameState, rules: GameRules, aiPlayer: Player, iterations: number): Move {
  const root: MCTSNode = {
    state,
    move: null,
    parent: null,
    children: [],
    wins: 0,
    visits: 0,
    untriedMoves: rules.getLegalMoves(state),
  };

  for (let i = 0; i < iterations; i++) {
    // Selection
    let node = root;
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = selectChild(node);
    }

    // Expansion
    if (node.untriedMoves.length > 0) {
      node = expand(node, rules);
    }

    // Simulation
    const winner = simulate(node.state, rules);

    // Backpropagation
    backpropagate(node, winner, aiPlayer);
  }

  if (root.children.length === 0) {
    return root.untriedMoves[0]!; // fallback: no simulations ran
  }

  const best = root.children.reduce((a, b) => b.visits > a.visits ? b : a);
  return best.move!;
}
