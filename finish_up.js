const fs = require('fs');

function applyFix(file, isAi) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace mapping
  if (!isAi) {
    const oldStr = `                  {(Object.keys(VARIANT_INFO) as Variant[]).map((v) => {
                    const { label, Icon } = VARIANT_INFO[v]!;
                    return (
                      <button
                        key={v}
                        className={\`\${styles.variantBtn} \${variant === v ? styles.selected : ''}\`}
                        onClick={() => dispatch({ type: 'SET_VARIANT', variant: v })}
                      >
                        <Icon size={16} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                        <span>{label}</span>
                      </button>
                    );
                  })}`;
    const newStr = `                  {GAME_VARIANTS.map((v) => {
                    const Icon = VARIANT_ICONS[v.id as Variant];
                    return (
                      <button
                        key={v.id}
                        className={\`\${styles.variantBtn} \${variant === v.id ? styles.selected : ''}\`}
                        onClick={() => dispatch({ type: 'SET_VARIANT', variant: v.id as Variant })}
                      >
                        <Icon size={16} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                        <span>{v.name}</span>
                      </button>
                    );
                  })}`;
    content = content.replace(oldStr, newStr);
  } else {
    const oldStr = `                  {(Object.keys(VARIANT_INFO) as Variant[]).map(v => {
                    const { label, Icon } = VARIANT_INFO[v]!;
                    return (
                      <button key={v}
                        className={\`\${localStyles.variantBtn} \${variant === v ? localStyles.selected : ''}\`}
                        onClick={() => setVariant(v)}
                      >
                        <Icon size={16} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                        <span>{label}</span>
                      </button>
                    );
                  })}`;
    const newStr = `                  {GAME_VARIANTS.map(v => {
                    const Icon = VARIANT_ICONS[v.id as Variant];
                    return (
                      <button key={v.id}
                        className={\`\${localStyles.variantBtn} \${variant === v.id ? localStyles.selected : ''}\`}
                        onClick={() => setVariant(v.id as Variant)}
                      >
                        <Icon size={16} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                        <span>{v.name}</span>
                      </button>
                    );
                  })}`;
    content = content.replace(oldStr, newStr);
  }

  // Also verify VARIANT_INFO exists before trying to replace it
  if (content.includes('const VARIANT_INFO')) {
    const infoRegex = /const VARIANT_INFO.*?\{\n(.*?\}|.*?)*?.*?\};\n/s;
    const newIconsMap = `const VARIANT_ICONS: Record<Variant, any> = {
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
};\n`;
    content = content.replace(infoRegex, newIconsMap);
  }

  fs.writeFileSync(file, content);
}

applyFix('apps/web/src/app/local/page.tsx', false);
applyFix('apps/web/src/app/vs-ai/page.tsx', true);

