'use client';
/** Everything the search box needs once the visitor interacts — loaded with import() so it stays out of the first paint. */
export { suggest, buildingList, countResults } from './suggest';
export { parseSearch } from './parse';
export { parsedToQuery } from './url';
export { highlightParts } from './fuzzy';
export { logSearchMiss } from './miss';
