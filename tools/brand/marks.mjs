// The Digital Factory marks: one source for the logo, the app icons, the module icons and the social card.
// The logo: a factory whose right half is a grid of cells, the physical plant becoming its digital twin;
// the top-right cell is lit (cyan), the live signal. On a 32-unit grid, optically centred, readable at 16 px.
export const C = { a: '#2D5BFF', b: '#1428A0', ink: '#0B1024', live: '#7FE4FF', white: '#FFFFFF' };
export const FACTORY = 'M7 23.8V9.4a.7.7 0 0 1 1.1-.57L11.5 11.3V9.4a.7.7 0 0 1 1.1-.57L16 11.3v12.5z';
// cells [x, y, opacity]; the lit cell is drawn on its own
export const CELLS = [[17.2, 20.4, 1], [21.4, 20.4, 1], [17.2, 16.2, 1], [21.4, 16.2, 0.72], [17.2, 12, 0.72]];
export const LIVE = [21.4, 12];
const cell = ([x, y, o], fill) => `<rect x="${x}" y="${y}" width="3.4" height="3.4" rx=".7" fill="${fill}"${o < 1 ? ` opacity="${o}"` : ''}/>`;
export const glyph = (fill = C.white, live = C.live) => `<path fill="${fill}" d="${FACTORY}"/>${CELLS.map(c => cell(c, fill)).join('')}${cell([...LIVE, 1], live)}`;
const grad = id => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.a}"/><stop offset="1" stop-color="${C.b}"/></linearGradient>`;
// the tile: rounded square, a top-left light falling to the deep brand blue, a hairline inner highlight
const tile = (inner, { r = 8, pad = 0 } = {}) => {
  const s = 32 + pad * 2, id = 'g' + Math.random().toString(36).slice(2, 7);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${s} ${s}"><defs>${grad(id)}</defs>`
    + `<rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" rx="${pad ? 0 : r}" fill="url(#${id})"/>`
    + (pad ? '' : `<rect x=".5" y=".5" width="31" height="31" rx="${r - 0.5}" fill="none" stroke="#fff" stroke-opacity=".14"/>`)
    + inner + '</svg>';
};
export const mark = () => tile(glyph());
// maskable (Android adaptive icons): the glyph inside the 80 % safe zone on a full-bleed field
export const maskable = () => tile(`<g transform="translate(16 16) scale(.74) translate(-16 -16.2)">${glyph()}</g>`, { pad: 0.001 }).replace(/rx="0"/, '');
// the glyph alone, one colour (for masks, monochrome icons and the 3D plates)
export const glyphOnly = (fill = '#000') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${glyph(fill, fill)}</svg>`;

// module icons: the same tile, a white line glyph (2 units, round), one lit part in the live cyan
const line = d => `<path d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
export const MODULES = {
  plant: { name: 'Live plant', inner: `<path d="M16 6.8 24.6 11.6 16 16.4 7.4 11.6z" fill="${C.live}"/>` + line('M16 6.8 24.6 11.6V20.8L16 25.6 7.4 20.8V11.6zM7.4 11.6 16 16.4 24.6 11.6M16 16.4v9.2') },
  room: { name: 'Command room', inner: line('M8.2 21.4a8.6 8.6 0 1 1 15.6 0M16 19.2l4.4-5.6M10.4 14.6l1.2.8M16 10.6v1.4M21.6 14.6l-1.2.8') + `<circle cx="16" cy="19.4" r="1.9" fill="${C.live}"/>` },
  deck: { name: 'Presentation', inner: line('M7.5 8.5h17v11.5h-17zM16 20v4M12 24.8h8M11.5 17v-2.5M14.8 17v-4.5') + `<path d="M18.1 17V10.6" fill="none" stroke="${C.live}" stroke-width="2" stroke-linecap="round"/>` },
  guide: { name: 'Guide', inner: line('M16 10.4C13.4 8.7 10 8.4 7.2 9.3v13.4c2.8-.9 6.2-.6 8.8 1.1 2.6-1.7 6-2 8.8-1.1V9.3c-2.8-.9-6.2-.6-8.8 1.1zM16 10.4v13.4') + `<path d="M19.4 8.7v5.6l1.5-1.1 1.5 1.1V8.4" fill="${C.live}"/>` },
  showroom: { name: 'Showroom', inner: `<path d="M8 10h16v9.5H8z" fill="${C.live}" opacity=".32"/><path d="M8 10l9.5 9.5H8z" fill="${C.live}" opacity=".5"/>` + line('M6.5 8.5h19v12.5h-19zM16 21v3.4M11.5 24.8h9') },
  present: { name: 'Present', inner: line('M7.5 9h17v14h-17z') + `<path d="M14 12.6v6.8l5.6-3.4z" fill="${C.live}"/>` }
};
export const module = k => tile(MODULES[k].inner);
