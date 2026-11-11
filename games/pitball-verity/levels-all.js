// PITBALL VERITY — full level list: launch levels (levels.js) + L4–L18 (levels-more.js).
import { LEVELS as BASE_LEVELS } from './levels.js';
import { LEVELS_MORE } from './levels-more.js';

export const LEVELS = [...BASE_LEVELS, ...LEVELS_MORE];
export default LEVELS;
