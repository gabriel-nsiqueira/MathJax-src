/**
 * @file A string that tracks where each character came from in the original
 *   root input. Every operation (slice, splice, insert) keeps positions in
 *   sync automatically. You can never lose track.
 *
 *   To create a SourceString from external text (not derived from the original
 *   source), you must call iAmDumbAndThisIsNotFromSource() — which forces you
 *   to provide the original position this text maps to.
 */

export interface SourceStringMatchArray {
  readonly [index: number]: SourceString;
  readonly index: number;
  readonly input: SourceString;
  readonly length: number;
}

export class SourceOriginRange {
  start: number;
  end: number;
  constructor(start: number, end: number) {
    this.start = start;
    this.end = end;
  }
}

export class SourceString {
  private _text: string;
  private _pos: SourceOriginRange[];

  /** Create a SourceString from the root input. This is the origin. */
  constructor(text?: string) {
    this._text = text ?? '';
    this._pos = Array.from(
      { length: this._text.length },
      (_, i) => new SourceOriginRange(i, i + 1)
    );
  }

  /**
   * Create a SourceString from text that is NOT from the original source.
   * Positions are repeated across the text if a single source range is passed.
   */
  static iAmDumbAndThisIsNotFromSource(
    text: string,
    pos: SourceOriginRange[]
  ): SourceString {
    const s = new SourceString('');
    s._text = text;
    s._pos = pos.length === text.length
      ? pos
      : Array.from({ length: text.length }, (_, i) => pos[i] || pos[0] || new SourceOriginRange(0, 0));
    return s;
  }

  /**
   * Create generated text and map it back to the source span that caused it.
   */
  static fromSourceRange(
    text: string,
    source: SourceString,
    start: number,
    end: number = start
  ): SourceString {
    let originalStart: number | undefined;
    let originalEnd: number | undefined;
    const actualStart = Math.max(0, Math.min(start, source.length));
    const actualEnd = Math.max(actualStart, Math.min(end, source.length));
    for (let i = actualStart; i < actualEnd; i++) {
      const posStart = source.toOriginal(i);
      const posEnd = source.toOriginalEnd(i);
      if (posStart != null) {
        originalStart = originalStart == null ? posStart : Math.min(originalStart, posStart);
      }
      if (posEnd != null) {
        originalEnd = originalEnd == null ? posEnd : Math.max(originalEnd, posEnd);
      }
    }
    originalStart ??= source.toOriginal(actualStart) ?? source.toOriginalEnd(actualStart - 1) ?? 0;
    originalEnd ??= source.toOriginalEnd(actualEnd - 1) ?? originalStart;
    const range = new SourceOriginRange(originalStart, originalEnd);
    const s = new SourceString('');
    s._text = text;
    s._pos = Array.from({ length: text.length }, () => range);
    return s;
  }

  // ─── Read-only string interface ──────────────────────────────────

