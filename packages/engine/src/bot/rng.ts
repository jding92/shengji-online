export type BotRng = () => number;

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Small deterministic PRNG suitable for repeatable policy choices. */
export function createBotRng(seed: string): BotRng {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function uniformPick<T>(candidates: readonly T[], rng: BotRng): T | undefined {
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(rng() * candidates.length)];
}

export function softmaxPick<T>(
  candidates: readonly T[],
  scores: readonly number[],
  temperature: number,
  rng: BotRng,
): T | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length !== scores.length) {
    throw new RangeError("Every bot candidate needs one score");
  }
  if (temperature <= 0) {
    let best = 0;
    for (let index = 1; index < scores.length; index += 1) {
      if (scores[index]! > scores[best]!) best = index;
    }
    return candidates[best];
  }

  const maximum = Math.max(...scores);
  const weights = scores.map((score) => Math.exp((score - maximum) / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = rng() * total;
  for (let index = 0; index < candidates.length; index += 1) {
    target -= weights[index]!;
    if (target <= 0) return candidates[index];
  }
  return candidates.at(-1);
}

export function noisyPick<T>(
  candidates: readonly T[],
  scores: readonly number[],
  temperature: number,
  blunderRate: number,
  rng: BotRng,
): T | undefined {
  return rng() < blunderRate
    ? uniformPick(candidates, rng)
    : softmaxPick(candidates, scores, temperature, rng);
}
