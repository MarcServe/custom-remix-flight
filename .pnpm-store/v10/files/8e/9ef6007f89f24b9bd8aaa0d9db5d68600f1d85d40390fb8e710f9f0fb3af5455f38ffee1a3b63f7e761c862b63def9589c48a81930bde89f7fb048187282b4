// src/sugar-high.ts
import { Decoration } from "prosemirror-view";
import { tokenize, SugarHigh } from "sugar-high";
var types = SugarHigh.TokenTypes;
function createParser() {
  return function parser({ content, pos }) {
    const decorations = [];
    const tokens = tokenize(content);
    let from = pos + 1;
    for (const [type, content2] of tokens) {
      const to = from + content2.length;
      const decoration = Decoration.inline(from, to, {
        class: `sh__token--${types[type]}`,
        style: `color: var(--sh-${types[type]})`
      });
      decorations.push(decoration);
      from = to;
    }
    return decorations;
  };
}
export {
  createParser
};
