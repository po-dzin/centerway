import pencil from "../../../data/brand/cw-pencil.json";

/** Shared physical drawing recipes. No colour, layout, state or animation. */
export const PENCIL_ILLUSTRATION = pencil.illustration;
export const PENCIL_METER = pencil.meter;

/** Low-frequency pressure, stable along a stroke; never per-point randomness. */
export function pencilPressure(t: number, seed: number, closed = false): number {
  const { primaryWave, secondaryWave } = pencil.pressure;
  const wave =
    Math.sin(t * Math.PI * 2 + seed) * primaryWave +
    Math.sin(t * Math.PI * (closed ? 6 : 5) + seed * 1.7) * secondaryWave;
  const tip = closed ? 1 : PENCIL_ILLUSTRATION.tipFloor + (1 - PENCIL_ILLUSTRATION.tipFloor) * Math.sin(Math.PI * t);
  return (1 + PENCIL_ILLUSTRATION.pressure * wave) * tip;
}
