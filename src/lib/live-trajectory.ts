export type Point = { x: number; y: number };
export type TrajectorySample = Point & { time: number };

export function recordSample(samples: TrajectorySample[], point: Point, time: number): TrajectorySample[] {
  const last = samples.at(-1);
  if (last && time < last.time) return samples;
  if (last && time === last.time) return [...samples.slice(0, -1), { ...point, time }];
  return [...samples, { ...point, time }];
}

export function trajectoryPosition(samples: TrajectorySample[], time: number): Point | undefined {
  const first = samples[0];
  if (!first) return undefined;
  if (time <= first.time) return first;
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1], next = samples[i];
    if (!previous || !next) continue;
    if (time <= next.time) {
      const fraction = (time - previous.time) / (next.time - previous.time);
      return { x: previous.x + (next.x - previous.x) * fraction, y: previous.y + (next.y - previous.y) * fraction };
    }
  }
  return samples.at(-1);
}