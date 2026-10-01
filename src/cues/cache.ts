/** LRU-ish cache for Dutch cue → translated text, plus in-flight prefetch tracking. */
export class CueTranslationCache {
  private readonly cache = new Map<string, string>();
  private readonly inFlight = new Set<string>();

  constructor(private readonly maxSize: number) {}

  get(dutch: string): string | undefined {
    return this.cache.get(dutch);
  }

  has(dutch: string): boolean {
    return this.cache.has(dutch);
  }

  set(dutch: string, translated: string): void {
    if (this.cache.has(dutch)) this.cache.delete(dutch);
    this.cache.set(dutch, translated);
    while (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  markInFlight(dutch: string): void {
    this.inFlight.add(dutch);
  }

  clearInFlight(dutch: string): void {
    this.inFlight.delete(dutch);
  }

  isInFlight(dutch: string): boolean {
    return this.inFlight.has(dutch);
  }

  get size(): number {
    return this.cache.size;
  }
}
