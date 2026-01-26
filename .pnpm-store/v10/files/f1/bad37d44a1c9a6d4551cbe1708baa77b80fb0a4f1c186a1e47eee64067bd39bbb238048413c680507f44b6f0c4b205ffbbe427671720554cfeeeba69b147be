var mt = Object.defineProperty;
var gt = (e, t, n) => t in e ? mt(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var x = (e, t, n) => gt(e, typeof t != "symbol" ? t + "" : t, n);
import { TableMap as We, goToNextCell as Se, columnResizing as bt, tableEditing as kt, CellSelection as Fe, TableView as Ct } from "prosemirror-tables";
import yt from "@tiptap/extension-bold";
import wt from "@tiptap/extension-code";
import vt from "@tiptap/extension-italic";
import Et from "@tiptap/extension-strike";
import xt from "@tiptap/extension-underline";
import { Extension as $e, combineTransactionSteps as St, getChangedRanges as Bt, findChildrenInRange as Mt, Node as D, Mark as Lt, callOrReturn as Tt, getExtensionField as At, mergeAttributes as ue } from "@tiptap/core";
import { Slice as de, Fragment as _, DOMParser as Q, DOMSerializer as Be } from "prosemirror-model";
import { Plugin as je, PluginKey as Ue, TextSelection as ze } from "prosemirror-state";
import { v4 as Nt } from "uuid";
import { createHighlightPlugin as It } from "prosemirror-highlight";
import { createParser as Pt } from "prosemirror-highlight/shiki";
import { ReplaceStep as Ht } from "prosemirror-transform";
import { DecorationSet as Me, Decoration as Ot } from "prosemirror-view";
function Dt(e, t = JSON.stringify) {
  const n = {};
  return e.filter((o) => {
    const r = t(o);
    return Object.prototype.hasOwnProperty.call(n, r) ? !1 : n[r] = !0;
  });
}
function _t(e) {
  const t = e.filter(
    (o, r) => e.indexOf(o) !== r
  );
  return Dt(t);
}
const qe = $e.create({
  name: "uniqueID",
  // we’ll set a very high priority to make sure this runs first
  // and is compatible with `appendTransaction` hooks of other extensions
  priority: 1e4,
  addOptions() {
    return {
      attributeName: "id",
      types: [],
      setIdAttribute: !1,
      generateID: () => {
        if (typeof window < "u" && window.__TEST_OPTIONS) {
          const e = window.__TEST_OPTIONS;
          return e.mockID === void 0 ? e.mockID = 0 : e.mockID++, e.mockID.toString();
        }
        return Nt();
      },
      filterTransaction: null
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: (e) => e.getAttribute(`data-${this.options.attributeName}`),
            renderHTML: (e) => {
              const t = {
                [`data-${this.options.attributeName}`]: e[this.options.attributeName]
              };
              return this.options.setIdAttribute ? {
                ...t,
                id: e[this.options.attributeName]
              } : t;
            }
          }
        }
      }
    ];
  },
  // check initial content for missing ids
  // onCreate() {
  //   // Don’t do this when the collaboration extension is active
  //   // because this may update the content, so Y.js tries to merge these changes.
  //   // This leads to empty block nodes.
  //   // See: https://github.com/ueberdosis/tiptap/issues/2400
  //   if (
  //     this.editor.extensionManager.extensions.find(
  //       (extension) => extension.name === "collaboration"
  //     )
  //   ) {
  //     return;
  //   }
  //   const { view, state } = this.editor;
  //   const { tr, doc } = state;
  //   const { types, attributeName, generateID } = this.options;
  //   const nodesWithoutId = findChildren(doc, (node) => {
  //     return (
  //       types.includes(node.type.name) && node.attrs[attributeName] === null
  //     );
  //   });
  //   nodesWithoutId.forEach(({ node, pos }) => {
  //     tr.setNodeMarkup(pos, undefined, {
  //       ...node.attrs,
  //       [attributeName]: generateID(),
  //     });
  //   });
  //   tr.setMeta("addToHistory", false);
  //   view.dispatch(tr);
  // },
  addProseMirrorPlugins() {
    let e = null, t = !1;
    return [
      new je({
        key: new Ue("uniqueID"),
        appendTransaction: (n, o, r) => {
          const s = n.some((h) => h.docChanged) && !o.doc.eq(r.doc), a = this.options.filterTransaction && n.some((h) => {
            var k, m;
            return !((m = (k = this.options).filterTransaction) != null && m.call(k, h));
          });
          if (!s || a)
            return;
          const { tr: i } = r, { types: c, attributeName: l, generateID: d } = this.options, u = St(
            o.doc,
            n
          ), { mapping: p } = u;
          if (Bt(u).forEach(({ newRange: h }) => {
            const k = Mt(
              r.doc,
              h,
              (y) => c.includes(y.type.name)
            ), m = k.map(({ node: y }) => y.attrs[l]).filter((y) => y !== null), b = _t(m);
            k.forEach(({ node: y, pos: g }) => {
              var V;
              const v = (V = i.doc.nodeAt(g)) == null ? void 0 : V.attrs[l];
              if (v === null) {
                const W = o.doc.type.createAndFill().content;
                if (o.doc.content.findDiffStart(W) === null) {
                  const xe = JSON.parse(
                    JSON.stringify(r.doc.toJSON())
                  );
                  if (xe.content[0].content[0].attrs.id = "initialBlockId", JSON.stringify(xe.content) === JSON.stringify(W.toJSON())) {
                    i.setNodeMarkup(g, void 0, {
                      ...y.attrs,
                      [l]: "initialBlockId"
                    });
                    return;
                  }
                }
                i.setNodeMarkup(g, void 0, {
                  ...y.attrs,
                  [l]: d()
                });
                return;
              }
              const { deleted: S } = p.invert().mapResult(g);
              S && b.includes(v) && i.setNodeMarkup(g, void 0, {
                ...y.attrs,
                [l]: d()
              });
            });
          }), !!i.steps.length)
            return i.setMeta("uniqueID", !0), i;
        },
        // we register a global drag handler to track the current drag source element
        view(n) {
          const o = (r) => {
            let s;
            e = !((s = n.dom.parentElement) === null || s === void 0) && s.contains(r.target) ? n.dom.parentElement : null;
          };
          return window.addEventListener("dragstart", o), {
            destroy() {
              window.removeEventListener("dragstart", o);
            }
          };
        },
        props: {
          // `handleDOMEvents` is called before `transformPasted` so we can do
          // some checks before. However, `transformPasted` only runs when
          // editor content is pasted - not external content.
          handleDOMEvents: {
            // only create new ids for dropped content while holding `alt`
            // or content is dragged from another editor
            drop: (n, o) => {
              let r;
              return e !== n.dom.parentElement || ((r = o.dataTransfer) === null || r === void 0 ? void 0 : r.effectAllowed) === "copy" ? t = !0 : t = !1, e = null, !1;
            },
            // always create new ids on pasted content
            paste: () => (t = !0, !1)
          },
          // we’ll remove ids for every pasted node
          // so we can create a new one within `appendTransaction`
          transformPasted: (n) => {
            if (!t)
              return n;
            const { types: o, attributeName: r } = this.options, s = (a) => {
              const i = [];
              return a.forEach((c) => {
                if (c.isText) {
                  i.push(c);
                  return;
                }
                if (!o.includes(c.type.name)) {
                  i.push(c.copy(s(c.content)));
                  return;
                }
                const l = c.type.create(
                  {
                    ...c.attrs,
                    [r]: null
                  },
                  s(c.content),
                  c.marks
                );
                i.push(l);
              }), _.from(i);
            };
            return t = !1, new de(
              s(n.content),
              n.openStart,
              n.openEnd
            );
          }
        }
      })
    ];
  }
});
function Le(e) {
  return e.type === "link";
}
function Ze(e) {
  return typeof e != "string" && e.type === "link";
}
function I(e) {
  return typeof e != "string" && e.type === "text";
}
function se(e) {
  var t, n, o, r, s;
  return pe(e) ? { ...e } : $(e) ? {
    type: "tableCell",
    content: [].concat(e.content),
    props: {
      backgroundColor: ((t = e.props) == null ? void 0 : t.backgroundColor) ?? "default",
      textColor: ((n = e.props) == null ? void 0 : n.textColor) ?? "default",
      textAlignment: ((o = e.props) == null ? void 0 : o.textAlignment) ?? "left",
      colspan: ((r = e.props) == null ? void 0 : r.colspan) ?? 1,
      rowspan: ((s = e.props) == null ? void 0 : s.rowspan) ?? 1
    }
  } : {
    type: "tableCell",
    content: [].concat(e),
    props: {
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
      colspan: 1,
      rowspan: 1
    }
  };
}
function $(e) {
  return e != null && typeof e != "string" && !Array.isArray(e) && e.type === "tableCell";
}
function pe(e) {
  return $(e) && e.props !== void 0 && e.content !== void 0;
}
function j(e) {
  return pe(e) ? e.props.colspan ?? 1 : 1;
}
function ae(e) {
  return pe(e) ? e.props.rowspan ?? 1 : 1;
}
class Z extends Error {
  constructor(t) {
    super(`Unreachable case: ${t}`);
  }
}
function Vo(e, t = !0) {
  const { "data-test": n, ...o } = e;
  if (Object.keys(o).length > 0 && t)
    throw new Error("Object must be empty " + JSON.stringify(e));
}
const Rt = () => typeof navigator < "u" && (/Mac/.test(navigator.platform) || /AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent));
function T(e, t = "Ctrl") {
  return Rt() ? e.replace("Mod", "⌘") : e.replace("Mod", t);
}
function U(...e) {
  return [
    // Converts to & from set to remove duplicates.
    ...new Set(
      e.filter((t) => t).join(" ").split(" ")
    )
  ].join(" ");
}
const Wo = () => /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
function Vt(e, t, n, o) {
  const r = document.createElement("div");
  r.className = U(
    "bn-block-content",
    n.class
  ), r.setAttribute("data-content-type", e);
  for (const [a, i] of Object.entries(n))
    a !== "class" && r.setAttribute(a, i);
  const s = document.createElement(t);
  s.className = U(
    "bn-inline-content",
    o.class
  );
  for (const [a, i] of Object.entries(
    o
  ))
    a !== "class" && s.setAttribute(a, i);
  return r.appendChild(s), {
    dom: r,
    contentDOM: s
  };
}
const Te = (e, t) => {
  let n = Y(e, t.pmSchema);
  n.type.name === "blockContainer" && (n = n.firstChild);
  const o = t.pmSchema.nodes[n.type.name].spec.toDOM;
  if (o === void 0)
    throw new Error(
      "This block has no default HTML serialization as its corresponding TipTap node doesn't implement `renderHTML`."
    );
  const r = o(n);
  if (typeof r != "object" || !("dom" in r))
    throw new Error(
      "Cannot use this block's default HTML serialization as its corresponding TipTap node's `renderHTML` function does not return an object with the `dom` property."
    );
  return r;
};
function Wt(e, t = "<br>") {
  const n = e.querySelectorAll("p");
  if (n.length > 1) {
    const o = n[0];
    for (let r = 1; r < n.length; r++) {
      const s = n[r];
      o.innerHTML += t + s.innerHTML, s.remove();
    }
  }
}
function K(e) {
  return "data-" + e.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
function Fo(e) {
  const t = e.split("/");
  return !t.length || // invalid?
  t[t.length - 1] === "" ? e : t[t.length - 1];
}
function $o(e) {
  var n;
  const t = [
    "mp4",
    "webm",
    "ogg",
    "mov",
    "mkv",
    "flv",
    "avi",
    "wmv",
    "m4v"
  ];
  try {
    const r = ((n = new URL(e).pathname.split(".").pop()) == null ? void 0 : n.toLowerCase()) || "";
    return t.includes(r);
  } catch {
    return !1;
  }
}
function Ft(e) {
  const t = {};
  return Object.entries(e).forEach(([n, o]) => {
    t[n] = {
      default: o.default,
      keepOnSplit: !0,
      // Props are displayed in kebab-case as HTML attributes. If a prop's
      // value is the same as its default, we don't display an HTML
      // attribute for it.
      parseHTML: (r) => {
        const s = r.getAttribute(K(n));
        if (s === null)
          return null;
        if (o.default === void 0 && o.type === "boolean" || o.default !== void 0 && typeof o.default == "boolean")
          return s === "true" ? !0 : s === "false" ? !1 : null;
        if (o.default === void 0 && o.type === "number" || o.default !== void 0 && typeof o.default == "number") {
          const a = parseFloat(s);
          return !Number.isNaN(a) && Number.isFinite(a) ? a : null;
        }
        return s;
      },
      renderHTML: (r) => r[n] !== o.default ? {
        [K(n)]: r[n]
      } : {}
    };
  }), t;
}
function $t(e, t, n, o) {
  const r = e();
  if (r === void 0)
    throw new Error("Cannot find node position");
  const a = n.state.doc.resolve(r).node().attrs.id;
  if (!a)
    throw new Error("Block doesn't have id");
  const i = t.getBlock(a);
  if (i.type !== o)
    throw new Error("Block type does not match");
  return i;
}
function ie(e, t, n, o, r = !1, s) {
  const a = document.createElement("div");
  if (s !== void 0)
    for (const [i, c] of Object.entries(s))
      i !== "class" && a.setAttribute(i, c);
  a.className = U(
    "bn-block-content",
    (s == null ? void 0 : s.class) || ""
  ), a.setAttribute("data-content-type", t);
  for (const [i, c] of Object.entries(n)) {
    const d = o[i].default;
    c !== d && a.setAttribute(K(i), c);
  }
  return r && a.setAttribute("data-file-block", ""), a.appendChild(e.dom), e.contentDOM && (e.contentDOM.className = U(
    "bn-inline-content",
    e.contentDOM.className
  )), {
    ...e,
    dom: a
  };
}
function jt(e, t, n) {
  return {
    config: {
      type: e.type,
      content: e.content,
      propSchema: t
    },
    implementation: {
      node: e.node,
      render: Te,
      toExternalHTML: Te
    },
    extensions: n
  };
}
function Ut(e, t) {
  e.stopEvent = (n) => (n.type === "mousedown" && setTimeout(() => {
    t.view.dom.blur();
  }, 10), !0);
}
function zt(e, t) {
  const n = [
    {
      tag: "[data-content-type=" + e.type + "]",
      contentElement: ".bn-inline-content"
    }
  ];
  return t.parse && n.push({
    tag: "*",
    getAttrs(o) {
      var s;
      if (typeof o == "string")
        return !1;
      const r = (s = t.parse) == null ? void 0 : s.call(t, o);
      return r === void 0 ? !1 : r;
    },
    getContent: e.content === "inline" || e.content === "none" ? (o, r) => {
      var s;
      if (t.parseContent)
        return t.parseContent({
          el: o,
          schema: r
        });
      if (e.content === "inline") {
        const i = o.cloneNode(!0);
        return Wt(
          i,
          (s = t.meta) != null && s.code ? `
` : "<br>"
        ), Q.fromSchema(r).parse(i, {
          topNode: r.nodes.paragraph.create()
        }).content;
      }
      return _.empty;
    } : void 0
  }), n;
}
function qt(e, t, n, o) {
  var s, a, i, c;
  const r = t.node || D.create({
    name: e.type,
    content: e.content === "inline" ? "inline*" : e.content === "none" ? "" : e.content,
    group: "blockContent",
    selectable: ((s = t.meta) == null ? void 0 : s.selectable) ?? !0,
    isolating: ((a = t.meta) == null ? void 0 : a.isolating) ?? !0,
    code: ((i = t.meta) == null ? void 0 : i.code) ?? !1,
    defining: ((c = t.meta) == null ? void 0 : c.defining) ?? !0,
    priority: o,
    addAttributes() {
      return Ft(e.propSchema);
    },
    parseHTML() {
      return zt(e, t);
    },
    renderHTML({ HTMLAttributes: l }) {
      var u;
      const d = document.createElement("div");
      return ie(
        {
          dom: d,
          contentDOM: e.content === "inline" ? d : void 0
        },
        e.type,
        {},
        e.propSchema,
        ((u = t.meta) == null ? void 0 : u.fileBlockAccept) !== void 0,
        l
      );
    },
    addNodeView() {
      return (l) => {
        var h, k;
        const d = this.options.editor, u = $t(
          l.getPos,
          d,
          this.editor,
          e.type
        ), p = ((h = this.options.domAttributes) == null ? void 0 : h.blockContent) || {}, f = t.render.call(
          { blockContentDOMAttributes: p, props: l, renderType: "nodeView" },
          u,
          d
        );
        return ((k = t.meta) == null ? void 0 : k.selectable) === !1 && Ut(f, this.editor), f;
      };
    }
  });
  if (r.name !== e.type)
    throw new Error(
      "Node name does not match block type. This is a bug in BlockNote."
    );
  return {
    config: e,
    implementation: {
      ...t,
      node: r,
      render(l, d) {
        var p;
        const u = ((p = r.options.domAttributes) == null ? void 0 : p.blockContent) || {};
        return t.render.call(
          {
            blockContentDOMAttributes: u,
            props: void 0,
            renderType: "dom"
          },
          l,
          d
        );
      },
      // TODO: this should not have wrapInBlockStructure and generally be a lot simpler
      // post-processing in externalHTMLExporter should not be necessary
      toExternalHTML: (l, d) => {
        var p, f;
        const u = ((p = r.options.domAttributes) == null ? void 0 : p.blockContent) || {};
        return ((f = t.toExternalHTML) == null ? void 0 : f.call(
          { blockContentDOMAttributes: u },
          l,
          d
        )) ?? t.render.call(
          { blockContentDOMAttributes: u, renderType: "dom", props: void 0 },
          l,
          d
        );
      }
    },
    extensions: n
  };
}
function jo(e) {
  return e;
}
function M(e, t, n) {
  return (o = {}) => {
    const r = typeof e == "function" ? e(o) : e, s = typeof t == "function" ? t(o) : t, a = n ? typeof n == "function" ? n(o) : n : void 0;
    return {
      config: r,
      implementation: {
        ...s,
        // TODO: this should not have wrapInBlockStructure and generally be a lot simpler
        // post-processing in externalHTMLExporter should not be necessary
        toExternalHTML(i, c) {
          var d, u;
          const l = (d = s.toExternalHTML) == null ? void 0 : d.call(
            { blockContentDOMAttributes: this.blockContentDOMAttributes },
            i,
            c
          );
          if (l !== void 0)
            return ie(
              l,
              i.type,
              i.props,
              r.propSchema,
              ((u = s.meta) == null ? void 0 : u.fileBlockAccept) !== void 0
            );
        },
        render(i, c) {
          var u;
          const l = s.render.call(
            {
              blockContentDOMAttributes: this.blockContentDOMAttributes,
              renderType: this.renderType,
              props: this.props
            },
            i,
            c
          );
          return ie(
            l,
            i.type,
            i.props,
            r.propSchema,
            ((u = s.meta) == null ? void 0 : u.fileBlockAccept) !== void 0,
            this.blockContentDOMAttributes
          );
        }
      },
      extensions: a
    };
  };
}
function fe(e, t) {
  const n = e.resolve(t);
  if (n.nodeAfter && n.nodeAfter.type.isInGroup("bnBlock"))
    return {
      posBeforeNode: n.pos,
      node: n.nodeAfter
    };
  let o = n.depth, r = n.node(o);
  for (; o > 0; ) {
    if (r.type.isInGroup("bnBlock"))
      return {
        posBeforeNode: n.before(o),
        node: r
      };
    o--, r = n.node(o);
  }
  const s = [];
  e.descendants((i, c) => {
    i.type.isInGroup("bnBlock") && s.push(c);
  }), console.warn(`Position ${t} is not within a blockContainer node.`);
  const a = e.resolve(
    s.find((i) => i >= t) || s[s.length - 1]
  );
  return {
    posBeforeNode: a.pos,
    node: a.nodeAfter
  };
}
function he(e, t) {
  if (!e.type.isInGroup("bnBlock"))
    throw new Error(
      `Attempted to get bnBlock node at position but found node of different type ${e.type.name}`
    );
  const n = e, o = t, r = o + n.nodeSize, s = {
    node: n,
    beforePos: o,
    afterPos: r
  };
  if (n.type.name === "blockContainer") {
    let a, i;
    if (n.forEach((c, l) => {
      if (c.type.spec.group === "blockContent") {
        const d = c, u = o + l + 1, p = u + c.nodeSize;
        a = {
          node: d,
          beforePos: u,
          afterPos: p
        };
      } else if (c.type.name === "blockGroup") {
        const d = c, u = o + l + 1, p = u + c.nodeSize;
        i = {
          node: d,
          beforePos: u,
          afterPos: p
        };
      }
    }), !a)
      throw new Error(
        `blockContainer node does not contain a blockContent node in its children: ${n}`
      );
    return {
      isBlockContainer: !0,
      bnBlock: s,
      blockContent: a,
      childContainer: i,
      blockNoteType: a.node.type.name
    };
  } else {
    if (!s.node.type.isInGroup("childContainer"))
      throw new Error(
        `bnBlock node is not in the childContainer group: ${s.node}`
      );
    return {
      isBlockContainer: !1,
      bnBlock: s,
      childContainer: s,
      blockNoteType: s.node.type.name
    };
  }
}
function z(e) {
  return he(e.node, e.posBeforeNode);
}
function Zt(e) {
  if (!e.nodeAfter)
    throw new Error(
      `Attempted to get blockContainer node at position ${e.pos} but a node at this position does not exist`
    );
  return he(e.nodeAfter, e.pos);
}
function Ge(e) {
  const t = fe(e.doc, e.selection.anchor);
  return z(t);
}
function Gt(e) {
  const t = fe(e.doc, e.selection.anchor);
  return z(t);
}
function G(e) {
  return "doc" in e ? e.doc.type.schema : e.type.schema;
}
function Xe(e) {
  return e.cached.blockNoteEditor;
}
function me(e) {
  return Xe(e).schema;
}
function ge(e) {
  return me(e).blockSchema;
}
function be(e) {
  return me(e).inlineContentSchema;
}
function R(e) {
  return me(e).styleSchema;
}
function ke(e) {
  return Xe(e).blockCache;
}
function Xt(e, t, n) {
  var s, a;
  const o = {
    type: "tableContent",
    columnWidths: [],
    headerRows: void 0,
    headerCols: void 0,
    rows: []
  }, r = [];
  e.content.forEach((i, c, l) => {
    const d = {
      cells: []
    };
    l === 0 && i.content.forEach((u) => {
      let p = u.attrs.colwidth;
      p == null && (p = new Array(u.attrs.colspan ?? 1).fill(void 0)), o.columnWidths.push(...p);
    }), d.cells = i.content.content.map((u, p) => (r[l] || (r[l] = []), r[l][p] = u.type.name === "tableHeader", {
      type: "tableCell",
      content: u.content.content.map(
        (h) => Ce(h, t, n)
      ).reduce(
        (h, k) => {
          if (!h.length)
            return k;
          const m = h[h.length - 1], b = k[0];
          return b && I(m) && I(b) && JSON.stringify(m.styles) === JSON.stringify(b.styles) ? (m.text += `
` + b.text, h.push(...k.slice(1)), h) : (h.push(...k), h);
        },
        []
      ),
      props: {
        colspan: u.attrs.colspan,
        rowspan: u.attrs.rowspan,
        backgroundColor: u.attrs.backgroundColor,
        textColor: u.attrs.textColor,
        textAlignment: u.attrs.textAlignment
      }
    })), o.rows.push(d);
  });
  for (let i = 0; i < r.length; i++)
    (s = r[i]) != null && s.every((c) => c) && (o.headerRows = (o.headerRows ?? 0) + 1);
  for (let i = 0; i < ((a = r[0]) == null ? void 0 : a.length); i++)
    r != null && r.every((c) => c[i]) && (o.headerCols = (o.headerCols ?? 0) + 1);
  return o;
}
function Ce(e, t, n) {
  const o = [];
  let r;
  return e.content.forEach((s) => {
    if (s.type.name === "hardBreak") {
      if (r)
        if (I(r))
          r.text += `
`;
        else if (Le(r))
          r.content[r.content.length - 1].text += `
`;
        else
          throw new Error("unexpected");
      else
        r = {
          type: "text",
          text: `
`,
          styles: {}
        };
      return;
    }
    if (s.type.name !== "link" && s.type.name !== "text") {
      if (!t[s.type.name]) {
        console.warn("unrecognized inline content type", s.type.name);
        return;
      }
      r && (o.push(r), r = void 0), o.push(
        Jt(s, t, n)
      );
      return;
    }
    const a = {};
    let i;
    for (const c of s.marks)
      if (c.type.name === "link")
        i = c;
      else {
        const l = n[c.type.name];
        if (!l) {
          if (c.type.spec.blocknoteIgnore)
            continue;
          throw new Error(`style ${c.type.name} not found in styleSchema`);
        }
        if (l.propSchema === "boolean")
          a[l.type] = !0;
        else if (l.propSchema === "string")
          a[l.type] = c.attrs.stringValue;
        else
          throw new Z(l.propSchema);
      }
    r ? I(r) ? i ? (o.push(r), r = {
      type: "link",
      href: i.attrs.href,
      content: [
        {
          type: "text",
          text: s.textContent,
          styles: a
        }
      ]
    }) : JSON.stringify(r.styles) === JSON.stringify(a) ? r.text += s.textContent : (o.push(r), r = {
      type: "text",
      text: s.textContent,
      styles: a
    }) : Le(r) && (i ? r.href === i.attrs.href ? JSON.stringify(
      r.content[r.content.length - 1].styles
    ) === JSON.stringify(a) ? r.content[r.content.length - 1].text += s.textContent : r.content.push({
      type: "text",
      text: s.textContent,
      styles: a
    }) : (o.push(r), r = {
      type: "link",
      href: i.attrs.href,
      content: [
        {
          type: "text",
          text: s.textContent,
          styles: a
        }
      ]
    }) : (o.push(r), r = {
      type: "text",
      text: s.textContent,
      styles: a
    })) : i ? r = {
      type: "link",
      href: i.attrs.href,
      content: [
        {
          type: "text",
          text: s.textContent,
          styles: a
        }
      ]
    } : r = {
      type: "text",
      text: s.textContent,
      styles: a
    };
  }), r && o.push(r), o;
}
function Jt(e, t, n) {
  if (e.type.name === "text" || e.type.name === "link")
    throw new Error("unexpected");
  const o = {}, r = t[e.type.name];
  for (const [i, c] of Object.entries(e.attrs)) {
    if (!r)
      throw Error("ic node is of an unrecognized type: " + e.type.name);
    const l = r.propSchema;
    i in l && (o[i] = c);
  }
  let s;
  return r.content === "styled" ? s = Ce(
    e,
    t,
    n
  ) : s = void 0, {
    type: e.type.name,
    props: o,
    content: s
  };
}
function X(e, t, n = ge(t), o = be(t), r = R(t), s = ke(t)) {
  var k;
  if (!e.type.isInGroup("bnBlock"))
    throw Error("Node should be a bnBlock, but is instead: " + e.type.name);
  const a = s == null ? void 0 : s.get(e);
  if (a)
    return a;
  const i = he(e, 0);
  let c = i.bnBlock.node.attrs.id;
  c === null && (c = qe.options.generateID());
  const l = n[i.blockNoteType];
  if (!l)
    throw Error("Block is of an unrecognized type: " + i.blockNoteType);
  const d = {};
  for (const [m, b] of Object.entries({
    ...e.attrs,
    ...i.isBlockContainer ? i.blockContent.node.attrs : {}
  })) {
    const y = l.propSchema;
    m in y && !(y[m].default === void 0 && b === void 0) && (d[m] = b);
  }
  const u = n[i.blockNoteType], p = [];
  (k = i.childContainer) == null || k.node.forEach((m) => {
    p.push(
      X(
        m,
        t,
        n,
        o,
        r,
        s
      )
    );
  });
  let f;
  if (u.content === "inline") {
    if (!i.isBlockContainer)
      throw new Error("impossible");
    f = Ce(
      i.blockContent.node,
      o,
      r
    );
  } else if (u.content === "table") {
    if (!i.isBlockContainer)
      throw new Error("impossible");
    f = Xt(
      i.blockContent.node,
      o,
      r
    );
  } else if (u.content === "none")
    f = void 0;
  else
    throw new Z(u.content);
  const h = {
    id: c,
    type: u.type,
    props: d,
    content: f,
    children: p
  };
  return s == null || s.set(e, h), h;
}
function Uo(e, t, n = ge(t), o = be(t), r = R(t), s = ke(t)) {
  const a = [];
  return e.firstChild.descendants((i) => (a.push(
    X(
      i,
      t,
      n,
      o,
      r,
      s
    )
  ), !1)), a;
}
function zo(e, t, n = ge(t), o = be(t), r = R(t), s = ke(t)) {
  function a(i, c, l) {
    if (i.type.name !== "blockGroup")
      throw new Error("unexpected");
    const d = [];
    let u, p;
    return i.forEach((f, h, k) => {
      if (f.type.name !== "blockContainer")
        throw new Error("unexpected");
      if (f.childCount === 0)
        return;
      if (f.childCount === 0 || f.childCount > 2)
        throw new Error(
          "unexpected, blockContainer.childCount: " + f.childCount
        );
      const m = k === 0, b = k === i.childCount - 1;
      if (f.firstChild.type.name === "blockGroup") {
        if (!m)
          throw new Error("unexpected");
        const S = a(
          f.firstChild,
          Math.max(0, c - 1),
          b ? Math.max(0, l - 1) : 0
        );
        u = S.blockCutAtStart, b && (p = S.blockCutAtEnd), d.push(...S.blocks);
        return;
      }
      const y = X(
        f,
        t,
        n,
        o,
        r,
        s
      ), g = f.childCount > 1 ? f.child(1) : void 0;
      let v = [];
      if (g) {
        const S = a(
          g,
          0,
          // TODO: can this be anything other than 0?
          b ? Math.max(0, l - 1) : 0
        );
        v = S.blocks, b && (p = S.blockCutAtEnd);
      }
      b && !g && l > 1 && (p = y.id), m && c > 1 && (u = y.id), d.push({
        ...y,
        children: v
      });
    }), { blocks: d, blockCutAtStart: u, blockCutAtEnd: p };
  }
  if (e.content.childCount === 0)
    return {
      blocks: [],
      blockCutAtStart: void 0,
      blockCutAtEnd: void 0
    };
  if (e.content.childCount !== 1)
    throw new Error(
      "slice must be a single block, did you forget includeParents=true?"
    );
  return a(
    e.content.firstChild,
    Math.max(e.openStart - 1, 0),
    Math.max(e.openEnd - 1, 0)
  );
}
function qo(e, t, n, o) {
  return e.dom.setAttribute("data-inline-content-type", t), Object.entries(n).filter(([r, s]) => {
    const a = o[r];
    return s !== a.default;
  }).map(([r, s]) => [K(r), s]).forEach(([r, s]) => e.dom.setAttribute(r, s)), e.contentDOM && e.contentDOM.setAttribute("data-editable", ""), e;
}
function Zo(e) {
  return {
    Backspace: ({ editor: t }) => {
      const n = t.state.selection.$from;
      return t.state.selection.empty && n.node().type.name === e.type && n.parentOffset === 0;
    }
  };
}
function Kt(e, t) {
  return {
    config: e,
    implementation: t
  };
}
function Go(e, t, n) {
  return Kt(
    {
      type: e.name,
      propSchema: t,
      content: e.config.content === "inline*" ? "styled" : "none"
    },
    {
      ...n,
      node: e
    }
  );
}
function Je(e) {
  return Object.fromEntries(
    Object.entries(e).map(([t, n]) => [t, n.config])
  );
}
function Qt(e) {
  return e === "boolean" ? {} : {
    stringValue: {
      default: void 0,
      keepOnSplit: !0,
      parseHTML: (t) => t.getAttribute("data-value"),
      renderHTML: (t) => t.stringValue !== void 0 ? {
        "data-value": t.stringValue
      } : {}
    }
  };
}
function J(e, t, n, o) {
  return e.dom.setAttribute("data-style-type", t), o === "string" && e.dom.setAttribute("data-value", n), e.contentDOM && e.contentDOM.setAttribute("data-editable", ""), e;
}
function Ke(e, t) {
  return {
    config: e,
    implementation: t
  };
}
function F(e, t) {
  return Ke(
    {
      type: e.name,
      propSchema: t
    },
    {
      mark: e,
      render(n, o) {
        const r = o.pmSchema.marks[e.name].spec.toDOM;
        if (r === void 0)
          throw new Error(
            "This block has no default HTML serialization as its corresponding TipTap node doesn't implement `renderHTML`."
          );
        const s = o.pmSchema.mark(e.name, {
          stringValue: n
        }), a = Be.renderSpec(
          document,
          r(s, !0)
        );
        if (typeof a != "object" || !("dom" in a))
          throw new Error(
            "Cannot use this block's default HTML serialization as its corresponding TipTap mark's `renderHTML` function does not return an object with the `dom` property."
          );
        return a;
      },
      toExternalHTML(n, o) {
        const r = o.pmSchema.marks[e.name].spec.toDOM;
        if (r === void 0)
          throw new Error(
            "This block has no default HTML serialization as its corresponding TipTap node doesn't implement `renderHTML`."
          );
        const s = o.pmSchema.mark(e.name, {
          stringValue: n
        }), a = Be.renderSpec(
          document,
          r(s, !0)
        );
        if (typeof a != "object" || !("dom" in a))
          throw new Error(
            "Cannot use this block's default HTML serialization as its corresponding TipTap mark's `renderHTML` function does not return an object with the `dom` property."
          );
        return a;
      }
    }
  );
}
function Qe(e) {
  return Object.fromEntries(
    Object.entries(e).map(([t, n]) => [t, n.config])
  );
}
function Yt(e, t) {
  const n = [
    {
      tag: `[data-style-type="${e.type}"]`,
      contentElement: (o) => {
        const r = o;
        return r.matches("[data-editable]") ? r : r.querySelector("[data-editable]") || r;
      }
    }
  ];
  return t && n.push({
    tag: "*",
    getAttrs(o) {
      if (typeof o == "string")
        return !1;
      const r = t == null ? void 0 : t(o);
      return r === void 0 ? !1 : { stringValue: r };
    }
  }), n;
}
function Ye(e, t) {
  const n = Lt.create({
    name: e.type,
    addAttributes() {
      return Qt(e.propSchema);
    },
    parseHTML() {
      return Yt(e, t.parse);
    },
    renderHTML({ mark: o }) {
      const r = (t.toExternalHTML || t.render)(o.attrs.stringValue);
      return J(
        r,
        e.type,
        o.attrs.stringValue,
        e.propSchema
      );
    },
    addMarkView() {
      return ({ mark: o }) => {
        const r = t.render(o.attrs.stringValue);
        return J(
          r,
          e.type,
          o.attrs.stringValue,
          e.propSchema
        );
      };
    }
  });
  return Ke(e, {
    mark: n,
    render: (o) => {
      const r = t.render(o);
      return J(
        r,
        e.type,
        o,
        e.propSchema
      );
    },
    toExternalHTML: (o) => {
      const r = (t.toExternalHTML || t.render)(o);
      return J(
        r,
        e.type,
        o,
        e.propSchema
      );
    }
  });
}
function en(e) {
  const t = nn(e);
  let { roots: n, nonRoots: o } = Ae(t);
  const r = [];
  for (; n.size; ) {
    r.push(n);
    const s = /* @__PURE__ */ new Set();
    for (const a of n) {
      const i = e.get(a);
      if (i)
        for (const c of i) {
          const l = t.get(c);
          if (l === void 0)
            continue;
          const d = l - 1;
          t.set(c, d), d === 0 && s.add(c);
        }
    }
    n = s;
  }
  if (o = Ae(t).nonRoots, o.size)
    throw new Error(
      `Cycle(s) detected; toposort only works on acyclic graphs. Cyclic nodes: ${Array.from(o).join(", ")}`
    );
  return r;
}
function tn(e) {
  const t = on(e);
  return en(t);
}
function nn(e) {
  const t = /* @__PURE__ */ new Map();
  for (const [n, o] of e.entries()) {
    t.has(n) || t.set(n, 0);
    for (const r of o) {
      const s = t.get(r) ?? 0;
      t.set(r, s + 1);
    }
  }
  return t;
}
function Ae(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const [o, r] of e.entries())
    r === 0 ? t.add(o) : n.add(o);
  return { roots: t, nonRoots: n };
}
function on(e) {
  const t = /* @__PURE__ */ new Map();
  for (const [n, o] of e.entries()) {
    t.has(n) || t.set(n, /* @__PURE__ */ new Set());
    for (const r of o)
      t.has(r) || t.set(r, /* @__PURE__ */ new Set()), t.get(r).add(n);
  }
  return t;
}
function rn() {
  return /* @__PURE__ */ new Map();
}
function Ne(e) {
  return e && Object.fromEntries(
    Object.entries(e).filter(([, t]) => t !== void 0)
  );
}
class sn {
  constructor(t) {
    // Helper so that you can use typeof schema.BlockNoteEditor
    x(this, "BlockNoteEditor", "only for types");
    x(this, "Block", "only for types");
    x(this, "PartialBlock", "only for types");
    x(this, "inlineContentSpecs");
    x(this, "styleSpecs");
    x(this, "blockSpecs");
    x(this, "blockSchema");
    x(this, "inlineContentSchema");
    x(this, "styleSchema");
    this.opts = t;
    const {
      blockSpecs: n,
      inlineContentSpecs: o,
      styleSpecs: r,
      blockSchema: s,
      inlineContentSchema: a,
      styleSchema: i
    } = this.init();
    this.blockSpecs = n, this.styleSpecs = r, this.styleSchema = i, this.inlineContentSpecs = o, this.blockSchema = s, this.inlineContentSchema = a;
  }
  init() {
    const t = rn(), n = /* @__PURE__ */ new Set();
    t.set("default", n);
    for (const [i, c] of Object.entries(this.opts.blockSpecs))
      c.implementation.runsBefore ? t.set(i, new Set(c.implementation.runsBefore)) : n.add(i);
    const o = tn(t), r = o.findIndex((i) => i.has("default")), s = (i) => 91 + (o.findIndex((l) => l.has(i)) + r) * 10, a = Object.fromEntries(
      Object.entries(this.opts.blockSpecs).map(([i, c]) => [
        i,
        qt(
          c.config,
          c.implementation,
          c.extensions,
          s(i)
        )
      ])
    );
    return {
      blockSpecs: a,
      blockSchema: Object.fromEntries(
        Object.entries(a).map(([i, c]) => [i, c.config])
      ),
      inlineContentSpecs: Ne(this.opts.inlineContentSpecs),
      styleSpecs: Ne(this.opts.styleSpecs),
      inlineContentSchema: Je(
        this.opts.inlineContentSpecs
      ),
      styleSchema: Qe(this.opts.styleSpecs)
    };
  }
  /**
   * Adds additional block specs to the current schema in a builder pattern.
   * This method allows extending the schema after it has been created.
   *
   * @param additionalBlockSpecs - Additional block specs to add to the schema
   * @returns The current schema instance for chaining
   */
  extend(t) {
    Object.assign(this.opts.blockSpecs, t.blockSpecs), Object.assign(this.opts.inlineContentSpecs, t.inlineContentSpecs), Object.assign(this.opts.styleSpecs, t.styleSpecs);
    const {
      blockSpecs: n,
      inlineContentSpecs: o,
      styleSpecs: r,
      blockSchema: s,
      inlineContentSchema: a,
      styleSchema: i
    } = this.init();
    return this.blockSpecs = n, this.styleSpecs = r, this.styleSchema = i, this.inlineContentSpecs = o, this.blockSchema = s, this.inlineContentSchema = a, this;
  }
}
function N(e) {
  const { height: t, width: n } = et(e), o = new Array(t).fill(!1).map(() => new Array(n).fill(null)), r = (s, a) => {
    for (let i = s; i < t; i++)
      for (let c = a; c < n; c++)
        if (!o[i][c])
          return { row: i, col: c };
    throw new Error(
      "Unable to create occupancy grid for table, no more available cells"
    );
  };
  for (let s = 0; s < e.content.rows.length; s++)
    for (let a = 0; a < e.content.rows[s].cells.length; a++) {
      const i = se(e.content.rows[s].cells[a]), c = ae(i), l = j(i), { row: d, col: u } = r(s, a);
      for (let p = d; p < d + c; p++)
        for (let f = u; f < u + l; f++) {
          if (o[p][f])
            throw new Error(
              `Unable to create occupancy grid for table, cell at ${p},${f} is already occupied`
            );
          o[p][f] = {
            row: s,
            col: a,
            rowspan: c,
            colspan: l,
            cell: i
          };
        }
    }
  return o;
}
function q(e) {
  const t = /* @__PURE__ */ new Set();
  return e.map((n) => ({
    cells: n.map((o) => t.has(o.row + ":" + o.col) ? !1 : (t.add(o.row + ":" + o.col), o.cell)).filter((o) => o !== !1)
  }));
}
function P(e, t, n = N(t)) {
  for (let o = 0; o < n.length; o++)
    for (let r = 0; r < n[o].length; r++) {
      const s = n[o][r];
      if (s.row === e.row && s.col === e.col)
        return { row: o, col: r, cell: s.cell };
    }
  throw new Error(
    `Unable to resolve relative table cell indices for table, cell at ${e.row},${e.col} is not occupied`
  );
}
function et(e) {
  const t = e.content.rows.length;
  let n = 0;
  return e.content.rows.forEach((o) => {
    let r = 0;
    o.cells.forEach((s) => {
      r += j(s);
    }), n = Math.max(n, r);
  }), { height: t, width: n };
}
function tt(e, t, n = N(t)) {
  var r;
  const o = (r = n[e.row]) == null ? void 0 : r[e.col];
  if (o)
    return {
      row: o.row,
      col: o.col,
      cell: o.cell
    };
}
function an(e, t) {
  var s;
  const n = N(e);
  if (t < 0 || t >= n.length)
    return [];
  let o = 0;
  for (let a = 0; a < t; a++) {
    const i = (s = n[o]) == null ? void 0 : s[0];
    if (!i)
      return [];
    o += i.rowspan;
  }
  const r = new Array(n[0].length).fill(!1).map((a, i) => tt(
    { row: o, col: i },
    e,
    n
  )).filter(
    (a) => a !== void 0
  );
  return r.filter((a, i) => r.findIndex((c) => c.row === a.row && c.col === a.col) === i);
}
function cn(e, t) {
  var s;
  const n = N(e);
  if (t < 0 || t >= n[0].length)
    return [];
  let o = 0;
  for (let a = 0; a < t; a++) {
    const i = (s = n[0]) == null ? void 0 : s[o];
    if (!i)
      return [];
    o += i.colspan;
  }
  const r = new Array(n.length).fill(!1).map((a, i) => tt(
    { row: i, col: o },
    e,
    n
  )).filter(
    (a) => a !== void 0
  );
  return r.filter((a, i) => r.findIndex((c) => c.row === a.row && c.col === a.col) === i);
}
function Xo(e, t, n, o = N(e)) {
  const { col: r } = P(
    {
      row: 0,
      col: t
    },
    e,
    o
  ), { col: s } = P(
    {
      row: 0,
      col: n
    },
    e,
    o
  );
  return o.forEach((a) => {
    const [i] = a.splice(r, 1);
    a.splice(s, 0, i);
  }), q(o);
}
function Jo(e, t, n, o = N(e)) {
  const { row: r } = P(
    {
      row: t,
      col: 0
    },
    e,
    o
  ), { row: s } = P(
    {
      row: n,
      col: 0
    },
    e,
    o
  ), [a] = o.splice(r, 1);
  return o.splice(s, 0, a), q(o);
}
function ce(e) {
  return e ? $(e) ? ce(e.content) : typeof e == "string" ? e.length === 0 : Array.isArray(e) ? e.every(
    (t) => typeof t == "string" ? t.length === 0 : I(t) ? t.text.length === 0 : Ze(t) ? typeof t.content == "string" ? t.content.length === 0 : t.content.every((n) => n.text.length === 0) : !1
  ) : !1 : !0;
}
function Ko(e, t, n = N(e)) {
  if (t === "columns") {
    let s = 0;
    for (let a = n[0].length - 1; a >= 0 && n.every(
      (c) => ce(c[a].cell) && c[a].colspan === 1
    ); a--)
      s++;
    for (let a = n.length - 1; a >= 0; a--) {
      const i = Math.max(
        n[a].length - s,
        1
      );
      n[a] = n[a].slice(0, i);
    }
    return q(n);
  }
  let o = 0;
  for (let s = n.length - 1; s >= 0 && n[s].every(
    (i) => ce(i.cell) && i.rowspan === 1
  ); s--)
    o++;
  const r = Math.min(o, n.length - 1);
  return n.splice(n.length - r, r), q(n);
}
function Qo(e, t, n, o = N(e)) {
  const { width: r, height: s } = et(e);
  if (t === "columns")
    o.forEach((a, i) => {
      if (n >= 0)
        for (let c = 0; c < n; c++)
          a.push({
            row: i,
            col: Math.max(...a.map((l) => l.col)) + 1,
            rowspan: 1,
            colspan: 1,
            cell: se("")
          });
      else
        a.splice(r + n, -1 * n);
    });
  else if (n > 0)
    for (let a = 0; a < n; a++) {
      const i = new Array(r).fill(null).map((c, l) => ({
        row: s + a,
        col: l,
        rowspan: 1,
        colspan: 1,
        cell: se("")
      }));
      o.push(i);
    }
  else n < 0 && o.splice(s + n, -1 * n);
  return q(o);
}
function Yo(e, t, n) {
  const o = an(e, n);
  if (!o.some((c) => ae(c.cell) > 1))
    return !0;
  let s = n, a = n;
  return o.forEach((c) => {
    const l = ae(c.cell);
    s = Math.max(s, c.row + l - 1), a = Math.min(a, c.row);
  }), t < n ? n === s : n === a;
}
function er(e, t, n) {
  const o = cn(e, n);
  if (!o.some((c) => j(c.cell) > 1))
    return !0;
  let s = n, a = n;
  return o.forEach((c) => {
    const l = j(c.cell);
    s = Math.max(s, c.col + l - 1), a = Math.min(a, c.col);
  }), t < n ? n === s : n === a;
}
function tr(e, t, n) {
  const o = P(e, n), r = P(t, n);
  return o.col === r.col;
}
function Ie(e, t, n, o) {
  const r = [];
  for (const [a, i] of Object.entries(e.styles || {})) {
    const c = n[a];
    if (!c)
      throw new Error(`style ${a} not found in styleSchema`);
    if (c.propSchema === "boolean")
      i && r.push(t.mark(a));
    else if (c.propSchema === "string")
      i && r.push(t.mark(a, { stringValue: i }));
    else
      throw new Z(c.propSchema);
  }
  return !o || !t.nodes[o].spec.code ? e.text.split(/(\n)/g).filter((a) => a.length > 0).map((a) => a === `
` ? t.nodes.hardBreak.createChecked() : t.text(a, r)) : e.text.length > 0 ? [t.text(e.text, r)] : [];
}
function ln(e, t, n) {
  const o = t.marks.link.create({
    href: e.href
  });
  return le(e.content, t, n).map(
    (r) => {
      if (r.type.name === "text")
        return r.mark([...r.marks, o]);
      if (r.type.name === "hardBreak")
        return r;
      throw new Error("unexpected node type");
    }
  );
}
function le(e, t, n, o) {
  const r = [];
  if (typeof e == "string")
    return r.push(
      ...Ie(
        { text: e, styles: {} },
        t,
        n,
        o
      )
    ), r;
  for (const s of e)
    r.push(
      ...Ie(s, t, n, o)
    );
  return r;
}
function O(e, t, n, o = R(t)) {
  const r = [];
  for (const s of e)
    typeof s == "string" ? r.push(
      ...le(s, t, o, n)
    ) : Ze(s) ? r.push(...ln(s, t, o)) : I(s) ? r.push(
      ...le([s], t, o, n)
    ) : r.push(
      ot(s, t, o)
    );
  return r;
}
function nt(e, t, n = R(t)) {
  const o = [], r = new Array(e.headerRows ?? 0).fill(!0), s = new Array(e.headerCols ?? 0).fill(!0), a = e.columnWidths ?? [];
  for (let i = 0; i < e.rows.length; i++) {
    const c = e.rows[i], l = [], d = r[i];
    for (let p = 0; p < c.cells.length; p++) {
      const f = c.cells[p], h = s[p], k = void 0;
      let m = null;
      const b = P(
        {
          row: i,
          col: p
        },
        { content: e }
      );
      let y = a[b.col] ? [a[b.col]] : null;
      if (f) if (typeof f == "string")
        m = t.text(f);
      else if ($(f)) {
        f.content && (m = O(
          f.content,
          t,
          "tableParagraph",
          n
        ));
        const v = j(f);
        v > 1 && (y = new Array(v).fill(!1).map((S, oe) => a[b.col + oe] ?? void 0));
      } else
        m = O(
          f,
          t,
          "tableParagraph",
          n
        );
      const g = t.nodes[h || d ? "tableHeader" : "tableCell"].createChecked(
        {
          ...$(f) ? f.props : {},
          colwidth: y
        },
        t.nodes.tableParagraph.createChecked(k, m)
      );
      l.push(g);
    }
    const u = t.nodes.tableRow.createChecked({}, l);
    o.push(u);
  }
  return o;
}
function ot(e, t, n) {
  let o, r = e.type;
  if (r === void 0 && (r = "paragraph"), !t.nodes[r])
    throw new Error(`node type ${r} not found in schema`);
  if (!e.content)
    o = t.nodes[r].createChecked(e.props);
  else if (typeof e.content == "string") {
    const s = O(
      [e.content],
      t,
      r,
      n
    );
    o = t.nodes[r].createChecked(e.props, s);
  } else if (Array.isArray(e.content)) {
    const s = O(
      e.content,
      t,
      r,
      n
    );
    o = t.nodes[r].createChecked(e.props, s);
  } else if (e.content.type === "tableContent") {
    const s = nt(e.content, t, n);
    o = t.nodes[r].createChecked(e.props, s);
  } else
    throw new Z(e.content.type);
  return o;
}
function Y(e, t, n = R(t)) {
  let o = e.id;
  o === void 0 && (o = qe.options.generateID());
  const r = [];
  if (e.children)
    for (const a of e.children)
      r.push(Y(a, t, n));
  if (!e.type || // can happen if block.type is not defined (this should create the default node)
  t.nodes[e.type].isInGroup("blockContent")) {
    const a = ot(
      e,
      t,
      n
    ), i = r.length > 0 ? t.nodes.blockGroup.createChecked({}, r) : void 0;
    return t.nodes.blockContainer.createChecked(
      {
        id: o,
        ...e.props
      },
      i ? [a, i] : a
    );
  } else {
    if (t.nodes[e.type].isInGroup("bnBlock"))
      return t.nodes[e.type].createChecked(
        {
          id: o,
          ...e.props
        },
        r
      );
    throw new Error(
      `block type ${e.type} doesn't match blockContent or bnBlock group`
    );
  }
}
function un(e, t) {
  let n, o;
  if (t.firstChild.descendants((r, s) => n ? !1 : !dn(r) || r.attrs.id !== e ? !0 : (n = r, o = s + 1, !1)), !(n === void 0 || o === void 0))
    return {
      node: n,
      posBeforeNode: o
    };
}
function dn(e) {
  return e.type.isInGroup("bnBlock");
}
const nr = (e, t) => ({
  tr: n,
  dispatch: o
}) => (o && ye(n, e, t), !0);
function ye(e, t, n, o, r) {
  const s = Zt(e.doc.resolve(t));
  let a = null;
  s.blockNoteType === "table" && (a = fn(e));
  const i = G(e);
  if (o !== void 0 && r !== void 0 && o > r)
    throw new Error("Invalid replaceFromPos or replaceToPos");
  const c = i.nodes[s.blockNoteType], l = i.nodes[n.type || s.blockNoteType], d = l.isInGroup("bnBlock") ? l : i.nodes.blockContainer;
  if (s.isBlockContainer && l.isInGroup("blockContent")) {
    const u = o !== void 0 && o > s.blockContent.beforePos && o < s.blockContent.afterPos ? o - s.blockContent.beforePos - 1 : void 0, p = r !== void 0 && r > s.blockContent.beforePos && r < s.blockContent.afterPos ? r - s.blockContent.beforePos - 1 : void 0;
    Pe(n, e, s), pn(
      n,
      e,
      c,
      l,
      s,
      u,
      p
    );
  } else if (!s.isBlockContainer && l.isInGroup("bnBlock"))
    Pe(n, e, s);
  else {
    const u = X(s.bnBlock.node, i);
    e.replaceWith(
      s.bnBlock.beforePos,
      s.bnBlock.afterPos,
      Y(
        {
          children: u.children,
          // if no children are passed in, use existing children
          ...n
        },
        i
      )
    );
    return;
  }
  e.setNodeMarkup(s.bnBlock.beforePos, d, {
    ...s.bnBlock.node.attrs,
    ...n.props
  }), a && hn(e, s, a);
}
function pn(e, t, n, o, r, s, a) {
  const i = G(t);
  let c = "keep";
  if (e.content)
    if (typeof e.content == "string")
      c = O(
        [e.content],
        i,
        o.name
      );
    else if (Array.isArray(e.content))
      c = O(e.content, i, o.name);
    else if (e.content.type === "tableContent")
      c = nt(e.content, i);
    else
      throw new Z(e.content.type);
  else
    n.spec.content === "" || o.spec.content !== n.spec.content && (c = []);
  if (c === "keep")
    t.setNodeMarkup(r.blockContent.beforePos, o, {
      ...r.blockContent.node.attrs,
      ...e.props
    });
  else if (s !== void 0 || a !== void 0) {
    t.setNodeMarkup(r.blockContent.beforePos, o, {
      ...r.blockContent.node.attrs,
      ...e.props
    });
    const l = r.blockContent.beforePos + 1 + (s ?? 0), d = r.blockContent.beforePos + 1 + (a ?? r.blockContent.node.content.size), u = t.doc.resolve(r.blockContent.beforePos).depth, p = t.doc.resolve(l).depth, f = t.doc.resolve(d).depth;
    t.replace(
      l,
      d,
      new de(
        _.from(c),
        p - u - 1,
        f - u - 1
      )
    );
  } else
    t.replaceWith(
      r.blockContent.beforePos,
      r.blockContent.afterPos,
      o.createChecked(
        {
          ...r.blockContent.node.attrs,
          ...e.props
        },
        c
      )
    );
}
function Pe(e, t, n) {
  const o = G(t);
  if (e.children !== void 0 && e.children.length > 0) {
    const r = e.children.map((s) => Y(s, o));
    if (n.childContainer)
      t.step(
        new Ht(
          n.childContainer.beforePos + 1,
          n.childContainer.afterPos - 1,
          new de(_.from(r), 0, 0)
        )
      );
    else {
      if (!n.isBlockContainer)
        throw new Error("impossible");
      t.insert(
        n.blockContent.afterPos,
        o.nodes.blockGroup.createChecked({}, r)
      );
    }
  }
}
function or(e, t, n, o, r) {
  const s = typeof t == "string" ? t : t.id, a = un(s, e.doc);
  if (!a)
    throw new Error(`Block with ID ${s} not found`);
  ye(
    e,
    a.posBeforeNode,
    n,
    o,
    r
  );
  const i = e.doc.resolve(a.posBeforeNode + 1).node(), c = G(e);
  return X(i, c);
}
function fn(e) {
  const t = "selection" in e ? e.selection : null;
  if (!(t instanceof ze))
    return null;
  const n = e.doc.resolve(t.head);
  let o = -1, r = -1;
  for (let m = n.depth; m >= 0; m--) {
    const b = n.node(m).type.name;
    if (o < 0 && (b === "tableCell" || b === "tableHeader") && (o = m), b === "table") {
      r = m;
      break;
    }
  }
  if (o < 0 || r < 0)
    return null;
  const s = n.before(o), a = n.before(r), i = e.doc.nodeAt(a);
  if (!i || i.type.name !== "table")
    return null;
  const c = We.get(i), l = s - (a + 1), d = c.map.indexOf(l);
  if (d < 0)
    return null;
  const u = Math.floor(d / c.width), p = d % c.width, h = s + 1 + 1, k = Math.max(0, t.head - h);
  return { row: u, col: p, offset: k };
}
function hn(e, t, n) {
  var m;
  if (t.blockNoteType !== "table")
    return !1;
  let o = -1;
  if (t.isBlockContainer)
    o = e.mapping.map(t.blockContent.beforePos);
  else {
    const b = e.mapping.map(t.bnBlock.beforePos), y = b + (((m = e.doc.nodeAt(b)) == null ? void 0 : m.nodeSize) || 0);
    e.doc.nodesBetween(b, y, (g, v) => g.type.name === "table" ? (o = v, !1) : !0);
  }
  const r = o >= 0 ? e.doc.nodeAt(o) : null;
  if (!r || r.type.name !== "table")
    return !1;
  const s = We.get(r), a = Math.max(0, Math.min(n.row, s.height - 1)), i = Math.max(0, Math.min(n.col, s.width - 1)), c = a * s.width + i, l = s.map[c];
  if (l == null)
    return !1;
  const u = o + 1 + l + 1, p = e.doc.nodeAt(u), f = u + 1, h = p ? p.content.size : 0, k = f + Math.max(0, Math.min(n.offset, h));
  return "selection" in e && e.setSelection(ze.create(e.doc, k)), !0;
}
const A = {
  gray: {
    text: "#9b9a97",
    background: "#ebeced"
  },
  brown: {
    text: "#64473a",
    background: "#e9e5e3"
  },
  red: {
    text: "#e03e3e",
    background: "#fbe4e4"
  },
  orange: {
    text: "#d9730d",
    background: "#f6e9d9"
  },
  yellow: {
    text: "#dfab01",
    background: "#fbf3db"
  },
  green: {
    text: "#4d6461",
    background: "#ddedea"
  },
  blue: {
    text: "#0b6e99",
    background: "#ddebf1"
  },
  purple: {
    text: "#6940a5",
    background: "#eae4f2"
  },
  pink: {
    text: "#ad1a72",
    background: "#f4dfeb"
  }
}, rr = {
  gray: {
    text: "#bebdb8",
    background: "#9b9a97"
  },
  brown: {
    text: "#8e6552",
    background: "#64473a"
  },
  red: {
    text: "#ec4040",
    background: "#be3434"
  },
  orange: {
    text: "#e3790d",
    background: "#b7600a"
  },
  yellow: {
    text: "#dfab01",
    background: "#b58b00"
  },
  green: {
    text: "#6b8b87",
    background: "#4d6461"
  },
  blue: {
    text: "#0e87bc",
    background: "#0b6e99"
  },
  purple: {
    text: "#8552d7",
    background: "#6940a5"
  },
  pink: {
    text: "#da208f",
    background: "#ad1a72"
  }
}, C = {
  backgroundColor: {
    default: "default"
  },
  textColor: {
    default: "default"
  },
  textAlignment: {
    default: "left",
    values: ["left", "center", "right", "justify"]
  }
}, B = (e) => {
  const t = {};
  return e.hasAttribute("data-background-color") ? t.backgroundColor = e.getAttribute("data-background-color") : e.style.backgroundColor && (t.backgroundColor = e.style.backgroundColor), e.hasAttribute("data-text-color") ? t.textColor = e.getAttribute("data-text-color") : e.style.color && (t.textColor = e.style.color), t.textAlignment = C.textAlignment.values.includes(
    e.style.textAlign
  ) ? e.style.textAlign : void 0, t;
}, H = (e, t) => {
  e.backgroundColor && e.backgroundColor !== C.backgroundColor.default && (t.style.backgroundColor = e.backgroundColor in A ? A[e.backgroundColor].background : e.backgroundColor), e.textColor && e.textColor !== C.textColor.default && (t.style.color = e.textColor in A ? A[e.textColor].text : e.textColor), e.textAlignment && e.textAlignment !== C.textAlignment.default && (t.style.textAlign = e.textAlignment);
}, sr = (e = "backgroundColor") => ({
  default: C.backgroundColor.default,
  parseHTML: (t) => t.hasAttribute("data-background-color") ? t.getAttribute("data-background-color") : t.style.backgroundColor ? t.style.backgroundColor : C.backgroundColor.default,
  renderHTML: (t) => t[e] === C.backgroundColor.default ? {} : {
    "data-background-color": t[e]
  }
}), ar = (e = "textColor") => ({
  default: C.textColor.default,
  parseHTML: (t) => t.hasAttribute("data-text-color") ? t.getAttribute("data-text-color") : t.style.color ? t.style.color : C.textColor.default,
  renderHTML: (t) => t[e] === C.textColor.default ? {} : {
    "data-text-color": t[e]
  }
}), ir = (e = "textAlignment") => ({
  default: C.textAlignment.default,
  parseHTML: (t) => t.hasAttribute("data-text-alignment") ? t.getAttribute("data-text-alignment") : t.style.textAlign ? t.style.textAlign : C.textAlignment.default,
  renderHTML: (t) => t[e] === C.textAlignment.default ? {} : {
    "data-text-alignment": t[e]
  }
}), ee = (e, t) => {
  const n = e.querySelector(
    t
  );
  if (!n)
    return;
  const o = e.querySelector("figcaption"), r = (o == null ? void 0 : o.textContent) ?? void 0;
  return { targetElement: n, caption: r };
}, mn = (e, t, n) => {
  const o = document.createElement("div");
  o.className = "bn-add-file-button";
  const r = document.createElement("div");
  r.className = "bn-add-file-button-icon", n ? r.appendChild(n) : r.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8L9.00319 2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8ZM10 4V9H5V20H19V4H10Z"></path></svg>', o.appendChild(r);
  const s = document.createElement("p");
  s.className = "bn-add-file-button-text", s.innerHTML = e.type in t.dictionary.file_blocks.add_button_text ? t.dictionary.file_blocks.add_button_text[e.type] : t.dictionary.file_blocks.add_button_text.file, o.appendChild(s);
  const a = (c) => {
    c.preventDefault();
  }, i = () => {
    t.transact(
      (c) => c.setMeta(t.filePanel.plugins[0], {
        block: e
      })
    );
  };
  return o.addEventListener(
    "mousedown",
    a,
    !0
  ), o.addEventListener("click", i, !0), {
    dom: o,
    destroy: () => {
      o.removeEventListener(
        "mousedown",
        a,
        !0
      ), o.removeEventListener(
        "click",
        i,
        !0
      );
    }
  };
}, gn = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8L9.00319 2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8ZM10 4V9H5V20H19V4H10Z"></path></svg>', bn = (e) => {
  const t = document.createElement("div");
  t.className = "bn-file-name-with-icon";
  const n = document.createElement("div");
  n.className = "bn-file-icon", n.innerHTML = gn, t.appendChild(n);
  const o = document.createElement("p");
  return o.className = "bn-file-name", o.textContent = e.props.name, t.appendChild(o), {
    dom: t
  };
}, we = (e, t, n, o) => {
  const r = document.createElement("div");
  if (r.className = "bn-file-block-content-wrapper", e.props.url === "") {
    const a = mn(e, t, o);
    r.appendChild(a.dom);
    const i = t.onUploadStart((c) => {
      if (c === e.id) {
        r.removeChild(a.dom);
        const l = document.createElement("div");
        l.className = "bn-file-loading-preview", l.textContent = "Loading...", r.appendChild(l);
      }
    });
    return {
      dom: r,
      destroy: () => {
        i(), a.destroy();
      }
    };
  }
  const s = { dom: r };
  if (e.props.showPreview === !1 || !n) {
    const a = bn(e);
    r.appendChild(a.dom), s.destroy = () => {
      var i;
      (i = a.destroy) == null || i.call(a);
    };
  } else
    r.appendChild(n.dom);
  if (e.props.caption) {
    const a = document.createElement("p");
    a.className = "bn-file-caption", a.textContent = e.props.caption, r.appendChild(a);
  }
  return s;
}, ve = (e, t) => {
  const n = document.createElement("figure"), o = document.createElement("figcaption");
  return o.textContent = t, n.appendChild(e), n.appendChild(o), { dom: n };
}, te = (e, t) => {
  const n = document.createElement("div"), o = document.createElement("p");
  return o.textContent = t, n.appendChild(e), n.appendChild(o), {
    dom: n
  };
}, He = (e) => ({ url: e.src || void 0 }), kn = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 16.0001H5.88889L11.1834 20.3319C11.2727 20.405 11.3846 20.4449 11.5 20.4449C11.7761 20.4449 12 20.2211 12 19.9449V4.05519C12 3.93977 11.9601 3.8279 11.887 3.73857C11.7121 3.52485 11.3971 3.49335 11.1834 3.66821L5.88889 8.00007H2C1.44772 8.00007 1 8.44778 1 9.00007V15.0001C1 15.5524 1.44772 16.0001 2 16.0001ZM23 12C23 15.292 21.5539 18.2463 19.2622 20.2622L17.8445 18.8444C19.7758 17.1937 21 14.7398 21 12C21 9.26016 19.7758 6.80629 17.8445 5.15557L19.2622 3.73779C21.5539 5.75368 23 8.70795 23 12ZM18 12C18 10.0883 17.106 8.38548 15.7133 7.28673L14.2842 8.71584C15.3213 9.43855 16 10.64 16 12C16 13.36 15.3213 14.5614 14.2842 15.2841L15.7133 16.7132C17.106 15.6145 18 13.9116 18 12Z"></path></svg>', Cn = (e) => ({
  type: "audio",
  propSchema: {
    backgroundColor: C.backgroundColor,
    // File name.
    name: {
      default: ""
    },
    // File url.
    url: {
      default: ""
    },
    // File caption.
    caption: {
      default: ""
    },
    showPreview: {
      default: !0
    }
  },
  content: "none"
}), yn = (e = {}) => (t) => {
  if (t.tagName === "AUDIO") {
    if (t.closest("figure"))
      return;
    const { backgroundColor: n } = B(t);
    return {
      ...He(t),
      backgroundColor: n
    };
  }
  if (t.tagName === "FIGURE") {
    const n = ee(t, "audio");
    if (!n)
      return;
    const { targetElement: o, caption: r } = n, { backgroundColor: s } = B(t);
    return {
      ...He(o),
      backgroundColor: s,
      caption: r
    };
  }
}, wn = (e = {}) => (t, n) => {
  const o = document.createElement("div");
  o.innerHTML = e.icon ?? kn;
  const r = document.createElement("audio");
  return r.className = "bn-audio", n.resolveFileUrl ? n.resolveFileUrl(t.props.url).then((s) => {
    r.src = s;
  }) : r.src = t.props.url, r.controls = !0, r.contentEditable = "false", r.draggable = !1, we(
    t,
    n,
    { dom: r },
    o.firstElementChild
  );
}, vn = (e = {}) => (t, n) => {
  if (!t.props.url) {
    const r = document.createElement("p");
    return r.textContent = "Add audio", {
      dom: r
    };
  }
  let o;
  return t.props.showPreview ? (o = document.createElement("audio"), o.src = t.props.url) : (o = document.createElement("a"), o.href = t.props.url, o.textContent = t.props.name || t.props.url), t.props.caption ? t.props.showPreview ? ve(o, t.props.caption) : te(o, t.props.caption) : {
    dom: o
  };
}, En = M(
  Cn,
  (e) => ({
    meta: {
      fileBlockAccept: ["audio/*"]
    },
    parse: yn(e),
    render: wn(e),
    toExternalHTML: vn(e),
    runsBefore: ["file"]
  })
);
class xn {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/ban-types
    x(this, "callbacks", {});
  }
  on(t, n) {
    return this.callbacks[t] || (this.callbacks[t] = []), this.callbacks[t].push(n), () => this.off(t, n);
  }
  emit(t, ...n) {
    const o = this.callbacks[t];
    o && o.forEach((r) => r.apply(this, n));
  }
  off(t, n) {
    const o = this.callbacks[t];
    o && (n ? this.callbacks[t] = o.filter((r) => r !== n) : delete this.callbacks[t]);
  }
  removeAllListeners() {
    this.callbacks = {};
  }
}
class Sn extends xn {
  // eslint-disable-next-line
  constructor(...n) {
    super();
    x(this, "plugins", []);
    /**
     * Input rules for the block
     */
    x(this, "inputRules");
    /**
     * A mapping of a keyboard shortcut to a function that will be called when the shortcut is pressed
     *
     * The keys are in the format:
     * - Key names may be strings like `Shift-Ctrl-Enter`—a key identifier prefixed with zero or more modifiers
     * - Key identifiers are based on the strings that can appear in KeyEvent.key
     * - Use lowercase letters to refer to letter keys (or uppercase letters if you want shift to be held)
     * - You may use `Space` as an alias for the " " name
     * - Modifiers can be given in any order: `Shift-` (or `s-`), `Alt-` (or `a-`), `Ctrl-` (or `c-` or `Control-`) and `Cmd-` (or `m-` or `Meta-`)
     * - For characters that are created by holding shift, the Shift- prefix is implied, and should not be added explicitly
     * - You can use Mod- as a shorthand for Cmd- on Mac and Ctrl- on other platforms
     *
     * @example
     * ```typescript
     * keyboardShortcuts: {
     *   "Mod-Enter": (ctx) => {  return true; },
     *   "Shift-Ctrl-Space": (ctx) => { return true; },
     *   "a": (ctx) => { return true; },
     *   "Space": (ctx) => { return true; }
     * }
     * ```
     */
    x(this, "keyboardShortcuts");
    x(this, "tiptapExtensions");
  }
  static key() {
    throw new Error("You must implement the key method in your extension");
  }
  addProsemirrorPlugin(n) {
    this.plugins.push(n);
  }
  get priority() {
  }
}
function L(e) {
  const t = Object.create(Sn.prototype);
  return t.key = e.key, t.inputRules = e.inputRules, t.keyboardShortcuts = e.keyboardShortcuts, t.plugins = e.plugins ?? [], t.tiptapExtensions = e.tiptapExtensions, t;
}
const Oe = Symbol.for("blocknote.shikiParser"), re = Symbol.for(
  "blocknote.shikiHighlighterPromise"
);
function Bn(e) {
  const t = globalThis;
  let n, o, r = !1;
  return It({
    parser: (a) => {
      if (!e.createHighlighter)
        return process.env.NODE_ENV === "development" && !r && (console.log(
          "For syntax highlighting of code blocks, you must provide a `createCodeBlockSpec({ createHighlighter: () => ... })` function"
        ), r = !0), [];
      if (!n)
        return t[re] = t[re] || e.createHighlighter(), t[re].then(
          (c) => {
            n = c;
          }
        );
      const i = rt(e, a.language);
      return !i || i === "text" || i === "none" || i === "plaintext" || i === "txt" ? [] : n.getLoadedLanguages().includes(i) ? (o || (o = t[Oe] || Pt(n), t[Oe] = o), o(a)) : n.loadLanguage(i);
    },
    languageExtractor: (a) => a.attrs.language,
    nodeTypes: ["codeBlock"]
  });
}
const Mn = ({ defaultLanguage: e = "text" }) => ({
  type: "codeBlock",
  propSchema: {
    language: {
      default: e
    }
  },
  content: "inline"
}), Ln = M(
  Mn,
  (e) => ({
    meta: {
      code: !0,
      defining: !0,
      isolating: !1
    },
    parse: (t) => {
      var r, s;
      if (t.tagName !== "PRE" || t.childElementCount !== 1 || ((r = t.firstElementChild) == null ? void 0 : r.tagName) !== "CODE")
        return;
      const n = t.firstElementChild;
      return { language: n.getAttribute("data-language") || ((s = n.className.split(" ").find((a) => a.includes("language-"))) == null ? void 0 : s.replace("language-", "")) };
    },
    parseContent: ({ el: t, schema: n }) => {
      const o = Q.fromSchema(n), r = t.firstElementChild;
      return o.parse(r, {
        topNode: n.nodes.codeBlock.create()
      }).content;
    },
    render(t, n) {
      const o = document.createDocumentFragment(), r = document.createElement("pre"), s = document.createElement("code");
      r.appendChild(s);
      let a;
      if (e.supportedLanguages) {
        const i = document.createElement("select");
        Object.entries(e.supportedLanguages ?? {}).forEach(
          ([d, { name: u }]) => {
            const p = document.createElement("option");
            p.value = d, p.text = u, i.appendChild(p);
          }
        ), i.value = t.props.language || e.defaultLanguage || "text";
        const c = (d) => {
          const u = d.target.value;
          n.updateBlock(t.id, { props: { language: u } });
        };
        i.addEventListener("change", c), a = () => i.removeEventListener("change", c);
        const l = document.createElement("div");
        l.contentEditable = "false", l.appendChild(i), o.appendChild(l);
      }
      return o.appendChild(r), {
        dom: o,
        contentDOM: s,
        destroy: () => {
          a == null || a();
        }
      };
    },
    toExternalHTML(t) {
      const n = document.createElement("pre"), o = document.createElement("code");
      return o.className = `language-${t.props.language}`, o.dataset.language = t.props.language, n.appendChild(o), {
        dom: n,
        contentDOM: o
      };
    }
  }),
  (e) => [
    L({
      key: "code-block-highlighter",
      plugins: [Bn(e)]
    }),
    L({
      key: "code-block-keyboard-shortcuts",
      keyboardShortcuts: {
        Delete: ({ editor: t }) => t.transact((n) => {
          const { block: o } = t.getTextCursorPosition();
          if (o.type !== "codeBlock")
            return !1;
          const { $from: r } = n.selection;
          return r.parent.textContent ? !1 : (t.removeBlocks([o]), !0);
        }),
        Tab: ({ editor: t }) => e.indentLineWithTab === !1 ? !1 : t.transact((n) => {
          const { block: o } = t.getTextCursorPosition();
          return o.type === "codeBlock" ? (n.insertText("  "), !0) : !1;
        }),
        Enter: ({ editor: t }) => t.transact((n) => {
          const { block: o, nextBlock: r } = t.getTextCursorPosition();
          if (o.type !== "codeBlock")
            return !1;
          const { $from: s } = n.selection, a = s.parentOffset === s.parent.nodeSize - 2, i = s.parent.textContent.endsWith(`

`);
          if (a && i) {
            if (n.delete(s.pos - 2, s.pos), r)
              return t.setTextCursorPosition(r, "start"), !0;
            const [c] = t.insertBlocks(
              [{ type: "paragraph" }],
              o,
              "after"
            );
            return t.setTextCursorPosition(c, "start"), !0;
          }
          return n.insertText(`
`), !0;
        }),
        "Shift-Enter": ({ editor: t }) => t.transact(() => {
          const { block: n } = t.getTextCursorPosition();
          if (n.type !== "codeBlock")
            return !1;
          const [o] = t.insertBlocks(
            // insert a new paragraph
            [{ type: "paragraph" }],
            n,
            "after"
          );
          return t.setTextCursorPosition(o, "start"), !0;
        })
      },
      inputRules: [
        {
          find: /^```(.*?)\s$/,
          replace: ({ match: t }) => {
            const n = t[1].trim();
            return {
              type: "codeBlock",
              props: {
                language: {
                  language: rt(e, n) ?? n
                }.language
              },
              content: []
            };
          }
        }
      ]
    })
  ]
);
function rt(e, t) {
  var n;
  return (n = Object.entries(e.supportedLanguages ?? {}).find(
    ([o, { aliases: r }]) => (r == null ? void 0 : r.includes(t)) || o === t
  )) == null ? void 0 : n[0];
}
const Tn = () => ({
  type: "divider",
  propSchema: {},
  content: "none"
}), An = M(
  Tn,
  {
    meta: {
      isolating: !1
    },
    parse(e) {
      if (e.tagName === "HR")
        return {};
    },
    render() {
      return {
        dom: document.createElement("hr")
      };
    }
  },
  [
    L({
      key: "divider-block-shortcuts",
      inputRules: [
        {
          find: new RegExp("^---$"),
          replace() {
            return { type: "divider", props: {}, content: [] };
          }
        }
      ]
    })
  ]
), De = (e) => ({ url: e.src || void 0 }), Nn = () => ({
  type: "file",
  propSchema: {
    backgroundColor: C.backgroundColor,
    // File name.
    name: {
      default: ""
    },
    // File url.
    url: {
      default: ""
    },
    // File caption.
    caption: {
      default: ""
    }
  },
  content: "none"
}), In = () => (e) => {
  if (e.tagName === "EMBED") {
    if (e.closest("figure"))
      return;
    const { backgroundColor: t } = B(e);
    return {
      ...De(e),
      backgroundColor: t
    };
  }
  if (e.tagName === "FIGURE") {
    const t = ee(e, "embed");
    if (!t)
      return;
    const { targetElement: n, caption: o } = t, { backgroundColor: r } = B(e);
    return {
      ...De(n),
      backgroundColor: r,
      caption: o
    };
  }
}, Pn = M(Nn, {
  meta: {
    fileBlockAccept: ["*/*"]
  },
  parse: In(),
  render(e, t) {
    return we(e, t);
  },
  toExternalHTML(e) {
    if (!e.props.url) {
      const n = document.createElement("p");
      return n.textContent = "Add file", {
        dom: n
      };
    }
    const t = document.createElement("a");
    return t.href = e.props.url, t.textContent = e.props.name || e.props.url, e.props.caption ? te(t, e.props.caption) : {
      dom: t
    };
  }
}), Hn = {
  set: (e, t) => window.localStorage.setItem(
    `toggle-${e.id}`,
    t ? "true" : "false"
  ),
  get: (e) => window.localStorage.getItem(`toggle-${e.id}`) === "true"
}, st = (e, t, n, o = Hn) => {
  if ("isToggleable" in e.props && !e.props.isToggleable)
    return {
      dom: n
    };
  const r = document.createElement("div"), s = document.createElement("div");
  s.className = "bn-toggle-wrapper";
  const a = document.createElement("button");
  a.className = "bn-toggle-button", a.type = "button", a.innerHTML = // https://fonts.google.com/icons?selected=Material+Symbols+Rounded:chevron_right:FILL@0;wght@700;GRAD@0;opsz@24&icon.query=chevron&icon.style=Rounded&icon.size=24&icon.color=%23e8eaed
  '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="CURRENTCOLOR"><path d="M320-200v-560l440 280-440 280Z"/></svg>';
  const i = (h) => h.preventDefault();
  a.addEventListener("mousedown", i);
  const c = () => {
    var h;
    s.getAttribute("data-show-children") === "true" ? (s.setAttribute("data-show-children", "false"), o.set(t.getBlock(e), !1), r.contains(l) && r.removeChild(l)) : (s.setAttribute("data-show-children", "true"), o.set(t.getBlock(e), !0), ((h = t.getBlock(e)) == null ? void 0 : h.children.length) === 0 && !r.contains(l) && r.appendChild(l));
  };
  a.addEventListener("click", c), s.appendChild(a), s.appendChild(n);
  const l = document.createElement("button");
  l.className = "bn-toggle-add-block-button", l.type = "button", l.textContent = t.dictionary.toggle_blocks.add_block_button;
  const d = (h) => h.preventDefault();
  l.addEventListener(
    "mousedown",
    d
  );
  const u = () => {
    t.transact(() => {
      const h = t.updateBlock(e, {
        // Single empty block with default type.
        children: [{}]
      });
      t.setTextCursorPosition(h.children[0].id, "end"), t.focus();
    });
  };
  l.addEventListener("click", u), r.appendChild(s);
  let p = e.children.length;
  const f = t.onChange(() => {
    var k;
    const h = ((k = t.getBlock(e)) == null ? void 0 : k.children.length) ?? 0;
    h > p ? (s.getAttribute("data-show-children") === "false" && (s.setAttribute("data-show-children", "true"), o.set(t.getBlock(e), !0)), r.contains(l) && r.removeChild(l)) : h === 0 && h < p && (s.getAttribute("data-show-children") === "true" && (s.setAttribute("data-show-children", "false"), o.set(t.getBlock(e), !1)), r.contains(l) && r.removeChild(l)), p = h;
  });
  return o.get(e) ? (s.setAttribute("data-show-children", "true"), e.children.length === 0 && r.appendChild(l)) : s.setAttribute("data-show-children", "false"), {
    dom: r,
    // Prevents re-renders when the toggle button is clicked.
    ignoreMutation: (h) => h instanceof MutationRecord && // We want to prevent re-renders when the view changes, so we ignore
    // all mutations where the `data-show-children` attribute is changed
    // or the "add block" button is added/removed.
    (h.type === "attributes" && h.target === s && h.attributeName === "data-show-children" || h.type === "childList" && (h.addedNodes[0] === l || h.removedNodes[0] === l)),
    destroy: () => {
      a.removeEventListener("mousedown", i), a.removeEventListener("click", c), l.removeEventListener(
        "mousedown",
        d
      ), l.removeEventListener(
        "click",
        u
      ), f == null || f();
    }
  };
}, at = [1, 2, 3, 4, 5, 6], On = ({
  defaultLevel: e = 1,
  levels: t = at,
  allowToggleHeadings: n = !0
} = {}) => ({
  type: "heading",
  propSchema: {
    ...C,
    level: { default: e, values: t },
    ...n ? { isToggleable: { default: !1, optional: !0 } } : {}
  },
  content: "inline"
}), Dn = M(
  On,
  ({ allowToggleHeadings: e = !0 } = {}) => ({
    meta: {
      isolating: !1
    },
    parse(t) {
      let n;
      switch (t.tagName) {
        case "H1":
          n = 1;
          break;
        case "H2":
          n = 2;
          break;
        case "H3":
          n = 3;
          break;
        case "H4":
          n = 4;
          break;
        case "H5":
          n = 5;
          break;
        case "H6":
          n = 6;
          break;
        default:
          return;
      }
      return {
        ...B(t),
        level: n
      };
    },
    render(t, n) {
      const o = document.createElement(`h${t.props.level}`);
      return e ? { ...st(t, n, o), contentDOM: o } : {
        dom: o,
        contentDOM: o
      };
    },
    toExternalHTML(t) {
      const n = document.createElement(`h${t.props.level}`);
      return H(t.props, n), {
        dom: n,
        contentDOM: n
      };
    }
  }),
  ({ levels: e = at } = {}) => [
    L({
      key: "heading-shortcuts",
      keyboardShortcuts: Object.fromEntries(
        e.map((t) => [
          `Mod-Alt-${t}`,
          ({ editor: n }) => {
            const o = n.getTextCursorPosition();
            return n.schema.blockSchema[o.block.type].content !== "inline" ? !1 : (n.updateBlock(o.block, {
              type: "heading",
              props: {
                level: t
              }
            }), !0);
          }
        ]) ?? []
      ),
      inputRules: e.map((t) => ({
        find: new RegExp(`^(#{${t}})\\s$`),
        replace({ match: n }) {
          return {
            type: "heading",
            props: {
              level: n[1].length
            }
          };
        }
      }))
    })
  ]
), it = (e, t, n, o, r) => {
  const { dom: s, destroy: a } = we(
    e,
    t,
    n,
    r
  ), i = s;
  i.style.position = "relative", e.props.url && e.props.showPreview && (e.props.previewWidth ? i.style.width = `${e.props.previewWidth}px` : i.style.width = "fit-content");
  const c = document.createElement("div");
  c.className = "bn-resize-handle", c.style.left = "4px";
  const l = document.createElement("div");
  l.className = "bn-resize-handle", l.style.right = "4px";
  const d = document.createElement("div");
  d.style.position = "absolute", d.style.height = "100%", d.style.width = "100%";
  let u, p = e.props.previewWidth;
  const f = (g) => {
    var V, W;
    if (!u) {
      !t.isEditable && o.contains(c) && o.contains(l) && (o.removeChild(c), o.removeChild(l));
      return;
    }
    let v;
    const S = "touches" in g ? g.touches[0].clientX : g.clientX;
    e.props.textAlignment === "center" ? u.handleUsed === "left" ? v = u.initialWidth + (u.initialClientX - S) * 2 : v = u.initialWidth + (S - u.initialClientX) * 2 : u.handleUsed === "left" ? v = u.initialWidth + u.initialClientX - S : v = u.initialWidth + S - u.initialClientX, p = Math.min(
      Math.max(v, 64),
      ((W = (V = t.domElement) == null ? void 0 : V.firstElementChild) == null ? void 0 : W.clientWidth) || Number.MAX_VALUE
    ), i.style.width = `${p}px`;
  }, h = (g) => {
    (!g.target || !i.contains(g.target) || !t.isEditable) && o.contains(c) && o.contains(l) && (o.removeChild(c), o.removeChild(l)), u && (u = void 0, i.contains(d) && i.removeChild(d), t.updateBlock(e, {
      props: {
        previewWidth: p
      }
    }));
  }, k = () => {
    t.isEditable && (o.appendChild(c), o.appendChild(l));
  }, m = (g) => {
    g.relatedTarget === c || g.relatedTarget === l || u || t.isEditable && o.contains(c) && o.contains(l) && (o.removeChild(c), o.removeChild(l));
  }, b = (g) => {
    g.preventDefault(), i.contains(d) || i.appendChild(d);
    const v = "touches" in g ? g.touches[0].clientX : g.clientX;
    u = {
      handleUsed: "left",
      initialWidth: i.clientWidth,
      initialClientX: v
    };
  }, y = (g) => {
    g.preventDefault(), i.contains(d) || i.appendChild(d);
    const v = "touches" in g ? g.touches[0].clientX : g.clientX;
    u = {
      handleUsed: "right",
      initialWidth: i.clientWidth,
      initialClientX: v
    };
  };
  return window.addEventListener("mousemove", f), window.addEventListener("touchmove", f), window.addEventListener("mouseup", h), window.addEventListener("touchend", h), i.addEventListener("mouseenter", k), i.addEventListener("mouseleave", m), c.addEventListener(
    "mousedown",
    b
  ), c.addEventListener(
    "touchstart",
    b
  ), l.addEventListener(
    "mousedown",
    y
  ), l.addEventListener(
    "touchstart",
    y
  ), {
    dom: i,
    destroy: () => {
      a == null || a(), window.removeEventListener("mousemove", f), window.removeEventListener("touchmove", f), window.removeEventListener("mouseup", h), window.removeEventListener("touchend", h), i.removeEventListener("mouseenter", k), i.removeEventListener("mouseleave", m), c.removeEventListener(
        "mousedown",
        b
      ), c.removeEventListener(
        "touchstart",
        b
      ), l.removeEventListener(
        "mousedown",
        y
      ), l.removeEventListener(
        "touchstart",
        y
      );
    }
  };
}, _e = (e) => {
  const t = e.src || void 0, n = e.width || void 0, o = e.alt || void 0;
  return { url: t, previewWidth: n, name: o };
}, _n = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11.1005L7 9.1005L12.5 14.6005L16 11.1005L19 14.1005V5H5V11.1005ZM4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3ZM15.5 10C14.6716 10 14 9.32843 14 8.5C14 7.67157 14.6716 7 15.5 7C16.3284 7 17 7.67157 17 8.5C17 9.32843 16.3284 10 15.5 10Z"></path></svg>', Rn = (e = {}) => ({
  type: "image",
  propSchema: {
    textAlignment: C.textAlignment,
    backgroundColor: C.backgroundColor,
    // File name.
    name: {
      default: ""
    },
    // File url.
    url: {
      default: ""
    },
    // File caption.
    caption: {
      default: ""
    },
    showPreview: {
      default: !0
    },
    // File preview width in px.
    previewWidth: {
      default: void 0,
      type: "number"
    }
  },
  content: "none"
}), Vn = (e = {}) => (t) => {
  if (t.tagName === "IMG") {
    if (t.closest("figure"))
      return;
    const { backgroundColor: n } = B(t);
    return {
      ..._e(t),
      backgroundColor: n
    };
  }
  if (t.tagName === "FIGURE") {
    const n = ee(t, "img");
    if (!n)
      return;
    const { targetElement: o, caption: r } = n, { backgroundColor: s } = B(t);
    return {
      ..._e(o),
      backgroundColor: s,
      caption: r
    };
  }
}, Wn = (e = {}) => (t, n) => {
  const o = document.createElement("div");
  o.innerHTML = e.icon ?? _n;
  const r = document.createElement("div");
  r.className = "bn-visual-media-wrapper";
  const s = document.createElement("img");
  return s.className = "bn-visual-media", n.resolveFileUrl ? n.resolveFileUrl(t.props.url).then((a) => {
    s.src = a;
  }) : s.src = t.props.url, s.alt = t.props.name || t.props.caption || "BlockNote image", s.contentEditable = "false", s.draggable = !1, r.appendChild(s), it(
    t,
    n,
    { dom: r },
    r,
    o.firstElementChild
  );
}, Fn = (e = {}) => (t, n) => {
  if (!t.props.url) {
    const r = document.createElement("p");
    return r.textContent = "Add image", {
      dom: r
    };
  }
  let o;
  return t.props.showPreview ? (o = document.createElement("img"), o.src = t.props.url, o.alt = t.props.name || t.props.caption || "BlockNote image", t.props.previewWidth && (o.width = t.props.previewWidth)) : (o = document.createElement("a"), o.href = t.props.url, o.textContent = t.props.name || t.props.url), t.props.caption ? t.props.showPreview ? ve(o, t.props.caption) : te(o, t.props.caption) : {
    dom: o
  };
}, $n = M(
  Rn,
  (e) => ({
    meta: {
      fileBlockAccept: ["image/*"]
    },
    parse: Vn(e),
    render: Wn(e),
    toExternalHTML: Fn(e),
    runsBefore: ["file"]
  })
), cr = (e, t, n) => ({
  state: o,
  dispatch: r
}) => r ? ct(o.tr, e, t, n) : !0, ct = (e, t, n, o) => {
  const r = fe(e.doc, t), s = z(r);
  if (!s.isBlockContainer)
    return !1;
  const a = G(e), i = [
    {
      type: s.bnBlock.node.type,
      // always keep blockcontainer type
      attrs: o ? { ...s.bnBlock.node.attrs, id: void 0 } : {}
    },
    {
      type: n ? s.blockContent.node.type : a.nodes.paragraph,
      attrs: o ? { ...s.blockContent.node.attrs } : {}
    }
  ];
  return e.split(t, 2, i), !0;
}, ne = (e, t) => {
  const { blockInfo: n, selectionEmpty: o } = e.transact((a) => ({
    blockInfo: Gt(a),
    selectionEmpty: a.selection.anchor === a.selection.head
  }));
  if (!n.isBlockContainer)
    return !1;
  const { bnBlock: r, blockContent: s } = n;
  return s.node.type.name !== t || !o ? !1 : s.node.childCount === 0 ? (e.transact((a) => {
    ye(a, r.beforePos, {
      type: "paragraph",
      props: {}
    });
  }), !0) : s.node.childCount > 0 ? e.transact((a) => (a.deleteSelection(), ct(a, a.selection.from, !0))) : !1;
};
function Ee(e, t, n) {
  var u, p, f;
  const o = Q.fromSchema(t), r = e, s = document.createElement("div");
  s.setAttribute("data-node-type", "blockGroup");
  for (const h of Array.from(r.childNodes))
    s.appendChild(h.cloneNode(!0));
  let a = o.parse(s, {
    topNode: t.nodes.blockGroup.create()
  });
  ((p = (u = a.firstChild) == null ? void 0 : u.firstChild) == null ? void 0 : p.type.name) === "checkListItem" && (a = a.copy(
    a.content.cut(
      a.firstChild.firstChild.nodeSize + 2
    )
  ));
  const i = (f = a.firstChild) == null ? void 0 : f.firstChild;
  if (!(i != null && i.isTextblock))
    return _.from(a);
  const c = t.nodes[n].create(
    {},
    i.content
  ), l = a.content.cut(
    // +2 for the `blockGroup` node's start and end markers
    i.nodeSize + 2
  );
  if (l.size > 0) {
    const h = a.copy(l);
    return c.content.addToEnd(h);
  }
  return c.content;
}
const jn = () => ({
  type: "bulletListItem",
  propSchema: {
    ...C
  },
  content: "inline"
}), Un = M(
  jn,
  {
    meta: {
      isolating: !1
    },
    parse(e) {
      var n;
      if (e.tagName !== "LI")
        return;
      const t = e.parentElement;
      if (t !== null && (t.tagName === "UL" || t.tagName === "DIV" && ((n = t.parentElement) == null ? void 0 : n.tagName) === "UL"))
        return B(e);
    },
    // As `li` elements can contain multiple paragraphs, we need to merge their contents
    // into a single one so that ProseMirror can parse everything correctly.
    parseContent: ({ el: e, schema: t }) => Ee(e, t, "bulletListItem"),
    render() {
      const e = document.createElement("p");
      return {
        dom: e,
        contentDOM: e
      };
    },
    toExternalHTML(e) {
      const t = document.createElement("li"), n = document.createElement("p");
      return H(e.props, t), t.appendChild(n), {
        dom: t,
        contentDOM: n
      };
    }
  },
  [
    L({
      key: "bullet-list-item-shortcuts",
      keyboardShortcuts: {
        Enter: ({ editor: e }) => ne(e, "bulletListItem"),
        "Mod-Shift-8": ({ editor: e }) => {
          const t = e.getTextCursorPosition();
          return e.schema.blockSchema[t.block.type].content !== "inline" ? !1 : (e.updateBlock(t.block, {
            type: "bulletListItem",
            props: {}
          }), !0);
        }
      },
      inputRules: [
        {
          find: new RegExp("^[-+*]\\s$"),
          replace({ editor: e }) {
            if (Ge(
              e.prosemirrorState
            ).blockNoteType !== "heading")
              return {
                type: "bulletListItem",
                props: {}
              };
          }
        }
      ]
    })
  ]
), zn = () => ({
  type: "checkListItem",
  propSchema: {
    ...C,
    checked: { default: !1, type: "boolean" }
  },
  content: "inline"
}), qn = M(
  zn,
  {
    meta: {
      isolating: !1
    },
    parse(e) {
      var n;
      if (e.tagName === "input")
        return e.closest("[data-content-type]") || e.closest("li") ? void 0 : e.type === "checkbox" ? { checked: e.checked } : void 0;
      if (e.tagName !== "LI")
        return;
      const t = e.parentElement;
      if (t !== null && (t.tagName === "UL" || t.tagName === "DIV" && ((n = t.parentElement) == null ? void 0 : n.tagName) === "UL")) {
        const o = e.querySelector("input[type=checkbox]") || null;
        return o === null ? void 0 : { ...B(e), checked: o.checked };
      }
    },
    // As `li` elements can contain multiple paragraphs, we need to merge their contents
    // into a single one so that ProseMirror can parse everything correctly.
    parseContent: ({ el: e, schema: t }) => Ee(e, t, "checkListItem"),
    render(e, t) {
      const n = document.createDocumentFragment(), o = document.createElement("input");
      o.type = "checkbox", o.checked = e.props.checked, e.props.checked && o.setAttribute("checked", ""), o.addEventListener("change", () => {
        t.updateBlock(e, { props: { checked: !e.props.checked } });
      });
      const r = document.createElement("p");
      return n.appendChild(o), n.appendChild(r), {
        dom: n,
        contentDOM: r
      };
    },
    toExternalHTML(e) {
      const t = document.createElement("li"), n = document.createElement("input");
      n.type = "checkbox", n.checked = e.props.checked, e.props.checked && n.setAttribute("checked", "");
      const o = document.createElement("p");
      return H(e.props, t), t.appendChild(n), t.appendChild(o), {
        dom: t,
        contentDOM: o
      };
    },
    runsBefore: ["bulletListItem"]
  },
  [
    L({
      key: "check-list-item-shortcuts",
      keyboardShortcuts: {
        Enter: ({ editor: e }) => ne(e, "checkListItem"),
        "Mod-Shift-9": ({ editor: e }) => {
          const t = e.getTextCursorPosition();
          return e.schema.blockSchema[t.block.type].content !== "inline" ? !1 : (e.updateBlock(t.block, {
            type: "checkListItem",
            props: {}
          }), !0);
        }
      },
      inputRules: [
        {
          find: new RegExp("\\[\\s*\\]\\s$"),
          replace() {
            return {
              type: "checkListItem",
              props: {
                checked: !1
              },
              content: []
            };
          }
        },
        {
          find: new RegExp("\\[[Xx]\\]\\s$"),
          replace() {
            return {
              type: "checkListItem",
              props: {
                checked: !0
              }
            };
          }
        }
      ]
    })
  ]
);
function lt(e, t, n, o) {
  let r = e.firstChild.attrs.start || 1, s = !0;
  const a = !!e.firstChild.attrs.start, i = z({
    posBeforeNode: t,
    node: e
  });
  if (!i.isBlockContainer)
    throw new Error("impossible");
  const c = n.doc.resolve(i.bnBlock.beforePos).nodeBefore, l = c ? o.get(c) : void 0;
  return l !== void 0 ? (r = l + 1, s = !1) : c && z({
    posBeforeNode: i.bnBlock.beforePos - c.nodeSize,
    node: c
  }).blockNoteType === "numberedListItem" && (r = lt(
    c,
    i.bnBlock.beforePos - c.nodeSize,
    n,
    o
  ).index + 1, s = !1), o.set(e, r), { index: r, isFirst: s, hasStart: a };
}
function Re(e, t) {
  const n = /* @__PURE__ */ new Map(), o = t.decorations.map(
    e.mapping,
    e.doc
  ), r = [];
  e.doc.nodesBetween(0, e.doc.nodeSize - 2, (a, i) => {
    if (a.type.name === "blockContainer" && a.firstChild.type.name === "numberedListItem") {
      const { index: c, isFirst: l, hasStart: d } = lt(
        a,
        i,
        e,
        n
      );
      o.find(
        i,
        i + a.nodeSize,
        (p) => p.index === c && p.isFirst === l && p.hasStart === d
      ).length === 0 && r.push(
        // move in by 1 to account for the block container
        Ot.node(i + 1, i + a.nodeSize - 1, {
          "data-index": c.toString()
        })
      );
    }
  });
  const s = r.flatMap(
    (a) => o.find(a.from, a.to)
  );
  return {
    decorations: o.remove(s).add(e.doc, r)
  };
}
const Zn = () => new je({
  key: new Ue("numbered-list-indexing-decorations"),
  state: {
    init(e, t) {
      return Re(t.tr, {
        decorations: Me.empty
      });
    },
    apply(e, t) {
      return !e.docChanged && !e.selectionSet && t.decorations ? t : Re(e, t);
    }
  },
  props: {
    decorations(e) {
      var t;
      return ((t = this.getState(e)) == null ? void 0 : t.decorations) ?? Me.empty;
    }
  }
}), Gn = () => ({
  type: "numberedListItem",
  propSchema: {
    ...C,
    start: { default: void 0, type: "number" }
  },
  content: "inline"
}), Xn = M(
  Gn,
  {
    meta: {
      isolating: !1
    },
    parse(e) {
      var n;
      if (e.tagName !== "LI")
        return;
      const t = e.parentElement;
      if (t !== null && (t.tagName === "OL" || t.tagName === "DIV" && ((n = t.parentElement) == null ? void 0 : n.tagName) === "OL")) {
        const o = parseInt(t.getAttribute("start") || "1"), r = B(e);
        return e.previousElementSibling || o === 1 ? r : {
          ...r,
          start: o
        };
      }
    },
    // As `li` elements can contain multiple paragraphs, we need to merge their contents
    // into a single one so that ProseMirror can parse everything correctly.
    parseContent: ({ el: e, schema: t }) => Ee(e, t, "numberedListItem"),
    render() {
      const e = document.createElement("p");
      return {
        dom: e,
        contentDOM: e
      };
    },
    toExternalHTML(e) {
      const t = document.createElement("li"), n = document.createElement("p");
      return H(e.props, t), t.appendChild(n), {
        dom: t,
        contentDOM: n
      };
    }
  },
  [
    L({
      key: "numbered-list-item-shortcuts",
      inputRules: [
        {
          find: new RegExp("^(\\d+)\\.\\s$"),
          replace({ match: e, editor: t }) {
            if (Ge(
              t.prosemirrorState
            ).blockNoteType === "heading")
              return;
            const o = parseInt(e[1]);
            return {
              type: "numberedListItem",
              props: {
                start: o !== 1 ? o : void 0
              }
            };
          }
        }
      ],
      keyboardShortcuts: {
        Enter: ({ editor: e }) => ne(e, "numberedListItem"),
        "Mod-Shift-7": ({ editor: e }) => {
          const t = e.getTextCursorPosition();
          return e.schema.blockSchema[t.block.type].content !== "inline" ? !1 : (e.updateBlock(t.block, {
            type: "numberedListItem",
            props: {}
          }), !0);
        }
      },
      plugins: [Zn()]
    })
  ]
), Jn = () => ({
  type: "toggleListItem",
  propSchema: {
    ...C
  },
  content: "inline"
}), Kn = M(
  Jn,
  {
    meta: {
      isolating: !1
    },
    render(e, t) {
      const n = document.createElement("p");
      return { ...st(
        e,
        t,
        n
      ), contentDOM: n };
    },
    toExternalHTML(e) {
      const t = document.createElement("li"), n = document.createElement("p");
      return H(e.props, t), t.appendChild(n), {
        dom: t,
        contentDOM: n
      };
    }
  },
  [
    L({
      key: "toggle-list-item-shortcuts",
      keyboardShortcuts: {
        Enter: ({ editor: e }) => ne(e, "toggleListItem"),
        "Mod-Shift-6": ({ editor: e }) => {
          const t = e.getTextCursorPosition();
          return e.schema.blockSchema[t.block.type].content !== "inline" ? !1 : (e.updateBlock(t.block, {
            type: "toggleListItem",
            props: {}
          }), !0);
        }
      }
    })
  ]
), Qn = () => ({
  type: "pageBreak",
  propSchema: {},
  content: "none"
}), Yn = M(
  Qn,
  {
    parse(e) {
      if (e.tagName === "DIV" && e.hasAttribute("data-page-break"))
        return {};
    },
    render() {
      const e = document.createElement("div");
      return e.setAttribute("data-page-break", ""), {
        dom: e
      };
    },
    toExternalHTML() {
      const e = document.createElement("div");
      return e.setAttribute("data-page-break", ""), {
        dom: e
      };
    }
  }
), lr = (e) => e.extend({
  blockSpecs: {
    pageBreak: Yn()
  }
}), eo = () => ({
  type: "paragraph",
  propSchema: C,
  content: "inline"
}), to = M(
  eo,
  {
    meta: {
      isolating: !1
    },
    parse: (e) => {
      var t;
      if (e.tagName === "P" && (t = e.textContent) != null && t.trim())
        return B(e);
    },
    render: () => {
      const e = document.createElement("p");
      return {
        dom: e,
        contentDOM: e
      };
    },
    toExternalHTML: (e) => {
      const t = document.createElement("p");
      return H(e.props, t), {
        dom: t,
        contentDOM: t
      };
    },
    runsBefore: ["default"]
  },
  [
    L({
      key: "paragraph-shortcuts",
      keyboardShortcuts: {
        "Mod-Alt-0": ({ editor: e }) => {
          const t = e.getTextCursorPosition();
          return e.schema.blockSchema[t.block.type].content !== "inline" ? !1 : (e.updateBlock(t.block, {
            type: "paragraph",
            props: {}
          }), !0);
        }
      }
    })
  ]
), no = () => ({
  type: "quote",
  propSchema: {
    backgroundColor: C.backgroundColor,
    textColor: C.textColor
  },
  content: "inline"
}), oo = M(
  no,
  {
    meta: {
      isolating: !1
    },
    parse(e) {
      if (e.tagName === "BLOCKQUOTE") {
        const { backgroundColor: t, textColor: n } = B(e);
        return { backgroundColor: t, textColor: n };
      }
    },
    render() {
      const e = document.createElement("blockquote");
      return {
        dom: e,
        contentDOM: e
      };
    },
    toExternalHTML(e) {
      const t = document.createElement("blockquote");
      return H(e.props, t), {
        dom: t,
        contentDOM: t
      };
    }
  },
  [
    L({
      key: "quote-block-shortcuts",
      keyboardShortcuts: {
        "Mod-Alt-q": ({ editor: e }) => {
          const t = e.getTextCursorPosition();
          return e.schema.blockSchema[t.block.type].content !== "inline" ? !1 : (e.updateBlock(t.block, {
            type: "quote",
            props: {}
          }), !0);
        }
      },
      inputRules: [
        {
          find: new RegExp("^>\\s$"),
          replace() {
            return {
              type: "quote",
              props: {}
            };
          }
        }
      ]
    })
  ]
), ro = 35, ut = 120, ur = 31, so = $e.create({
  name: "BlockNoteTableExtension",
  addProseMirrorPlugins: () => [
    bt({
      cellMinWidth: ro,
      defaultCellMinWidth: ut,
      // We set this to null as we implement our own node view in the table
      // block content. This node view is the same as what's used by default,
      // but is wrapped in a `blockContent` HTML element.
      View: null
    }),
    kt()
  ],
  addKeyboardShortcuts() {
    return {
      // Makes enter create a new line within the cell.
      Enter: () => this.editor.state.selection.empty && this.editor.state.selection.$head.parent.type.name === "tableParagraph" ? (this.editor.commands.insertContent({ type: "hardBreak" }), !0) : !1,
      // Ensures that backspace won't delete the table if the text cursor is at
      // the start of a cell and the selection is empty.
      Backspace: () => {
        const e = this.editor.state.selection, t = e.empty, n = e.$head.parentOffset === 0, o = e.$head.node().type.name === "tableParagraph";
        return t && n && o;
      },
      // Enables navigating cells using the tab key.
      Tab: () => this.editor.commands.command(
        ({ state: e, dispatch: t, view: n }) => Se(1)(e, t, n)
      ),
      "Shift-Tab": () => this.editor.commands.command(
        ({ state: e, dispatch: t, view: n }) => Se(-1)(e, t, n)
      )
    };
  },
  extendNodeSchema(e) {
    const t = {
      name: e.name,
      options: e.options,
      storage: e.storage
    };
    return {
      tableRole: Tt(
        At(e, "tableRole", t)
      )
    };
  }
}), ao = {
  textColor: C.textColor
}, io = D.create({
  name: "tableHeader",
  addOptions() {
    return {
      HTMLAttributes: {}
    };
  },
  /**
   * We allow table headers and cells to have multiple tableContent nodes because
   * when merging cells, prosemirror-tables will concat the contents of the cells naively.
   * This would cause that content to overflow into other cells when prosemirror tries to enforce the cell structure.
   *
   * So, we manually fix this up when reading back in the `nodeToBlock` and only ever place a single tableContent back into the cell.
   */
  content: "tableContent+",
  addAttributes() {
    return {
      colspan: {
        default: 1
      },
      rowspan: {
        default: 1
      },
      colwidth: {
        default: null,
        parseHTML: (e) => {
          const t = e.getAttribute("colwidth");
          return t ? t.split(",").map((o) => parseInt(o, 10)) : null;
        }
      }
    };
  },
  tableRole: "header_cell",
  isolating: !0,
  parseHTML() {
    return [
      {
        tag: "th",
        // As `th` elements can contain multiple paragraphs, we need to merge their contents
        // into a single one so that ProseMirror can parse everything correctly.
        getContent: (e, t) => dt(e, t)
      }
    ];
  },
  renderHTML({ HTMLAttributes: e }) {
    return [
      "th",
      ue(this.options.HTMLAttributes, e),
      0
    ];
  }
}), co = D.create({
  name: "tableCell",
  addOptions() {
    return {
      HTMLAttributes: {}
    };
  },
  content: "tableContent+",
  addAttributes() {
    return {
      colspan: {
        default: 1
      },
      rowspan: {
        default: 1
      },
      colwidth: {
        default: null,
        parseHTML: (e) => {
          const t = e.getAttribute("colwidth");
          return t ? t.split(",").map((o) => parseInt(o, 10)) : null;
        }
      }
    };
  },
  tableRole: "cell",
  isolating: !0,
  parseHTML() {
    return [
      {
        tag: "td",
        // As `td` elements can contain multiple paragraphs, we need to merge their contents
        // into a single one so that ProseMirror can parse everything correctly.
        getContent: (e, t) => dt(e, t)
      }
    ];
  },
  renderHTML({ HTMLAttributes: e }) {
    return [
      "td",
      ue(this.options.HTMLAttributes, e),
      0
    ];
  }
}), lo = D.create({
  name: "table",
  content: "tableRow+",
  group: "blockContent",
  tableRole: "table",
  marks: "deletion insertion modification",
  isolating: !0,
  parseHTML() {
    return [
      {
        tag: "table"
      }
    ];
  },
  renderHTML({ node: e, HTMLAttributes: t }) {
    var r, s, a;
    const n = Vt(
      this.name,
      "table",
      {
        ...((r = this.options.domAttributes) == null ? void 0 : r.blockContent) || {},
        ...t
      },
      ((s = this.options.domAttributes) == null ? void 0 : s.inlineContent) || {}
    ), o = document.createElement("colgroup");
    for (const i of e.children[0].children)
      if (i.attrs.colwidth)
        for (const l of i.attrs.colwidth) {
          const d = document.createElement("col");
          l && (d.style = `width: ${l}px`), o.appendChild(d);
        }
      else
        o.appendChild(document.createElement("col"));
    return (a = n.dom.firstChild) == null || a.appendChild(o), n;
  },
  // This node view is needed for the `columnResizing` plugin. By default, the
  // plugin adds its own node view, which overrides how the node is rendered vs
  // `renderHTML`. This means that the wrapping `blockContent` HTML element is
  // no longer rendered. The `columnResizing` plugin uses the `TableView` as its
  // default node view. `BlockNoteTableView` extends it by wrapping it in a
  // `blockContent` element, so the DOM structure is consistent with other block
  // types.
  addNodeView() {
    return ({ node: e, HTMLAttributes: t }) => {
      var o;
      class n extends Ct {
        constructor(s, a, i) {
          super(s, a), this.node = s, this.cellMinWidth = a, this.blockContentHTMLAttributes = i;
          const c = document.createElement("div");
          c.className = U(
            "bn-block-content",
            i.class
          ), c.setAttribute("data-content-type", "table");
          for (const [p, f] of Object.entries(
            i
          ))
            p !== "class" && c.setAttribute(p, f);
          const l = this.dom, d = document.createElement("div");
          d.className = "tableWrapper-inner", d.appendChild(l.firstChild), l.appendChild(d), c.appendChild(l);
          const u = document.createElement("div");
          u.className = "table-widgets-container", u.style.position = "relative", l.appendChild(u), this.dom = c;
        }
        ignoreMutation(s) {
          return !s.target.closest(".tableWrapper-inner") || super.ignoreMutation(s);
        }
      }
      return new n(e, ut, {
        ...((o = this.options.domAttributes) == null ? void 0 : o.blockContent) || {},
        ...t
      });
    };
  }
}), uo = D.create({
  name: "tableParagraph",
  group: "tableContent",
  content: "inline*",
  parseHTML() {
    return [
      {
        tag: "p",
        getAttrs: (e) => {
          if (typeof e == "string" || !e.textContent || !e.closest("[data-content-type]"))
            return !1;
          const t = e.parentElement;
          return t === null ? !1 : t.tagName === "TD" || t.tagName === "TH" ? {} : !1;
        },
        node: "tableParagraph"
      }
    ];
  },
  renderHTML({ HTMLAttributes: e }) {
    return ["p", e, 0];
  }
}), po = D.create({
  name: "tableRow",
  addOptions() {
    return {
      HTMLAttributes: {}
    };
  },
  content: "(tableCell | tableHeader)+",
  tableRole: "row",
  marks: "deletion insertion modification",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML({ HTMLAttributes: e }) {
    return [
      "tr",
      ue(this.options.HTMLAttributes, e),
      0
    ];
  }
});
function dt(e, t) {
  const o = Q.fromSchema(t).parse(e, {
    topNode: t.nodes.blockGroup.create()
  }), r = [];
  return o.content.descendants((s) => {
    if (s.isInline)
      return r.push(s), !1;
  }), _.fromArray(r);
}
const fo = () => jt(
  { node: lo, type: "table", content: "table" },
  ao,
  [
    L({
      key: "table-extensions",
      tiptapExtensions: [
        so,
        uo,
        io,
        co,
        po
      ]
    }),
    // Extension for keyboard shortcut which deletes the table if it's empty
    // and all cells are selected. Uses a separate extension as it needs
    // priority over keyboard handlers in the `TableExtension`'s
    // `tableEditing` plugin.
    L({
      key: "table-keyboard-delete",
      keyboardShortcuts: {
        Backspace: ({ editor: e }) => {
          if (!(e.prosemirrorState.selection instanceof Fe))
            return !1;
          const t = e.getTextCursorPosition().block, n = t.content;
          let o = 0;
          for (const s of n.rows)
            for (const a of s.cells) {
              if ("type" in a && a.content.length > 0 || !("type" in a) && a.length > 0)
                return !1;
              o++;
            }
          let r = 0;
          return e.prosemirrorState.selection.forEachCell(() => {
            r++;
          }), r < o ? !1 : (e.transact(() => {
            (e.getPrevBlock(t) || e.getNextBlock(t)) && e.setTextCursorPosition(t), e.removeBlocks([t]);
          }), !0);
        }
      }
    })
  ]
), Ve = (e) => {
  const t = e.src || void 0, n = e.width || void 0;
  return { url: t, previewWidth: n };
}, ho = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2 3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934ZM8 5V19H16V5H8ZM4 5V7H6V5H4ZM18 5V7H20V5H18ZM4 9V11H6V9H4ZM18 9V11H20V9H18ZM4 13V15H6V13H4ZM18 13V15H20V13H18ZM4 17V19H6V17H4ZM18 17V19H20V17H18Z"></path></svg>', mo = (e) => ({
  type: "video",
  propSchema: {
    textAlignment: C.textAlignment,
    backgroundColor: C.backgroundColor,
    name: { default: "" },
    url: { default: "" },
    caption: { default: "" },
    showPreview: { default: !0 },
    previewWidth: { default: void 0, type: "number" }
  },
  content: "none"
}), go = (e) => (t) => {
  if (t.tagName === "VIDEO") {
    if (t.closest("figure"))
      return;
    const { backgroundColor: n } = B(t);
    return {
      ...Ve(t),
      backgroundColor: n
    };
  }
  if (t.tagName === "FIGURE") {
    const n = ee(t, "video");
    if (!n)
      return;
    const { targetElement: o, caption: r } = n, { backgroundColor: s } = B(t);
    return {
      ...Ve(o),
      backgroundColor: s,
      caption: r
    };
  }
}, bo = M(
  mo,
  (e) => ({
    meta: {
      fileBlockAccept: ["video/*"]
    },
    parse: go(),
    render(t, n) {
      const o = document.createElement("div");
      o.innerHTML = e.icon ?? ho;
      const r = document.createElement("div");
      r.className = "bn-visual-media-wrapper";
      const s = document.createElement("video");
      return s.className = "bn-visual-media", n.resolveFileUrl ? n.resolveFileUrl(t.props.url).then((a) => {
        s.src = a;
      }) : s.src = t.props.url, s.controls = !0, s.contentEditable = "false", s.draggable = !1, s.width = t.props.previewWidth, r.appendChild(s), it(
        t,
        n,
        { dom: r },
        r,
        o.firstElementChild
      );
    },
    toExternalHTML(t) {
      if (!t.props.url) {
        const o = document.createElement("p");
        return o.textContent = "Add video", {
          dom: o
        };
      }
      let n;
      return t.props.showPreview ? (n = document.createElement("video"), n.src = t.props.url, t.props.previewWidth && (n.width = t.props.previewWidth)) : (n = document.createElement("a"), n.href = t.props.url, n.textContent = t.props.name || t.props.url), t.props.caption ? t.props.showPreview ? ve(n, t.props.caption) : te(n, t.props.caption) : {
        dom: n
      };
    },
    runsBefore: ["file"]
  })
), dr = async (e) => {
  const t = new FormData();
  return t.append("file", e), (await (await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: t
  })).json()).data.url.replace(
    "tmpfiles.org/",
    "tmpfiles.org/dl/"
  );
};
function E(e, t, n) {
  if (!(t in e.schema.blockSpecs))
    return !1;
  if (!n)
    return !0;
  for (const [o, r] of Object.entries(n)) {
    if (!(o in e.schema.blockSpecs[t].config.propSchema))
      return !1;
    if (typeof r == "string") {
      if (e.schema.blockSpecs[t].config.propSchema[o].default && typeof e.schema.blockSpecs[t].config.propSchema[o].default !== r || e.schema.blockSpecs[t].config.propSchema[o].type && e.schema.blockSpecs[t].config.propSchema[o].type !== r)
        return !1;
    } else {
      if (e.schema.blockSpecs[t].config.propSchema[o].default !== r.default || e.schema.blockSpecs[t].config.propSchema[o].default === void 0 && r.default === void 0 && e.schema.blockSpecs[t].config.propSchema[o].type !== r.type || typeof e.schema.blockSpecs[t].config.propSchema[o].values != typeof r.values)
        return !1;
      if (typeof e.schema.blockSpecs[t].config.propSchema[o].values == "object" && typeof r.values == "object") {
        if (e.schema.blockSpecs[t].config.propSchema[o].values.length !== r.values.length)
          return !1;
        for (let s = 0; s < e.schema.blockSpecs[t].config.propSchema[o].values.length; s++)
          if (e.schema.blockSpecs[t].config.propSchema[o].values[s] !== r.values[s])
            return !1;
      }
    }
  }
  return !0;
}
function pr(e, t, n, o) {
  return E(t, n, o) && e.type === n;
}
function fr(e) {
  return e instanceof Fe;
}
function ko(e) {
  let t = e.getTextCursorPosition().block, n = e.schema.blockSchema[t.type].content;
  for (; n === "none"; ) {
    if (t = e.getTextCursorPosition().nextBlock, t === void 0)
      return;
    n = e.schema.blockSchema[t.type].content, e.setTextCursorPosition(t, "end");
  }
}
function w(e, t) {
  const n = e.getTextCursorPosition().block;
  if (n.content === void 0)
    throw new Error("Slash Menu open in a block that doesn't contain content.");
  let o;
  return Array.isArray(n.content) && (n.content.length === 1 && I(n.content[0]) && n.content[0].type === "text" && n.content[0].text === "/" || n.content.length === 0) ? (o = e.updateBlock(n, t), e.setTextCursorPosition(o)) : (o = e.insertBlocks([t], n, "after")[0], e.setTextCursorPosition(e.getTextCursorPosition().nextBlock)), ko(e), o;
}
function hr(e) {
  const t = [];
  return E(e, "heading", { level: "number" }) && t.push(
    {
      onItemClick: () => {
        w(e, {
          type: "heading",
          props: { level: 1 }
        });
      },
      badge: T("Mod-Alt-1"),
      key: "heading",
      ...e.dictionary.slash_menu.heading
    },
    {
      onItemClick: () => {
        w(e, {
          type: "heading",
          props: { level: 2 }
        });
      },
      badge: T("Mod-Alt-2"),
      key: "heading_2",
      ...e.dictionary.slash_menu.heading_2
    },
    {
      onItemClick: () => {
        w(e, {
          type: "heading",
          props: { level: 3 }
        });
      },
      badge: T("Mod-Alt-3"),
      key: "heading_3",
      ...e.dictionary.slash_menu.heading_3
    }
  ), E(e, "quote") && t.push({
    onItemClick: () => {
      w(e, {
        type: "quote"
      });
    },
    key: "quote",
    ...e.dictionary.slash_menu.quote
  }), E(e, "toggleListItem") && t.push({
    onItemClick: () => {
      w(e, {
        type: "toggleListItem"
      });
    },
    badge: T("Mod-Shift-6"),
    key: "toggle_list",
    ...e.dictionary.slash_menu.toggle_list
  }), E(e, "numberedListItem") && t.push({
    onItemClick: () => {
      w(e, {
        type: "numberedListItem"
      });
    },
    badge: T("Mod-Shift-7"),
    key: "numbered_list",
    ...e.dictionary.slash_menu.numbered_list
  }), E(e, "bulletListItem") && t.push({
    onItemClick: () => {
      w(e, {
        type: "bulletListItem"
      });
    },
    badge: T("Mod-Shift-8"),
    key: "bullet_list",
    ...e.dictionary.slash_menu.bullet_list
  }), E(e, "checkListItem") && t.push({
    onItemClick: () => {
      w(e, {
        type: "checkListItem"
      });
    },
    badge: T("Mod-Shift-9"),
    key: "check_list",
    ...e.dictionary.slash_menu.check_list
  }), E(e, "paragraph") && t.push({
    onItemClick: () => {
      w(e, {
        type: "paragraph"
      });
    },
    badge: T("Mod-Alt-0"),
    key: "paragraph",
    ...e.dictionary.slash_menu.paragraph
  }), E(e, "codeBlock") && t.push({
    onItemClick: () => {
      w(e, {
        type: "codeBlock"
      });
    },
    badge: T("Mod-Alt-c"),
    key: "code_block",
    ...e.dictionary.slash_menu.code_block
  }), E(e, "divider") && t.push({
    onItemClick: () => {
      w(e, { type: "divider" });
    },
    key: "divider",
    ...e.dictionary.slash_menu.divider
  }), E(e, "table") && t.push({
    onItemClick: () => {
      w(e, {
        type: "table",
        content: {
          type: "tableContent",
          rows: [
            {
              cells: ["", "", ""]
            },
            {
              cells: ["", "", ""]
            }
          ]
        }
      });
    },
    badge: void 0,
    key: "table",
    ...e.dictionary.slash_menu.table
  }), E(e, "image", { url: "string" }) && t.push({
    onItemClick: () => {
      const n = w(e, {
        type: "image"
      });
      e.transact(
        (o) => o.setMeta(e.filePanel.plugins[0], {
          block: n
        })
      );
    },
    key: "image",
    ...e.dictionary.slash_menu.image
  }), E(e, "video", { url: "string" }) && t.push({
    onItemClick: () => {
      const n = w(e, {
        type: "video"
      });
      e.transact(
        (o) => o.setMeta(e.filePanel.plugins[0], {
          block: n
        })
      );
    },
    key: "video",
    ...e.dictionary.slash_menu.video
  }), E(e, "audio", { url: "string" }) && t.push({
    onItemClick: () => {
      const n = w(e, {
        type: "audio"
      });
      e.transact(
        (o) => o.setMeta(e.filePanel.plugins[0], {
          block: n
        })
      );
    },
    key: "audio",
    ...e.dictionary.slash_menu.audio
  }), E(e, "file", { url: "string" }) && t.push({
    onItemClick: () => {
      const n = w(e, {
        type: "file"
      });
      e.transact(
        (o) => o.setMeta(e.filePanel.plugins[0], {
          block: n
        })
      );
    },
    key: "file",
    ...e.dictionary.slash_menu.file
  }), E(e, "heading", {
    level: "number",
    isToggleable: "boolean"
  }) && t.push(
    {
      onItemClick: () => {
        w(e, {
          type: "heading",
          props: { level: 1, isToggleable: !0 }
        });
      },
      key: "toggle_heading",
      ...e.dictionary.slash_menu.toggle_heading
    },
    {
      onItemClick: () => {
        w(e, {
          type: "heading",
          props: { level: 2, isToggleable: !0 }
        });
      },
      key: "toggle_heading_2",
      ...e.dictionary.slash_menu.toggle_heading_2
    },
    {
      onItemClick: () => {
        w(e, {
          type: "heading",
          props: { level: 3, isToggleable: !0 }
        });
      },
      key: "toggle_heading_3",
      ...e.dictionary.slash_menu.toggle_heading_3
    }
  ), E(e, "heading", { level: "number" }) && (e.schema.blockSchema.heading.propSchema.level.values || []).filter((n) => n > 3).forEach((n) => {
    t.push({
      onItemClick: () => {
        w(e, {
          type: "heading",
          props: { level: n }
        });
      },
      key: `heading_${n}`,
      ...e.dictionary.slash_menu[`heading_${n}`]
    });
  }), t.push({
    onItemClick: () => {
      e.openSuggestionMenu(":", {
        deleteTriggerCharacter: !0,
        ignoreQueryLength: !0
      });
    },
    key: "emoji",
    ...e.dictionary.slash_menu.emoji
  }), t;
}
function mr(e, t) {
  return e.filter(
    ({ title: n, aliases: o }) => n.toLowerCase().includes(t.toLowerCase()) || o && o.filter(
      (r) => r.toLowerCase().includes(t.toLowerCase())
    ).length !== 0
  );
}
function Co(e) {
  return "pageBreak" in e.schema.blockSchema;
}
function gr(e) {
  const t = [];
  return Co(e) && t.push({
    ...e.dictionary.slash_menu.page_break,
    onItemClick: () => {
      w(e, {
        type: "pageBreak"
      });
    },
    key: "page_break"
  }), t;
}
const yo = {
  audio: En(),
  bulletListItem: Un(),
  checkListItem: qn(),
  codeBlock: Ln(),
  divider: An(),
  file: Pn(),
  heading: Dn(),
  image: $n(),
  numberedListItem: Xn(),
  paragraph: to(),
  quote: oo(),
  table: fo(),
  toggleListItem: Kn(),
  video: bo()
}, wo = Ye(
  {
    type: "textColor",
    propSchema: "string"
  },
  {
    render: () => {
      const e = document.createElement("span");
      return {
        dom: e,
        contentDOM: e
      };
    },
    toExternalHTML: (e) => {
      const t = document.createElement("span");
      return e !== C.textColor.default && (t.style.color = e in A ? A[e].text : e), {
        dom: t,
        contentDOM: t
      };
    },
    parse: (e) => {
      if (e.tagName === "SPAN" && e.style.color)
        return e.style.color;
    }
  }
), vo = Ye(
  {
    type: "backgroundColor",
    propSchema: "string"
  },
  {
    render: () => {
      const e = document.createElement("span");
      return {
        dom: e,
        contentDOM: e
      };
    },
    toExternalHTML: (e) => {
      const t = document.createElement("span");
      return e !== C.backgroundColor.default && (t.style.backgroundColor = e in A ? A[e].background : e), {
        dom: t,
        contentDOM: t
      };
    },
    parse: (e) => {
      if (e.tagName === "SPAN" && e.style.backgroundColor)
        return e.style.backgroundColor;
    }
  }
), pt = {
  bold: F(yt, "boolean"),
  italic: F(vt, "boolean"),
  underline: F(xt, "boolean"),
  strike: F(Et, "boolean"),
  code: F(wt, "boolean"),
  textColor: wo,
  backgroundColor: vo
}, br = Qe(pt), ft = {
  text: { config: "text", implementation: {} },
  link: { config: "link", implementation: {} }
}, kr = Je(
  ft
);
class ht extends sn {
  static create(t) {
    return new ht({
      blockSpecs: (t == null ? void 0 : t.blockSpecs) ?? yo,
      inlineContentSpecs: (t == null ? void 0 : t.inlineContentSpecs) ?? ft,
      styleSpecs: (t == null ? void 0 : t.styleSpecs) ?? pt
    });
  }
}
export {
  Te as $,
  qn as A,
  Gn as B,
  Xn as C,
  Jn as D,
  ur as E,
  kn as F,
  Kn as G,
  Qn as H,
  Yn as I,
  lr as J,
  eo as K,
  to as L,
  no as M,
  oo as N,
  ao as O,
  fo as P,
  ho as Q,
  mo as R,
  go as S,
  bo as T,
  Hn as U,
  st as V,
  dr as W,
  Co as X,
  gr as Y,
  ht as Z,
  Vt as _,
  ut as a,
  ke as a$,
  Wt as a0,
  yo as a1,
  pt as a2,
  br as a3,
  ft as a4,
  kr as a5,
  E as a6,
  pr as a7,
  fr as a8,
  C as a9,
  cr as aA,
  nr as aB,
  Yo as aC,
  Jo as aD,
  er as aE,
  Xo as aF,
  et as aG,
  an as aH,
  cn as aI,
  tr as aJ,
  Ko as aK,
  Qo as aL,
  U as aM,
  qe as aN,
  Uo as aO,
  or as aP,
  $o as aQ,
  zo as aR,
  me as aS,
  z as aT,
  ye as aU,
  Vo as aV,
  fn as aW,
  he as aX,
  ge as aY,
  be as aZ,
  R as a_,
  B as aa,
  H as ab,
  sr as ac,
  ar as ad,
  ir as ae,
  Jt as af,
  O as ag,
  qo as ah,
  Zo as ai,
  Ft as aj,
  Go as ak,
  G as al,
  Y as am,
  un as an,
  X as ao,
  nt as ap,
  Z as aq,
  dn as ar,
  fe as as,
  Xt as at,
  Ce as au,
  Sn as av,
  xn as aw,
  Zt as ax,
  Gt as ay,
  Ge as az,
  yn as b,
  L as b0,
  A as b1,
  rr as b2,
  w as b3,
  hr as b4,
  mr as b5,
  Ut as b6,
  zt as b7,
  qt as b8,
  jo as b9,
  ae as bA,
  M as ba,
  $t as bb,
  ie as bc,
  jt as bd,
  Kt as be,
  Je as bf,
  Le as bg,
  Ze as bh,
  I as bi,
  Yt as bj,
  Ye as bk,
  Qt as bl,
  J as bm,
  Ke as bn,
  F as bo,
  Qe as bp,
  sn as bq,
  Rt as br,
  T as bs,
  Wo as bt,
  K as bu,
  Fo as bv,
  se as bw,
  $ as bx,
  pe as by,
  j as bz,
  Cn as c,
  wn as d,
  vn as e,
  En as f,
  Mn as g,
  Ln as h,
  rt as i,
  Tn as j,
  An as k,
  Nn as l,
  In as m,
  Pn as n,
  On as o,
  He as p,
  Dn as q,
  _n as r,
  Rn as s,
  Vn as t,
  Wn as u,
  Fn as v,
  $n as w,
  jn as x,
  Un as y,
  zn as z
};
//# sourceMappingURL=BlockNoteSchema-CYRHak18.js.map
