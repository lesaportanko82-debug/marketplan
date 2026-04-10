/**
 * Clipboard utility with fallback for restricted environments
 * (embedded iframes, permissions policy blocks, etc.)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try the modern Clipboard API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API blocked - fall through to fallback
    }
  }

  // Fallback: use a temporary textarea + execCommand
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Prevent scrolling
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
