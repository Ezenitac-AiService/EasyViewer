// SPDX-License-Identifier: GPL-3.0-only
// Vite `?raw` imports return the file contents as a string (used by the About dialog).
declare module '*?raw' {
  const content: string
  export default content
}
