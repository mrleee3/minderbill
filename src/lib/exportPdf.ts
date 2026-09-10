/** Keep iOS PDF previews from taking over the app's browsing context. */
export async function exportPdf(file: File, options: { title: string; text?: string }, share = false): Promise<"shared" | "downloaded"> {
  const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if ((share || appleMobile) && navigator.canShare?.({ files: [file] })) {
    // Cancellation deliberately propagates: never open a preview after Cancel.
    await navigator.share({ files: [file], ...options });
    return "shared";
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  // Browsers that preview rather than download must leave this app intact.
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return "downloaded";
}
