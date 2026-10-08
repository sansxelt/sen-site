// Keep the existing film handoff, then give the statement one extra viewport of travel.
// Progress stays a reversible function of scroll position, without a second easing clock.
export const OPENING_VIEWPORTS = 3.1;
const FOLLOWING_CHAPTER_VIEWPORTS = 2.1;

export function sequenceOpeningTrack(totalHeight: number, stageHeight: number) {
  const openingHeight = totalHeight - stageHeight * FOLLOWING_CHAPTER_VIEWPORTS;
  return {
    travel: Math.max(1, openingHeight - stageHeight),
    readingTravel: openingHeight / OPENING_VIEWPORTS,
  };
}

export function openingProgress(distance: number, travel: number, readingTravel: number) {
  const originalTravel = Math.max(1, travel - readingTravel);
  const readingStart = originalTravel * .60;
  const value = distance <= readingStart
    ? distance / originalTravel
    : .60 + (distance - readingStart) / Math.max(1, travel - readingStart) * .40;
  return Math.max(0, Math.min(1, value));
}
