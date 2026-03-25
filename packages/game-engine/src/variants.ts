export interface VariantMeta {
  id: string;
  name: string;
  description: string;
  allowPrivate: boolean;
  allowCasual: boolean;
  allowRated: boolean;
}

export const GAME_VARIANTS: VariantMeta[] = [
  { id: 'ultimate_ttt',  name: 'Ultimate',      description: '9 boards in one. The flagship.',                           allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'standard_3x3', name: 'Classic',        description: 'Classic 3×3. Quick casual games.',                         allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'gomoku',        name: 'Gomoku',         description: '15×15 board. First to 5 in a row wins. Deep strategy.',    allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'misere_ttt',   name: 'Misère',         description: 'Force your opponent to get 3-in-a-row to win.',            allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'notakto_ttt',  name: 'Notakto',        description: 'Both players place X. Avoid making 3-in-a-row!',           allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'wild_ttt',     name: 'Wild',           description: 'Choose to place X or O on every turn.',                    allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'sos_ttt',      name: 'SOS',            description: 'Place S or O to spell S-O-S for points + extra turns.',    allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'numerical_ttt',name: 'Numerical',      description: 'Place numbers to sum precisely to 15.',                    allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'vanishing_ttt',name: 'Vanishing',      description: 'Pieces disappear after 6 moves. Memory counts.',           allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'ttt_3d',       name: '3D TTT',         description: '3×3×3 cube with 49 possible win lines.',                   allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'ttt_4d',       name: '4D TTT',         description: '3×3×3×3 hypercube. Four dimensions of strategy.',          allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'order_chaos',  name: 'Order & Chaos',  description: '6×6 asymmetric game. One side orders, one creates chaos.', allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'tactic_toe',   name: 'Tactic Toe',     description: '3D board with 8 moveable obstacles. Plan ahead.',          allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'ultimate_3d',  name: 'Ultimate 3D',    description: 'Ultimate TTT expanded to 3D. 729 cells, one winner.',      allowPrivate: true, allowCasual: true, allowRated: true },
  { id: 'garrison',     name: 'Garrison',       description: 'Place chess pieces on an 8×8 board. Win by 5-in-a-row.',    allowPrivate: true, allowCasual: true, allowRated: false },
];
