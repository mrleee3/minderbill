/** Apple Home Screen web clips do not always match display-mode: standalone. */
export function isHomeScreen(mediaStandalone: boolean, appleStandalone?: boolean): boolean {
  return mediaStandalone || appleStandalone === true;
}
