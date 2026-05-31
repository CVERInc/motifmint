/**
 * A tiny undo/redo history stack. Generic and pure (no Svelte, no DOM) so it's
 * fully unit-testable; the component pushes immutable snapshots of its edit
 * state and restores them on undo/redo.
 *
 * Semantics:
 *   • `reset(state)` seeds the stack with a single baseline entry.
 *   • `push(state)` appends a new present, discarding any redo branch.
 *   • `undo()` / `redo()` move the cursor and return the now-current entry
 *     (or null at the ends).
 *   • An optional `limit` caps memory by dropping the oldest entries.
 */
export class History<T> {
  private stack: T[] = [];
  private index = -1;
  private readonly limit: number;

  constructor(limit = 100) {
    this.limit = Math.max(1, limit);
  }

  /** Re-seed with a single baseline entry (clears all history). */
  reset(state: T): void {
    this.stack = [state];
    this.index = 0;
  }

  /** Append a new present; anything after the cursor (the redo branch) is dropped. */
  push(state: T): void {
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }
    this.stack.push(state);
    this.index = this.stack.length - 1;
    if (this.stack.length > this.limit) {
      const overflow = this.stack.length - this.limit;
      this.stack = this.stack.slice(overflow);
      this.index -= overflow;
    }
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  /** The entry at the cursor, or null if empty. */
  get current(): T | null {
    return this.index >= 0 ? this.stack[this.index] : null;
  }

  /** Step back; returns the now-current entry, or null if already at the start. */
  undo(): T | null {
    if (!this.canUndo) return null;
    this.index -= 1;
    return this.stack[this.index];
  }

  /** Step forward; returns the now-current entry, or null if at the end. */
  redo(): T | null {
    if (!this.canRedo) return null;
    this.index += 1;
    return this.stack[this.index];
  }

  /** Number of entries currently retained (for tests/debug). */
  get size(): number {
    return this.stack.length;
  }
}
