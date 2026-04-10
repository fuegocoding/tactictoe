const fs = require('fs');

function replaceInfo(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Find the start of VARIANT_INFO
  const startIndex = content.indexOf('const VARIANT_INFO');
  if (startIndex === -1) return;

  // Find the end of it
  const endIndex = content.indexOf('};', startIndex) + 2;

  const replacement = `const VARIANT_ICONS: Record<string, any> = {
  standard_3x3:  Grid3x3,
  ultimate_ttt:  Table2,
  misere_ttt:    Target,
  wild_ttt:      Asterisk,
  notakto_ttt:   Ban,
  gomoku:        Grip,
  sos_ttt:       Type,
  numerical_ttt: Hash,
  vanishing_ttt: Eye,
  ttt_3d:        Layers,
  ttt_4d:        Box,
  order_chaos:   Shuffle,
  tactic_toe:    Swords,
  ultimate_3d:   Network,
  garrison:      Shield,
};`;

  content = content.slice(0, startIndex) + replacement + content.slice(endIndex);
  fs.writeFileSync(file, content);
}

replaceInfo('apps/web/src/app/local/page.tsx');
replaceInfo('apps/web/src/app/vs-ai/page.tsx');
