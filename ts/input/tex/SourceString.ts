/**
 * @file A string that tracks where each character came from in the original
 *   root input. Every operation (slice, splice, insert) keeps positions in
 *   sync automatically. You can never lose track.
 *
 *   To create a SourceString from external text (not derived from the original
 *   source), you must call iAmDumbAndThisIsNotFromSource() — which forces you
 *   to provide the original position this text maps to.
 */

export class SourceString {
  private _text: string;
  private _pos: number[];
  private _endPos: number;

  /** Create a SourceString from the root input. This is the origin. */
  constructor(text: string, baseOffset: number = 0) {
    this._text = text;
    this._pos = Array.from({length: text.length}, (_, i) => baseOffset + i);
    this._endPos = baseOffset + text.length;
  }

  /**
   * Create a SourceString from text that is NOT from the original source
   * (e.g., a macro expansion body). All characters map to `originalPos`.
   */
  static iAmDumbAndThisIsNotFromSource(text: string, originalPos: number, originalEnd: number): SourceString {
    const s = new SourceString('');
    s._text = text;
    s._pos = new Array(text.length).fill(originalPos);
    s._endPos = originalEnd;
    return s;
  }

  // ─── Read-only string interface ──────────────────────────────────

  get length(): number { return this._text.length; }
  get endPos(): number { return this._endPos; }

  charAt(i: number): string { return this._text.charAt(i); }
  codePointAt(i: number): number | undefined { return this._text.codePointAt(i); }
  charCodeAt(i: number): number { return this._text.charCodeAt(i); }
  substring(start: number, end?: number): string { return this._text.substring(start, end); }
  match(re: RegExp): RegExpMatchArray | null { return this._text.match(re); }
  search(re: RegExp | string): number { return this._text.search(re); }
  indexOf(s: string, from?: number): number { return this._text.indexOf(s, from); }
  endsWith(s: string): boolean { return this._text.endsWith(s); }
  startsWith(s: string): boolean { return this._text.startsWith(s); }
  trim(): string { return this._text.trim(); }
  toString(): string { return this._text; }

  /** Slice that returns a raw string (for backward compat). */
  slice(start: number, end?: number): string {
    return this._text.slice(start, end);
  }

  // ─── Position-aware operations ───────────────────────────────────

  /** Slice producing a child SourceString with correct positions. */
  sliceSource(start: number, end?: number): SourceString {
    const actualEnd = end ?? this._text.length;
    const s = new SourceString('');
    s._text = this._text.slice(start, actualEnd);
    s._pos = this._pos.slice(start, actualEnd);
    s._endPos = actualEnd < this._pos.length
      ? this.toOriginal(actualEnd)
      : this._endPos;
    return s;
  }

  /**
   * Replace [start, end) with a replacement SourceString.
   * The replacement carries its own positions.
   */
  splice(start: number, end: number, replacement: SourceString) {
    this._pos = [
      ...this._pos.slice(0, start),
      ...replacement._pos,
      ...this._pos.slice(end),
    ];
    this._text = this._text.slice(0, start) + replacement._text + this._text.slice(end);
  }

  /**
   * Insert synthetic text at pos (not from original source, e.g., spaces).
   */
  insert(pos: number, text: string) {
    this._pos.splice(pos, 0, ...new Array(text.length).fill(-1));
    this._text = this._text.slice(0, pos) + text + this._text.slice(pos);
  }

  // ─── Position lookups ────────────────────────────────────────────

  /** Map a position to the original start offset. */
  toOriginal(pos: number): number {
    if (this._pos.length === 0) return this._endPos;
    if (pos >= this._pos.length) return this._endPos;
    if (pos < 0) return Math.max(0, this._pos[0] + pos);
    const p = this._pos[pos];
    if (p !== -1) return p;
    for (let i = pos - 1; i >= 0; i--) {
      if (this._pos[i] !== -1) return this._pos[i] + 1;
    }
    return this._pos[0];
  }

  /**
   * Map a position to the original end offset. For synthetic/expansion
   * characters, looks forward to find where the expansion ends.
   */
  toOriginalEnd(pos: number): number {
    if (this._pos.length === 0) return this._endPos;
    if (pos >= this._pos.length) return this._endPos;
    if (pos < 0) return this.toOriginal(pos);
    const p = this._pos[pos];
    if (p !== -1 && (pos === 0 || this._pos[pos - 1] !== p)) return p;
    for (let i = pos; i < this._pos.length; i++) {
      if (this._pos[i] !== -1 && this._pos[i] !== p) {
        return this._pos[i];
      }
    }
    return this._endPos;
  }
}
