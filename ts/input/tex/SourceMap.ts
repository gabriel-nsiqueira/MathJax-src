/**
 * @file Memory-mapped position tracking for the TeX parser.
 *
 * Maintains an array where positions[i] = the original root-input position
 * of character i in the (possibly mutated) parser string. Insertions splice
 * in -1 entries. Slicing produces a child with the correct sub-array.
 * Any position lookup is a simple array index.
 */

export class SourceMap {
  private positions: number[];

  /**
   * Create a SourceMap for a string of `length` characters starting at
   * `baseOffset` in the root input. Initializes an identity mapping.
   */
  constructor(length: number, baseOffset: number = 0) {
    this.positions = Array.from({length}, (_, i) => baseOffset + i);
  }

  /**
   * Record that `count` synthetic characters were inserted at `pos`.
   * They don't correspond to any original position (-1).
   */
  recordInsertion(pos: number, count: number = 1) {
    const inserted = new Array(count).fill(-1);
    this.positions.splice(pos, 0, ...inserted);
  }

  /**
   * Map a position in the current (mutated) string to the original root
   * input position. Handles positions at/past the end by extrapolating.
   */
  toOriginal(pos: number): number {
    if (this.positions.length === 0) return 0;
    if (pos <= 0) return this.positions[0] + pos;
    if (pos >= this.positions.length) {
      let last = this.positions[this.positions.length - 1];
      if (last === -1) {
        for (let i = this.positions.length - 2; i >= 0; i--) {
          if (this.positions[i] !== -1) { last = this.positions[i]; break; }
        }
      }
      return last + 1 + (pos - this.positions.length);
    }
    const p = this.positions[pos];
    if (p !== -1) return p;
    for (let i = pos - 1; i >= 0; i--) {
      if (this.positions[i] !== -1) return this.positions[i] + 1;
    }
    return this.positions[0];
  }

  /**
   * Create a child SourceMap for a sub-parser whose string was sliced
   * from this parser's string as [start, end). The child inherits the
   * correct original positions directly from this map's array.
   */
  child(start: number, end: number): SourceMap {
    const sm = new SourceMap(0);
    sm.positions = this.positions.slice(start, end);
    return sm;
  }
}
