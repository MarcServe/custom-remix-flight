// src/shiki.ts
import { Decoration } from "prosemirror-view";
function createParser(highlighter, options) {
  return function parser({ content, language, pos, size }) {
    var _a;
    const decorations = [];
    const { tokens, fg, bg, rootStyle } = highlighter.codeToTokens(content, {
      lang: language,
      // Use provided options for themes or just use first loaded theme
      ...options != null ? options : {
        theme: highlighter.getLoadedThemes()[0]
      }
    });
    const style = rootStyle || (fg && bg ? `--prosemirror-highlight:${fg};--prosemirror-highlight-bg:${bg}` : "");
    if (style) {
      const decoration = Decoration.node(pos, pos + size, { style });
      decorations.push(decoration);
    }
    let from = pos + 1;
    for (const line of tokens) {
      for (const token of line) {
        const to = from + token.content.length;
        const decoration = Decoration.inline(from, to, {
          // When using `options.themes` the `htmlStyle` field will be set, otherwise `color` will be set
          style: stringifyTokenStyle(
            (_a = token.htmlStyle) != null ? _a : `color: ${token.color}`
          ),
          class: "shiki"
        });
        decorations.push(decoration);
        from = to;
      }
      from += 1;
    }
    return decorations;
  };
}
function stringifyTokenStyle(token) {
  if (typeof token === "string") return token;
  return Object.entries(token).map(([key, value]) => `${key}:${value}`).join(";");
}
export {
  createParser
};
