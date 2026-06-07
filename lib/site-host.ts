// It's just vraelis.com. There is no sansxel / chat / platform split
// anymore, so every request is a vraelis request. Kept as a function
// (returning a constant) so the existing call sites — root layout and
// /signin — don't need to change.
export async function isVraelisRequest(): Promise<boolean> {
  return true;
}
