export type Theme = {
  id: string;
  name: string;
  type: 'dark' | 'light';
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  // black, red, green, yellow, blue, magenta, cyan, white, then the bright variants
  ansi: string[];
};

// [id, name, type, bg, surface, border, text, muted, accent, ansi (space separated)]
type Row = [string, string, 'dark' | 'light', string, string, string, string, string, string, string];

const rows: Row[] = [
  ['shellmoor', 'Shellmoor', 'dark', '#0e1013', '#15181d', '#262a31', '#d8dde4', '#7d8590', '#5fd4b0',
    '#1b1e23 #e06c75 #5fd4b0 #e5c07b #61afef #c678dd #56b6c2 #d8dde4 #5c6370 #ff7b86 #7ee8c8 #f0d08a #7cc0ff #d79af0 #6fd0dc #ffffff'],
  ['dracula', 'Dracula', 'dark', '#282a36', '#21222c', '#44475a', '#f8f8f2', '#6272a4', '#bd93f9',
    '#21222c #ff5555 #50fa7b #f1fa8c #bd93f9 #ff79c6 #8be9fd #f8f8f2 #6272a4 #ff6e6e #69ff94 #ffffa5 #d6acff #ff92df #a4ffff #ffffff'],
  ['nord', 'Nord', 'dark', '#2e3440', '#3b4252', '#434c5e', '#d8dee9', '#7b88a1', '#88c0d0',
    '#3b4252 #bf616a #a3be8c #ebcb8b #81a1c1 #b48ead #88c0d0 #e5e9f0 #4c566a #bf616a #a3be8c #ebcb8b #81a1c1 #b48ead #8fbcbb #eceff4'],
  ['gruvbox-dark', 'Gruvbox Dark', 'dark', '#282828', '#1d2021', '#3c3836', '#ebdbb2', '#928374', '#fabd2f',
    '#282828 #cc241d #98971a #d79921 #458588 #b16286 #689d6a #a89984 #928374 #fb4934 #b8bb26 #fabd2f #83a598 #d3869b #8ec07c #ebdbb2'],
  ['gruvbox-light', 'Gruvbox Light', 'light', '#fbf1c7', '#f2e5bc', '#d5c4a1', '#3c3836', '#7c6f64', '#af3a03',
    '#fbf1c7 #cc241d #98971a #d79921 #458588 #b16286 #689d6a #7c6f64 #928374 #9d0006 #79740e #b57614 #076678 #8f3f71 #427b58 #3c3836'],
  ['solarized-dark', 'Solarized Dark', 'dark', '#002b36', '#073642', '#0d4553', '#93a1a1', '#586e75', '#2aa198',
    '#073642 #dc322f #859900 #b58900 #268bd2 #d33682 #2aa198 #eee8d5 #002b36 #cb4b16 #586e75 #657b83 #839496 #6c71c4 #93a1a1 #fdf6e3'],
  ['solarized-light', 'Solarized Light', 'light', '#fdf6e3', '#eee8d5', '#ddd6c1', '#586e75', '#93a1a1', '#268bd2',
    '#073642 #dc322f #859900 #b58900 #268bd2 #d33682 #2aa198 #eee8d5 #002b36 #cb4b16 #586e75 #657b83 #839496 #6c71c4 #93a1a1 #fdf6e3'],
  ['one-dark', 'One Dark', 'dark', '#282c34', '#21252b', '#3e4451', '#abb2bf', '#5c6370', '#61afef',
    '#282c34 #e06c75 #98c379 #e5c07b #61afef #c678dd #56b6c2 #abb2bf #5c6370 #e06c75 #98c379 #e5c07b #61afef #c678dd #56b6c2 #ffffff'],
  ['one-light', 'One Light', 'light', '#fafafa', '#f0f0f0', '#e0e0e0', '#383a42', '#a0a1a7', '#4078f2',
    '#383a42 #e45649 #50a14f #c18401 #4078f2 #a626a4 #0184bc #a0a1a7 #696c77 #e45649 #50a14f #c18401 #4078f2 #a626a4 #0184bc #fafafa'],
  ['monokai', 'Monokai', 'dark', '#272822', '#1e1f1c', '#3e3d32', '#f8f8f2', '#75715e', '#a6e22e',
    '#272822 #f92672 #a6e22e #f4bf75 #66d9ef #ae81ff #a1efe4 #f8f8f2 #75715e #f92672 #a6e22e #f4bf75 #66d9ef #ae81ff #a1efe4 #f9f8f5'],
  ['tokyo-night', 'Tokyo Night', 'dark', '#1a1b26', '#16161e', '#292e42', '#c0caf5', '#565f89', '#7aa2f7',
    '#15161e #f7768e #9ece6a #e0af68 #7aa2f7 #bb9af7 #7dcfff #a9b1d6 #414868 #f7768e #9ece6a #e0af68 #7aa2f7 #bb9af7 #7dcfff #c0caf5'],
  ['tokyo-night-day', 'Tokyo Night Day', 'light', '#e1e2e7', '#d0d5e3', '#c4c8da', '#3760bf', '#848cb5', '#2e7de9',
    '#e9e9ed #f52a65 #587539 #8c6c3e #2e7de9 #9854f1 #007197 #6172b0 #a1a6c5 #f52a65 #587539 #8c6c3e #2e7de9 #9854f1 #007197 #3760bf'],
  ['catppuccin-mocha', 'Catppuccin Mocha', 'dark', '#1e1e2e', '#181825', '#313244', '#cdd6f4', '#7f849c', '#cba6f7',
    '#45475a #f38ba8 #a6e3a1 #f9e2af #89b4fa #f5c2e7 #94e2d5 #bac2de #585b70 #f38ba8 #a6e3a1 #f9e2af #89b4fa #f5c2e7 #94e2d5 #a6adc8'],
  ['catppuccin-macchiato', 'Catppuccin Macchiato', 'dark', '#24273a', '#1e2030', '#363a4f', '#cad3f5', '#8087a2', '#8aadf4',
    '#494d64 #ed8796 #a6da95 #eed49f #8aadf4 #f5bde6 #8bd5ca #b8c0e0 #5b6078 #ed8796 #a6da95 #eed49f #8aadf4 #f5bde6 #8bd5ca #a5adcb'],
  ['catppuccin-frappe', 'Catppuccin Frappé', 'dark', '#303446', '#292c3c', '#414559', '#c6d0f5', '#838ba7', '#ca9ee6',
    '#51576d #e78284 #a6d189 #e5c890 #8caaee #f4b8e4 #81c8be #b5bfe2 #626880 #e78284 #a6d189 #e5c890 #8caaee #f4b8e4 #81c8be #a5adce'],
  ['catppuccin-latte', 'Catppuccin Latte', 'light', '#eff1f5', '#e6e9ef', '#ccd0da', '#4c4f69', '#8c8fa1', '#8839ef',
    '#5c5f77 #d20f39 #40a02b #df8e1d #1e66f5 #ea76cb #179299 #acb0be #6c6f85 #d20f39 #40a02b #df8e1d #1e66f5 #ea76cb #179299 #bcc0cc'],
  ['rose-pine', 'Rosé Pine', 'dark', '#191724', '#1f1d2e', '#26233a', '#e0def4', '#6e6a86', '#ebbcba',
    '#26233a #eb6f92 #31748f #f6c177 #9ccfd8 #c4a7e7 #ebbcba #e0def4 #6e6a86 #eb6f92 #31748f #f6c177 #9ccfd8 #c4a7e7 #ebbcba #e0def4'],
  ['rose-pine-moon', 'Rosé Pine Moon', 'dark', '#232136', '#2a273f', '#393552', '#e0def4', '#6e6a86', '#ea9a97',
    '#393552 #eb6f92 #3e8fb0 #f6c177 #9ccfd8 #c4a7e7 #ea9a97 #e0def4 #6e6a86 #eb6f92 #3e8fb0 #f6c177 #9ccfd8 #c4a7e7 #ea9a97 #e0def4'],
  ['rose-pine-dawn', 'Rosé Pine Dawn', 'light', '#faf4ed', '#fffaf3', '#f2e9e1', '#575279', '#9893a5', '#d7827e',
    '#f2e9e1 #b4637a #286983 #ea9d34 #56949f #907aa9 #d7827e #575279 #9893a5 #b4637a #286983 #ea9d34 #56949f #907aa9 #d7827e #575279'],
  ['everforest-dark', 'Everforest Dark', 'dark', '#2d353b', '#272e33', '#3d484d', '#d3c6aa', '#859289', '#a7c080',
    '#475258 #e67e80 #a7c080 #dbbc7f #7fbbb3 #d699b6 #83c092 #d3c6aa #859289 #e67e80 #a7c080 #dbbc7f #7fbbb3 #d699b6 #83c092 #d3c6aa'],
  ['everforest-light', 'Everforest Light', 'light', '#fdf6e3', '#f4f0d9', '#e6e2cc', '#5c6a72', '#939f91', '#8da101',
    '#5c6a72 #f85552 #8da101 #dfa000 #3a94c5 #df69ba #35a77c #dfddc8 #939f91 #f85552 #8da101 #dfa000 #3a94c5 #df69ba #35a77c #fdf6e3'],
  ['kanagawa', 'Kanagawa', 'dark', '#1f1f28', '#16161d', '#2a2a37', '#dcd7ba', '#727169', '#7e9cd8',
    '#16161d #c34043 #76946a #c0a36e #7e9cd8 #957fb8 #6a9589 #c8c093 #727169 #e82424 #98bb6c #e6c384 #7fb4ca #938aa9 #7aa89f #dcd7ba'],
  ['github-dark', 'GitHub Dark', 'dark', '#0d1117', '#161b22', '#30363d', '#e6edf3', '#7d8590', '#2f81f7',
    '#484f58 #ff7b72 #3fb950 #d29922 #58a6ff #bc8cff #39c5cf #b1bac4 #6e7681 #ffa198 #56d364 #e3b341 #79c0ff #d2a8ff #56d4dd #ffffff'],
  ['github-light', 'GitHub Light', 'light', '#ffffff', '#f6f8fa', '#d0d7de', '#1f2328', '#656d76', '#0969da',
    '#24292f #cf222e #116329 #4d2d00 #0969da #8250df #1b7c83 #6e7781 #57606a #a40e26 #1a7f37 #633c01 #218bff #a475f9 #3192aa #8c959f'],
  ['ayu-dark', 'Ayu Dark', 'dark', '#0b0e14', '#0d1017', '#1e222a', '#bfbdb6', '#565b66', '#e6b450',
    '#1e232b #ea6c73 #7fd962 #f9af4f #53bdfa #cda1fa #90e1c6 #c7c7c7 #686868 #f07178 #aad94c #ffb454 #59c2ff #d2a6ff #95e6cb #ffffff'],
  ['ayu-light', 'Ayu Light', 'light', '#fcfcfc', '#f3f4f5', '#e7e8e9', '#5c6166', '#8a9199', '#ff9940',
    '#000000 #ea6c6d #6cbf43 #eca944 #3199e1 #9e75c7 #46ba94 #bababa #686868 #f07171 #86b300 #f2ae49 #399ee6 #a37acc #4cbf99 #d1d1d1'],
  ['night-owl', 'Night Owl', 'dark', '#011627', '#01111d', '#122d42', '#d6deeb', '#5f7e97', '#82aaff',
    '#011627 #ef5350 #22da6e #addb67 #82aaff #c792ea #21c7a8 #ffffff #575656 #ef5350 #22da6e #ffeb95 #82aaff #c792ea #7fdbca #ffffff'],
  ['synthwave-84', "Synthwave '84", 'dark', '#262335', '#1e1a2e', '#34294f', '#ffffff', '#848bbd', '#ff7edb',
    '#262335 #fe4450 #72f1b8 #fede5d #03edf9 #ff7edb #03edf9 #ffffff #614d85 #fe4450 #72f1b8 #f97e72 #03edf9 #ff7edb #03edf9 #ffffff'],
  ['palenight', 'Material Palenight', 'dark', '#292d3e', '#232635', '#3a3f58', '#a6accd', '#676e95', '#c792ea',
    '#292d3e #f07178 #c3e88d #ffcb6b #82aaff #c792ea #89ddff #d0d0d0 #434758 #ff8b92 #ddffa7 #ffe585 #9cc4ff #e1acff #a3f7ff #ffffff'],
  ['material-ocean', 'Material Ocean', 'dark', '#0f111a', '#090b10', '#1f2233', '#8f93a2', '#4b526d', '#84ffff',
    '#546e7a #ff5370 #c3e88d #ffcb6b #82aaff #c792ea #89ddff #ffffff #546e7a #ff5370 #c3e88d #ffcb6b #82aaff #c792ea #89ddff #ffffff'],
  ['cobalt2', 'Cobalt2', 'dark', '#193549', '#122738', '#234e6d', '#ffffff', '#0088ff', '#ffc600',
    '#000000 #ff0000 #38de21 #ffe50a #1460d2 #ff005d #00bbbb #bbbbbb #555555 #f40e17 #3bd01d #edc809 #5555ff #ff55ff #6ae3fa #ffffff'],
  ['horizon', 'Horizon', 'dark', '#1c1e26', '#16161c', '#2e303e', '#d5d8da', '#6c6f93', '#e95678',
    '#16161c #e95678 #29d398 #fab795 #26bbd9 #ee64ac #59e1e3 #d5d8da #5b5858 #ec6a88 #3fdaa4 #fbc3a7 #3fc4de #f075b5 #6be4e6 #d5d8da'],
  ['oceanic-next', 'Oceanic Next', 'dark', '#1b2b34', '#16232a', '#343d46', '#c0c5ce', '#65737e', '#6699cc',
    '#343d46 #ec5f67 #99c794 #fac863 #6699cc #c594c5 #5fb3b3 #c0c5ce #65737e #ec5f67 #99c794 #fac863 #6699cc #c594c5 #5fb3b3 #d8dee9'],
  ['nightfox', 'Nightfox', 'dark', '#192330', '#131a24', '#29394f', '#cdcecf', '#738091', '#719cd6',
    '#393b44 #c94f6d #81b29a #dbc074 #719cd6 #9d79d6 #63cdcf #dfdfe0 #575860 #d16983 #8ebaa4 #e0c989 #86abdc #baa1e2 #7ad5d6 #e4e4e5'],
  ['iceberg', 'Iceberg', 'dark', '#161821', '#1e2132', '#2a3158', '#c6c8d1', '#6b7089', '#84a0c6',
    '#1e2132 #e27878 #b4be82 #e2a478 #84a0c6 #a093c7 #89b8c2 #c6c8d1 #6b7089 #e98989 #c0ca8e #e9b189 #91acd1 #ada0d3 #95c4ce #d2d4de'],
  ['zenburn', 'Zenburn', 'dark', '#3f3f3f', '#383838', '#4f4f4f', '#dcdccc', '#7f9f7f', '#f0dfaf',
    '#4d4d4d #705050 #60b48a #f0dfaf #506070 #dc8cc3 #8cd0d3 #dcdccc #709080 #dca3a3 #c3bf9f #e0cf9f #94bff3 #ec93d3 #93e0e3 #ffffff'],
  ['vesper', 'Vesper', 'dark', '#101010', '#161616', '#282828', '#ffffff', '#a0a0a0', '#ffc799',
    '#101010 #ff8080 #99ffe4 #ffc799 #a0a0a0 #ffc799 #99ffe4 #ffffff #505050 #ff8080 #99ffe4 #ffc799 #b0b0b0 #ffc799 #99ffe4 #ffffff'],
  ['matrix', 'Matrix', 'dark', '#000000', '#030a03', '#0f2a0f', '#33ff66', '#1a8c3a', '#00ff41',
    '#000000 #1a8c3a #00ff41 #66ff99 #22bb55 #33dd77 #44ff88 #99ffbb #0f3d1a #33aa55 #33ff66 #88ffaa #44dd77 #55ee99 #77ffaa #ccffdd'],
  ['monochrome', 'Monochrome', 'dark', '#111111', '#1a1a1a', '#2c2c2c', '#e0e0e0', '#808080', '#ffffff',
    '#111111 #9a9a9a #bdbdbd #d0d0d0 #8a8a8a #a8a8a8 #c4c4c4 #e0e0e0 #555555 #b0b0b0 #d0d0d0 #e8e8e8 #a0a0a0 #c0c0c0 #dadada #ffffff'],
  ['high-contrast', 'High Contrast', 'dark', '#000000', '#0a0a0a', '#6fc3df', '#ffffff', '#c0c0c0', '#ffff00',
    '#000000 #ff4040 #40ff40 #ffff00 #4fa8ff #ff40ff #40ffff #ffffff #808080 #ff8080 #80ff80 #ffff80 #80c0ff #ff80ff #80ffff #ffffff'],
];

export const themes: Theme[] = rows.map(([id, name, type, bg, surface, border, text, muted, accent, ansi]) => ({
  id, name, type, bg, surface, border, text, muted, accent, ansi: ansi.split(' '),
}));

export const themeById = (id: string) => themes.find((t) => t.id === id) ?? themes[0];

// Overrides the Tailwind @theme tokens in style.css, so every bg-*/text-*/border-* class follows.
export function applyTheme(t: Theme) {
  const s = document.documentElement.style;
  for (const k of ['bg', 'surface', 'border', 'text', 'muted', 'accent'] as const) s.setProperty(`--color-${k}`, t[k]);
  s.colorScheme = t.type;
}

const ansiKeys = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

export function xtermTheme(t: Theme) {
  const out: Record<string, string> = {
    background: t.bg,
    foreground: t.text,
    cursor: t.accent,
    cursorAccent: t.bg,
    selectionBackground: t.accent + '55',
  };
  ansiKeys.forEach((k, i) => {
    out[k] = t.ansi[i];
    out['bright' + k[0].toUpperCase() + k.slice(1)] = t.ansi[i + 8];
  });
  return out;
}