  get length(): number {
    return this._text.length;
  }
  charAt(i: number): string {
    return this._text.charAt(i);
  }
  codePointAt(i: number): number | undefined {
    return this._text.codePointAt(i);
  }
  charCodeAt(i: number): number {
    return this._text.charCodeAt(i);
  }
  substring(start: number, end?: number): string {
    return this._text.substring(start, end);
  }
  match(re: RegExp): SourceStringMatchArray | null {
    const flags = re.flags.includes('d') ? re.flags : re.flags + 'd';
    const dRe = new RegExp(re.source, flags);

    if (re.global) {
      const matches: SourceString[] = [];
      let firstIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = dRe.exec(this._text)) !== null) {
        if (matches.length === 0) firstIndex = m.index;
        const [start, end] = (m as any).indices[0] as [number, number];
        matches.push(this.slice(start, end));
      }
      if (matches.length === 0) return null;
      return Object.assign(matches, {
        index: firstIndex,
        input: this as SourceString,
      }) as unknown as SourceStringMatchArray;
    }

    const result = this._text.match(dRe);
    if (!result) return null;

    const indices: ([number, number] | undefined)[] = (result as any).indices;
    const matches: (SourceString | undefined)[] = [];
    for (let i = 0; i < result.length; i++) {
      const range = indices[i];
      matches.push(range ? this.slice(range[0], range[1]) : undefined);
    }
    return Object.assign(matches, {
      index: result.index!,
      input: this as SourceString,
    }) as unknown as SourceStringMatchArray;
  }
  search(re: RegExp | string): number {
    return this._text.search(re);
  }
  indexOf(s: string, from?: number): number {
    return this._text.indexOf(s, from);
  }
  endsWith(s: string): boolean {
    return this._text.endsWith(s);
  }
  startsWith(s: string): boolean {
    return this._text.startsWith(s);
  }
  trim(): SourceString {
    const s = new SourceString('');
    const startMatch = this._text.match(/^\s+/);
    const startLength = startMatch ? startMatch[0].length : 0;
    const endMatch = this._text.match(/\s+$/);
    const endLength = endMatch ? endMatch[0].length : 0;
    s._text = this._text.slice(startLength, this._text.length - endLength);
    s._pos = this._pos.slice(startLength, this._pos.length - endLength);
    return s;
  }
  concat(s: SourceString): SourceString {
    const c = new SourceString('');
    c._text = this._text + s._text;
    c._pos = [...this._pos, ...s._pos];
    return c;
  }
  toString(): string {
    return this._text;
  }
  includes(search: string): boolean {
    return this._text.includes(search);
  }
  toLowerCase(): SourceString {
    const s = new SourceString('');
    s._text = this._text.toLowerCase();
    s._pos = [...this._pos];
    return s;
  }
  toUpperCase(): SourceString {
    const s = new SourceString('');
    s._text = this._text.toUpperCase();
    s._pos = [...this._pos];
    return s;
  }
  at(i: number): SourceString | undefined {
    if (i < 0) i = this._text.length + i;
    if (i < 0 || i >= this._text.length) return undefined;
    return this.slice(i, i + 1);
  }
  trimStart(): SourceString {
    const m = this._text.match(/^\s+/);
    const len = m ? m[0].length : 0;
    return this.slice(len);
  }
  trimEnd(): SourceString {
    const m = this._text.match(/\s+$/);
    const len = m ? m[0].length : 0;
    return this.slice(0, this._text.length - len);
  }
  split(separator: string | RegExp): SourceString[] {
    if (typeof separator === 'string') {
      const results: SourceString[] = [];
      let start = 0;
      let idx: number;
      while ((idx = this._text.indexOf(separator, start)) !== -1) {
        results.push(this.slice(start, idx));
        start = idx + separator.length;
      }
      results.push(this.slice(start));
      return results;
    }
    const flags = separator.flags.includes('d')
      ? separator.flags
      : separator.flags + 'd';
    const re = new RegExp(
      separator.source,
      flags.includes('g') ? flags : flags + 'g'
    );
    const results: SourceString[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this._text)) !== null) {
      const [matchStart, matchEnd] = (m as any).indices[0] as [number, number];
      results.push(this.slice(lastIndex, matchStart));
      lastIndex = matchEnd;
      if (matchStart === matchEnd) re.lastIndex++;
    }
    results.push(this.slice(lastIndex));
    return results;
  }
  replace(pattern: string | RegExp, replacement: string): SourceString {
    let re: RegExp;
    if (typeof pattern === 'string') {
      re = new RegExp(
        pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'd'
      );
    } else {
      const flags = pattern.flags.includes('d')
        ? pattern.flags
        : pattern.flags + 'd';
      re = new RegExp(pattern.source, flags);
    }
    const isGlobal = re.global;
    const parts: SourceString[] = [];
    let lastIndex = 0;
    let matched = false;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this._text)) !== null) {
      matched = true;
      const [matchStart, matchEnd] = (m as any).indices[0] as [number, number];
      if (matchStart > lastIndex) {
        parts.push(this.slice(lastIndex, matchStart));
      }
      if (replacement.length > 0) {
        let origStart: number;
        let origEnd: number;
        if (matchEnd > matchStart) {
          origStart = this._pos[matchStart].start;
          origEnd = this._pos[matchEnd - 1].end;
        } else {
          origStart = matchStart < this._pos.length
            ? this._pos[matchStart].start
            : this._pos.length > 0
              ? this._pos[this._pos.length - 1].end
              : 0;
          origEnd = origStart;
        }
        const rPos = Array.from(
          { length: replacement.length },
          () => new SourceOriginRange(origStart, origEnd)
        );
        const r = new SourceString('');
        r._text = replacement;
        r._pos = rPos;
        parts.push(r);
      }
      lastIndex = matchEnd;
      if (!isGlobal) break;
      if (matchStart === matchEnd) re.lastIndex++;
    }
    if (!matched) {
      return this.slice(0);
    }
    if (lastIndex < this._text.length) {
      parts.push(this.slice(lastIndex));
    }
    if (parts.length === 0) {
      return new SourceString('');
    }
    let result = parts[0];
    for (let i = 1; i < parts.length; i++) {
      result = result.concat(parts[i]);
    }
    return result;
  }
  *[Symbol.iterator](): IterableIterator<SourceString> {
    for (let i = 0; i < this._text.length; i++) {
      yield this.slice(i, i + 1);
    }
  }

  // ─── Position-aware operations ───────────────────────────────────

  /** Slice producing a child SourceString with correct positions. */
  slice(start: number, end?: number): SourceString {
    const actualEnd = end ?? this._text.length;
    const s = new SourceString('');
    s._text = this._text.slice(start, actualEnd);
    s._pos = this._pos.slice(start, actualEnd);
    return s;
  }

  /**
   * Replace [start, end) with replacement text.
   */
  splice(start: number, end: number, replacement: SourceString) {
    const rText = replacement._text;
    const rPos = replacement._pos;
    this._pos = [
      ...this._pos.slice(0, start),
      ...rPos,
      ...this._pos.slice(end),
    ];
    this._text = this._text.slice(0, start) + rText + this._text.slice(end);
  }

  /**
   * Insert text at pos.
   */
  insert(pos: number, text: SourceString) {
    this._pos.splice(pos, 0, ...text._pos);
    this._text = this._text.slice(0, pos) + text._text + this._text.slice(pos);
  }

  // ─── Position lookups ────────────────────────────────────────────

  /** Map a position to the original start offset. */
  toOriginal(pos: number): number | undefined {
    if (pos < 0 || pos >= this._pos.length) return undefined;
    return this._pos[pos].start;
  }

  /** Map a position to the original end offset. */
  toOriginalEnd(pos: number): number | undefined {
    if (pos < 0 || pos >= this._pos.length) return undefined;
    return this._pos[pos].end;
  }

  /**
   * @returns {SourceOriginRange | undefined} The smallest original span
   * covered by this string.
   */
  originalRange(): SourceOriginRange | undefined {
    if (!this._pos.length) return undefined;
    let start = Infinity;
    let end = -Infinity;
    for (const pos of this._pos) {
      start = Math.min(start, pos.start);
      end = Math.max(end, pos.end);
    }
    return new SourceOriginRange(start, end);
  }
}
