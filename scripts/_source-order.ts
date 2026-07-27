// "A runs before B" in a source file, stated so that it can actually fail.
//
// Source-order assertions across these suites were written as `src.indexOf(a) < src.indexOf(b)`. indexOf
// returns -1 for a needle that is not present, so that comparison reports SUCCESS in precisely the case the
// assertion exists to catch: delete the earlier guard and -1 sorts before everything else.
//
// This was not hypothetical. Deleting the per-account velocity cap from the launch route left its suite
// fully green, because "the ceiling is checked AFTER the owner-level gates" was comparing -1 against a real
// offset. An assertion that passes when its subject is removed is not protecting anything.
//
// Two rules follow, and this helper enforces the first:
//   1. both needles must be present before their order means anything
//   2. prefer CALL SHAPES ("gateFoo(") over bare names, since an import line names every symbol in the file
//      and would otherwise stand in for a call site that is gone
export function before(src: string, a: string, b: string): boolean {
  const i = src.indexOf(a), j = src.indexOf(b);
  return i >= 0 && j >= 0 && i < j;
}
