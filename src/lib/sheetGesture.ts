/** Require a deliberate pull, or a short downward flick, to dismiss. */
export function shouldDismissSheet(distance: number, velocity: number, height: number): boolean {
  return distance >= Math.min(120, height * 0.25) || (distance >= 40 && velocity >= 0.6);
}
