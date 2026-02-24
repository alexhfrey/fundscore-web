export function createSeededRandom(seed: number) {
  let s = seed;
  return {
    next(): number {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    },
    nextRange(min: number, max: number): number {
      return min + this.next() * (max - min);
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.nextRange(min, max + 1));
    },
    nextNormal(mean: number, stdDev: number): number {
      const u1 = this.next();
      const u2 = this.next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * stdDev;
    },
    pick<T>(arr: T[]): T {
      return arr[this.nextInt(0, arr.length - 1)];
    },
    shuffle<T>(arr: T[]): T[] {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = this.nextInt(0, i);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
  };
}
