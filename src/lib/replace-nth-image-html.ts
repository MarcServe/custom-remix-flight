/** Replace or remove the n-th <img> in HTML (0-based index). Used by newsletter & campaign editors. */
export function replaceNthImage(html: string, index: number, newSrc: string | null): string {
  const imgRegex = /<img[^>]*>/gi;
  let i = 0;
  return html.replace(imgRegex, (match) => {
    if (i++ === index) {
      if (newSrc === null) return "";
      const safe = newSrc.replace(/"/g, "&quot;");
      return match.replace(/src\s*=\s*["'][^"']*["']/i, `src="${safe}"`);
    }
    return match;
  });
}
