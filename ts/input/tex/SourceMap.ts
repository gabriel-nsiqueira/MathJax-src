/**
 * @file Memory-mapped position tracking for the TeX parser.
 *
 * Maintains an array where positions[i] = the original root-input position
 * of character i in the (possibly mutated) parser string. Insertions splice
 * in -1 entries. Macro expansions mark a range with a shared source span.
 * Any position lookup is a simple array index.
 */

export type SourcePos = number | { start: number; end: number };

export class SourceMap {
  private positions: SourcePos[];
  private endPos: number;

  constructor(length: number, baseOffset: number = 0) {
    this.positions = Array.from({length}, (_, i) => baseOffset + i);
    this.endPos = baseOffset + length;
  }

  recordInsertion(pos: number, count: number = 1) {
    const inserted = new Array(count).fill(-1);
    this.positions.splice(pos, 0, ...inserted);
  }

  /**
   * Record a macro expansion. Positions [0, consumedEnd) are replaced by
   * `expansionLen` entries that all carry the macro's original source span.
   */
  recordExpansion(macroStart: number, consumedEnd: number, expansionLen: number) {
    const origStart = this.resolve(macroStart);
    const origEnd = consumedEnd < this.positions.length
      ? this.resolve(consumedEnd)
      : this.endPos;
    const span = { start: origStart, end: origEnd };
    const tail = this.positions.slice(consumedEnd);
    this.positions = new Array(expansionLen).fill(span).concat(tail);
    if (tail.length === 0) {
      this.endPos = origEnd;
    }
  }

  /**
   * Resolve a position entry to a plain number (the start of its range).
   */
  private resolve(pos: number): number {
    if (pos < 0 || this.positions.length === 0) return this.endPos;
    if (pos >= this.positions.length) return this.endPos;
    const p = this.positions[pos];
    if (typeof p === 'object') return p.start;
    if (p !== -1) return p;
    for (let i = pos - 1; i >= 0; i--) {
      const q = this.positions[i];
      if (typeof q === 'object') return q.start + 1;
      if (q !== -1) return q + 1;
    }
    return typeof this.positions[0] === 'object'
      ? (this.positions[0] as {start: number}).start
      : (this.positions[0] as number);
  }

  /**
   * Map a position to the original start offset.
   */
  toOriginal(pos: number): number {
    if (this.positions.length === 0) return this.endPos;
    if (pos <= 0 && this.positions.length > 0) {
      const p = this.positions[0];
      return typeof p === 'object' ? p.start + pos : p + pos;
    }
    if (pos >= this.positions.length) return this.endPos;
    return this.resolve(pos);
  }

  /**
   * Map a position to the original end offset. For positions within a
   * macro expansion, this returns the macro's end rather than its start.
   */
  toOriginalEnd(pos: number): number {
    if (this.positions.length === 0) return this.endPos;
    if (pos >= this.positions.length) return this.endPos;
    if (pos < 0) return this.toOriginal(pos);
    const p = this.positions[pos];
    if (typeof p === 'object') return p.end;
    return this.toOriginal(pos);
  }

  child(start: number, end: number): SourceMap {
    const sm = new SourceMap(0);
    sm.positions = this.positions.slice(start, end);
    sm.endPos = end < this.positions.length
      ? this.resolve(end)
      : this.endPos;
    return sm;
  }
}
