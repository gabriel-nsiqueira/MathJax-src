/**
 * @file Memory-mapped position tracking for the TeX parser string.
 *
 * Tracks the relationship between positions in the current (possibly mutated)
 * parser string and the original root input string. Automatically handles:
 * - Sub-parser slicing (child())
 * - Character insertions (recordInsertion())
 * - Macro expansions (replaceRange())
 */

export class SourceMap {
  /** positions[i] = original position of character i, or -1 for synthetic */
  public positions: number[];
  /** Original position corresponding to "past the end" of this string */
  public endPos: number;

  constructor(length: number, baseOffset: number = 0) {
    this.positions = Array.from({length}, (_, i) => baseOffset + i);
    this.endPos = baseOffset + length;
  }

  /** Record synthetic characters inserted at `pos` (e.g., digit-separator spaces). */
  recordInsertion(pos: number, count: number = 1) {
    this.positions.splice(pos, 0, ...new Array(count).fill(-1));
  }

  /**
   * Replace positions [start, end) with `newLen` entries that all map to the
   * original position of `start`. Used for macro expansion: the macro's source
   * span is [toOriginal(start), toOriginal(end)), and all expanded characters
   * map back to that start.
   */
  replaceRange(start: number, end: number, newLen: number) {
    const origStart = this.toOriginal(start);
    const tail = this.positions.slice(end);
    this.positions = [
      ...this.positions.slice(0, start),
      ...new Array(newLen).fill(origStart),
      ...tail,
    ];
  }

  /** Map a position in the current string to the original root position. */
  toOriginal(pos: number): number {
    if (this.positions.length === 0) return this.endPos;
    if (pos >= this.positions.length) return this.endPos;
    if (pos < 0) return Math.max(0, this.positions[0] + pos);
    const p = this.positions[pos];
    if (p !== -1) return p;
    for (let i = pos - 1; i >= 0; i--) {
      if (this.positions[i] !== -1) return this.positions[i] + 1;
    }
    return this.positions[0];
  }

  /**
   * Map a position to the original end offset. For synthetic/expansion
   * positions, looks forward to find where the expansion ends.
   */
  toOriginalEnd(pos: number): number {
    if (this.positions.length === 0) return this.endPos;
    if (pos >= this.positions.length) return this.endPos;
    if (pos < 0) return this.toOriginal(pos);
    const p = this.positions[pos];
    // If it's a real (non-synthetic) position, just return it
    if (p !== -1 && (pos === 0 || this.positions[pos - 1] !== p)) return p;
    // Synthetic or expansion: find the next different real position
    for (let i = pos; i < this.positions.length; i++) {
      if (this.positions[i] !== -1 && this.positions[i] !== p) {
        return this.positions[i];
      }
    }
    return this.endPos;
  }

  /** Create a child SourceMap for a sub-parser whose string is a slice [start, end). */
  child(start: number, end: number): SourceMap {
    const sm = new SourceMap(0);
    sm.positions = this.positions.slice(start, end);
    sm.endPos = end < this.positions.length
      ? this.toOriginal(end)
      : this.endPos;
    return sm;
  }
}
