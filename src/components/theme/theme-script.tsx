/**
 * Applies the persisted (or system) theme before first paint to avoid a
 * flash of the wrong theme. Rendered in <head>.
 */
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem("fl-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
