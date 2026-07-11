/**
 * Keyboard-accessibility skip link: visually hidden until focused, jumps
 * straight past the header to the page's main landmark.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Skip to content
    </a>
  );
}
