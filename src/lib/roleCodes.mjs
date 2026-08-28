/**
 * roleCodes.mjs | the sixteen role codes, in canonical order.
 *
 * Seven from Part 12 and nine from Part 19.2. The order is fixed so that any
 * list of codes rendered anywhere in the app appears in the same sequence.
 */

export const ROLE_CODES_MAIN = Object.freeze(['AAE', 'FDE', 'FS', 'BE', 'ASE', 'PLAT', 'DE']);
export const ROLE_CODES_EARLY = Object.freeze([
  'WEB', 'SUP', 'FE', 'AUTO', 'JRT', 'INT', 'QA', 'DEVREL', 'PROMPT',
]);
export const ROLE_CODES_ALL = Object.freeze([...ROLE_CODES_MAIN, ...ROLE_CODES_EARLY]);
