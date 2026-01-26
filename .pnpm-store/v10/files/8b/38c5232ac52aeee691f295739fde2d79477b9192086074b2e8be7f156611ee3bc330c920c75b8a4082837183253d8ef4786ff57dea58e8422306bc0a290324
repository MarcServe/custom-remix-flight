var qt = Object.defineProperty;
var Yt = (n, t, e) => t in n ? qt(n, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : n[t] = e;
var h = (n, t, e) => Yt(n, typeof t != "symbol" ? t + "" : t, e);
import { Slice as q, Fragment as V, DOMSerializer as we, DOMParser as lt } from "prosemirror-model";
import { ReplaceStep as Wt, ReplaceAroundStep as Pe, Mapping as Xt } from "prosemirror-transform";
import { af as me, ag as Y, ah as Ee, ai as Jt, aj as Qt, ak as Zt, al as I, am as De, an as _, ao as B, ap as dt, aq as ne, ar as ht, as as re, at as eo, au as to, ac as oo, av as S, a9 as $e, aw as Ae, ax as ye, ay as Ce, az as A, aA as no, aB as ro, a6 as ut, aC as pt, aD as so, aE as mt, aF as io, aG as ao, aH as Fe, aI as ze, a8 as Ge, aJ as co, aK as lo, aL as ho, ad as uo, aM as _e, aN as ft, aO as po, aP as mo, aQ as fo, aR as go, aS as gt, aT as Te, Z as bo, aU as ko, a5 as wo } from "./BlockNoteSchema-CYRHak18.js";
import { b2 as bi, b1 as ki, bq as wi, E as yi, a as Ci, F as vi, r as Si, Q as Bi, ab as Ei, b8 as Mi, bm as Pi, b6 as Ti, aV as xi, b as Ii, d as Li, e as Di, a7 as Ai, bu as _i, aW as Oi, X as Hi, c as Ni, f as Ui, b9 as Ri, b0 as Vi, ba as $i, bd as Fi, x as zi, y as Gi, A as ji, z as Ki, g as qi, h as Yi, _ as Wi, j as Xi, k as Ji, l as Qi, n as Zi, o as ea, q as ta, s as oa, w as na, be as ra, bn as sa, B as ia, C as aa, H as ca, I as la, K as da, L as ha, M as ua, N as pa, bk as ma, bo as fa, P as ga, D as ba, G as ka, V as wa, R as ya, T as Ca, a1 as va, $ as Sa, a4 as Ba, a3 as Ea, a2 as Ma, U as Pa, m as Ta, bv as xa, b5 as Ia, bs as La, a$ as Da, bb as Aa, aX as _a, aY as Oa, bz as Ha, b4 as Na, aZ as Ua, bf as Ra, i as Va, Y as $a, b7 as Fa, bA as za, bj as Ga, a_ as ja, bp as Ka, ae as qa, t as Ya, u as Wa, v as Xa, b3 as Ja, br as Qa, bg as Za, bh as ec, bx as tc, bt as oc, bi as nc, by as rc, bw as sc, a0 as ic, p as ac, aa as cc, bl as lc, O as dc, W as hc, S as uc, J as pc, bc as mc } from "./BlockNoteSchema-CYRHak18.js";
import { Node as W, combineTransactionSteps as yo, Extension as O, Mark as ie, mergeAttributes as bt, isTextSelection as Co, isNodeSelection as xe, posToDOMRect as fe, getMarkRange as je, findChildren as Ke, findParentNode as vo, extensions as te, selectionToInsertionEnd as So, InputRule as Bo, getSchema as Eo, createDocument as Mo, Editor as Po } from "@tiptap/core";
import To from "fast-deep-equal";
import { dropCursor as xo } from "prosemirror-dropcursor";
import * as R from "yjs";
import { Gapcursor as Io } from "@tiptap/extension-gapcursor";
import { History as Lo } from "@tiptap/extension-history";
import { Link as Do } from "@tiptap/extension-link";
import { Text as Ao } from "@tiptap/extension-text";
import { Plugin as E, NodeSelection as X, PluginKey as L, TextSelection as T, Selection as ue } from "prosemirror-state";
import { CellSelection as ve, addRowBefore as _o, addRowAfter as Oo, addColumnBefore as Ho, addColumnAfter as No, deleteRow as Uo, deleteColumn as Ro, mergeCells as Vo, splitCell as $o, TableMap as qe } from "prosemirror-tables";
import Fo from "rehype-parse";
import zo from "rehype-remark";
import kt from "remark-gfm";
import Go from "remark-stringify";
import { unified as wt } from "unified";
import { fromDom as jo } from "hast-util-from-dom";
import { visit as Ko } from "unist-util-visit";
import { yCursorPlugin as qo, defaultSelectionBuilder as Yo, ySyncPlugin as Wo, yUndoPlugin as Xo, yUndoPluginKey as ae, yCursorPluginKey as Jo, ySyncPluginKey as G, getRelativeSelection as Qo, absolutePositionToRelativePosition as Zo, relativePositionToAbsolutePosition as en, undoCommand as tn, redoCommand as on } from "y-prosemirror";
import { DecorationSet as U, Decoration as $ } from "prosemirror-view";
import { v4 as nn } from "uuid";
import { e as rn } from "./en-njEqD7AG.js";
import sn from "remark-parse";
import an, { defaultHandlers as Ye } from "remark-rehype";
import cn from "rehype-stringify";
import { undo as ln, redo as dn } from "prosemirror-history";
function hn(n, t) {
  const e = [
    {
      tag: `[data-inline-content-type="${n.type}"]`,
      contentElement: (o) => {
        const r = o;
        return r.matches("[data-editable]") ? r : r.querySelector("[data-editable]") || r;
      }
    }
  ];
  return t && e.push({
    tag: "*",
    getAttrs(o) {
      if (typeof o == "string")
        return !1;
      const r = t == null ? void 0 : t(o);
      return r === void 0 ? !1 : r;
    }
  }), e;
}
function li(n, t) {
  var o;
  const e = W.create({
    name: n.type,
    inline: !0,
    group: "inline",
    draggable: (o = t.meta) == null ? void 0 : o.draggable,
    selectable: n.content === "styled",
    atom: n.content === "none",
    content: n.content === "styled" ? "inline*" : "",
    addAttributes() {
      return Qt(n.propSchema);
    },
    addKeyboardShortcuts() {
      return Jt(n);
    },
    parseHTML() {
      return hn(
        n,
        t.parse
      );
    },
    renderHTML({ node: r }) {
      const s = this.options.editor, i = t.render.call(
        { renderType: "dom", props: void 0 },
        me(
          r,
          s.schema.inlineContentSchema,
          s.schema.styleSchema
        ),
        // TODO: fix cast
        () => {
        },
        s
      );
      return Ee(
        i,
        n.type,
        r.attrs,
        n.propSchema
      );
    },
    addNodeView() {
      return (r) => {
        const { node: s, getPos: i } = r, c = this.options.editor, a = t.render.call(
          { renderType: "nodeView", props: r },
          me(
            s,
            c.schema.inlineContentSchema,
            c.schema.styleSchema
          ),
          // TODO: fix cast
          (l) => {
            const d = Y([l], c.pmSchema), u = i();
            u && c.transact(
              (p) => p.replaceWith(u, u + s.nodeSize, d)
            );
          },
          c
        );
        return Ee(
          a,
          n.type,
          s.attrs,
          n.propSchema
        );
      };
    }
  });
  return Zt(
    e,
    n.propSchema,
    {
      toExternalHTML: t.toExternalHTML,
      render(r, s, i) {
        const c = t.render(
          r,
          s,
          i
        );
        return Ee(
          c,
          n.type,
          r.props,
          n.propSchema
        );
      }
    }
  );
}
function un(n, t, e, o = "before") {
  const r = typeof e == "string" ? e : e.id, s = I(n), i = t.map(
    (d) => De(d, s)
  ), c = _(r, n.doc);
  if (!c)
    throw new Error(`Block with ID ${r} not found`);
  let a = c.posBeforeNode;
  return o === "after" && (a += c.node.nodeSize), n.step(
    new Wt(a, a, new q(V.from(i), 0, 0))
  ), i.map(
    (d) => B(d, s)
  );
}
function We(n, t, e) {
  const o = I(n), r = e.map(
    (d) => De(d, o)
  ), s = new Set(
    t.map(
      (d) => typeof d == "string" ? d : d.id
    )
  ), i = [], c = typeof t[0] == "string" ? t[0] : t[0].id;
  let a = 0;
  if (n.doc.descendants((d, u) => {
    if (s.size === 0)
      return !1;
    if (!d.type.isInGroup("bnBlock") || !s.has(d.attrs.id))
      return !0;
    if (i.push(B(d, o)), s.delete(d.attrs.id), e.length > 0 && d.attrs.id === c) {
      const f = n.doc.nodeSize;
      n.insert(u, r);
      const b = n.doc.nodeSize;
      a += f - b;
    }
    const p = n.doc.nodeSize, m = n.doc.resolve(u - a);
    m.node().type.name === "blockGroup" && m.node(m.depth - 1).type.name !== "doc" && m.node().childCount === 1 ? n.delete(m.before(), m.after()) : n.delete(u - a, u - a + d.nodeSize);
    const g = n.doc.nodeSize;
    return a += p - g, !1;
  }), s.size > 0) {
    const d = [...s].join(`
`);
    throw Error(
      "Blocks with the following IDs could not be found in the editor: " + d
    );
  }
  return { insertedBlocks: r.map(
    (d) => B(d, o)
  ), removedBlocks: i };
}
function yt(n) {
  const t = Array.from(n.classList).filter(
    (e) => !e.startsWith("bn-")
  ) || [];
  t.length > 0 ? n.className = t.join(" ") : n.removeAttribute("class");
}
function Ct(n, t, e, o) {
  var c;
  let r;
  if (t)
    if (typeof t == "string")
      r = Y([t], n.pmSchema);
    else if (Array.isArray(t))
      r = Y(t, n.pmSchema);
    else if (t.type === "tableContent")
      r = dt(t, n.pmSchema);
    else
      throw new ne(t.type);
  else throw new Error("blockContent is required");
  const i = ((o == null ? void 0 : o.document) ?? document).createDocumentFragment();
  for (const a of r)
    if (a.type.name !== "text" && n.schema.inlineContentSchema[a.type.name]) {
      const l = n.schema.inlineContentSpecs[a.type.name].implementation;
      if (l) {
        const d = me(
          a,
          n.schema.inlineContentSchema,
          n.schema.styleSchema
        ), u = l.toExternalHTML ? l.toExternalHTML(
          d,
          n
        ) : l.render.call(
          {
            renderType: "dom",
            props: void 0
          },
          d,
          () => {
          },
          n
        );
        if (u) {
          if (i.appendChild(u.dom), u.contentDOM) {
            const p = e.serializeFragment(
              a.content,
              o
            );
            u.contentDOM.dataset.editable = "", u.contentDOM.appendChild(p);
          }
          continue;
        }
      }
    } else if (a.type.name === "text") {
      let l = document.createTextNode(
        a.textContent
      );
      for (const d of a.marks.toReversed())
        if (d.type.name in n.schema.styleSpecs) {
          const u = (n.schema.styleSpecs[d.type.name].implementation.toExternalHTML ?? n.schema.styleSpecs[d.type.name].implementation.render)(d.attrs.stringValue, n);
          u.contentDOM.appendChild(l), l = u.dom;
        } else {
          const u = d.type.spec.toDOM(d, !0), p = we.renderSpec(document, u);
          p.contentDOM.appendChild(l), l = p.dom;
        }
      i.appendChild(l);
    } else {
      const l = e.serializeFragment(
        V.from([a]),
        o
      );
      i.appendChild(l);
    }
  return i.childNodes.length === 1 && ((c = i.firstChild) == null ? void 0 : c.nodeType) === 1 && yt(i.firstChild), i;
}
function pn(n, t, e, o, r, s, i) {
  var b, k, w, D, F, J, Q, Z, ee;
  const c = (i == null ? void 0 : i.document) ?? document, a = t.pmSchema.nodes.blockContainer, l = e.props || {};
  for (const [v, M] of Object.entries(
    t.schema.blockSchema[e.type].propSchema
  ))
    !(v in l) && M.default !== void 0 && (l[v] = M.default);
  const d = (k = (b = a.spec) == null ? void 0 : b.toDOM) == null ? void 0 : k.call(
    b,
    a.create({
      id: e.id,
      ...l
    })
  ), u = Array.from(d.dom.attributes), p = t.blockImplementations[e.type].implementation, m = ((w = p.toExternalHTML) == null ? void 0 : w.call(
    {},
    { ...e, props: l },
    t
  )) || p.render.call(
    {},
    { ...e, props: l },
    t
  ), g = c.createDocumentFragment();
  if (m.dom.classList.contains("bn-block-content")) {
    const v = [
      ...u,
      ...Array.from(m.dom.attributes)
    ].filter(
      (M) => M.name.startsWith("data") && M.name !== "data-content-type" && M.name !== "data-file-block" && M.name !== "data-node-view-wrapper" && M.name !== "data-node-type" && M.name !== "data-id" && M.name !== "data-editable"
    );
    for (const M of v)
      m.dom.firstChild.setAttribute(M.name, M.value);
    yt(m.dom.firstChild), g.append(...Array.from(m.dom.childNodes));
  } else
    g.append(m.dom);
  if (m.contentDOM && e.content) {
    const v = Ct(
      t,
      e.content,
      // TODO
      o,
      i
    );
    m.contentDOM.appendChild(v);
  }
  let f;
  if (r.has(e.type) ? f = "OL" : s.has(e.type) && (f = "UL"), f) {
    if (((D = n.lastChild) == null ? void 0 : D.nodeName) !== f) {
      const v = c.createElement(f);
      f === "OL" && "start" in l && l.start && (l == null ? void 0 : l.start) !== 1 && v.setAttribute("start", l.start + ""), n.append(v);
    }
    n.lastChild.appendChild(g);
  } else
    n.append(g);
  if (e.children && e.children.length > 0) {
    const v = c.createDocumentFragment();
    if (vt(
      v,
      t,
      e.children,
      o,
      r,
      s,
      i
    ), ((F = n.lastChild) == null ? void 0 : F.nodeName) === "UL" || ((J = n.lastChild) == null ? void 0 : J.nodeName) === "OL")
      for (; ((Q = v.firstChild) == null ? void 0 : Q.nodeName) === "UL" || ((Z = v.firstChild) == null ? void 0 : Z.nodeName) === "OL"; )
        n.lastChild.lastChild.appendChild(v.firstChild);
    t.pmSchema.nodes[e.type].isInGroup("blockContent") ? n.append(v) : (ee = m.contentDOM) == null || ee.append(v);
  }
}
const vt = (n, t, e, o, r, s, i) => {
  for (const c of e)
    pn(
      n,
      t,
      c,
      o,
      r,
      s,
      i
    );
}, mn = (n, t, e, o, r, s) => {
  const c = ((s == null ? void 0 : s.document) ?? document).createDocumentFragment();
  return vt(
    c,
    n,
    t,
    e,
    o,
    r,
    s
  ), c;
}, Se = (n, t) => {
  const e = we.fromSchema(n);
  return {
    exportBlocks: (o, r) => {
      const s = mn(
        t,
        o,
        e,
        /* @__PURE__ */ new Set(["numberedListItem"]),
        /* @__PURE__ */ new Set(["bulletListItem", "checkListItem", "toggleListItem"]),
        r
      ), i = document.createElement("div");
      return i.append(s), i.innerHTML;
    },
    exportInlineContent: (o, r) => {
      const s = Ct(
        t,
        o,
        e,
        r
      ), i = document.createElement("div");
      return i.append(s.cloneNode(!0)), i.innerHTML;
    }
  };
};
function fn(n, t, e, o, r) {
  let s;
  if (t)
    if (typeof t == "string")
      s = Y([t], n.pmSchema, o);
    else if (Array.isArray(t))
      s = Y(t, n.pmSchema, o);
    else if (t.type === "tableContent")
      s = dt(t, n.pmSchema);
    else
      throw new ne(t.type);
  else throw new Error("blockContent is required");
  const c = ((r == null ? void 0 : r.document) ?? document).createDocumentFragment();
  for (const a of s)
    if (a.type.name !== "text" && n.schema.inlineContentSchema[a.type.name]) {
      const l = n.schema.inlineContentSpecs[a.type.name].implementation;
      if (l) {
        const d = me(
          a,
          n.schema.inlineContentSchema,
          n.schema.styleSchema
        ), u = l.render.call(
          {
            renderType: "dom",
            props: void 0
          },
          d,
          () => {
          },
          n
        );
        if (u) {
          if (c.appendChild(u.dom), u.contentDOM) {
            const p = e.serializeFragment(
              a.content,
              r
            );
            u.contentDOM.dataset.editable = "", u.contentDOM.appendChild(p);
          }
          continue;
        }
      }
    } else if (a.type.name === "text") {
      let l = document.createTextNode(
        a.textContent
      );
      for (const d of a.marks.toReversed())
        if (d.type.name in n.schema.styleSpecs) {
          const u = n.schema.styleSpecs[d.type.name].implementation.render(d.attrs.stringValue, n);
          u.contentDOM.appendChild(l), l = u.dom;
        } else {
          const u = d.type.spec.toDOM(d, !0), p = we.renderSpec(document, u);
          p.contentDOM.appendChild(l), l = p.dom;
        }
      c.appendChild(l);
    } else {
      const l = e.serializeFragment(
        V.from([a]),
        r
      );
      c.appendChild(l);
    }
  return c;
}
function gn(n, t, e, o) {
  var u, p, m, g, f;
  const r = n.pmSchema.nodes.blockContainer, s = t.props || {};
  for (const [b, k] of Object.entries(
    n.schema.blockSchema[t.type].propSchema
  ))
    !(b in s) && k.default !== void 0 && (s[b] = k.default);
  const i = t.children || [], a = n.blockImplementations[t.type].implementation.render.call(
    {
      renderType: "dom",
      props: void 0
    },
    { ...t, props: s, children: i },
    n
  );
  if (a.contentDOM && t.content) {
    const b = fn(
      n,
      t.content,
      // TODO
      e,
      t.type,
      o
    );
    a.contentDOM.appendChild(b);
  }
  if (n.pmSchema.nodes[t.type].isInGroup("bnBlock")) {
    if (t.children && t.children.length > 0) {
      const b = St(
        n,
        t.children,
        e,
        o
      );
      (u = a.contentDOM) == null || u.append(b);
    }
    return a.dom;
  }
  const d = (m = (p = r.spec) == null ? void 0 : p.toDOM) == null ? void 0 : m.call(
    p,
    r.create({
      id: t.id,
      ...s
    })
  );
  return (g = d.contentDOM) == null || g.appendChild(a.dom), t.children && t.children.length > 0 && ((f = d.contentDOM) == null || f.appendChild(
    Bt(n, t.children, e, o)
  )), d.dom;
}
function St(n, t, e, o) {
  const s = ((o == null ? void 0 : o.document) ?? document).createDocumentFragment();
  for (const i of t) {
    const c = gn(n, i, e, o);
    s.appendChild(c);
  }
  return s;
}
const Bt = (n, t, e, o) => {
  var c;
  const r = n.pmSchema.nodes.blockGroup, s = r.spec.toDOM(r.create({})), i = St(n, t, e, o);
  return (c = s.contentDOM) == null || c.appendChild(i), s.dom;
}, bn = (n, t) => {
  const e = we.fromSchema(n);
  return {
    serializeBlocks: (o, r) => Bt(t, o, e, r).outerHTML
  };
};
function kn(n, t) {
  if (t === 0)
    return;
  const e = n.resolve(t);
  for (let o = e.depth; o > 0; o--) {
    const r = e.node(o);
    if (ht(r))
      return r.attrs.id;
  }
}
function wn(n) {
  return n.getMeta("paste") ? { type: "paste" } : n.getMeta("uiEvent") === "drop" ? { type: "drop" } : n.getMeta("history$") ? {
    type: n.getMeta("history$").redo ? "redo" : "undo"
  } : n.getMeta("y-sync$") ? n.getMeta("y-sync$").isUndoRedoOperation ? { type: "undo-redo" } : { type: "yjs-remote" } : { type: "local" };
}
function Xe(n) {
  const t = "__root__", e = {}, o = {}, r = I(n);
  return n.descendants((s, i) => {
    if (!ht(s))
      return !0;
    const c = kn(n, i), a = c ?? t;
    o[a] || (o[a] = []);
    const l = B(s, r);
    return e[s.attrs.id] = { block: l, parentId: c }, o[a].push(s.attrs.id), !0;
  }), { byId: e, childrenByParent: o };
}
function yn(n, t) {
  const e = /* @__PURE__ */ new Set();
  if (!n || !t)
    return e;
  const o = new Set(n), r = t.filter((f) => o.has(f)), s = n.filter(
    (f) => r.includes(f)
  );
  if (s.length <= 1 || r.length <= 1)
    return e;
  const i = {};
  for (let f = 0; f < s.length; f++)
    i[s[f]] = f;
  const c = r.map((f) => i[f]), a = c.length, l = [], d = [], u = new Array(a).fill(-1), p = (f, b) => {
    let k = 0, w = f.length;
    for (; k < w; ) {
      const D = k + w >>> 1;
      f[D] < b ? k = D + 1 : w = D;
    }
    return k;
  };
  for (let f = 0; f < a; f++) {
    const b = c[f], k = p(l, b);
    k > 0 && (u[f] = d[k - 1]), k === l.length ? (l.push(b), d.push(f)) : (l[k] = b, d[k] = f);
  }
  const m = /* @__PURE__ */ new Set();
  let g = d[d.length - 1] ?? -1;
  for (; g !== -1; )
    m.add(g), g = u[g];
  for (let f = 0; f < r.length; f++)
    m.has(f) || e.add(r[f]);
  return e;
}
function Et(n, t = []) {
  const e = wn(n), o = yo(n.before, [
    n,
    ...t
  ]), r = Xe(
    o.before
  ), s = Xe(
    o.doc
  ), i = [], c = /* @__PURE__ */ new Set();
  Object.keys(s.byId).filter((m) => !(m in r.byId)).forEach((m) => {
    i.push({
      type: "insert",
      block: s.byId[m].block,
      source: e,
      prevBlock: void 0
    }), c.add(m);
  }), Object.keys(r.byId).filter((m) => !(m in s.byId)).forEach((m) => {
    i.push({
      type: "delete",
      block: r.byId[m].block,
      source: e,
      prevBlock: void 0
    }), c.add(m);
  }), Object.keys(s.byId).filter((m) => m in r.byId).forEach((m) => {
    var k, w;
    const g = r.byId[m], f = s.byId[m];
    g.parentId !== f.parentId ? (i.push({
      type: "move",
      block: f.block,
      prevBlock: g.block,
      source: e,
      prevParent: g.parentId ? (k = r.byId[g.parentId]) == null ? void 0 : k.block : void 0,
      currentParent: f.parentId ? (w = s.byId[f.parentId]) == null ? void 0 : w.block : void 0
    }), c.add(m)) : To(
      { ...g.block, children: void 0 },
      { ...f.block, children: void 0 }
    ) || (i.push({
      type: "update",
      block: f.block,
      prevBlock: g.block,
      source: e
    }), c.add(m));
  });
  const a = r.childrenByParent, l = s.childrenByParent, d = "__root__", u = /* @__PURE__ */ new Set([
    ...Object.keys(a),
    ...Object.keys(l)
  ]), p = /* @__PURE__ */ new Set();
  return u.forEach((m) => {
    const g = yn(
      a[m],
      l[m]
    );
    g.size !== 0 && g.forEach((f) => {
      var D, F;
      const b = r.byId[f], k = s.byId[f];
      !b || !k || b.parentId !== k.parentId || c.has(f) || (b.parentId ?? d) !== m || p.has(f) || (p.add(f), i.push({
        type: "move",
        block: k.block,
        prevBlock: b.block,
        source: e,
        prevParent: b.parentId ? (D = r.byId[b.parentId]) == null ? void 0 : D.block : void 0,
        currentParent: k.parentId ? (F = s.byId[k.parentId]) == null ? void 0 : F.block : void 0
      }), c.add(f));
    });
  }), i;
}
const Oe = [
  "vscode-editor-data",
  "blocknote/html",
  "text/markdown",
  "text/html",
  "text/plain",
  "Files"
];
function Cn(n, t) {
  if (!n.startsWith(".") || !t.startsWith("."))
    throw new Error("The strings provided are not valid file extensions.");
  return n === t;
}
function vn(n, t) {
  const e = n.split("/"), o = t.split("/");
  if (e.length !== 2)
    throw new Error(`The string ${n} is not a valid MIME type.`);
  if (o.length !== 2)
    throw new Error(`The string ${t} is not a valid MIME type.`);
  return e[1] === "*" || o[1] === "*" ? e[0] === o[0] : (e[0] === "*" || o[0] === "*" || e[0] === o[0]) && e[1] === o[1];
}
function Je(n, t, e, o = "after") {
  let r;
  return Array.isArray(t.content) && t.content.length === 0 ? r = n.updateBlock(t, e).id : r = n.insertBlocks(
    [e],
    t,
    o
  )[0].id, r;
}
async function Mt(n, t) {
  var s;
  if (!t.uploadFile) {
    console.warn(
      "Attempted ot insert file, but uploadFile is not set in the BlockNote editor options"
    );
    return;
  }
  const e = "dataTransfer" in n ? n.dataTransfer : n.clipboardData;
  if (e === null)
    return;
  let o = null;
  for (const i of Oe)
    if (e.types.includes(i)) {
      o = i;
      break;
    }
  if (o !== "Files")
    return;
  const r = e.items;
  if (r) {
    n.preventDefault();
    for (let i = 0; i < r.length; i++) {
      let c = "file";
      for (const l of Object.values(t.schema.blockSpecs))
        for (const d of ((s = l.implementation.meta) == null ? void 0 : s.fileBlockAccept) || []) {
          const u = d.startsWith("."), p = r[i].getAsFile();
          if (p && (!u && p.type && vn(r[i].type, d) || u && Cn(
            "." + p.name.split(".").pop(),
            d
          ))) {
            c = l.config.type;
            break;
          }
        }
      const a = r[i].getAsFile();
      if (a) {
        const l = {
          type: c,
          props: {
            name: a.name
          }
        };
        let d;
        if (n.type === "paste") {
          const m = t.getTextCursorPosition().block;
          d = Je(t, m, l);
        } else if (n.type === "drop") {
          const m = {
            left: n.clientX,
            top: n.clientY
          }, g = t.prosemirrorView.posAtCoords(m);
          if (!g)
            return;
          d = t.transact((f) => {
            const b = re(f.doc, g.pos), k = t.prosemirrorView.dom.querySelector(
              `[data-id="${b.node.attrs.id}"]`
            ), w = k == null ? void 0 : k.getBoundingClientRect();
            return Je(
              t,
              t.getBlock(b.node.attrs.id),
              l,
              w && (w.top + w.bottom) / 2 > m.top ? "before" : "after"
            );
          });
        } else
          return;
        const u = await t.uploadFile(a, d), p = typeof u == "string" ? {
          props: {
            url: u
          }
        } : { ...u };
        t.updateBlock(d, p);
      }
    }
  }
}
const Sn = (n) => O.create({
  name: "dropFile",
  addProseMirrorPlugins() {
    return [
      new E({
        props: {
          handleDOMEvents: {
            drop(t, e) {
              if (!n.isEditable)
                return;
              let o = null;
              for (const r of Oe)
                if (e.dataTransfer.types.includes(r)) {
                  o = r;
                  break;
                }
              return o === null ? !0 : o === "Files" ? (Mt(e, n), !0) : !1;
            }
          }
        }
      })
    ];
  }
}), Bn = /(^|\n) {0,3}#{1,6} {1,8}[^\n]{1,64}\r?\n\r?\n\s{0,32}\S/, En = /(_|__|\*|\*\*|~~|==|\+\+)(?!\s)(?:[^\s](?:.{0,62}[^\s])?|\S)(?=\1)/, Mn = /\[[^\]]{1,128}\]\(https?:\/\/\S{1,999}\)/, Pn = /(?:\s|^)`(?!\s)(?:[^\s`](?:[^`]{0,46}[^\s`])?|[^\s`])`([^\w]|$)/, Tn = /(?:^|\n)\s{0,5}-\s{1}[^\n]+\n\s{0,15}-\s/, xn = /(?:^|\n)\s{0,5}\d+\.\s{1}[^\n]+\n\s{0,15}\d+\.\s/, In = /\n{2} {0,3}-{2,48}\n{2}/, Ln = /(?:\n|^)(```|~~~|\$\$)(?!`|~)[^\s]{0,64} {0,64}[^\n]{0,64}\n[\s\S]{0,9999}?\s*\1 {0,64}(?:\n+|$)/, Dn = /(?:\n|^)(?!\s)\w[^\n]{0,64}\r?\n(-|=)\1{0,64}\n\n\s{0,64}(\w|$)/, An = /(?:^|(\r?\n\r?\n))( {0,3}>[^\n]{1,333}\n){1,999}($|(\r?\n))/, _n = /^\s*\|(.+\|)+\s*$/m, On = /^\s*\|(\s*[-:]+[-:]\s*\|)+\s*$/m, Hn = /^\s*\|(.+\|)+\s*$/m, Nn = (n) => Bn.test(n) || En.test(n) || Mn.test(n) || Pn.test(n) || Tn.test(n) || xn.test(n) || In.test(n) || Ln.test(n) || Dn.test(n) || An.test(n) || _n.test(n) || On.test(n) || Hn.test(n);
async function Un(n, t) {
  const { schema: e } = t.state;
  if (!n.clipboardData)
    return !1;
  const o = n.clipboardData.getData("text/plain");
  if (!o)
    return !1;
  if (!e.nodes.codeBlock)
    return t.pasteText(o), !0;
  const r = n.clipboardData.getData("vscode-editor-data"), s = r ? JSON.parse(r) : void 0, i = s == null ? void 0 : s.mode;
  return i ? (t.pasteHTML(
    `<pre><code class="language-${i}">${o.replace(
      /\r\n?/g,
      `
`
    )}</code></pre>`
  ), !0) : !1;
}
function Rn({
  event: n,
  editor: t,
  prioritizeMarkdownOverHTML: e,
  plainTextAsMarkdown: o
}) {
  var c;
  if (t.transact(
    (a) => a.selection.$from.parent.type.spec.code && a.selection.$to.parent.type.spec.code
  )) {
    const a = (c = n.clipboardData) == null ? void 0 : c.getData("text/plain");
    if (a)
      return t.pasteText(a), !0;
  }
  let s;
  for (const a of Oe)
    if (n.clipboardData.types.includes(a)) {
      s = a;
      break;
    }
  if (!s)
    return !0;
  if (s === "vscode-editor-data")
    return Un(n, t.prosemirrorView), !0;
  if (s === "Files")
    return Mt(n, t), !0;
  const i = n.clipboardData.getData(s);
  if (s === "blocknote/html")
    return t.pasteHTML(i, !0), !0;
  if (s === "text/markdown")
    return t.pasteMarkdown(i), !0;
  if (e) {
    const a = n.clipboardData.getData("text/plain");
    if (Nn(a))
      return t.pasteMarkdown(a), !0;
  }
  return s === "text/html" ? (t.pasteHTML(i), !0) : o ? (t.pasteMarkdown(i), !0) : (t.pasteText(i), !0);
}
const Vn = (n, t) => O.create({
  name: "pasteFromClipboard",
  addProseMirrorPlugins() {
    return [
      new E({
        props: {
          handleDOMEvents: {
            paste(e, o) {
              if (o.preventDefault(), !!n.isEditable)
                return t({
                  event: o,
                  editor: n,
                  defaultPasteHandler: ({
                    prioritizeMarkdownOverHTML: r = !0,
                    plainTextAsMarkdown: s = !0
                  } = {}) => Rn({
                    event: o,
                    editor: n,
                    prioritizeMarkdownOverHTML: r,
                    plainTextAsMarkdown: s
                  })
                });
            }
          }
        }
      })
    ];
  }
});
function $n() {
  const n = (t) => {
    let e = t.children.length;
    for (let o = 0; o < e; o++) {
      const r = t.children[o];
      if (r.type === "element" && (n(r), r.tagName === "u"))
        if (r.children.length > 0) {
          t.children.splice(o, 1, ...r.children);
          const s = r.children.length - 1;
          e += s, o += s;
        } else
          t.children.splice(o, 1), e--, o--;
    }
  };
  return n;
}
function Fn() {
  const n = (t) => {
    var e;
    if (t.children && "length" in t.children && t.children.length)
      for (let o = t.children.length - 1; o >= 0; o--) {
        const r = t.children[o], s = o + 1 < t.children.length ? t.children[o + 1] : void 0;
        r.type === "element" && r.tagName === "input" && ((e = r.properties) == null ? void 0 : e.type) === "checkbox" && (s == null ? void 0 : s.type) === "element" && s.tagName === "p" ? (s.tagName = "span", s.children.splice(
          0,
          0,
          jo(document.createTextNode(" "))
        )) : n(r);
      }
  };
  return n;
}
function zn() {
  return (n) => {
    Ko(n, "element", (t, e, o) => {
      var r, s, i, c;
      if (o && t.tagName === "video") {
        const a = ((r = t.properties) == null ? void 0 : r.src) || ((s = t.properties) == null ? void 0 : s["data-url"]) || "", l = ((i = t.properties) == null ? void 0 : i.title) || ((c = t.properties) == null ? void 0 : c["data-name"]) || "";
        o.children[e] = {
          type: "text",
          value: `![${l}](${a})`
        };
      }
    });
  };
}
function He(n) {
  return wt().use(Fo, { fragment: !0 }).use(zn).use($n).use(Fn).use(zo).use(kt).use(Go, {
    handlers: { text: (e) => e.value }
  }).processSync(n).value;
}
function Gn(n, t, e, o) {
  const s = Se(t, e).exportBlocks(n, o);
  return He(s);
}
function Pt(n) {
  const t = [];
  return n.descendants((e) => {
    var r, s;
    const o = I(e);
    return e.type.name === "blockContainer" && ((r = e.firstChild) == null ? void 0 : r.type.name) === "blockGroup" ? !0 : e.type.name === "columnList" && e.childCount === 1 ? ((s = e.firstChild) == null || s.forEach((i) => {
      t.push(B(i, o));
    }), !1) : e.type.isInGroup("bnBlock") ? (t.push(B(e, o)), !1) : !0;
  }), t;
}
function jn(n, t, e) {
  var c;
  let o = !1;
  const r = n.state.selection instanceof ve;
  if (!r) {
    const a = n.state.doc.slice(
      n.state.selection.from,
      n.state.selection.to,
      !1
    ).content, l = [];
    for (let d = 0; d < a.childCount; d++)
      l.push(a.child(d));
    o = l.find(
      (d) => d.type.isInGroup("bnBlock") || d.type.name === "blockGroup" || d.type.spec.group === "blockContent"
    ) === void 0, o && (t = a);
  }
  let s;
  const i = Se(
    n.state.schema,
    e
  );
  if (r) {
    ((c = t.firstChild) == null ? void 0 : c.type.name) === "table" && (t = t.firstChild.content);
    const a = eo(
      t,
      e.schema.inlineContentSchema,
      e.schema.styleSchema
    );
    s = `<table>${i.exportInlineContent(
      a,
      {}
    )}</table>`;
  } else if (o) {
    const a = to(
      t,
      e.schema.inlineContentSchema,
      e.schema.styleSchema
    );
    s = i.exportInlineContent(a, {});
  } else {
    const a = Pt(t);
    s = i.exportBlocks(a, {});
  }
  return s;
}
function Tt(n, t) {
  "node" in n.state.selection && n.state.selection.node.type.spec.group === "blockContent" && t.transact(
    (i) => i.setSelection(
      new X(i.doc.resolve(n.state.selection.from - 1))
    )
  );
  const e = n.serializeForClipboard(
    n.state.selection.content()
  ).dom.innerHTML, o = n.state.selection.content().content, r = jn(
    n,
    o,
    t
  ), s = He(r);
  return { clipboardHTML: e, externalHTML: r, markdown: s };
}
const Qe = () => {
  const n = window.getSelection();
  if (!n || n.isCollapsed)
    return !0;
  let t = n.focusNode;
  for (; t; ) {
    if (t instanceof HTMLElement && t.getAttribute("contenteditable") === "false")
      return !0;
    t = t.parentElement;
  }
  return !1;
}, Ze = (n, t, e) => {
  e.preventDefault(), e.clipboardData.clearData();
  const { clipboardHTML: o, externalHTML: r, markdown: s } = Tt(
    t,
    n
  );
  e.clipboardData.setData("blocknote/html", o), e.clipboardData.setData("text/html", r), e.clipboardData.setData("text/plain", s);
}, Kn = (n) => O.create({
  name: "copyToClipboard",
  addProseMirrorPlugins() {
    return [
      new E({
        props: {
          handleDOMEvents: {
            copy(t, e) {
              return Qe() || Ze(n, t, e), !0;
            },
            cut(t, e) {
              return Qe() || (Ze(n, t, e), t.editable && t.dispatch(t.state.tr.deleteSelection())), !0;
            },
            // This is for the use-case in which only a block without content
            // is selected, e.g. an image block, and dragged (not using the
            // drag handle).
            dragstart(t, e) {
              if (!("node" in t.state.selection) || t.state.selection.node.type.spec.group !== "blockContent")
                return;
              n.transact(
                (i) => i.setSelection(
                  new X(
                    i.doc.resolve(t.state.selection.from - 1)
                  )
                )
              ), e.preventDefault(), e.dataTransfer.clearData();
              const { clipboardHTML: o, externalHTML: r, markdown: s } = Tt(t, n);
              return e.dataTransfer.setData("blocknote/html", o), e.dataTransfer.setData("text/html", r), e.dataTransfer.setData("text/plain", s), !0;
            }
          }
        }
      })
    ];
  }
}), qn = O.create({
  name: "blockBackgroundColor",
  addGlobalAttributes() {
    return [
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          backgroundColor: oo()
        }
      }
    ];
  }
});
class Yn extends S {
  constructor() {
    super();
    h(this, "beforeChangeCallbacks", []);
    this.addProsemirrorPlugin(
      new E({
        key: new L("blockChange"),
        filterTransaction: (e) => {
          let o;
          return this.beforeChangeCallbacks.reduce((r, s) => r === !1 ? r : s({
            getChanges() {
              return o || (o = Et(e), o);
            },
            tr: e
          }) !== !1, !0);
        }
      })
    );
  }
  static key() {
    return "blockChange";
  }
  subscribe(e) {
    return this.beforeChangeCallbacks.push(e), () => {
      this.beforeChangeCallbacks = this.beforeChangeCallbacks.filter(
        (o) => o !== e
      );
    };
  }
}
const j = class j extends S {
  constructor(e) {
    super();
    h(this, "provider");
    h(this, "recentlyUpdatedCursors");
    h(this, "renderCursor", (e, o) => {
      let r = this.recentlyUpdatedCursors.get(o);
      if (!r) {
        const s = (this.collaboration.renderCursor ?? j.defaultCursorRender)(e);
        this.collaboration.showCursorLabels !== "always" && (s.addEventListener("mouseenter", () => {
          const i = this.recentlyUpdatedCursors.get(o);
          i.element.setAttribute("data-active", ""), i.hideTimeout && (clearTimeout(i.hideTimeout), this.recentlyUpdatedCursors.set(o, {
            element: i.element,
            hideTimeout: void 0
          }));
        }), s.addEventListener("mouseleave", () => {
          const i = this.recentlyUpdatedCursors.get(o);
          this.recentlyUpdatedCursors.set(o, {
            element: i.element,
            hideTimeout: setTimeout(() => {
              i.element.removeAttribute("data-active");
            }, 2e3)
          });
        })), r = {
          element: s,
          hideTimeout: void 0
        }, this.recentlyUpdatedCursors.set(o, r);
      }
      return r.element;
    });
    h(this, "updateUser", (e) => {
      this.provider.awareness.setLocalStateField("user", e);
    });
    this.collaboration = e, this.provider = e.provider, this.recentlyUpdatedCursors = /* @__PURE__ */ new Map(), this.provider.awareness.setLocalStateField("user", e.user), e.showCursorLabels !== "always" && this.provider.awareness.on(
      "change",
      ({
        updated: o
      }) => {
        for (const r of o) {
          const s = this.recentlyUpdatedCursors.get(r);
          s && (s.element.setAttribute("data-active", ""), s.hideTimeout && clearTimeout(s.hideTimeout), this.recentlyUpdatedCursors.set(r, {
            element: s.element,
            hideTimeout: setTimeout(() => {
              s.element.removeAttribute("data-active");
            }, 2e3)
          }));
        }
      }
    ), this.addProsemirrorPlugin(
      qo(this.provider.awareness, {
        selectionBuilder: Yo,
        cursorBuilder: this.renderCursor
      })
    );
  }
  static key() {
    return "yCursorPlugin";
  }
  get priority() {
    return 999;
  }
  /**
   * Determine whether the foreground color should be white or black based on a provided background color
   * Inspired by: https://stackoverflow.com/a/3943023
   *
   */
  static isDarkColor(e) {
    const o = e.charAt(0) === "#" ? e.substring(1, 7) : e, r = parseInt(o.substring(0, 2), 16), s = parseInt(o.substring(2, 4), 16), i = parseInt(o.substring(4, 6), 16), a = [r / 255, s / 255, i / 255].map((d) => d <= 0.03928 ? d / 12.92 : Math.pow((d + 0.055) / 1.055, 2.4));
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2] <= 0.179;
  }
};
h(j, "defaultCursorRender", (e) => {
  const o = document.createElement("span");
  o.classList.add("bn-collaboration-cursor__base");
  const r = document.createElement("span");
  r.setAttribute("contentedEditable", "false"), r.classList.add("bn-collaboration-cursor__caret"), r.setAttribute(
    "style",
    `background-color: ${e.color}; color: ${j.isDarkColor(e.color) ? "white" : "black"}`
  );
  const s = document.createElement("span");
  return s.classList.add("bn-collaboration-cursor__label"), s.setAttribute(
    "style",
    `background-color: ${e.color}; color: ${j.isDarkColor(e.color) ? "white" : "black"}`
  ), s.insertBefore(document.createTextNode(e.name), null), r.insertBefore(s, null), o.insertBefore(document.createTextNode("⁠"), null), o.insertBefore(r, null), o.insertBefore(document.createTextNode("⁠"), null), o;
});
let se = j;
class ge extends S {
  static key() {
    return "ySyncPlugin";
  }
  constructor(t) {
    super(), this.addProsemirrorPlugin(Wo(t));
  }
  get priority() {
    return 1001;
  }
}
class be extends S {
  static key() {
    return "yUndoPlugin";
  }
  constructor({ editor: t }) {
    super(), this.addProsemirrorPlugin(Xo({ trackedOrigins: [t] }));
  }
  get priority() {
    return 1e3;
  }
}
class xt extends S {
  constructor({
    editor: e,
    collaboration: o
  }) {
    super(e);
    h(this, "editor");
    h(this, "collaboration");
    /**
     * Stores whether the editor is editing a forked document,
     * preserving a reference to the original document and the forked document.
     */
    h(this, "forkedState");
    this.editor = e, this.collaboration = o;
  }
  static key() {
    return "ForkYDocPlugin";
  }
  /**
   * To find a fragment in another ydoc, we need to search for it.
   */
  findTypeInOtherYdoc(e, o) {
    const r = e.doc;
    if (e._item === null) {
      const s = Array.from(r.share.keys()).find(
        (i) => r.share.get(i) === e
      );
      if (s == null)
        throw new Error("type does not exist in other ydoc");
      return o.get(s, e.constructor);
    } else {
      const s = e._item, i = o.store.clients.get(s.id.client) ?? [], c = R.findIndexSS(i, s.id.clock);
      return i[c].content.type;
    }
  }
  /**
   * Whether the editor is editing a forked document,
   * preserving a reference to the original document and the forked document.
   */
  get isForkedFromRemote() {
    return this.forkedState !== void 0;
  }
  /**
   * Fork the Y.js document from syncing to the remote,
   * allowing modifications to the document without affecting the remote.
   * These changes can later be rolled back or applied to the remote.
   */
  fork() {
    var s;
    if (this.isForkedFromRemote)
      return;
    const e = (s = this.collaboration) == null ? void 0 : s.fragment;
    if (!e)
      throw new Error("No fragment to fork from");
    const o = new R.Doc();
    R.applyUpdate(o, R.encodeStateAsUpdate(e.doc));
    const r = this.findTypeInOtherYdoc(e, o);
    this.forkedState = {
      undoStack: ae.getState(this.editor.prosemirrorState).undoManager.undoStack,
      originalFragment: e,
      forkedFragment: r
    }, this.editor._tiptapEditor.unregisterPlugin([
      Jo,
      ae,
      G
    ]), this.editor._tiptapEditor.registerPlugin(
      new ge(r).plugins[0]
    ), this.editor._tiptapEditor.registerPlugin(
      new be({ editor: this.editor }).plugins[0]
    ), this.emit("forked", !0);
  }
  /**
   * Resume syncing the Y.js document to the remote
   * If `keepChanges` is true, any changes that have been made to the forked document will be applied to the original document.
   * Otherwise, the original document will be restored and the changes will be discarded.
   */
  merge({ keepChanges: e }) {
    if (!this.forkedState)
      return;
    this.editor._tiptapEditor.unregisterPlugin(G), this.editor._tiptapEditor.unregisterPlugin(ae);
    const { originalFragment: o, forkedFragment: r, undoStack: s } = this.forkedState;
    if (this.editor.extensions.ySyncPlugin = new ge(o), this.editor.extensions.yCursorPlugin = new se(
      this.collaboration
    ), this.editor.extensions.yUndoPlugin = new be({
      editor: this.editor
    }), this.editor._tiptapEditor.registerPlugin(
      this.editor.extensions.ySyncPlugin.plugins[0]
    ), this.editor._tiptapEditor.registerPlugin(
      this.editor.extensions.yCursorPlugin.plugins[0]
    ), this.editor._tiptapEditor.registerPlugin(
      this.editor.extensions.yUndoPlugin.plugins[0]
    ), ae.getState(
      this.editor.prosemirrorState
    ).undoManager.undoStack = s, e) {
      const i = R.encodeStateAsUpdate(
        r.doc,
        R.encodeStateVector(o.doc)
      );
      R.applyUpdate(o.doc, i, this.editor);
    }
    this.forkedState = void 0, this.emit("forked", !1);
  }
}
const It = (n, t) => {
  t(n), n.forEach((e) => {
    e instanceof R.XmlElement && It(e, t);
  });
}, Wn = (n, t) => {
  const e = {};
  n.forEach((o) => {
    o instanceof R.XmlElement && It(o, (r) => {
      if (r.nodeName === "blockContainer" && r.hasAttribute("id")) {
        const s = {
          textColor: r.getAttribute("textColor"),
          backgroundColor: r.getAttribute("backgroundColor")
        };
        s.textColor === $e.textColor.default && (s.textColor = void 0), s.backgroundColor === $e.backgroundColor.default && (s.backgroundColor = void 0), (s.textColor || s.backgroundColor) && (e[r.getAttribute("id")] = s);
      }
    });
  }), t.doc.descendants((o, r) => {
    o.type.name === "blockContainer" && e[o.attrs.id] && (t = t.setNodeMarkup(
      r + 1,
      void 0,
      e[o.attrs.id]
    ));
  });
}, Xn = [Wn];
class Ne extends S {
  constructor(e) {
    const o = new L(Ne.key());
    super();
    h(this, "migrationDone", !1);
    this.addProsemirrorPlugin(
      new E({
        key: o,
        appendTransaction: (r, s, i) => {
          if (this.migrationDone || r.length !== 1 || !r[0].getMeta(G))
            return;
          const c = i.tr;
          for (const a of Xn)
            a(e, c);
          return this.migrationDone = !0, c;
        }
      })
    );
  }
  static key() {
    return "schemaMigrationPlugin";
  }
}
const ke = ie.create({
  name: "comment",
  excludes: "",
  inclusive: !1,
  keepOnSplit: !0,
  addAttributes() {
    return {
      // orphans are marks that currently don't have an active thread. It could be
      // that users have resolved the thread. Resolved threads by default are not shown in the document,
      // but we need to keep the mark (positioning) data so we can still "revive" it when the thread is unresolved
      // or we enter a "comments" view that includes resolved threads.
      orphan: {
        parseHTML: (n) => !!n.getAttribute("data-orphan"),
        renderHTML: (n) => n.orphan ? {
          "data-orphan": "true"
        } : {},
        default: !1
      },
      threadId: {
        parseHTML: (n) => n.getAttribute("data-bn-thread-id"),
        renderHTML: (n) => ({
          "data-bn-thread-id": n.threadId
        }),
        default: ""
      }
    };
  },
  renderHTML({ HTMLAttributes: n }) {
    return [
      "span",
      bt(n, {
        class: "bn-thread-mark"
      })
    ];
  },
  parseHTML() {
    return [{ tag: "span.bn-thread-mark" }];
  },
  extendMarkSchema(n) {
    return n.name === "comment" ? {
      blocknoteIgnore: !0
    } : {};
  }
});
class Jn extends Ae {
  constructor(e) {
    super();
    h(this, "userCache", /* @__PURE__ */ new Map());
    // avoid duplicate loads
    h(this, "loadingUsers", /* @__PURE__ */ new Set());
    this.resolveUsers = e;
  }
  /**
   * Load information about users based on an array of user ids.
   */
  async loadUsers(e) {
    const o = e.filter(
      (r) => !this.userCache.has(r) && !this.loadingUsers.has(r)
    );
    if (o.length !== 0) {
      for (const r of o)
        this.loadingUsers.add(r);
      try {
        const r = await this.resolveUsers(o);
        for (const s of r)
          this.userCache.set(s.id, s);
        this.emit("update", this.userCache);
      } finally {
        for (const r of o)
          this.loadingUsers.delete(r);
      }
    }
  }
  /**
   * Retrieve information about a user based on their id, if cached.
   *
   * The user will have to be loaded via `loadUsers` first
   */
  getUser(e) {
    return this.userCache.get(e);
  }
  /**
   * Subscribe to changes in the user store.
   *
   * @param cb - The callback to call when the user store changes.
   * @returns A function to unsubscribe from the user store.
   */
  subscribe(e) {
    return this.on("update", e);
  }
}
const ce = new L("blocknote-comments"), Qn = "SET_SELECTED_THREAD_ID";
function Zn(n, t) {
  const e = /* @__PURE__ */ new Map();
  return n.descendants((o, r) => {
    o.marks.forEach((s) => {
      if (s.type.name === t) {
        const i = s.attrs.threadId;
        if (!i)
          return;
        const c = r, a = c + o.nodeSize, l = e.get(i) ?? {
          from: 1 / 0,
          to: 0
        };
        e.set(i, {
          from: Math.min(c, l.from),
          to: Math.max(a, l.to)
        });
      }
    });
  }), e;
}
class Lt extends S {
  constructor(e, o, r, s, i) {
    super();
    h(this, "userStore");
    /**
     * Whether a comment is currently being composed
     */
    h(this, "pendingComment", !1);
    /**
     * The currently selected thread id
     */
    h(this, "selectedThreadId");
    /**
     * Store the positions of all threads in the document.
     * this can be used later to implement a floating sidebar
     */
    h(this, "threadPositions", /* @__PURE__ */ new Map());
    /**
     * when a thread is resolved or deleted, we need to update the marks to reflect the new state
     */
    h(this, "updateMarksFromThreads", (e) => {
      this.editor.transact((o) => {
        o.doc.descendants((r, s) => {
          r.marks.forEach((i) => {
            if (i.type.name === this.markType) {
              const c = i.type, a = i.attrs.threadId, l = e.get(a), d = !!(!l || l.resolved || l.deletedAt);
              if (d !== i.attrs.orphan) {
                const u = Math.max(s, 0), p = Math.min(
                  s + r.nodeSize,
                  o.doc.content.size - 1,
                  o.doc.content.size - 1
                );
                o.removeMark(u, p, i), o.addMark(
                  u,
                  p,
                  c.create({
                    ...i.attrs,
                    orphan: d
                  })
                ), d && this.selectedThreadId === a && (this.selectedThreadId = void 0, this.emitStateUpdate());
              }
            }
          });
        });
      });
    });
    if (this.editor = e, this.threadStore = o, this.markType = r, this.resolveUsers = s, this.commentEditorSchema = i, !s)
      throw new Error("resolveUsers is required for comments");
    this.userStore = new Jn(s), this.threadStore.subscribe(this.updateMarksFromThreads), e.onCreate(() => {
      this.updateMarksFromThreads(this.threadStore.getThreads()), e.onSelectionChange(() => {
        this.pendingComment && (this.pendingComment = !1, this.emitStateUpdate());
      });
    });
    const c = this;
    this.addProsemirrorPlugin(
      new E({
        key: ce,
        state: {
          init() {
            return {
              decorations: U.empty
            };
          },
          apply(a, l) {
            const d = a.getMeta(ce);
            if (!a.docChanged && !d)
              return l;
            const u = a.docChanged ? Zn(a.doc, c.markType) : c.threadPositions;
            (u.size > 0 || c.threadPositions.size > 0) && (c.threadPositions = u, c.emitStateUpdate());
            const p = [];
            if (c.selectedThreadId) {
              const m = u.get(
                c.selectedThreadId
              );
              m && p.push(
                $.inline(
                  m.from,
                  m.to,
                  {
                    class: "bn-thread-mark-selected"
                  }
                )
              );
            }
            return {
              decorations: U.create(a.doc, p)
            };
          }
        },
        props: {
          decorations(a) {
            var l;
            return ((l = ce.getState(a)) == null ? void 0 : l.decorations) ?? U.empty;
          },
          /**
           * Handle click on a thread mark and mark it as selected
           */
          handleClick: (a, l, d) => {
            if (d.button !== 0)
              return;
            const u = a.state.doc.nodeAt(l);
            if (!u) {
              c.selectThread(void 0);
              return;
            }
            const p = u.marks.find(
              (g) => g.type.name === r && g.attrs.orphan !== !0
            ), m = p == null ? void 0 : p.attrs.threadId;
            c.selectThread(m, !1);
          }
        }
      })
    );
  }
  static key() {
    return "comments";
  }
  emitStateUpdate() {
    this.emit("update", {
      selectedThreadId: this.selectedThreadId,
      pendingComment: this.pendingComment,
      threadPositions: this.threadPositions
    });
  }
  /**
   * Subscribe to state updates
   */
  onUpdate(e) {
    return this.on("update", e);
  }
  /**
   * Set the selected thread
   */
  selectThread(e, o = !0) {
    var r, s;
    if (this.selectedThreadId !== e && (this.selectedThreadId = e, this.emitStateUpdate(), this.editor.transact(
      (i) => i.setMeta(ce, {
        name: Qn
      })
    ), e && o)) {
      const i = this.threadPositions.get(e);
      if (!i)
        return;
      (s = (r = this.editor.prosemirrorView) == null ? void 0 : r.domAtPos(i.from).node) == null || s.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }
  /**
   * Start a pending comment (e.g.: when clicking the "Add comment" button)
   */
  startPendingComment() {
    this.pendingComment = !0, this.emitStateUpdate();
  }
  /**
   * Stop a pending comment (e.g.: user closes the comment composer)
   */
  stopPendingComment() {
    this.pendingComment = !1, this.emitStateUpdate();
  }
  /**
   * Create a thread at the current selection
   */
  async createThread(e) {
    const o = await this.threadStore.createThread(e);
    if (this.threadStore.addThreadToDocument) {
      const r = this.editor.prosemirrorView, s = r.state.selection, i = G.getState(r.state), c = {
        prosemirror: {
          head: s.head,
          anchor: s.anchor
        },
        yjs: i ? Qo(i.binding, r.state) : void 0
        // if we're not using yjs
      };
      await this.threadStore.addThreadToDocument({
        threadId: o.id,
        selection: c
      });
    } else
      this.editor._tiptapEditor.commands.setMark(this.markType, {
        orphan: !1,
        threadId: o.id
      });
  }
}
class er {
  constructor(t, e, o, r) {
    h(this, "state");
    h(this, "emitUpdate");
    h(this, "mouseDownHandler", () => {
      var t;
      (t = this.state) != null && t.show && (this.state.show = !1, this.emitUpdate());
    });
    // For dragging the whole editor.
    h(this, "dragstartHandler", () => {
      var t;
      (t = this.state) != null && t.show && (this.state.show = !1, this.emitUpdate());
    });
    h(this, "scrollHandler", () => {
      var t;
      if ((t = this.state) != null && t.show) {
        const e = this.pmView.root.querySelector(
          `[data-node-type="blockContainer"][data-id="${this.state.block.id}"]`
        );
        if (!e)
          return;
        this.state.referencePos = e.getBoundingClientRect(), this.emitUpdate();
      }
    });
    h(this, "closeMenu", () => {
      var t;
      (t = this.state) != null && t.show && (this.state.show = !1, this.emitUpdate());
    });
    this.editor = t, this.pluginKey = e, this.pmView = o, this.emitUpdate = () => {
      if (!this.state)
        throw new Error("Attempting to update uninitialized file panel");
      r(this.state);
    }, o.dom.addEventListener("mousedown", this.mouseDownHandler), o.dom.addEventListener("dragstart", this.dragstartHandler), o.root.addEventListener("scroll", this.scrollHandler, !0);
  }
  update(t, e) {
    var c, a;
    const o = this.pluginKey.getState(t.state), r = this.pluginKey.getState(e);
    if (!((c = this.state) != null && c.show) && (o != null && o.block) && this.editor.isEditable) {
      const l = this.pmView.root.querySelector(
        `[data-node-type="blockContainer"][data-id="${o.block.id}"]`
      );
      if (!l)
        return;
      this.state = {
        show: !0,
        referencePos: l.getBoundingClientRect(),
        block: o.block
      }, this.emitUpdate();
      return;
    }
    const s = (o == null ? void 0 : o.block) && !(r != null && r.block), i = !(o != null && o.block) && (r == null ? void 0 : r.block);
    s && this.state && !this.state.show && (this.state.show = !0, this.emitUpdate()), i && ((a = this.state) != null && a.show) && (this.state.show = !1, this.emitUpdate());
  }
  destroy() {
    this.pmView.dom.removeEventListener("mousedown", this.mouseDownHandler), this.pmView.dom.removeEventListener("dragstart", this.dragstartHandler), this.pmView.root.removeEventListener("scroll", this.scrollHandler, !0);
  }
}
const Me = new L(
  "FilePanelPlugin"
);
class tr extends S {
  constructor(e) {
    super();
    h(this, "view");
    h(this, "closeMenu", () => {
      var e;
      return (e = this.view) == null ? void 0 : e.closeMenu();
    });
    this.addProsemirrorPlugin(
      new E({
        key: Me,
        view: (o) => (this.view = new er(
          e,
          Me,
          o,
          (r) => {
            this.emit("update", r);
          }
        ), this.view),
        props: {
          handleKeyDown: (o, r) => {
            var s;
            return r.key === "Escape" && this.shown ? ((s = this.view) == null || s.closeMenu(), !0) : !1;
          }
        },
        state: {
          init: () => ({
            block: void 0
          }),
          apply: (o, r) => {
            const s = o.getMeta(Me);
            return s || (!o.getMeta(G) && (o.selectionSet || o.docChanged) ? { block: void 0 } : r);
          }
        }
      })
    );
  }
  static key() {
    return "filePanel";
  }
  get shown() {
    var e, o;
    return ((o = (e = this.view) == null ? void 0 : e.state) == null ? void 0 : o.show) || !1;
  }
  onUpdate(e) {
    return this.on("update", e);
  }
}
class or {
  constructor(t, e, o) {
    h(this, "state");
    h(this, "emitUpdate");
    h(this, "preventHide", !1);
    h(this, "preventShow", !1);
    h(this, "shouldShow", ({ view: t, state: e, from: o, to: r }) => {
      const { doc: s, selection: i } = e, { empty: c } = i, a = !s.textBetween(o, r).length && Co(e.selection);
      if (i.$from.parent.type.spec.code || xe(i) && i.node.type.spec.code || c || a)
        return !1;
      const l = document.activeElement;
      return !(!this.isElementWithinEditorWrapper(l) && t.editable);
    });
    h(this, "blurHandler", (t) => {
      var o;
      if (this.preventHide) {
        this.preventHide = !1;
        return;
      }
      const e = this.pmView.dom.parentElement;
      // An element is clicked.
      t && t.relatedTarget && // Element is inside the editor.
      (e === t.relatedTarget || e.contains(t.relatedTarget) || t.relatedTarget.matches(
        ".bn-ui-container, .bn-ui-container *"
      )) || (o = this.state) != null && o.show && (this.state.show = !1, this.emitUpdate());
    });
    h(this, "isElementWithinEditorWrapper", (t) => {
      if (!t)
        return !1;
      const e = this.pmView.dom.parentElement;
      return e ? e.contains(t) : !1;
    });
    h(this, "viewMousedownHandler", (t) => {
      (!this.isElementWithinEditorWrapper(t.target) || t.button === 0) && (this.preventShow = !0);
    });
    h(this, "mouseupHandler", () => {
      this.preventShow && (this.preventShow = !1, setTimeout(() => this.update(this.pmView)));
    });
    // For dragging the whole editor.
    h(this, "dragHandler", () => {
      var t;
      (t = this.state) != null && t.show && (this.state.show = !1, this.emitUpdate());
    });
    h(this, "scrollHandler", () => {
      var t;
      (t = this.state) != null && t.show && (this.state.referencePos = this.getSelectionBoundingBox(), this.emitUpdate());
    });
    h(this, "closeMenu", () => {
      var t;
      (t = this.state) != null && t.show && (this.state.show = !1, this.emitUpdate());
    });
    this.editor = t, this.pmView = e, this.emitUpdate = () => {
      if (!this.state)
        throw new Error(
          "Attempting to update uninitialized formatting toolbar"
        );
      o(this.state);
    }, e.dom.addEventListener("mousedown", this.viewMousedownHandler), e.root.addEventListener("mouseup", this.mouseupHandler), e.dom.addEventListener("dragstart", this.dragHandler), e.dom.addEventListener("dragover", this.dragHandler), e.dom.addEventListener("blur", this.blurHandler), e.root.addEventListener("scroll", this.scrollHandler, !0);
  }
  update(t, e) {
    var m, g, f;
    const { state: o, composing: r } = t, { doc: s, selection: i } = o, c = e && e.doc.eq(s) && e.selection.eq(i);
    if (r || c)
      return;
    const { ranges: a } = i, l = Math.min(...a.map((b) => b.$from.pos)), d = Math.max(...a.map((b) => b.$to.pos)), u = this.shouldShow({
      view: t,
      state: o,
      from: l,
      to: d
    }), p = typeof Range.prototype.getClientRects > "u";
    if (!this.preventShow && (u || this.preventHide) && !p) {
      const b = this.getSelectionBoundingBox();
      if (b.height === 0 && b.width === 0) {
        queueMicrotask(() => {
          const w = {
            show: !0,
            referencePos: this.getSelectionBoundingBox()
          };
          this.state = w, this.emitUpdate(), t.dispatch(
            t.state.tr.setSelection(
              T.create(
                t.state.doc,
                t.state.selection.from + 1,
                t.state.selection.to
              )
            )
          ), t.dispatch(
            t.state.tr.setSelection(
              T.create(
                t.state.doc,
                t.state.selection.from - 1,
                t.state.selection.to
              )
            )
          );
        });
        return;
      }
      const k = {
        show: !0,
        referencePos: this.getSelectionBoundingBox()
      };
      (k.show !== ((m = this.state) == null ? void 0 : m.show) || k.referencePos.toJSON() !== ((g = this.state) == null ? void 0 : g.referencePos.toJSON())) && (this.state = k, this.emitUpdate());
      return;
    }
    if ((f = this.state) != null && f.show && !this.preventHide && (!u || this.preventShow || !this.editor.isEditable)) {
      this.state.show = !1, this.emitUpdate();
      return;
    }
  }
  destroy() {
    this.pmView.dom.removeEventListener("mousedown", this.viewMousedownHandler), this.pmView.root.removeEventListener("mouseup", this.mouseupHandler), this.pmView.dom.removeEventListener("dragstart", this.dragHandler), this.pmView.dom.removeEventListener("dragover", this.dragHandler), this.pmView.dom.removeEventListener("blur", this.blurHandler), this.pmView.root.removeEventListener("scroll", this.scrollHandler, !0);
  }
  getSelectionBoundingBox() {
    const { state: t } = this.pmView, { selection: e } = t, { ranges: o } = e, r = Math.min(...o.map((i) => i.$from.pos)), s = Math.max(...o.map((i) => i.$to.pos));
    if (xe(e)) {
      const i = this.pmView.nodeDOM(r);
      if (i)
        return i.getBoundingClientRect();
    }
    return fe(this.pmView, r, s);
  }
}
const nr = new L(
  "FormattingToolbarPlugin"
);
class rr extends S {
  constructor(e) {
    super();
    h(this, "view");
    h(this, "closeMenu", () => this.view.closeMenu());
    this.addProsemirrorPlugin(
      new E({
        key: nr,
        view: (o) => (this.view = new or(e, o, (r) => {
          this.emit("update", r);
        }), this.view),
        props: {
          handleKeyDown: (o, r) => r.key === "Escape" && this.shown ? (this.view.closeMenu(), !0) : !1
        }
      })
    );
  }
  static key() {
    return "formattingToolbar";
  }
  get shown() {
    var e, o;
    return ((o = (e = this.view) == null ? void 0 : e.state) == null ? void 0 : o.show) || !1;
  }
  onUpdate(e) {
    return this.on("update", e);
  }
}
const sr = W.create({
  name: "hardBreak",
  inline: !0,
  group: "inline",
  selectable: !1,
  linebreakReplacement: !0,
  priority: 10,
  parseHTML() {
    return [{ tag: "br" }];
  },
  renderHTML({ HTMLAttributes: n }) {
    return ["br", bt(this.options.HTMLAttributes, n)];
  },
  renderText() {
    return `
`;
  }
}), et = (n, t) => {
  const e = n.resolve(t);
  if (e.depth <= 1)
    return;
  const o = e.posAtIndex(
    e.index(e.depth - 1),
    e.depth - 1
  );
  return ye(
    n.resolve(o)
  );
}, pe = (n, t) => {
  const e = n.resolve(t), o = e.index();
  if (o === 0)
    return;
  const r = e.posAtIndex(o - 1);
  return ye(
    n.resolve(r)
  );
}, Dt = (n, t) => {
  for (; t.childContainer; ) {
    const e = t.childContainer.node, o = n.resolve(t.childContainer.beforePos + 1).posAtIndex(e.childCount - 1);
    t = ye(n.resolve(o));
  }
  return t;
}, ir = (n, t) => n.isBlockContainer && n.blockContent.node.type.spec.content === "inline*" && n.blockContent.node.childCount > 0 && t.isBlockContainer && t.blockContent.node.type.spec.content === "inline*", ar = (n, t, e, o) => {
  if (!o.isBlockContainer)
    throw new Error(
      `Attempted to merge block at position ${o.bnBlock.beforePos} into previous block at position ${e.bnBlock.beforePos}, but next block is not a block container`
    );
  if (o.childContainer) {
    const r = n.doc.resolve(
      o.childContainer.beforePos + 1
    ), s = n.doc.resolve(
      o.childContainer.afterPos - 1
    ), i = r.blockRange(s);
    if (t) {
      const c = n.doc.resolve(o.bnBlock.beforePos);
      n.tr.lift(i, c.depth);
    }
  }
  if (t) {
    if (!e.isBlockContainer)
      throw new Error(
        `Attempted to merge block at position ${o.bnBlock.beforePos} into previous block at position ${e.bnBlock.beforePos}, but previous block is not a block container`
      );
    t(
      n.tr.delete(
        e.blockContent.afterPos - 1,
        o.blockContent.beforePos + 1
      )
    );
  }
  return !0;
}, tt = (n) => ({
  state: t,
  dispatch: e
}) => {
  const o = t.doc.resolve(n), r = ye(o), s = pe(
    t.doc,
    r.bnBlock.beforePos
  );
  if (!s)
    return !1;
  const i = Dt(
    t.doc,
    s
  );
  return ir(i, r) ? ar(t, e, i, r) : !1;
};
function cr(n, t, e) {
  const { $from: o, $to: r } = n.selection, s = o.blockRange(
    r,
    (g) => g.childCount > 0 && (g.type.name === "blockGroup" || g.type.name === "column")
    // change necessary to not look at first item child type
  );
  if (!s)
    return !1;
  const i = s.startIndex;
  if (i === 0)
    return !1;
  const a = s.parent.child(i - 1);
  if (a.type !== t)
    return !1;
  const l = a.lastChild && a.lastChild.type === e, d = V.from(l ? t.create() : null), u = new q(
    V.from(
      t.create(null, V.from(e.create(null, d)))
      // change necessary to create "groupType" instead of parent.type
    ),
    l ? 3 : 1,
    0
  ), p = s.start, m = s.end;
  return n.step(
    new Pe(
      p - (l ? 3 : 1),
      m,
      p,
      m,
      u,
      1,
      !0
    )
  ).scrollIntoView(), !0;
}
function At(n) {
  return n.transact((t) => cr(
    t,
    n.pmSchema.nodes.blockContainer,
    n.pmSchema.nodes.blockGroup
  ));
}
function lr(n) {
  n._tiptapEditor.commands.liftListItem("blockContainer");
}
function dr(n) {
  return n.transact((t) => {
    const { bnBlock: e } = Ce(t);
    return t.doc.resolve(e.beforePos).nodeBefore !== null;
  });
}
function hr(n) {
  return n.transact((t) => {
    const { bnBlock: e } = Ce(t);
    return t.doc.resolve(e.beforePos).depth > 1;
  });
}
const ur = O.create({
  priority: 50,
  // TODO: The shortcuts need a refactor. Do we want to use a command priority
  //  design as there is now, or clump the logic into a single function?
  addKeyboardShortcuts() {
    const n = () => this.editor.commands.first(({ chain: o, commands: r }) => [
      // Deletes the selection if it's not empty.
      () => r.deleteSelection(),
      // Undoes an input rule if one was triggered in the last editor state change.
      () => r.undoInputRule(),
      // Reverts block content type to a paragraph if the selection is at the start of the block.
      () => r.command(({ state: s }) => {
        const i = A(s);
        if (!i.isBlockContainer)
          return !1;
        const c = s.selection.from === i.blockContent.beforePos + 1, a = i.blockContent.node.type.name === "paragraph";
        return c && !a ? r.command(
          ro(i.bnBlock.beforePos, {
            type: "paragraph",
            props: {}
          })
        ) : !1;
      }),
      // Removes a level of nesting if the block is indented if the selection is at the start of the block.
      () => r.command(({ state: s }) => {
        const i = A(s);
        if (!i.isBlockContainer)
          return !1;
        const { blockContent: c } = i;
        return s.selection.from === c.beforePos + 1 ? r.liftListItem("blockContainer") : !1;
      }),
      // Merges block with the previous one if it isn't indented, and the selection is at the start of the
      // block. The target block for merging must contain inline content.
      () => r.command(({ state: s }) => {
        const i = A(s);
        if (!i.isBlockContainer)
          return !1;
        const { bnBlock: c, blockContent: a } = i, l = s.selection.from === a.beforePos + 1, d = s.selection.empty, u = c.beforePos;
        return l && d ? o().command(tt(u)).scrollIntoView().run() : !1;
      }),
      () => r.command(({ state: s, dispatch: i }) => {
        const c = A(s);
        if (!c.isBlockContainer || !(s.selection.from === c.blockContent.beforePos + 1) || pe(
          s.doc,
          c.bnBlock.beforePos
        ))
          return !1;
        const d = et(
          s.doc,
          c.bnBlock.beforePos
        );
        if ((d == null ? void 0 : d.blockNoteType) !== "column")
          return !1;
        const u = d, p = et(
          s.doc,
          u.bnBlock.beforePos
        );
        if ((p == null ? void 0 : p.blockNoteType) !== "columnList")
          throw new Error("parent of column is not a column list");
        const m = u.childContainer.node.childCount === 1, g = m && p.childContainer.node.childCount === 2, f = p.childContainer.node.firstChild === u.bnBlock.node;
        if (i) {
          const b = s.doc.slice(
            c.bnBlock.beforePos,
            c.bnBlock.afterPos,
            !1
          );
          if (g)
            if (f) {
              s.tr.step(
                new Pe(
                  // replace entire column list
                  p.bnBlock.beforePos,
                  p.bnBlock.afterPos,
                  // select content of remaining column:
                  u.bnBlock.afterPos + 1,
                  p.bnBlock.afterPos - 2,
                  b,
                  b.size,
                  // append existing content to blockToMove
                  !1
                )
              );
              const k = s.tr.doc.resolve(u.bnBlock.beforePos);
              s.tr.setSelection(T.between(k, k));
            } else {
              s.tr.step(
                new Pe(
                  // replace entire column list
                  p.bnBlock.beforePos,
                  p.bnBlock.afterPos,
                  // select content of existing column:
                  p.bnBlock.beforePos + 2,
                  u.bnBlock.beforePos - 1,
                  b,
                  0,
                  // prepend existing content to blockToMove
                  !1
                )
              );
              const k = s.tr.doc.resolve(
                s.tr.mapping.map(u.bnBlock.beforePos - 1)
              );
              s.tr.setSelection(T.between(k, k));
            }
          else if (m)
            if (f) {
              s.tr.delete(
                u.bnBlock.beforePos,
                u.bnBlock.afterPos
              ), s.tr.insert(
                p.bnBlock.beforePos,
                b.content
              );
              const k = s.tr.doc.resolve(
                p.bnBlock.beforePos
              );
              s.tr.setSelection(T.between(k, k));
            } else
              s.tr.delete(
                u.bnBlock.beforePos - 1,
                u.bnBlock.beforePos + 1
              );
          else {
            s.tr.delete(
              c.bnBlock.beforePos,
              c.bnBlock.afterPos
            ), f ? s.tr.insert(
              p.bnBlock.beforePos - 1,
              b.content
            ) : s.tr.insert(
              u.bnBlock.beforePos - 1,
              b.content
            );
            const k = s.tr.doc.resolve(u.bnBlock.beforePos - 1);
            s.tr.setSelection(T.between(k, k));
          }
        }
        return !0;
      }),
      // Deletes the current block if it's an empty block with inline content,
      // and moves the selection to the previous block.
      () => r.command(({ state: s }) => {
        const i = A(s);
        if (!i.isBlockContainer)
          return !1;
        if (i.blockContent.node.childCount === 0 && i.blockContent.node.type.spec.content === "inline*") {
          const a = pe(
            s.doc,
            i.bnBlock.beforePos
          );
          if (!a || !a.isBlockContainer)
            return !1;
          let l = o();
          if (a.blockContent.node.type.spec.content === "tableRow+") {
            const g = i.bnBlock.beforePos - 1 - 1 - 1 - 1 - 1;
            l = l.setTextSelection(
              g
            );
          } else if (a.blockContent.node.type.spec.content === "") {
            const d = a.blockContent.afterPos - a.blockContent.node.nodeSize;
            l = l.setNodeSelection(
              d
            );
          } else {
            const d = a.blockContent.afterPos - a.blockContent.node.nodeSize;
            l = l.setTextSelection(d);
          }
          return l.deleteRange({
            from: i.bnBlock.beforePos,
            to: i.bnBlock.afterPos
          }).scrollIntoView().run();
        }
        return !1;
      }),
      // Deletes previous block if it contains no content and isn't a table,
      // when the selection is empty and at the start of the block. Moves the
      // current block into the deleted block's place.
      () => r.command(({ state: s }) => {
        const i = A(s);
        if (!i.isBlockContainer)
          throw new Error("todo");
        const c = s.selection.from === i.blockContent.beforePos + 1, a = s.selection.empty, l = pe(
          s.doc,
          i.bnBlock.beforePos
        );
        if (l && c && a) {
          const d = Dt(
            s.doc,
            l
          );
          if (!d.isBlockContainer)
            throw new Error("todo");
          if (d.blockContent.node.type.spec.content === "" || d.blockContent.node.type.spec.content === "inline*" && d.blockContent.node.childCount === 0)
            return o().cut(
              {
                from: i.bnBlock.beforePos,
                to: i.bnBlock.afterPos
              },
              d.bnBlock.afterPos
            ).deleteRange({
              from: d.bnBlock.beforePos,
              to: d.bnBlock.afterPos
            }).run();
        }
        return !1;
      })
    ]), t = () => this.editor.commands.first(({ commands: o }) => [
      // Deletes the selection if it's not empty.
      () => o.deleteSelection(),
      // Merges block with the next one (at the same nesting level or lower),
      // if one exists, the block has no children, and the selection is at the
      // end of the block.
      () => o.command(({ state: r }) => {
        const s = A(r);
        if (!s.isBlockContainer)
          return !1;
        const {
          bnBlock: i,
          blockContent: c,
          childContainer: a
        } = s, { depth: l } = r.doc.resolve(i.beforePos), d = i.afterPos === r.doc.nodeSize - 3, u = r.selection.from === c.afterPos - 1, p = r.selection.empty;
        if (!d && u && p && !(a !== void 0)) {
          let g = l, f = i.afterPos + 1, b = r.doc.resolve(f).depth;
          for (; b < g; )
            g = b, f += 2, b = r.doc.resolve(f).depth;
          return o.command(tt(f - 1));
        }
        return !1;
      })
    ]), e = (o = !1) => this.editor.commands.first(({ commands: r, tr: s }) => [
      // Removes a level of nesting if the block is empty & indented, while the selection is also empty & at the start
      // of the block.
      () => r.command(({ state: i }) => {
        const c = A(i);
        if (!c.isBlockContainer)
          return !1;
        const { bnBlock: a, blockContent: l } = c, { depth: d } = i.doc.resolve(a.beforePos), u = i.selection.$anchor.parentOffset === 0, p = i.selection.anchor === i.selection.head, m = l.node.childCount === 0, g = d > 1;
        return u && p && m && g ? r.liftListItem("blockContainer") : !1;
      }),
      // Creates a hard break if block is configured to do so.
      () => r.command(({ state: i }) => {
        var l;
        const c = A(i), a = ((l = this.options.editor.schema.blockSchema[c.blockNoteType].meta) == null ? void 0 : l.hardBreakShortcut) ?? "shift+enter";
        if (a === "none")
          return !1;
        if (
          // If shortcut is not configured, or is configured as "shift+enter",
          // create a hard break for shift+enter, but not for enter.
          a === "shift+enter" && o || // If shortcut is configured as "enter", create a hard break for
          // both enter and shift+enter.
          a === "enter"
        ) {
          const d = s.storedMarks || s.selection.$head.marks().filter(
            (u) => this.editor.extensionManager.splittableMarks.includes(
              u.type.name
            )
          );
          return s.insert(
            s.selection.head,
            s.doc.type.schema.nodes.hardBreak.create()
          ).ensureMarks(d), !0;
        }
        return !1;
      }),
      // Creates a new block and moves the selection to it if the current one is empty, while the selection is also
      // empty & at the start of the block.
      () => r.command(({ state: i, dispatch: c }) => {
        const a = A(i);
        if (!a.isBlockContainer)
          return !1;
        const { bnBlock: l, blockContent: d } = a, u = i.selection.$anchor.parentOffset === 0, p = i.selection.anchor === i.selection.head, m = d.node.childCount === 0;
        if (u && p && m) {
          const g = l.afterPos, f = g + 2;
          if (c) {
            const b = i.schema.nodes.blockContainer.createAndFill();
            i.tr.insert(g, b).scrollIntoView(), i.tr.setSelection(
              new T(i.doc.resolve(f))
            );
          }
          return !0;
        }
        return !1;
      }),
      // Splits the current block, moving content inside that's after the cursor to a new text block below. Also
      // deletes the selection beforehand, if it's not empty.
      () => r.command(({ state: i, chain: c }) => {
        const a = A(i);
        if (!a.isBlockContainer)
          return !1;
        const { blockContent: l } = a, d = i.selection.$anchor.parentOffset === 0;
        return l.node.childCount === 0 ? !1 : (c().deleteSelection().command(
          no(
            i.selection.from,
            d,
            d
          )
        ).run(), !0);
      })
    ]);
    return {
      Backspace: n,
      Delete: t,
      Enter: () => e(),
      "Shift-Enter": () => e(!0),
      // Always returning true for tab key presses ensures they're not captured by the browser. Otherwise, they blur the
      // editor since the browser will try to use tab for keyboard navigation.
      Tab: () => {
        var o, r, s;
        return this.options.tabBehavior !== "prefer-indent" && ((o = this.options.editor.formattingToolbar) != null && o.shown || (r = this.options.editor.linkToolbar) != null && r.shown || (s = this.options.editor.filePanel) != null && s.shown) ? !1 : At(this.options.editor);
      },
      "Shift-Tab": () => {
        var o, r, s;
        return this.options.tabBehavior !== "prefer-indent" && ((o = this.options.editor.formattingToolbar) != null && o.shown || (r = this.options.editor.linkToolbar) != null && r.shown || (s = this.options.editor.filePanel) != null && s.shown) ? !1 : (this.editor.commands.liftListItem("blockContainer"), !0);
      },
      "Shift-Mod-ArrowUp": () => (this.options.editor.moveBlocksUp(), !0),
      "Shift-Mod-ArrowDown": () => (this.options.editor.moveBlocksDown(), !0),
      "Mod-z": () => this.options.editor.undo(),
      "Mod-y": () => this.options.editor.redo(),
      "Shift-Mod-z": () => this.options.editor.redo()
    };
  }
});
class pr {
  constructor(t, e, o) {
    h(this, "state");
    h(this, "emitUpdate");
    h(this, "menuUpdateTimer");
    h(this, "startMenuUpdateTimer");
    h(this, "stopMenuUpdateTimer");
    h(this, "mouseHoveredLinkMark");
    h(this, "mouseHoveredLinkMarkRange");
    h(this, "keyboardHoveredLinkMark");
    h(this, "keyboardHoveredLinkMarkRange");
    h(this, "linkMark");
    h(this, "linkMarkRange");
    h(this, "mouseOverHandler", (t) => {
      if (this.mouseHoveredLinkMark = void 0, this.mouseHoveredLinkMarkRange = void 0, this.stopMenuUpdateTimer(), t.target instanceof HTMLAnchorElement && t.target.nodeName === "A") {
        const e = t.target, o = this.pmView.posAtDOM(e, 0) + 1, r = this.pmView.state.doc.resolve(o), s = r.marks();
        for (const i of s)
          if (i.type.name === this.pmView.state.schema.mark("link").type.name) {
            this.mouseHoveredLinkMark = i, this.mouseHoveredLinkMarkRange = je(r, i.type, i.attrs) || void 0;
            break;
          }
      }
      return this.startMenuUpdateTimer(), !1;
    });
    h(this, "clickHandler", (t) => {
      var o;
      const e = this.pmView.dom.parentElement;
      // Toolbar is open.
      this.linkMark && // An element is clicked.
      t && t.target && // The clicked element is not the editor.
      !(e === t.target || e.contains(t.target)) && (o = this.state) != null && o.show && (this.state.show = !1, this.emitUpdate());
    });
    h(this, "scrollHandler", () => {
      var t;
      this.linkMark !== void 0 && (t = this.state) != null && t.show && (this.state.referencePos = fe(
        this.pmView,
        this.linkMarkRange.from,
        this.linkMarkRange.to
      ), this.emitUpdate());
    });
    h(this, "closeMenu", () => {
      var t;
      (t = this.state) != null && t.show && (this.state.show = !1, this.emitUpdate());
    });
    this.editor = t, this.pmView = e, this.emitUpdate = () => {
      if (!this.state)
        throw new Error("Attempting to update uninitialized link toolbar");
      o(this.state);
    }, this.startMenuUpdateTimer = () => {
      this.menuUpdateTimer = setTimeout(() => {
        this.update(this.pmView, void 0, !0);
      }, 250);
    }, this.stopMenuUpdateTimer = () => (this.menuUpdateTimer && (clearTimeout(this.menuUpdateTimer), this.menuUpdateTimer = void 0), !1), this.pmView.dom.addEventListener("mouseover", this.mouseOverHandler), this.pmView.root.addEventListener(
      "click",
      this.clickHandler,
      !0
    ), this.pmView.root.addEventListener("scroll", this.scrollHandler, !0);
  }
  editLink(t, e) {
    var o;
    this.editor.transact((r) => {
      const s = I(r);
      r.insertText(e, this.linkMarkRange.from, this.linkMarkRange.to), r.addMark(
        this.linkMarkRange.from,
        this.linkMarkRange.from + e.length,
        s.mark("link", { href: t })
      );
    }), this.pmView.focus(), (o = this.state) != null && o.show && (this.state.show = !1, this.emitUpdate());
  }
  deleteLink() {
    var t;
    this.editor.transact(
      (e) => e.removeMark(
        this.linkMarkRange.from,
        this.linkMarkRange.to,
        this.linkMark.type
      ).setMeta("preventAutolink", !0)
    ), this.pmView.focus(), (t = this.state) != null && t.show && (this.state.show = !1, this.emitUpdate());
  }
  update(t, e, o = !1) {
    var c;
    const { state: r } = t;
    if (e && e.selection.from === r.selection.from && e.selection.to === r.selection.to || !this.pmView.hasFocus())
      return;
    const i = this.linkMark;
    if (this.linkMark = void 0, this.linkMarkRange = void 0, this.keyboardHoveredLinkMark = void 0, this.keyboardHoveredLinkMarkRange = void 0, this.pmView.state.selection.empty) {
      const a = this.pmView.state.selection.$from.marks();
      for (const l of a)
        if (l.type.name === this.pmView.state.schema.mark("link").type.name) {
          this.keyboardHoveredLinkMark = l, this.keyboardHoveredLinkMarkRange = je(
            this.pmView.state.selection.$from,
            l.type,
            l.attrs
          ) || void 0;
          break;
        }
    }
    if (this.mouseHoveredLinkMark && o && (this.linkMark = this.mouseHoveredLinkMark, this.linkMarkRange = this.mouseHoveredLinkMarkRange), this.keyboardHoveredLinkMark && (this.linkMark = this.keyboardHoveredLinkMark, this.linkMarkRange = this.keyboardHoveredLinkMarkRange), this.linkMark && this.editor.isEditable) {
      this.state = {
        show: !0,
        referencePos: fe(
          this.pmView,
          this.linkMarkRange.from,
          this.linkMarkRange.to
        ),
        url: this.linkMark.attrs.href,
        text: this.pmView.state.doc.textBetween(
          this.linkMarkRange.from,
          this.linkMarkRange.to
        )
      }, this.emitUpdate();
      return;
    }
    if ((c = this.state) != null && c.show && i && (!this.linkMark || !this.editor.isEditable)) {
      this.state.show = !1, this.emitUpdate();
      return;
    }
  }
  destroy() {
    this.pmView.dom.removeEventListener("mouseover", this.mouseOverHandler), this.pmView.root.removeEventListener("scroll", this.scrollHandler, !0), this.pmView.root.removeEventListener(
      "click",
      this.clickHandler,
      !0
    );
  }
}
const mr = new L("LinkToolbarPlugin");
class fr extends S {
  constructor(e) {
    super();
    h(this, "view");
    /**
     * Edit the currently hovered link.
     */
    h(this, "editLink", (e, o) => {
      this.view.editLink(e, o);
    });
    /**
     * Delete the currently hovered link.
     */
    h(this, "deleteLink", () => {
      this.view.deleteLink();
    });
    /**
     * When hovering on/off links using the mouse cursor, the link toolbar will
     * open & close with a delay.
     *
     * This function starts the delay timer, and should be used for when the mouse
     * cursor enters the link toolbar.
     */
    h(this, "startHideTimer", () => {
      this.view.startMenuUpdateTimer();
    });
    /**
     * When hovering on/off links using the mouse cursor, the link toolbar will
     * open & close with a delay.
     *
     * This function stops the delay timer, and should be used for when the mouse
     * cursor exits the link toolbar.
     */
    h(this, "stopHideTimer", () => {
      this.view.stopMenuUpdateTimer();
    });
    h(this, "closeMenu", () => this.view.closeMenu());
    this.addProsemirrorPlugin(
      new E({
        key: mr,
        view: (o) => (this.view = new pr(e, o, (r) => {
          this.emit("update", r);
        }), this.view),
        props: {
          handleKeyDown: (o, r) => r.key === "Escape" && this.shown ? (this.view.closeMenu(), !0) : !1
        }
      })
    );
  }
  static key() {
    return "linkToolbar";
  }
  onUpdate(e) {
    return this.on("update", e);
  }
  get shown() {
    var e, o;
    return ((o = (e = this.view) == null ? void 0 : e.state) == null ? void 0 : o.show) || !1;
  }
}
const gr = [
  "http",
  "https",
  "ftp",
  "ftps",
  "mailto",
  "tel",
  "callto",
  "sms",
  "cid",
  "xmpp"
], br = "https", kr = new L("node-selection-keyboard");
class wr extends S {
  static key() {
    return "nodeSelectionKeyboard";
  }
  constructor() {
    super(), this.addProsemirrorPlugin(
      new E({
        key: kr,
        props: {
          handleKeyDown: (t, e) => {
            if ("node" in t.state.selection) {
              if (e.ctrlKey || e.metaKey)
                return !1;
              if (e.key.length === 1)
                return e.preventDefault(), !0;
              if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
                const o = t.state.tr;
                return t.dispatch(
                  o.insert(
                    t.state.tr.selection.$to.after(),
                    t.state.schema.nodes.paragraph.createChecked()
                  ).setSelection(
                    new T(
                      o.doc.resolve(t.state.tr.selection.$to.after() + 1)
                    )
                  )
                ), !0;
              }
            }
            return !1;
          }
        }
      })
    );
  }
}
const yr = new L("blocknote-placeholder");
class Cr extends S {
  static key() {
    return "placeholder";
  }
  constructor(t, e) {
    super(), this.addProsemirrorPlugin(
      new E({
        key: yr,
        view: (o) => {
          const r = `placeholder-selector-${nn()}`;
          o.dom.classList.add(r);
          const s = document.createElement("style"), i = t._tiptapEditor.options.injectNonce;
          i && s.setAttribute("nonce", i), o.root instanceof window.ShadowRoot ? o.root.append(s) : o.root.head.appendChild(s);
          const c = s.sheet, a = (l = "") => `.${r} .bn-block-content${l} .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child):before`;
          try {
            const {
              default: l,
              emptyDocument: d,
              ...u
            } = e;
            for (const [g, f] of Object.entries(u)) {
              const b = `[data-content-type="${g}"]`;
              c.insertRule(
                `${a(b)} { content: ${JSON.stringify(
                  f
                )}; }`
              );
            }
            const p = "[data-is-only-empty-block]", m = "[data-is-empty-and-focused]";
            c.insertRule(
              `${a(p)} { content: ${JSON.stringify(
                d
              )}; }`
            ), c.insertRule(
              `${a(m)} { content: ${JSON.stringify(
                l
              )}; }`
            );
          } catch (l) {
            console.warn(
              "Failed to insert placeholder CSS rule - this is likely due to the browser not supporting certain CSS pseudo-element selectors (:has, :only-child:, or :before)",
              l
            );
          }
          return {
            destroy: () => {
              o.root instanceof window.ShadowRoot ? o.root.removeChild(s) : o.root.head.removeChild(s);
            }
          };
        },
        props: {
          decorations: (o) => {
            const { doc: r, selection: s } = o;
            if (!t.isEditable || !s.empty || s.$from.parent.type.spec.code)
              return;
            const i = [];
            o.doc.content.size === 6 && i.push(
              $.node(2, 4, {
                "data-is-only-empty-block": "true"
              })
            );
            const c = s.$anchor, a = c.parent;
            if (a.content.size === 0) {
              const l = c.before();
              i.push(
                $.node(l, l + a.nodeSize, {
                  "data-is-empty-and-focused": "true"
                })
              );
            }
            return U.create(r, i);
          }
        }
      })
    );
  }
}
const ot = new L("previous-blocks"), vr = {
  // Numbered List Items
  index: "index",
  // Headings
  level: "level",
  // All Blocks
  type: "type",
  depth: "depth",
  "depth-change": "depth-change"
};
class Sr extends S {
  static key() {
    return "previousBlockType";
  }
  constructor() {
    super();
    let t;
    this.addProsemirrorPlugin(
      new E({
        key: ot,
        view(e) {
          return {
            update: async (o, r) => {
              var s;
              ((s = this.key) == null ? void 0 : s.getState(o.state).updatedBlocks.size) > 0 && (t = setTimeout(() => {
                o.dispatch(
                  o.state.tr.setMeta(ot, { clearUpdate: !0 })
                );
              }, 0));
            },
            destroy: () => {
              t && clearTimeout(t);
            }
          };
        },
        state: {
          init() {
            return {
              // Block attributes, by block ID, from just before the previous transaction.
              prevTransactionOldBlockAttrs: {},
              // Block attributes, by block ID, from just before the current transaction.
              currentTransactionOldBlockAttrs: {},
              // Set of IDs of blocks whose attributes changed from the current transaction.
              updatedBlocks: /* @__PURE__ */ new Set()
            };
          },
          apply(e, o, r, s) {
            if (o.currentTransactionOldBlockAttrs = {}, o.updatedBlocks.clear(), !e.docChanged || r.doc.eq(s.doc))
              return o;
            const i = {}, c = Ke(
              r.doc,
              (d) => d.attrs.id
            ), a = new Map(
              c.map((d) => [d.node.attrs.id, d])
            ), l = Ke(
              s.doc,
              (d) => d.attrs.id
            );
            for (const d of l) {
              const u = a.get(d.node.attrs.id), p = u == null ? void 0 : u.node.firstChild, m = d.node.firstChild;
              if (u && p && m) {
                const g = {
                  index: m.attrs.index,
                  level: m.attrs.level,
                  type: m.type.name,
                  depth: s.doc.resolve(d.pos).depth
                }, f = {
                  index: p.attrs.index,
                  level: p.attrs.level,
                  type: p.type.name,
                  depth: r.doc.resolve(u.pos).depth
                };
                i[d.node.attrs.id] = f, o.currentTransactionOldBlockAttrs[d.node.attrs.id] = f, JSON.stringify(f) !== JSON.stringify(g) && (f["depth-change"] = f.depth - g.depth, o.updatedBlocks.add(d.node.attrs.id));
              }
            }
            return o.prevTransactionOldBlockAttrs = i, o;
          }
        },
        props: {
          decorations(e) {
            const o = this.getState(e);
            if (o.updatedBlocks.size === 0)
              return;
            const r = [];
            return e.doc.descendants((s, i) => {
              if (!s.attrs.id || !o.updatedBlocks.has(s.attrs.id))
                return;
              const c = o.currentTransactionOldBlockAttrs[s.attrs.id], a = {};
              for (const [d, u] of Object.entries(c))
                a["data-prev-" + vr[d]] = u || "none";
              const l = $.node(i, i + s.nodeSize, {
                ...a
              });
              r.push(l);
            }), U.create(e.doc, r);
          }
        }
      })
    );
  }
}
const nt = new L("blocknote-show-selection");
class Br extends S {
  constructor(e) {
    super();
    h(this, "enabled", !1);
    this.editor = e, this.addProsemirrorPlugin(
      new E({
        key: nt,
        props: {
          decorations: (o) => {
            const { doc: r, selection: s } = o;
            if (!this.enabled)
              return U.empty;
            const i = $.inline(s.from, s.to, {
              "data-show-selection": "true"
            });
            return U.create(r, [i]);
          }
        }
      })
    );
  }
  static key() {
    return "showSelection";
  }
  setEnabled(e) {
    this.enabled !== e && (this.enabled = e, this.editor.transact((o) => o.setMeta(nt, {})));
  }
  getEnabled() {
    return this.enabled;
  }
}
function _t(n, t) {
  var e, o;
  for (; n && n.parentElement && n.parentElement !== t.dom && ((e = n.getAttribute) == null ? void 0 : e.call(n, "data-node-type")) !== "blockContainer"; )
    n = n.parentElement;
  if (((o = n.getAttribute) == null ? void 0 : o.call(n, "data-node-type")) === "blockContainer")
    return { node: n, id: n.getAttribute("data-id") };
}
class z extends ue {
  constructor(e, o) {
    super(e, o);
    h(this, "nodes");
    const r = e.node();
    this.nodes = [], e.doc.nodesBetween(e.pos, o.pos, (s, i, c) => {
      if (c !== null && c.eq(r))
        return this.nodes.push(s), !1;
    });
  }
  static create(e, o, r = o) {
    return new z(e.resolve(o), e.resolve(r));
  }
  content() {
    return new q(V.from(this.nodes), 0, 0);
  }
  eq(e) {
    if (!(e instanceof z) || this.nodes.length !== e.nodes.length || this.from !== e.from || this.to !== e.to)
      return !1;
    for (let o = 0; o < this.nodes.length; o++)
      if (!this.nodes[o].eq(e.nodes[o]))
        return !1;
    return !0;
  }
  map(e, o) {
    const r = o.mapResult(this.from), s = o.mapResult(this.to);
    return s.deleted ? ue.near(e.resolve(r.pos)) : r.deleted ? ue.near(e.resolve(s.pos)) : new z(
      e.resolve(r.pos),
      e.resolve(s.pos)
    );
  }
  toJSON() {
    return { type: "multiple-node", anchor: this.anchor, head: this.head };
  }
}
ue.jsonID("multiple-node", z);
let N;
function Er(n, t) {
  let e, o;
  const r = t.resolve(n.from).node().type.spec.group === "blockContent", s = t.resolve(n.to).node().type.spec.group === "blockContent", i = Math.min(n.$anchor.depth, n.$head.depth);
  if (r && s) {
    const c = n.$from.start(i - 1), a = n.$to.end(i - 1);
    e = t.resolve(c - 1).pos, o = t.resolve(a + 1).pos;
  } else
    e = n.from, o = n.to;
  return { from: e, to: o };
}
function rt(n, t, e = t) {
  t === e && (e += n.state.doc.resolve(t + 1).node().nodeSize);
  const o = n.domAtPos(t).node.cloneNode(!0), r = n.domAtPos(t).node, s = (u, p) => Array.prototype.indexOf.call(u.children, p), i = s(
    r,
    // Expects from position to be just before the first selected block.
    n.domAtPos(t + 1).node.parentElement
  ), c = s(
    r,
    // Expects to position to be just after the last selected block.
    n.domAtPos(e - 1).node.parentElement
  );
  for (let u = r.childElementCount - 1; u >= 0; u--)
    (u > c || u < i) && o.removeChild(o.children[u]);
  Ot(n.root), N = o;
  const a = N.getElementsByTagName("iframe");
  for (let u = 0; u < a.length; u++) {
    const p = a[u], m = p.parentElement;
    m && m.removeChild(p);
  }
  const d = n.dom.className.split(" ").filter(
    (u) => u !== "ProseMirror" && u !== "bn-root" && u !== "bn-editor"
  ).join(" ");
  N.className = N.className + " bn-drag-preview " + d, n.root instanceof ShadowRoot ? n.root.appendChild(N) : n.root.body.appendChild(N);
}
function Ot(n) {
  N !== void 0 && (n instanceof ShadowRoot ? n.removeChild(N) : n.body.removeChild(N), N = void 0);
}
function Mr(n, t, e) {
  if (!n.dataTransfer || e.headless)
    return;
  const o = e.prosemirrorView, r = _(t.id, o.state.doc);
  if (!r)
    throw new Error(`Block with ID ${t.id} not found`);
  const s = r.posBeforeNode;
  if (s != null) {
    const i = o.state.selection, c = o.state.doc, { from: a, to: l } = Er(i, c), d = a <= s && s < l, u = i.$anchor.node() !== i.$head.node() || i instanceof z;
    d && u ? (o.dispatch(
      o.state.tr.setSelection(z.create(c, a, l))
    ), rt(o, a, l)) : (o.dispatch(
      o.state.tr.setSelection(X.create(o.state.doc, s))
    ), rt(o, s));
    const p = o.state.selection.content(), m = e.pmSchema, g = o.serializeForClipboard(p).dom.innerHTML, f = Se(m, e), b = Pt(p.content), k = f.exportBlocks(b, {}), w = He(k);
    n.dataTransfer.clearData(), n.dataTransfer.setData("blocknote/html", g), n.dataTransfer.setData("text/html", k), n.dataTransfer.setData("text/plain", w), n.dataTransfer.effectAllowed = "move", n.dataTransfer.setDragImage(N, 0, 0);
  }
}
const st = 250;
function Ie(n, t, e = !0) {
  const o = n.root.elementsFromPoint(t.left, t.top);
  for (const r of o)
    if (n.dom.contains(r))
      return e && r.closest("[data-node-type=columnList]") ? Ie(
        n,
        {
          // TODO can we do better than this?
          left: t.left + 50,
          // bit hacky, but if we're inside a column, offset x position to right to account for the width of sidemenu itself
          top: t.top
        },
        !1
      ) : _t(r, n);
}
function Pr(n, t) {
  if (!t.dom.firstChild)
    return;
  const e = t.dom.firstChild.getBoundingClientRect(), o = {
    // Clamps the x position to the editor's bounding box.
    left: Math.min(
      Math.max(e.left + 10, n.x),
      e.right - 10
    ),
    top: n.y
  }, r = Ie(t, o);
  if (!r)
    return;
  const s = r.node.getBoundingClientRect();
  return Ie(
    t,
    {
      left: s.right - 10,
      top: n.y
    },
    !1
  );
}
class Tr {
  constructor(t, e, o) {
    h(this, "state");
    h(this, "emitUpdate");
    h(this, "mousePos");
    h(this, "hoveredBlock");
    h(this, "menuFrozen", !1);
    h(this, "isDragOrigin", !1);
    h(this, "updateState", (t) => {
      this.state = t, this.emitUpdate(this.state);
    });
    h(this, "updateStateFromMousePos", () => {
      var o, r, s, i, c;
      if (this.menuFrozen || !this.mousePos)
        return;
      const t = this.findClosestEditorElement({
        clientX: this.mousePos.x,
        clientY: this.mousePos.y
      });
      if ((t == null ? void 0 : t.element) !== this.pmView.dom || t.distance > st) {
        (o = this.state) != null && o.show && (this.state.show = !1, this.updateState(this.state));
        return;
      }
      const e = Pr(this.mousePos, this.pmView);
      if (!e || !this.editor.isEditable) {
        (r = this.state) != null && r.show && (this.state.show = !1, this.updateState(this.state));
        return;
      }
      if (!((s = this.state) != null && s.show && ((i = this.hoveredBlock) != null && i.hasAttribute("data-id")) && ((c = this.hoveredBlock) == null ? void 0 : c.getAttribute("data-id")) === e.id) && (this.hoveredBlock = e.node, this.editor.isEditable)) {
        const a = e.node.getBoundingClientRect(), l = e.node.closest("[data-node-type=column]");
        this.state = {
          show: !0,
          referencePos: new DOMRect(
            l ? (
              // We take the first child as column elements have some default
              // padding. This is a little weird since this child element will
              // be the first block, but since it's always non-nested and we
              // only take the x coordinate, it's ok.
              l.firstElementChild.getBoundingClientRect().x
            ) : this.pmView.dom.firstChild.getBoundingClientRect().x,
            a.y,
            a.width,
            a.height
          ),
          block: this.editor.getBlock(
            this.hoveredBlock.getAttribute("data-id")
          )
        }, this.updateState(this.state);
      }
    });
    /**
     * If a block is being dragged, ProseMirror usually gets the context of what's
     * being dragged from `view.dragging`, which is automatically set when a
     * `dragstart` event fires in the editor. However, if the user tries to drag
     * and drop blocks between multiple editors, only the one in which the drag
     * began has that context, so we need to set it on the others manually. This
     * ensures that PM always drops the blocks in between other blocks, and not
     * inside them.
     *
     * After the `dragstart` event fires on the drag handle, it sets
     * `blocknote/html` data on the clipboard. This handler fires right after,
     * parsing the `blocknote/html` data into nodes and setting them on
     * `view.dragging`.
     *
     * Note: Setting `view.dragging` on `dragover` would be better as the user
     * could then drag between editors in different windows, but you can only
     * access `dataTransfer` contents on `dragstart` and `drop` events.
     */
    h(this, "onDragStart", (t) => {
      var i;
      const e = (i = t.dataTransfer) == null ? void 0 : i.getData("blocknote/html");
      if (!e || this.pmView.dragging)
        return;
      const o = document.createElement("div");
      o.innerHTML = e;
      const s = lt.fromSchema(this.pmView.state.schema).parse(o, {
        topNode: this.pmView.state.schema.nodes.blockGroup.create()
      });
      this.pmView.dragging = {
        slice: new q(s.content, 0, 0),
        move: !0
      };
    });
    /**
     * Finds the closest editor visually to the given coordinates
     */
    h(this, "findClosestEditorElement", (t) => {
      const e = Array.from(this.pmView.root.querySelectorAll(".bn-editor"));
      if (e.length === 0)
        return null;
      let o = e[0], r = Number.MAX_VALUE;
      return e.forEach((s) => {
        const i = s.querySelector(".bn-block-group").getBoundingClientRect(), c = t.clientX < i.left ? i.left - t.clientX : t.clientX > i.right ? t.clientX - i.right : 0, a = t.clientY < i.top ? i.top - t.clientY : t.clientY > i.bottom ? t.clientY - i.bottom : 0, l = Math.sqrt(
          Math.pow(c, 2) + Math.pow(a, 2)
        );
        l < r && (r = l, o = s);
      }), {
        element: o,
        distance: r
      };
    });
    /**
     * This dragover event handler listens at the document level,
     * and is trying to handle dragover events for all editors.
     *
     * It specifically is trying to handle the following cases:
     *  - If the dragover event is within the bounds of any editor, then it does nothing
     *  - If the dragover event is outside the bounds of any editor, but close enough (within DISTANCE_TO_CONSIDER_EDITOR_BOUNDS) to the closest editor,
     *    then it dispatches a synthetic dragover event to the closest editor (which will trigger the drop-cursor to be shown on that editor)
     *  - If the dragover event is outside the bounds of the current editor, then it will dispatch a synthetic dragleave event to the current editor
     *    (which will trigger the drop-cursor to be removed from the current editor)
     *
     * The synthetic event is a necessary evil because we do not control prosemirror-dropcursor to be able to show the drop-cursor within the range we want
     */
    h(this, "onDragOver", (t) => {
      if (t.synthetic)
        return;
      const e = this.getDragEventContext(t);
      if (!e || !e.isDropPoint) {
        this.closeDropCursor();
        return;
      }
      e.isDropPoint && !e.isDropWithinEditorBounds && this.dispatchSyntheticEvent(t);
    });
    /**
     * Closes the drop-cursor for the current editor
     */
    h(this, "closeDropCursor", () => {
      const t = new Event("dragleave", { bubbles: !1 });
      t.synthetic = !0, this.pmView.dom.dispatchEvent(t);
    });
    /**
     * It is surprisingly difficult to determine the information we need to know about a drag event
     *
     * This function is trying to determine the following:
     *  - Whether the current editor instance is the drop point
     *  - Whether the current editor instance is the drag origin
     *  - Whether the drop event is within the bounds of the current editor instance
     */
    h(this, "getDragEventContext", (t) => {
      var a;
      const e = !((a = t.dataTransfer) != null && a.types.includes("blocknote/html")) && !!this.pmView.dragging, o = !!this.isDragOrigin, r = e || o, s = this.findClosestEditorElement(t);
      if (!s || s.distance > st)
        return;
      const i = s.element === this.pmView.dom, c = i && s.distance === 0;
      if (!(!i && !r))
        return {
          isDropPoint: i,
          isDropWithinEditorBounds: c,
          isDragOrigin: r
        };
    });
    /**
     * The drop event handler listens at the document level,
     * and handles drop events for all editors.
     *
     * It specifically handles the following cases:
     *  - If we are both the drag origin and drop point:
     *    - Let normal drop handling take over
     *  - If we are the drop point but not the drag origin:
     *    - Collapse selection to prevent PM from deleting unrelated content
     *    - If drop event is outside our editor bounds, dispatch synthetic drop event to our editor
     *  - If we are the drag origin but not the drop point:
     *    - Delete the dragged content from our editor after a delay
     */
    h(this, "onDrop", (t) => {
      if (t.synthetic)
        return;
      const e = this.getDragEventContext(t);
      if (!e) {
        this.closeDropCursor();
        return;
      }
      const { isDropPoint: o, isDropWithinEditorBounds: r, isDragOrigin: s } = e;
      if (!r && o && this.dispatchSyntheticEvent(t), o) {
        if (this.pmView.dragging)
          return;
        this.pmView.dispatch(
          this.pmView.state.tr.setSelection(
            T.create(
              this.pmView.state.tr.doc,
              this.pmView.state.tr.selection.anchor
            )
          )
        );
        return;
      } else if (s) {
        setTimeout(
          () => this.pmView.dispatch(this.pmView.state.tr.deleteSelection()),
          0
        );
        return;
      }
    });
    h(this, "onDragEnd", (t) => {
      t.synthetic || (this.pmView.dragging = null);
    });
    h(this, "onKeyDown", (t) => {
      var e;
      (e = this.state) != null && e.show && this.editor.isFocused() && (this.state.show = !1, this.emitUpdate(this.state));
    });
    h(this, "onMouseMove", (t) => {
      var s;
      if (this.menuFrozen)
        return;
      this.mousePos = { x: t.clientX, y: t.clientY };
      const e = this.pmView.dom.getBoundingClientRect(), o = this.mousePos.x > e.left && this.mousePos.x < e.right && this.mousePos.y > e.top && this.mousePos.y < e.bottom, r = this.pmView.dom.parentElement;
      if (
        // Cursor is within the editor area
        o && // An element is hovered
        t && t.target && // Element is outside the editor
        !(r === t.target || r.contains(t.target))
      ) {
        (s = this.state) != null && s.show && (this.state.show = !1, this.emitUpdate(this.state));
        return;
      }
      this.updateStateFromMousePos();
    });
    h(this, "onScroll", () => {
      var t;
      (t = this.state) != null && t.show && (this.state.referencePos = this.hoveredBlock.getBoundingClientRect(), this.emitUpdate(this.state)), this.updateStateFromMousePos();
    });
    this.editor = t, this.pmView = e, this.emitUpdate = () => {
      if (!this.state)
        throw new Error("Attempting to update uninitialized side menu");
      o(this.state);
    }, this.pmView.root.addEventListener(
      "dragstart",
      this.onDragStart
    ), this.pmView.root.addEventListener(
      "dragover",
      this.onDragOver
    ), this.pmView.root.addEventListener(
      "drop",
      this.onDrop,
      !0
    ), this.pmView.root.addEventListener(
      "dragend",
      this.onDragEnd,
      !0
    ), this.pmView.root.addEventListener(
      "mousemove",
      this.onMouseMove,
      !0
    ), this.pmView.root.addEventListener(
      "keydown",
      this.onKeyDown,
      !0
    ), e.root.addEventListener("scroll", this.onScroll, !0);
  }
  dispatchSyntheticEvent(t) {
    const e = new Event(t.type, t), o = this.pmView.dom.firstChild.getBoundingClientRect();
    e.clientX = t.clientX, e.clientY = t.clientY, e.clientX = Math.min(
      Math.max(t.clientX, o.left),
      o.left + o.width
    ), e.clientY = Math.min(
      Math.max(t.clientY, o.top),
      o.top + o.height
    ), e.dataTransfer = t.dataTransfer, e.preventDefault = () => t.preventDefault(), e.synthetic = !0, this.pmView.dom.dispatchEvent(e);
  }
  // Needed in cases where the editor state updates without the mouse cursor
  // moving, as some state updates can require a side menu update. For example,
  // adding a button to the side menu which removes the block can cause the
  // block below to jump up into the place of the removed block when clicked,
  // allowing the user to click the button again without moving the cursor. This
  // would otherwise not update the side menu, and so clicking the button again
  // would attempt to remove the same block again, causing an error.
  update(t, e) {
    var r;
    !e.doc.eq(this.pmView.state.doc) && ((r = this.state) != null && r.show) && this.updateStateFromMousePos();
  }
  destroy() {
    var t;
    (t = this.state) != null && t.show && (this.state.show = !1, this.emitUpdate(this.state)), this.pmView.root.removeEventListener(
      "mousemove",
      this.onMouseMove,
      !0
    ), this.pmView.root.removeEventListener(
      "dragstart",
      this.onDragStart
    ), this.pmView.root.removeEventListener(
      "dragover",
      this.onDragOver
    ), this.pmView.root.removeEventListener(
      "drop",
      this.onDrop,
      !0
    ), this.pmView.root.removeEventListener(
      "dragend",
      this.onDragEnd,
      !0
    ), this.pmView.root.removeEventListener(
      "keydown",
      this.onKeyDown,
      !0
    ), this.pmView.root.removeEventListener("scroll", this.onScroll, !0);
  }
}
const xr = new L("SideMenuPlugin");
class Ir extends S {
  constructor(e) {
    super();
    h(this, "view");
    /**
     * Handles drag & drop events for blocks.
     */
    h(this, "blockDragStart", (e, o) => {
      this.view && (this.view.isDragOrigin = !0), Mr(e, o, this.editor);
    });
    /**
     * Handles drag & drop events for blocks.
     */
    h(this, "blockDragEnd", () => {
      Ot(this.editor.prosemirrorView.root), this.view && (this.view.isDragOrigin = !1);
    });
    /**
     * Freezes the side menu. When frozen, the side menu will stay
     * attached to the same block regardless of which block is hovered by the
     * mouse cursor.
     */
    h(this, "freezeMenu", () => {
      this.view.menuFrozen = !0, this.view.state.show = !0, this.view.emitUpdate(this.view.state);
    });
    /**
     * Unfreezes the side menu. When frozen, the side menu will stay
     * attached to the same block regardless of which block is hovered by the
     * mouse cursor.
     */
    h(this, "unfreezeMenu", () => {
      this.view.menuFrozen = !1, this.view.state.show = !1, this.view.emitUpdate(this.view.state);
    });
    this.editor = e, this.addProsemirrorPlugin(
      new E({
        key: xr,
        view: (o) => (this.view = new Tr(e, o, (r) => {
          this.emit("update", r);
        }), this.view)
      })
    );
  }
  static key() {
    return "sideMenu";
  }
  onUpdate(e) {
    return this.on("update", e);
  }
}
const le = /* @__PURE__ */ new Map();
function Lr(n) {
  if (le.has(n))
    return le.get(n);
  const t = new Xt();
  return n._tiptapEditor.on("transaction", ({ transaction: e }) => {
    t.appendMapping(e.mapping);
  }), n._tiptapEditor.on("destroy", () => {
    le.delete(n);
  }), le.set(n, t), t;
}
function Dr(n, t, e = "left") {
  const o = G.getState(n.prosemirrorState);
  if (!o) {
    const s = Lr(n), i = s.maps.length;
    return () => s.slice(i).map(t, e === "left" ? -1 : 1);
  }
  const r = Zo(
    // Track the position after the position if we are on the right side
    t + (e === "right" ? 1 : -1),
    o.binding.type,
    o.binding.mapping
  );
  return () => {
    const s = G.getState(
      n.prosemirrorState
    ), i = en(
      s.doc,
      s.binding.type,
      r,
      s.binding.mapping
    );
    if (i === null)
      throw new Error("Position not found, cannot track positions");
    return i + (e === "right" ? -1 : 1);
  };
}
const Ar = vo((n) => n.type.name === "blockContainer");
class _r {
  constructor(t, e, o) {
    h(this, "state");
    h(this, "emitUpdate");
    h(this, "rootEl");
    h(this, "pluginState");
    h(this, "handleScroll", () => {
      var t, e;
      if ((t = this.state) != null && t.show) {
        const o = (e = this.rootEl) == null ? void 0 : e.querySelector(
          `[data-decoration-id="${this.pluginState.decorationId}"]`
        );
        if (!o)
          return;
        this.state.referencePos = o.getBoundingClientRect(), this.emitUpdate(this.pluginState.triggerCharacter);
      }
    });
    h(this, "closeMenu", () => {
      this.editor.transact((t) => t.setMeta(K, null));
    });
    h(this, "clearQuery", () => {
      this.pluginState !== void 0 && this.editor._tiptapEditor.chain().focus().deleteRange({
        from: this.pluginState.queryStartPos() - (this.pluginState.deleteTriggerCharacter ? this.pluginState.triggerCharacter.length : 0),
        to: this.editor.transact((t) => t.selection.from)
      }).run();
    });
    var r;
    this.editor = t, this.pluginState = void 0, this.emitUpdate = (s) => {
      var i;
      if (!this.state)
        throw new Error("Attempting to update uninitialized suggestions menu");
      e(s, {
        ...this.state,
        ignoreQueryLength: (i = this.pluginState) == null ? void 0 : i.ignoreQueryLength
      });
    }, this.rootEl = o.root, (r = this.rootEl) == null || r.addEventListener("scroll", this.handleScroll, !0);
  }
  update(t, e) {
    var l;
    const o = K.getState(e), r = K.getState(
      t.state
    ), s = o === void 0 && r !== void 0, i = o !== void 0 && r === void 0;
    if (!s && !(o !== void 0 && r !== void 0) && !i)
      return;
    if (this.pluginState = i ? o : r, i || !this.editor.isEditable) {
      this.state && (this.state.show = !1), this.emitUpdate(this.pluginState.triggerCharacter);
      return;
    }
    const a = (l = this.rootEl) == null ? void 0 : l.querySelector(
      `[data-decoration-id="${this.pluginState.decorationId}"]`
    );
    this.editor.isEditable && a && (this.state = {
      show: !0,
      referencePos: a.getBoundingClientRect(),
      query: this.pluginState.query
    }, this.emitUpdate(this.pluginState.triggerCharacter));
  }
  destroy() {
    var t;
    (t = this.rootEl) == null || t.removeEventListener("scroll", this.handleScroll, !0);
  }
}
const K = new L("SuggestionMenuPlugin");
class Or extends S {
  constructor(e) {
    super();
    h(this, "view");
    h(this, "triggerCharacters", []);
    h(this, "addTriggerCharacter", (e) => {
      this.triggerCharacters.push(e);
    });
    // TODO: Should this be called automatically when listeners are removed?
    h(this, "removeTriggerCharacter", (e) => {
      this.triggerCharacters = this.triggerCharacters.filter(
        (o) => o !== e
      );
    });
    h(this, "closeMenu", () => this.view.closeMenu());
    h(this, "clearQuery", () => this.view.clearQuery());
    const o = this.triggerCharacters;
    this.addProsemirrorPlugin(
      new E({
        key: K,
        view: (r) => (this.view = new _r(
          e,
          (s, i) => {
            this.emit(`update ${s}`, i);
          },
          r
        ), this.view),
        state: {
          // Initialize the plugin's internal state.
          init() {
          },
          // Apply changes to the plugin state from an editor transaction.
          apply: (r, s, i, c) => {
            if (r.selection.$from.parent.type.spec.code)
              return s;
            const a = r.getMeta(K);
            if (typeof a == "object" && a !== null) {
              s && this.closeMenu();
              const d = Dr(
                e,
                c.selection.from - // Need to account for the trigger char that was inserted, so we offset the position by the length of the trigger character.
                a.triggerCharacter.length
              );
              return {
                triggerCharacter: a.triggerCharacter,
                deleteTriggerCharacter: a.deleteTriggerCharacter !== !1,
                // When reading the queryStartPos, we offset the result by the length of the trigger character, to make it easy on the caller
                queryStartPos: () => d() + a.triggerCharacter.length,
                query: "",
                decorationId: `id_${Math.floor(Math.random() * 4294967295)}`,
                ignoreQueryLength: a == null ? void 0 : a.ignoreQueryLength
              };
            }
            if (s === void 0)
              return s;
            if (
              // Highlighting text should hide the menu.
              c.selection.from !== c.selection.to || // Transactions with plugin metadata should hide the menu.
              a === null || // Certain mouse events should hide the menu.
              // TODO: Change to global mousedown listener.
              r.getMeta("focus") || r.getMeta("blur") || r.getMeta("pointer") || // Moving the caret before the character which triggered the menu should hide it.
              s.triggerCharacter !== void 0 && c.selection.from < s.queryStartPos() || // Moving the caret to a new block should hide the menu.
              !c.selection.$from.sameParent(
                c.doc.resolve(s.queryStartPos())
              )
            )
              return;
            const l = { ...s };
            return l.query = c.doc.textBetween(
              s.queryStartPos(),
              c.selection.from
            ), l;
          }
        },
        props: {
          handleTextInput(r, s, i, c) {
            if (s === i) {
              const a = r.state.doc;
              for (const l of o) {
                const d = l.length > 1 ? a.textBetween(s - l.length, s) + c : c;
                if (l === d)
                  return r.dispatch(r.state.tr.insertText(c)), r.dispatch(
                    r.state.tr.setMeta(K, {
                      triggerCharacter: d
                    }).scrollIntoView()
                  ), !0;
              }
            }
            return !1;
          },
          // Setup decorator on the currently active suggestion.
          decorations(r) {
            const s = this.getState(r);
            if (s === void 0)
              return null;
            if (!s.deleteTriggerCharacter) {
              const i = Ar(r.selection);
              if (i)
                return U.create(r.doc, [
                  $.node(
                    i.pos,
                    i.pos + i.node.nodeSize,
                    {
                      nodeName: "span",
                      class: "bn-suggestion-decorator",
                      "data-decoration-id": s.decorationId
                    }
                  )
                ]);
            }
            return U.create(r.doc, [
              $.inline(
                s.queryStartPos() - s.triggerCharacter.length,
                s.queryStartPos(),
                {
                  nodeName: "span",
                  class: "bn-suggestion-decorator",
                  "data-decoration-id": s.decorationId
                }
              )
            ]);
          }
        }
      })
    );
  }
  static key() {
    return "suggestionMenu";
  }
  onUpdate(e, o) {
    return this.triggerCharacters.includes(e) || this.addTriggerCharacter(e), this.on(`update ${e}`, o);
  }
  get shown() {
    var e, o;
    return ((o = (e = this.view) == null ? void 0 : e.state) == null ? void 0 : o.show) || !1;
  }
}
function di(n, t) {
  n.suggestionMenus.addTriggerCharacter(t);
}
const Hr = ie.create({
  name: "insertion",
  inclusive: !1,
  excludes: "deletion modification insertion",
  addAttributes() {
    return {
      id: { default: null, validate: "number" }
      // note: validate is supported in prosemirror but not in tiptap, so this doesn't actually work (considered not critical)
    };
  },
  extendMarkSchema(n) {
    return n.name !== "insertion" ? {} : {
      blocknoteIgnore: !0,
      inclusive: !1,
      toDOM(t, e) {
        return [
          "ins",
          {
            "data-id": String(t.attrs.id),
            "data-inline": String(e),
            ...!e && { style: "display: contents" }
            // changed to "contents" to make this work for table rows
          },
          0
        ];
      },
      parseDOM: [
        {
          tag: "ins",
          getAttrs(t) {
            return t.dataset.id ? {
              id: parseInt(t.dataset.id, 10)
            } : !1;
          }
        }
      ]
    };
  }
}), Nr = ie.create({
  name: "deletion",
  inclusive: !1,
  excludes: "insertion modification deletion",
  addAttributes() {
    return {
      id: { default: null, validate: "number" }
      // note: validate is supported in prosemirror but not in tiptap
    };
  },
  extendMarkSchema(n) {
    return n.name !== "deletion" ? {} : {
      blocknoteIgnore: !0,
      inclusive: !1,
      // attrs: {
      //   id: { validate: "number" },
      // },
      toDOM(t, e) {
        return [
          "del",
          {
            "data-id": String(t.attrs.id),
            "data-inline": String(e),
            ...!e && { style: "display: contents" }
            // changed to "contents" to make this work for table rows
          },
          0
        ];
      },
      parseDOM: [
        {
          tag: "del",
          getAttrs(t) {
            return t.dataset.id ? {
              id: parseInt(t.dataset.id, 10)
            } : !1;
          }
        }
      ]
    };
  }
}), Ur = ie.create({
  name: "modification",
  inclusive: !1,
  excludes: "deletion insertion",
  addAttributes() {
    return {
      id: { default: null, validate: "number" },
      type: { validate: "string" },
      attrName: { default: null, validate: "string|null" },
      previousValue: { default: null },
      newValue: { default: null }
    };
  },
  extendMarkSchema(n) {
    return n.name !== "modification" ? {} : {
      blocknoteIgnore: !0,
      inclusive: !1,
      // attrs: {
      //   id: { validate: "number" },
      //   type: { validate: "string" },
      //   attrName: { default: null, validate: "string|null" },
      //   previousValue: { default: null },
      //   newValue: { default: null },
      // },
      toDOM(t, e) {
        return [
          e ? "span" : "div",
          {
            "data-type": "modification",
            "data-id": String(t.attrs.id),
            "data-mod-type": t.attrs.type,
            "data-mod-prev-val": JSON.stringify(t.attrs.previousValue),
            // TODO: Try to serialize marks with toJSON?
            "data-mod-new-val": JSON.stringify(t.attrs.newValue)
          },
          0
        ];
      },
      parseDOM: [
        {
          tag: "span[data-type='modification']",
          getAttrs(t) {
            return t.dataset.id ? {
              id: parseInt(t.dataset.id, 10),
              type: t.dataset.modType,
              previousValue: t.dataset.modPrevVal,
              newValue: t.dataset.modNewVal
            } : !1;
          }
        },
        {
          tag: "div[data-type='modification']",
          getAttrs(t) {
            return t.dataset.id ? {
              id: parseInt(t.dataset.id, 10),
              type: t.dataset.modType,
              previousValue: t.dataset.modPrevVal
            } : !1;
          }
        }
      ]
    };
  }
});
let x;
function it(n) {
  x || (x = document.createElement("div"), x.innerHTML = "_", x.style.opacity = "0", x.style.height = "1px", x.style.width = "1px", n instanceof Document ? n.body.appendChild(x) : n.appendChild(x));
}
function Rr(n) {
  x && (n instanceof Document ? n.body.removeChild(x) : n.removeChild(x), x = void 0);
}
function de(n) {
  return Array.prototype.indexOf.call(n.parentElement.childNodes, n);
}
function Vr(n) {
  let t = n;
  for (; t && t.nodeName !== "TD" && t.nodeName !== "TH" && !t.classList.contains("tableWrapper"); ) {
    if (t.classList.contains("ProseMirror"))
      return;
    const e = t.parentNode;
    if (!e || !(e instanceof Element))
      return;
    t = e;
  }
  return t.nodeName === "TD" || t.nodeName === "TH" ? {
    type: "cell",
    domNode: t,
    tbodyNode: t.closest("tbody")
  } : {
    type: "wrapper",
    domNode: t,
    tbodyNode: t.querySelector("tbody")
  };
}
function $r(n, t) {
  const e = t.querySelectorAll(n);
  for (let o = 0; o < e.length; o++)
    e[o].style.visibility = "hidden";
}
class Fr {
  constructor(t, e, o) {
    h(this, "state");
    h(this, "emitUpdate");
    h(this, "tableId");
    h(this, "tablePos");
    h(this, "tableElement");
    h(this, "menuFrozen", !1);
    h(this, "mouseState", "up");
    h(this, "prevWasEditable", null);
    h(this, "viewMousedownHandler", () => {
      this.mouseState = "down";
    });
    h(this, "mouseUpHandler", (t) => {
      this.mouseState = "up", this.mouseMoveHandler(t);
    });
    h(this, "mouseMoveHandler", (t) => {
      var l, d, u, p, m, g, f;
      if (this.menuFrozen || this.mouseState === "selecting" || !(t.target instanceof Element) || !this.pmView.dom.contains(t.target))
        return;
      const e = Vr(t.target);
      if ((e == null ? void 0 : e.type) === "cell" && this.mouseState === "down" && !((l = this.state) != null && l.draggingState)) {
        this.mouseState = "selecting", (d = this.state) != null && d.show && (this.state.show = !1, this.state.showAddOrRemoveRowsButton = !1, this.state.showAddOrRemoveColumnsButton = !1, this.emitUpdate());
        return;
      }
      if (!e || !this.editor.isEditable) {
        (u = this.state) != null && u.show && (this.state.show = !1, this.state.showAddOrRemoveRowsButton = !1, this.state.showAddOrRemoveColumnsButton = !1, this.emitUpdate());
        return;
      }
      if (!e.tbodyNode)
        return;
      const o = e.tbodyNode.getBoundingClientRect(), r = _t(e.domNode, this.pmView);
      if (!r)
        return;
      this.tableElement = r.node;
      let s;
      const i = this.editor.transact(
        (b) => _(r.id, b.doc)
      );
      if (!i)
        throw new Error(`Block with ID ${r.id} not found`);
      const c = B(
        i.node,
        this.editor.pmSchema,
        this.editor.schema.blockSchema,
        this.editor.schema.inlineContentSchema,
        this.editor.schema.styleSchema
      );
      if (ut(this.editor, "table") && (this.tablePos = i.posBeforeNode + 1, s = c), !s)
        return;
      this.tableId = r.id;
      const a = (p = e.domNode.closest(".tableWrapper")) == null ? void 0 : p.querySelector(".table-widgets-container");
      if ((e == null ? void 0 : e.type) === "wrapper") {
        const b = t.clientY >= o.bottom - 1 && // -1 to account for fractions of pixels in "bottom"
        t.clientY < o.bottom + 20, k = t.clientX >= o.right - 1 && t.clientX < o.right + 20, w = t.clientX > o.right || t.clientY > o.bottom;
        this.state = {
          ...this.state,
          show: !0,
          showAddOrRemoveRowsButton: b,
          showAddOrRemoveColumnsButton: k,
          referencePosTable: o,
          block: s,
          widgetContainer: a,
          colIndex: w || (m = this.state) == null ? void 0 : m.colIndex,
          rowIndex: w || (g = this.state) == null ? void 0 : g.rowIndex,
          referencePosCell: w || (f = this.state) == null ? void 0 : f.referencePosCell
        };
      } else {
        const b = de(e.domNode), k = de(e.domNode.parentElement), w = e.domNode.getBoundingClientRect();
        if (this.state !== void 0 && this.state.show && this.tableId === r.id && this.state.rowIndex === k && this.state.colIndex === b)
          return;
        this.state = {
          show: !0,
          showAddOrRemoveColumnsButton: b === s.content.rows[0].cells.length - 1,
          showAddOrRemoveRowsButton: k === s.content.rows.length - 1,
          referencePosTable: o,
          block: s,
          draggingState: void 0,
          referencePosCell: w,
          colIndex: b,
          rowIndex: k,
          widgetContainer: a
        };
      }
      return this.emitUpdate(), !1;
    });
    h(this, "dragOverHandler", (t) => {
      var p;
      if (((p = this.state) == null ? void 0 : p.draggingState) === void 0)
        return;
      t.preventDefault(), t.dataTransfer.dropEffect = "move", $r(
        ".prosemirror-dropcursor-block, .prosemirror-dropcursor-inline",
        this.pmView.root
      );
      const e = {
        left: Math.min(
          Math.max(t.clientX, this.state.referencePosTable.left + 1),
          this.state.referencePosTable.right - 1
        ),
        top: Math.min(
          Math.max(t.clientY, this.state.referencePosTable.top + 1),
          this.state.referencePosTable.bottom - 1
        )
      }, o = this.pmView.root.elementsFromPoint(e.left, e.top).filter(
        (m) => m.tagName === "TD" || m.tagName === "TH"
      );
      if (o.length === 0)
        return;
      const r = o[0];
      let s = !1;
      const i = de(r.parentElement), c = de(r), a = this.state.draggingState.draggedCellOrientation === "row" ? this.state.rowIndex : this.state.colIndex, d = (this.state.draggingState.draggedCellOrientation === "row" ? i : c) !== a;
      (this.state.rowIndex !== i || this.state.colIndex !== c) && (this.state.rowIndex = i, this.state.colIndex = c, this.state.referencePosCell = r.getBoundingClientRect(), s = !0);
      const u = this.state.draggingState.draggedCellOrientation === "row" ? e.top : e.left;
      this.state.draggingState.mousePos !== u && (this.state.draggingState.mousePos = u, s = !0), s && this.emitUpdate(), d && this.editor.transact((m) => m.setMeta(oe, !0));
    });
    h(this, "dropHandler", (t) => {
      if (this.mouseState = "up", this.state === void 0 || this.state.draggingState === void 0)
        return !1;
      if (this.state.rowIndex === void 0 || this.state.colIndex === void 0)
        throw new Error(
          "Attempted to drop table row or column, but no table block was hovered prior."
        );
      t.preventDefault();
      const { draggingState: e, colIndex: o, rowIndex: r } = this.state, s = this.state.block.content.columnWidths;
      if (e.draggedCellOrientation === "row") {
        if (!pt(
          this.state.block,
          e.originalIndex,
          r
        ))
          return !1;
        const i = so(
          this.state.block,
          e.originalIndex,
          r
        );
        this.editor.updateBlock(this.state.block, {
          type: "table",
          content: {
            ...this.state.block.content,
            rows: i
          }
        });
      } else {
        if (!mt(
          this.state.block,
          e.originalIndex,
          o
        ))
          return !1;
        const i = io(
          this.state.block,
          e.originalIndex,
          o
        ), [c] = s.splice(e.originalIndex, 1);
        s.splice(o, 0, c), this.editor.updateBlock(this.state.block, {
          type: "table",
          content: {
            ...this.state.block.content,
            columnWidths: s,
            rows: i
          }
        });
      }
      return this.editor.setTextCursorPosition(this.state.block.id), !0;
    });
    this.editor = t, this.pmView = e, this.emitUpdate = () => {
      if (!this.state)
        throw new Error("Attempting to update uninitialized image toolbar");
      o(this.state);
    }, e.dom.addEventListener("mousemove", this.mouseMoveHandler), e.dom.addEventListener("mousedown", this.viewMousedownHandler), window.addEventListener("mouseup", this.mouseUpHandler), e.root.addEventListener(
      "dragover",
      this.dragOverHandler
    ), e.root.addEventListener(
      "drop",
      this.dropHandler
    );
  }
  // Updates drag handles when the table is modified or removed.
  update() {
    var r;
    if (!this.state || !this.state.show)
      return;
    if (this.state.block = this.editor.getBlock(this.state.block.id), !this.state.block || this.state.block.type !== "table" || // when collaborating, the table element might be replaced and out of date
    // because yjs replaces the element when for example you change the color via the side menu
    !((r = this.tableElement) != null && r.isConnected)) {
      this.state.show = !1, this.state.showAddOrRemoveRowsButton = !1, this.state.showAddOrRemoveColumnsButton = !1, this.emitUpdate();
      return;
    }
    const { height: t, width: e } = ao(
      this.state.block
    );
    this.state.rowIndex !== void 0 && this.state.colIndex !== void 0 && (this.state.rowIndex >= t && (this.state.rowIndex = t - 1), this.state.colIndex >= e && (this.state.colIndex = e - 1));
    const o = this.tableElement.querySelector("tbody");
    if (!o)
      throw new Error(
        "Table block does not contain a 'tbody' HTML element. This should never happen."
      );
    if (this.state.rowIndex !== void 0 && this.state.colIndex !== void 0) {
      const i = o.children[this.state.rowIndex].children[this.state.colIndex];
      i ? this.state.referencePosCell = i.getBoundingClientRect() : (this.state.rowIndex = void 0, this.state.colIndex = void 0);
    }
    this.state.referencePosTable = o.getBoundingClientRect(), this.emitUpdate();
  }
  destroy() {
    this.pmView.dom.removeEventListener("mousemove", this.mouseMoveHandler), window.removeEventListener("mouseup", this.mouseUpHandler), this.pmView.dom.removeEventListener("mousedown", this.viewMousedownHandler), this.pmView.root.removeEventListener(
      "dragover",
      this.dragOverHandler
    ), this.pmView.root.removeEventListener(
      "drop",
      this.dropHandler
    );
  }
}
const oe = new L("TableHandlesPlugin");
class zr extends S {
  constructor(e) {
    super();
    h(this, "view");
    /**
     * Callback that should be set on the `dragStart` event for whichever element
     * is used as the column drag handle.
     */
    h(this, "colDragStart", (e) => {
      if (this.view.state === void 0 || this.view.state.colIndex === void 0)
        throw new Error(
          "Attempted to drag table column, but no table block was hovered prior."
        );
      this.view.state.draggingState = {
        draggedCellOrientation: "col",
        originalIndex: this.view.state.colIndex,
        mousePos: e.clientX
      }, this.view.emitUpdate(), this.editor.transact(
        (o) => o.setMeta(oe, {
          draggedCellOrientation: this.view.state.draggingState.draggedCellOrientation,
          originalIndex: this.view.state.colIndex,
          newIndex: this.view.state.colIndex,
          tablePos: this.view.tablePos
        })
      ), !this.editor.headless && (it(this.editor.prosemirrorView.root), e.dataTransfer.setDragImage(x, 0, 0), e.dataTransfer.effectAllowed = "move");
    });
    /**
     * Callback that should be set on the `dragStart` event for whichever element
     * is used as the row drag handle.
     */
    h(this, "rowDragStart", (e) => {
      if (this.view.state === void 0 || this.view.state.rowIndex === void 0)
        throw new Error(
          "Attempted to drag table row, but no table block was hovered prior."
        );
      this.view.state.draggingState = {
        draggedCellOrientation: "row",
        originalIndex: this.view.state.rowIndex,
        mousePos: e.clientY
      }, this.view.emitUpdate(), this.editor.transact(
        (o) => o.setMeta(oe, {
          draggedCellOrientation: this.view.state.draggingState.draggedCellOrientation,
          originalIndex: this.view.state.rowIndex,
          newIndex: this.view.state.rowIndex,
          tablePos: this.view.tablePos
        })
      ), !this.editor.headless && (it(this.editor.prosemirrorView.root), e.dataTransfer.setDragImage(x, 0, 0), e.dataTransfer.effectAllowed = "copyMove");
    });
    /**
     * Callback that should be set on the `dragEnd` event for both the element
     * used as the row drag handle, and the one used as the column drag handle.
     */
    h(this, "dragEnd", () => {
      if (this.view.state === void 0)
        throw new Error(
          "Attempted to drag table row, but no table block was hovered prior."
        );
      this.view.state.draggingState = void 0, this.view.emitUpdate(), this.editor.transact((e) => e.setMeta(oe, null)), !this.editor.headless && Rr(this.editor.prosemirrorView.root);
    });
    /**
     * Freezes the drag handles. When frozen, they will stay attached to the same
     * cell regardless of which cell is hovered by the mouse cursor.
     */
    h(this, "freezeHandles", () => {
      this.view.menuFrozen = !0;
    });
    /**
     * Unfreezes the drag handles. When frozen, they will stay attached to the
     * same cell regardless of which cell is hovered by the mouse cursor.
     */
    h(this, "unfreezeHandles", () => {
      this.view.menuFrozen = !1;
    });
    h(this, "getCellsAtRowHandle", (e, o) => Fe(e, o));
    /**
     * Get all the cells in a column of the table block.
     */
    h(this, "getCellsAtColumnHandle", (e, o) => ze(e, o));
    /**
     * Sets the selection to the given cell or a range of cells.
     * @returns The new state after the selection has been set.
     */
    h(this, "setCellSelection", (e, o, r = o) => {
      const s = this.view;
      if (!s)
        throw new Error("Table handles view not initialized");
      const i = e.doc.resolve(s.tablePos + 1), c = e.doc.resolve(
        i.posAtIndex(o.row) + 1
      ), a = e.doc.resolve(
        // No need for +1, since CellSelection expects the position before the cell
        c.posAtIndex(o.col)
      ), l = e.doc.resolve(
        i.posAtIndex(r.row) + 1
      ), d = e.doc.resolve(
        // No need for +1, since CellSelection expects the position before the cell
        l.posAtIndex(r.col)
      ), u = e.tr;
      return u.setSelection(
        new ve(a, d)
      ), e.apply(u);
    });
    /**
     * Adds a row or column to the table using prosemirror-table commands
     */
    h(this, "addRowOrColumn", (e, o) => {
      this.editor.exec((r, s) => {
        const i = this.setCellSelection(
          r,
          o.orientation === "row" ? { row: e, col: 0 } : { row: 0, col: e }
        );
        return o.orientation === "row" ? o.side === "above" ? _o(i, s) : Oo(i, s) : o.side === "left" ? Ho(i, s) : No(i, s);
      });
    });
    /**
     * Removes a row or column from the table using prosemirror-table commands
     */
    h(this, "removeRowOrColumn", (e, o) => o === "row" ? this.editor.exec((r, s) => {
      const i = this.setCellSelection(r, {
        row: e,
        col: 0
      });
      return Uo(i, s);
    }) : this.editor.exec((r, s) => {
      const i = this.setCellSelection(r, {
        row: 0,
        col: e
      });
      return Ro(i, s);
    }));
    /**
     * Merges the cells in the table block.
     */
    h(this, "mergeCells", (e) => this.editor.exec((o, r) => {
      const s = e ? this.setCellSelection(
        o,
        e.relativeStartCell,
        e.relativeEndCell
      ) : o;
      return Vo(s, r);
    }));
    /**
     * Splits the cell in the table block.
     * If no cell is provided, the current cell selected will be split.
     */
    h(this, "splitCell", (e) => this.editor.exec((o, r) => {
      const s = e ? this.setCellSelection(o, e) : o;
      return $o(s, r);
    }));
    /**
     * Gets the start and end cells of the current cell selection.
     * @returns The start and end cells of the current cell selection.
     */
    h(this, "getCellSelection", () => this.editor.transact((e) => {
      const o = e.selection;
      let r = o.$from, s = o.$to;
      if (Ge(o)) {
        const { ranges: g } = o;
        g.forEach((f) => {
          r = f.$from.min(r ?? f.$from), s = f.$to.max(s ?? f.$to);
        });
      } else if (r = e.doc.resolve(
        o.$from.pos - o.$from.parentOffset - 1
      ), s = e.doc.resolve(
        o.$to.pos - o.$to.parentOffset - 1
      ), r.pos === 0 || s.pos === 0)
        return;
      const i = e.doc.resolve(
        r.pos - r.parentOffset - 1
      ), c = e.doc.resolve(s.pos - s.parentOffset - 1), a = e.doc.resolve(i.pos - i.parentOffset - 1), l = r.index(i.depth), d = i.index(a.depth), u = s.index(c.depth), p = c.index(a.depth), m = [];
      for (let g = d; g <= p; g++)
        for (let f = l; f <= u; f++)
          m.push({ row: g, col: f });
      return {
        from: {
          row: d,
          col: l
        },
        to: {
          row: p,
          col: u
        },
        cells: m
      };
    }));
    /**
     * Gets the direction of the merge based on the current cell selection.
     *
     * Returns undefined when there is no cell selection, or the selection is not within a table.
     */
    h(this, "getMergeDirection", (e) => this.editor.transact((o) => {
      const r = Ge(o.selection) ? o.selection : void 0;
      if (!r || !e || // Only offer the merge button if there is more than one cell selected.
      r.ranges.length <= 1)
        return;
      const s = this.getCellSelection();
      if (s)
        return co(s.from, s.to, e) ? "vertical" : "horizontal";
    }));
    h(this, "cropEmptyRowsOrColumns", (e, o) => lo(e, o));
    h(this, "addRowsOrColumns", (e, o, r) => ho(e, o, r));
    this.editor = e, this.addProsemirrorPlugin(
      new E({
        key: oe,
        view: (o) => (this.view = new Fr(e, o, (r) => {
          this.emit("update", r);
        }), this.view),
        // We use decorations to render the drop cursor when dragging a table row
        // or column. The decorations are updated in the `dragOverHandler` method.
        props: {
          decorations: (o) => {
            if (this.view === void 0 || this.view.state === void 0 || this.view.state.draggingState === void 0 || this.view.tablePos === void 0)
              return;
            const r = this.view.state.draggingState.draggedCellOrientation === "row" ? this.view.state.rowIndex : this.view.state.colIndex;
            if (r === void 0)
              return;
            const s = [], { block: i, draggingState: c } = this.view.state, { originalIndex: a, draggedCellOrientation: l } = c;
            if (r === a || !i || l === "row" && !pt(i, a, r) || l === "col" && !mt(i, a, r))
              return U.create(o.doc, s);
            const d = o.doc.resolve(this.view.tablePos + 1);
            return this.view.state.draggingState.draggedCellOrientation === "row" ? Fe(
              this.view.state.block,
              r
            ).forEach(({ row: p, col: m }) => {
              const g = o.doc.resolve(
                d.posAtIndex(p) + 1
              ), f = o.doc.resolve(
                g.posAtIndex(m) + 1
              ), b = f.node(), k = f.pos + (r > a ? b.nodeSize - 2 : 0);
              s.push(
                // The widget is a small bar which spans the width of the cell.
                $.widget(k, () => {
                  const w = document.createElement("div");
                  return w.className = "bn-table-drop-cursor", w.style.left = "0", w.style.right = "0", r > a ? w.style.bottom = "-2px" : w.style.top = "-3px", w.style.height = "4px", w;
                })
              );
            }) : ze(
              this.view.state.block,
              r
            ).forEach(({ row: p, col: m }) => {
              const g = o.doc.resolve(
                d.posAtIndex(p) + 1
              ), f = o.doc.resolve(
                g.posAtIndex(m) + 1
              ), b = f.node(), k = f.pos + (r > a ? b.nodeSize - 2 : 0);
              s.push(
                // The widget is a small bar which spans the height of the cell.
                $.widget(k, () => {
                  const w = document.createElement("div");
                  return w.className = "bn-table-drop-cursor", w.style.top = "0", w.style.bottom = "0", r > a ? w.style.right = "-2px" : w.style.left = "-3px", w.style.width = "4px", w;
                })
              );
            }), U.create(o.doc, s);
          }
        }
      })
    );
  }
  static key() {
    return "tableHandles";
  }
  onUpdate(e) {
    return this.on("update", e);
  }
}
const Gr = O.create({
  name: "textAlignment",
  addGlobalAttributes() {
    return [
      {
        // Generally text alignment is handled through props using the custom
        // blocks API. Tables are the only blocks that are created as TipTap
        // nodes and ported to blocks, so we need to add text alignment in a
        // separate extension.
        types: ["tableCell", "tableHeader"],
        attributes: {
          textAlignment: {
            default: "left",
            parseHTML: (n) => n.getAttribute("data-text-alignment"),
            renderHTML: (n) => n.textAlignment === "left" ? {} : {
              "data-text-alignment": n.textAlignment
            }
          }
        }
      }
    ];
  }
}), jr = O.create({
  name: "blockTextColor",
  addGlobalAttributes() {
    return [
      {
        types: ["table", "tableCell", "tableHeader"],
        attributes: {
          textColor: uo()
        }
      }
    ];
  }
}), Kr = O.create({
  name: "trailingNode",
  addProseMirrorPlugins() {
    const n = new L(this.name);
    return [
      new E({
        key: n,
        appendTransaction: (t, e, o) => {
          const { doc: r, tr: s, schema: i } = o, c = n.getState(o), a = r.content.size - 2, l = i.nodes.blockContainer, d = i.nodes.paragraph;
          if (c)
            return s.insert(
              a,
              l.create(void 0, d.create())
            );
        },
        state: {
          init: (t, e) => {
          },
          apply: (t, e) => {
            if (!t.docChanged)
              return e;
            let o = t.doc.lastChild;
            if (!o || o.type.name !== "blockGroup")
              throw new Error("Expected blockGroup");
            if (o = o.lastChild, !o || o.type.name !== "blockContainer")
              return !0;
            const r = o.firstChild;
            if (!r)
              throw new Error("Expected blockContent");
            return o.nodeSize > 4 || r.type.spec.content !== "inline*";
          }
        }
      })
    ];
  }
}), qr = {
  blockColor: "data-block-color",
  blockStyle: "data-block-style",
  id: "data-id",
  depth: "data-depth",
  depthChange: "data-depth-change"
}, Yr = W.create({
  name: "blockContainer",
  group: "blockGroupChild bnBlock",
  // A block always contains content, and optionally a blockGroup which contains nested blocks
  content: "blockContent blockGroup?",
  // Ensures content-specific keyboard handlers trigger first.
  priority: 50,
  defining: !0,
  marks: "insertion modification deletion",
  parseHTML() {
    return [
      {
        tag: "div[data-node-type=" + this.name + "]",
        getAttrs: (n) => {
          if (typeof n == "string")
            return !1;
          const t = {};
          for (const [e, o] of Object.entries(qr))
            n.getAttribute(o) && (t[e] = n.getAttribute(o));
          return t;
        }
      },
      // Ignore `blockOuter` divs, but parse the `blockContainer` divs inside them.
      {
        tag: 'div[data-node-type="blockOuter"]',
        skip: !0
      }
    ];
  },
  renderHTML({ HTMLAttributes: n }) {
    var r;
    const t = document.createElement("div");
    t.className = "bn-block-outer", t.setAttribute("data-node-type", "blockOuter");
    for (const [s, i] of Object.entries(n))
      s !== "class" && t.setAttribute(s, i);
    const e = {
      ...((r = this.options.domAttributes) == null ? void 0 : r.block) || {},
      ...n
    }, o = document.createElement("div");
    o.className = _e("bn-block", e.class), o.setAttribute("data-node-type", this.name);
    for (const [s, i] of Object.entries(e))
      s !== "class" && o.setAttribute(s, i);
    return t.appendChild(o), {
      dom: t,
      contentDOM: o
    };
  }
}), Wr = W.create({
  name: "blockGroup",
  group: "childContainer",
  content: "blockGroupChild+",
  marks: "deletion insertion modification",
  parseHTML() {
    return [
      {
        tag: "div",
        getAttrs: (n) => typeof n == "string" ? !1 : n.getAttribute("data-node-type") === "blockGroup" ? null : !1
      }
    ];
  },
  renderHTML({ HTMLAttributes: n }) {
    var o;
    const t = {
      ...((o = this.options.domAttributes) == null ? void 0 : o.blockGroup) || {},
      ...n
    }, e = document.createElement("div");
    e.className = _e(
      "bn-block-group",
      t.class
    ), e.setAttribute("data-node-type", "blockGroup");
    for (const [r, s] of Object.entries(t))
      r !== "class" && e.setAttribute(r, s);
    return {
      dom: e,
      contentDOM: e
    };
  }
}), Xr = W.create({
  name: "doc",
  topNode: !0,
  content: "blockGroup",
  marks: "insertion modification deletion"
}), Jr = (n) => {
  var r;
  const t = {}, e = Qr(n);
  for (const s of e)
    t[s.name] = s;
  n.collaboration && (t.ySyncPlugin = new ge(n.collaboration.fragment), t.yUndoPlugin = new be({ editor: n.editor }), (r = n.collaboration.provider) != null && r.awareness && (t.yCursorPlugin = new se(n.collaboration)), t.forkYDocPlugin = new xt({
    editor: n.editor,
    collaboration: n.collaboration
  }), t.schemaMigrationPlugin = new Ne(
    n.collaboration.fragment
  )), t.formattingToolbar = new rr(
    n.editor
  ), t.linkToolbar = new fr(n.editor), t.sideMenu = new Ir(n.editor), t.suggestionMenus = new Or(n.editor), t.filePanel = new tr(n.editor), t.placeholder = new Cr(n.editor, n.placeholders), (n.animations ?? !0) && (t.animations = new Sr()), n.tableHandles && (t.tableHandles = new zr(n.editor)), t.nodeSelectionKeyboard = new wr(), t.blockChange = new Yn(), t.showSelection = new Br(n.editor), n.comments && (t.comments = new Lt(
    n.editor,
    n.comments.threadStore,
    ke.name,
    n.comments.resolveUsers,
    n.comments.schema
  ));
  const o = n.disableExtensions || [];
  for (const s of o)
    delete t[s];
  return t;
};
let at = !1;
const Qr = (n) => {
  const t = [
    te.ClipboardTextSerializer,
    te.Commands,
    te.Editable,
    te.FocusEvents,
    te.Tabindex,
    // DevTools,
    Io,
    // DropCursor,
    O.create({
      name: "dropCursor",
      addProseMirrorPlugins: () => [
        n.dropCursor({
          width: 5,
          color: "#ddeeff",
          editor: n.editor
        })
      ]
    }),
    ft.configure({
      // everything from bnBlock group (nodes that represent a BlockNote block should have an id)
      types: ["blockContainer", "columnList", "column"],
      setIdAttribute: n.setIdAttribute
    }),
    sr,
    // Comments,
    // basics:
    Ao,
    // marks:
    Hr,
    Nr,
    Ur,
    Do.extend({
      inclusive: !1
    }).configure({
      defaultProtocol: br,
      // only call this once if we have multiple editors installed. Or fix https://github.com/ueberdosis/tiptap/issues/5450
      protocols: at ? [] : gr
    }),
    ...Object.values(n.styleSpecs).map((e) => e.implementation.mark.configure({
      editor: n.editor
    })),
    jr,
    qn,
    Gr,
    // make sure escape blurs editor, so that we can tab to other elements in the host page (accessibility)
    O.create({
      name: "OverrideEscape",
      addKeyboardShortcuts() {
        return {
          Escape: () => n.editor.suggestionMenus.shown ? !1 : this.editor.commands.blur()
        };
      }
    }),
    // nodes
    Xr,
    Yr.configure({
      editor: n.editor,
      domAttributes: n.domAttributes
    }),
    ur.configure({
      editor: n.editor,
      tabBehavior: n.tabBehavior
    }),
    Wr.configure({
      domAttributes: n.domAttributes
    }),
    ...Object.values(n.inlineContentSpecs).filter((e) => e.config !== "link" && e.config !== "text").map((e) => e.implementation.node.configure({
      editor: n.editor
    })),
    ...Object.values(n.blockSpecs).flatMap((e) => [
      // the node extension implementations
      ..."node" in e.implementation ? [
        e.implementation.node.configure({
          editor: n.editor,
          domAttributes: n.domAttributes
        })
      ] : []
    ]),
    Kn(n.editor),
    Vn(
      n.editor,
      n.pasteHandler || ((e) => e.defaultPasteHandler())
    ),
    Sn(n.editor),
    // This needs to be at the bottom of this list, because Key events (such as enter, when selecting a /command),
    // should be handled before Enter handlers in other components like splitListItem
    ...n.trailingBlock === void 0 || n.trailingBlock ? [Kr] : [],
    ...n.comments ? [ke] : []
  ];
  return at = !0, n.collaboration || t.push(Lo), t;
};
function Zr(n) {
  return n.transact((t) => {
    const e = re(t.doc, t.selection.anchor);
    if (t.selection instanceof ve)
      return {
        type: "cell",
        anchorBlockId: e.node.attrs.id,
        anchorCellOffset: t.selection.$anchorCell.pos - e.posBeforeNode,
        headCellOffset: t.selection.$headCell.pos - e.posBeforeNode
      };
    if (t.selection instanceof X)
      return {
        type: "node",
        anchorBlockId: e.node.attrs.id
      };
    {
      const o = re(t.doc, t.selection.head);
      return {
        type: "text",
        anchorBlockId: e.node.attrs.id,
        headBlockId: o.node.attrs.id,
        anchorOffset: t.selection.anchor - e.posBeforeNode,
        headOffset: t.selection.head - o.posBeforeNode
      };
    }
  });
}
function es(n, t) {
  var r, s;
  const e = (r = _(t.anchorBlockId, n.doc)) == null ? void 0 : r.posBeforeNode;
  if (e === void 0)
    throw new Error(
      `Could not find block with ID ${t.anchorBlockId} to update selection`
    );
  let o;
  if (t.type === "cell")
    o = ve.create(
      n.doc,
      e + t.anchorCellOffset,
      e + t.headCellOffset
    );
  else if (t.type === "node")
    o = X.create(n.doc, e + 1);
  else {
    const i = (s = _(t.headBlockId, n.doc)) == null ? void 0 : s.posBeforeNode;
    if (i === void 0)
      throw new Error(
        `Could not find block with ID ${t.headBlockId} to update selection`
      );
    o = T.create(
      n.doc,
      e + t.anchorOffset,
      i + t.headOffset
    );
  }
  n.setSelection(o);
}
function Le(n) {
  return n.map((t) => t.type === "columnList" ? t.children.map((e) => Le(e.children)).flat() : {
    ...t,
    children: Le(t.children)
  }).flat();
}
function Ht(n, t, e) {
  n.transact((o) => {
    var i;
    const r = ((i = n.getSelection()) == null ? void 0 : i.blocks) || [
      n.getTextCursorPosition().block
    ], s = Zr(n);
    n.removeBlocks(r), n.insertBlocks(Le(r), t, e), es(o, s);
  });
}
function Nt(n) {
  return !n || n.type !== "columnList";
}
function Ut(n, t, e) {
  let o, r;
  if (t ? t.children.length > 0 ? (o = t.children[t.children.length - 1], r = "after") : (o = t, r = "before") : e && (o = e, r = "before"), !o || !r)
    return;
  const s = n.getParentBlock(o);
  return Nt(s) ? { referenceBlock: o, placement: r } : Ut(
    n,
    r === "after" ? o : n.getPrevBlock(o),
    s
  );
}
function Rt(n, t, e) {
  let o, r;
  if (t ? t.children.length > 0 ? (o = t.children[0], r = "before") : (o = t, r = "after") : e && (o = e, r = "after"), !o || !r)
    return;
  const s = n.getParentBlock(o);
  return Nt(s) ? { referenceBlock: o, placement: r } : Rt(
    n,
    r === "before" ? o : n.getNextBlock(o),
    s
  );
}
function ts(n) {
  n.transact(() => {
    const t = n.getSelection(), e = (t == null ? void 0 : t.blocks[0]) || n.getTextCursorPosition().block, o = Ut(
      n,
      n.getPrevBlock(e),
      n.getParentBlock(e)
    );
    o && Ht(
      n,
      o.referenceBlock,
      o.placement
    );
  });
}
function os(n) {
  n.transact(() => {
    const t = n.getSelection(), e = (t == null ? void 0 : t.blocks[(t == null ? void 0 : t.blocks.length) - 1]) || n.getTextCursorPosition().block, o = Rt(
      n,
      n.getNextBlock(e),
      n.getParentBlock(e)
    );
    o && Ht(
      n,
      o.referenceBlock,
      o.placement
    );
  });
}
function ns(n, t) {
  const e = typeof t == "string" ? t : t.id, o = I(n), r = _(e, n);
  if (r)
    return B(r.node, o);
}
function rs(n, t) {
  const e = typeof t == "string" ? t : t.id, o = _(e, n), r = I(n);
  if (!o)
    return;
  const i = n.resolve(o.posBeforeNode).nodeBefore;
  if (i)
    return B(i, r);
}
function ss(n, t) {
  const e = typeof t == "string" ? t : t.id, o = _(e, n), r = I(n);
  if (!o)
    return;
  const i = n.resolve(
    o.posBeforeNode + o.node.nodeSize
  ).nodeAfter;
  if (i)
    return B(i, r);
}
function is(n, t) {
  const e = typeof t == "string" ? t : t.id, o = I(n), r = _(e, n);
  if (!r)
    return;
  const s = n.resolve(r.posBeforeNode), i = s.node(), c = s.node(-1), a = c.type.name !== "doc" ? i.type.name === "blockGroup" ? c : i : void 0;
  if (a)
    return B(a, o);
}
class as {
  constructor(t) {
    this.editor = t;
  }
  /**
   * Gets a snapshot of all top-level (non-nested) blocks in the editor.
   * @returns A snapshot of all top-level (non-nested) blocks in the editor.
   */
  get document() {
    return this.editor.transact((t) => po(t.doc, this.editor.pmSchema));
  }
  /**
   * Gets a snapshot of an existing block from the editor.
   * @param blockIdentifier The identifier of an existing block that should be
   * retrieved.
   * @returns The block that matches the identifier, or `undefined` if no
   * matching block was found.
   */
  getBlock(t) {
    return this.editor.transact((e) => ns(e.doc, t));
  }
  /**
   * Gets a snapshot of the previous sibling of an existing block from the
   * editor.
   * @param blockIdentifier The identifier of an existing block for which the
   * previous sibling should be retrieved.
   * @returns The previous sibling of the block that matches the identifier.
   * `undefined` if no matching block was found, or it's the first child/block
   * in the document.
   */
  getPrevBlock(t) {
    return this.editor.transact((e) => rs(e.doc, t));
  }
  /**
   * Gets a snapshot of the next sibling of an existing block from the editor.
   * @param blockIdentifier The identifier of an existing block for which the
   * next sibling should be retrieved.
   * @returns The next sibling of the block that matches the identifier.
   * `undefined` if no matching block was found, or it's the last child/block in
   * the document.
   */
  getNextBlock(t) {
    return this.editor.transact((e) => ss(e.doc, t));
  }
  /**
   * Gets a snapshot of the parent of an existing block from the editor.
   * @param blockIdentifier The identifier of an existing block for which the
   * parent should be retrieved.
   * @returns The parent of the block that matches the identifier. `undefined`
   * if no matching block was found, or the block isn't nested.
   */
  getParentBlock(t) {
    return this.editor.transact(
      (e) => is(e.doc, t)
    );
  }
  /**
   * Traverses all blocks in the editor depth-first, and executes a callback for each.
   * @param callback The callback to execute for each block. Returning `false` stops the traversal.
   * @param reverse Whether the blocks should be traversed in reverse order.
   */
  forEachBlock(t, e = !1) {
    const o = this.document.slice();
    e && o.reverse();
    function r(s) {
      for (const i of s) {
        if (t(i) === !1)
          return !1;
        const c = e ? i.children.slice().reverse() : i.children;
        if (!r(c))
          return !1;
      }
      return !0;
    }
    r(o);
  }
  /**
   * Inserts new blocks into the editor. If a block's `id` is undefined, BlockNote generates one automatically. Throws an
   * error if the reference block could not be found.
   * @param blocksToInsert An array of partial blocks that should be inserted.
   * @param referenceBlock An identifier for an existing block, at which the new blocks should be inserted.
   * @param placement Whether the blocks should be inserted just before, just after, or nested inside the
   * `referenceBlock`.
   */
  insertBlocks(t, e, o = "before") {
    return this.editor.transact(
      (r) => un(r, t, e, o)
    );
  }
  /**
   * Updates an existing block in the editor. Since updatedBlock is a PartialBlock object, some fields might not be
   * defined. These undefined fields are kept as-is from the existing block. Throws an error if the block to update could
   * not be found.
   * @param blockToUpdate The block that should be updated.
   * @param update A partial block which defines how the existing block should be changed.
   */
  updateBlock(t, e) {
    return this.editor.transact((o) => mo(o, t, e));
  }
  /**
   * Removes existing blocks from the editor. Throws an error if any of the blocks could not be found.
   * @param blocksToRemove An array of identifiers for existing blocks that should be removed.
   */
  removeBlocks(t) {
    return this.editor.transact(
      (e) => We(e, t, []).removedBlocks
    );
  }
  /**
   * Replaces existing blocks in the editor with new blocks. If the blocks that should be removed are not adjacent or
   * are at different nesting levels, `blocksToInsert` will be inserted at the position of the first block in
   * `blocksToRemove`. Throws an error if any of the blocks to remove could not be found.
   * @param blocksToRemove An array of blocks that should be replaced.
   * @param blocksToInsert An array of partial blocks to replace the old ones with.
   */
  replaceBlocks(t, e) {
    return this.editor.transact(
      (o) => We(o, t, e)
    );
  }
  /**
   * Checks if the block containing the text cursor can be nested.
   */
  canNestBlock() {
    return dr(this.editor);
  }
  /**
   * Nests the block containing the text cursor into the block above it.
   */
  nestBlock() {
    At(this.editor);
  }
  /**
   * Checks if the block containing the text cursor is nested.
   */
  canUnnestBlock() {
    return hr(this.editor);
  }
  /**
   * Lifts the block containing the text cursor out of its parent.
   */
  unnestBlock() {
    lr(this.editor);
  }
  /**
   * Moves the selected blocks up. If the previous block has children, moves
   * them to the end of its children. If there is no previous block, but the
   * current blocks share a common parent, moves them out of & before it.
   */
  moveBlocksUp() {
    return ts(this.editor);
  }
  /**
   * Moves the selected blocks down. If the next block has children, moves
   * them to the start of its children. If there is no next block, but the
   * current blocks share a common parent, moves them out of & after it.
   */
  moveBlocksDown() {
    return os(this.editor);
  }
}
class cs {
  constructor(t, e) {
    h(this, "editor");
    h(this, "options");
    h(this, "_commentsPlugin");
    h(this, "_forkYDocPlugin");
    h(this, "_syncPlugin");
    h(this, "_undoPlugin");
    h(this, "_cursorPlugin");
    this.editor = t, this.options = e;
  }
  /**
   * Get the sync plugin instance
   */
  get syncPlugin() {
    return this._syncPlugin;
  }
  /**
   * Get the undo plugin instance
   */
  get undoPlugin() {
    return this._undoPlugin;
  }
  /**
   * Get the cursor plugin instance
   */
  get cursorPlugin() {
    return this._cursorPlugin;
  }
  /**
   * Get the fork YDoc plugin instance
   */
  get forkYDocPlugin() {
    return this._forkYDocPlugin;
  }
  // Initialize collaboration plugins
  initExtensions() {
    var e;
    const t = {};
    if (this._syncPlugin = new ge(this.options.fragment), t.ySyncPlugin = this._syncPlugin, this._undoPlugin = new be({ editor: this.editor }), t.yUndoPlugin = this._undoPlugin, (e = this.options.provider) != null && e.awareness && (this._cursorPlugin = new se(this.options), t.yCursorPlugin = this._cursorPlugin), this._forkYDocPlugin = new xt({
      editor: this.editor,
      collaboration: this.options
    }), t.forkYDocPlugin = this._forkYDocPlugin, this.options.comments) {
      if (!this.options.resolveUsers)
        throw new Error("resolveUsers is required when using comments");
      this._commentsPlugin = new Lt(
        this.editor,
        this.options.comments.threadStore,
        ke.name,
        this.options.resolveUsers,
        this.options.comments.schema
      ), t.comments = this._commentsPlugin, t.commentMark = ke;
    }
    return t;
  }
  /**
   * Update the user info for the current user that's shown to other collaborators
   */
  updateUserInfo(t) {
    const e = this.cursorPlugin;
    if (!e)
      throw new Error(
        "Cannot update collaboration user info when collaboration is disabled."
      );
    e.updateUser(t);
  }
  /**
   * Get the collaboration undo command
   */
  getUndoCommand() {
    return tn;
  }
  /**
   * Get the collaboration redo command
   */
  getRedoCommand() {
    return on;
  }
  /**
   * Check if initial content should be avoided due to collaboration
   */
  shouldAvoidInitialContent() {
    return !!this.options.provider;
  }
  /**
   * Get the collaboration options
   */
  getOptions() {
    return this.options;
  }
  /**
   * Get the comments plugin if available
   */
  get comments() {
    return this._commentsPlugin;
  }
  /**
   * Check if comments are enabled
   */
  get hasComments() {
    return !!this.options.comments;
  }
  /**
   * Get the resolveUsers function
   */
  get resolveUsers() {
    return this.options.resolveUsers;
  }
}
class ls extends Ae {
  constructor(t) {
    super(), this.editor = t, t.onCreate(() => {
      t._tiptapEditor.on(
        "update",
        ({ transaction: e, appendedTransactions: o }) => {
          this.emit("onChange", t, {
            getChanges() {
              return Et(
                e,
                o
              );
            }
          });
        }
      ), t._tiptapEditor.on("selectionUpdate", ({ transaction: e }) => {
        this.emit("onSelectionChange", { editor: t, transaction: e });
      }), t._tiptapEditor.on("mount", () => {
        this.emit("onMount", { editor: t });
      }), t._tiptapEditor.on("unmount", () => {
        this.emit("onUnmount", { editor: t });
      });
    });
  }
  /**
   * Register a callback that will be called when the editor changes.
   */
  onChange(t) {
    return this.on("onChange", t), () => {
      this.off("onChange", t);
    };
  }
  /**
   * Register a callback that will be called when the selection changes.
   */
  onSelectionChange(t, e = !1) {
    const o = (r) => {
      r.transaction.getMeta("$y-sync") && !e || t(this.editor);
    };
    return this.on("onSelectionChange", o), () => {
      this.off("onSelectionChange", o);
    };
  }
  /**
   * Register a callback that will be called when the editor is mounted.
   */
  onMount(t) {
    return this.on("onMount", t), () => {
      this.off("onMount", t);
    };
  }
  /**
   * Register a callback that will be called when the editor is unmounted.
   */
  onUnmount(t) {
    return this.on("onUnmount", t), () => {
      this.off("onUnmount", t);
    };
  }
}
function ds(n) {
  return Array.prototype.indexOf.call(n.parentElement.childNodes, n);
}
function hs(n) {
  return n.nodeType === 3 && !/\S/.test(n.nodeValue || "");
}
function us(n) {
  n.querySelectorAll("li > ul, li > ol").forEach((t) => {
    const e = ds(t), o = t.parentElement, r = Array.from(o.childNodes).slice(
      e + 1
    );
    t.remove(), r.forEach((s) => {
      s.remove();
    }), o.insertAdjacentElement("afterend", t), r.reverse().forEach((s) => {
      if (hs(s))
        return;
      const i = document.createElement("li");
      i.append(s), t.insertAdjacentElement("afterend", i);
    }), o.childNodes.length === 0 && o.remove();
  });
}
function ps(n) {
  n.querySelectorAll("li + ul, li + ol").forEach((t) => {
    var s, i;
    const e = t.previousElementSibling, o = document.createElement("div");
    e.insertAdjacentElement("afterend", o), o.append(e);
    const r = document.createElement("div");
    for (r.setAttribute("data-node-type", "blockGroup"), o.append(r); ((s = o.nextElementSibling) == null ? void 0 : s.nodeName) === "UL" || ((i = o.nextElementSibling) == null ? void 0 : i.nodeName) === "OL"; )
      r.append(o.nextElementSibling);
  });
}
let ct = null;
function ms() {
  return ct || (ct = document.implementation.createHTMLDocument("title"));
}
function fs(n) {
  if (typeof n == "string") {
    const t = ms().createElement("div");
    t.innerHTML = n, n = t;
  }
  return us(n), ps(n), n;
}
function Vt(n, t) {
  const e = fs(n), r = lt.fromSchema(t).parse(e, {
    topNode: t.nodes.blockGroup.create()
  }), s = [];
  for (let i = 0; i < r.childCount; i++)
    s.push(B(r.child(i), t));
  return s;
}
function gs(n, t) {
  const e = t.value ? t.value : "", o = {};
  t.lang && (o["data-language"] = t.lang);
  let r = {
    type: "element",
    tagName: "code",
    properties: o,
    children: [{ type: "text", value: e }]
  };
  return t.meta && (r.data = { meta: t.meta }), n.patch(t, r), r = n.applyData(t, r), r = {
    type: "element",
    tagName: "pre",
    properties: {},
    children: [r]
  }, n.patch(t, r), r;
}
function bs(n, t) {
  var s;
  const e = String((t == null ? void 0 : t.url) || ""), o = t != null && t.title ? String(t.title) : void 0;
  let r = {
    type: "element",
    tagName: "video",
    properties: {
      src: e,
      "data-name": o,
      "data-url": e,
      controls: !0
    },
    children: []
  };
  return (s = n.patch) == null || s.call(n, t, r), r = n.applyData ? n.applyData(t, r) : r, r;
}
function $t(n) {
  return wt().use(sn).use(kt).use(an, {
    handlers: {
      ...Ye,
      image: (e, o) => {
        const r = String((o == null ? void 0 : o.url) || "");
        return fo(r) ? bs(e, o) : Ye.image(e, o);
      },
      code: gs
    }
  }).use(cn).processSync(n).value;
}
function ks(n, t) {
  const e = $t(n);
  return Vt(e, t);
}
class ws {
  constructor(t) {
    this.editor = t;
  }
  /**
   * Exports blocks into a simplified HTML string. To better conform to HTML standards, children of blocks which aren't list
   * items are un-nested in the output HTML.
   *
   * @param blocks An array of blocks that should be serialized into HTML.
   * @returns The blocks, serialized as an HTML string.
   */
  blocksToHTMLLossy(t = this.editor.document) {
    return Se(
      this.editor.pmSchema,
      this.editor
    ).exportBlocks(t, {});
  }
  /**
   * Serializes blocks into an HTML string in the format that would normally be rendered by the editor.
   *
   * Use this method if you want to server-side render HTML (for example, a blog post that has been edited in BlockNote)
   * and serve it to users without loading the editor on the client (i.e.: displaying the blog post)
   *
   * @param blocks An array of blocks that should be serialized into HTML.
   * @returns The blocks, serialized as an HTML string.
   */
  blocksToFullHTML(t) {
    return bn(
      this.editor.pmSchema,
      this.editor
    ).serializeBlocks(t, {});
  }
  /**
   * Parses blocks from an HTML string. Tries to create `Block` objects out of any HTML block-level elements, and
   * `InlineNode` objects from any HTML inline elements, though not all element types are recognized. If BlockNote
   * doesn't recognize an HTML element's tag, it will parse it as a paragraph or plain text.
   * @param html The HTML string to parse blocks from.
   * @returns The blocks parsed from the HTML string.
   */
  tryParseHTMLToBlocks(t) {
    return Vt(t, this.editor.pmSchema);
  }
  /**
   * Serializes blocks into a Markdown string. The output is simplified as Markdown does not support all features of
   * BlockNote - children of blocks which aren't list items are un-nested and certain styles are removed.
   * @param blocks An array of blocks that should be serialized into Markdown.
   * @returns The blocks, serialized as a Markdown string.
   */
  blocksToMarkdownLossy(t = this.editor.document) {
    return Gn(t, this.editor.pmSchema, this.editor, {});
  }
  /**
   * Creates a list of blocks from a Markdown string. Tries to create `Block` and `InlineNode` objects based on
   * Markdown syntax, though not all symbols are recognized. If BlockNote doesn't recognize a symbol, it will parse it
   * as text.
   * @param markdown The Markdown string to parse blocks from.
   * @returns The blocks parsed from the Markdown string.
   */
  tryParseMarkdownToBlocks(t) {
    return ks(t, this.editor.pmSchema);
  }
  /**
   * Paste HTML into the editor. Defaults to converting HTML to BlockNote HTML.
   * @param html The HTML to paste.
   * @param raw Whether to paste the HTML as is, or to convert it to BlockNote HTML.
   */
  pasteHTML(t, e = !1) {
    var r;
    let o = t;
    if (!e) {
      const s = this.tryParseHTMLToBlocks(t);
      o = this.blocksToFullHTML(s);
    }
    o && ((r = this.editor.prosemirrorView) == null || r.pasteHTML(o));
  }
  /**
   * Paste text into the editor. Defaults to interpreting text as markdown.
   * @param text The text to paste.
   */
  pasteText(t) {
    var e;
    return (e = this.editor.prosemirrorView) == null ? void 0 : e.pasteText(t);
  }
  /**
   * Paste markdown into the editor.
   * @param markdown The markdown to paste.
   */
  pasteMarkdown(t) {
    const e = $t(t);
    return this.pasteHTML(e);
  }
}
class ys {
  constructor(t) {
    this.editor = t;
  }
  /**
   * Shorthand to get a typed extension from the editor, by
   * just passing in the extension class.
   *
   * @param ext - The extension class to get
   * @param key - optional, the key of the extension in the extensions object (defaults to the extension name)
   * @returns The extension instance
   */
  extension(t, e = t.key()) {
    const o = this.editor.extensions[e];
    if (!o)
      throw new Error(`Extension ${e} not found`);
    return o;
  }
  /**
   * Get all extensions
   */
  getExtensions() {
    return this.editor.extensions;
  }
  /**
   * Get a specific extension by key
   */
  getExtension(t) {
    return this.editor.extensions[t];
  }
  /**
   * Check if an extension exists
   */
  hasExtension(t) {
    return t in this.editor.extensions;
  }
  // Plugin getters - these provide access to the core BlockNote plugins
  /**
   * Get the formatting toolbar plugin
   */
  get formattingToolbar() {
    return this.editor.extensions.formattingToolbar;
  }
  /**
   * Get the link toolbar plugin
   */
  get linkToolbar() {
    return this.editor.extensions.linkToolbar;
  }
  /**
   * Get the side menu plugin
   */
  get sideMenu() {
    return this.editor.extensions.sideMenu;
  }
  /**
   * Get the suggestion menus plugin
   */
  get suggestionMenus() {
    return this.editor.extensions.suggestionMenus;
  }
  /**
   * Get the file panel plugin (if available)
   */
  get filePanel() {
    return this.editor.extensions.filePanel;
  }
  /**
   * Get the table handles plugin (if available)
   */
  get tableHandles() {
    return this.editor.extensions.tableHandles;
  }
  /**
   * Get the show selection plugin
   */
  get showSelectionPlugin() {
    return this.editor.extensions.showSelection;
  }
  /**
   * Check if collaboration is enabled (Yjs or Liveblocks)
   */
  get isCollaborationEnabled() {
    return this.hasExtension("ySyncPlugin") || this.hasExtension("liveblocksExtension");
  }
}
function Cs(n) {
  const t = I(n);
  if (n.selection.empty || "node" in n.selection)
    return;
  const e = n.doc.resolve(
    re(n.doc, n.selection.from).posBeforeNode
  ), o = n.doc.resolve(
    re(n.doc, n.selection.to).posBeforeNode
  ), r = (l, d) => {
    const u = e.posAtIndex(l, d), p = n.doc.resolve(u).nodeAfter;
    if (!p)
      throw new Error(
        `Error getting selection - node not found at position ${u}`
      );
    return B(p, t);
  }, s = [], i = e.sharedDepth(o.pos), c = e.index(i), a = o.index(i);
  if (e.depth > i) {
    s.push(B(e.nodeAfter, t));
    for (let l = e.depth; l > i; l--)
      if (e.node(l).type.isInGroup("childContainer")) {
        const u = e.index(l) + 1, p = e.node(l).childCount;
        for (let m = u; m < p; m++)
          s.push(r(m, l));
      }
  } else
    s.push(r(c, i));
  for (let l = c + 1; l <= a; l++)
    s.push(r(l, i));
  if (s.length === 0)
    throw new Error(
      `Error getting selection - selection doesn't span any blocks (${n.selection})`
    );
  return {
    blocks: s
  };
}
function vs(n, t, e) {
  const o = typeof t == "string" ? t : t.id, r = typeof e == "string" ? e : e.id, s = I(n), i = gt(s);
  if (o === r)
    throw new Error(
      `Attempting to set selection with the same anchor and head blocks (id ${o})`
    );
  const c = _(o, n.doc);
  if (!c)
    throw new Error(`Block with ID ${o} not found`);
  const a = _(r, n.doc);
  if (!a)
    throw new Error(`Block with ID ${r} not found`);
  const l = Te(c), d = Te(a), u = i.blockSchema[l.blockNoteType], p = i.blockSchema[d.blockNoteType];
  if (!l.isBlockContainer || u.content === "none")
    throw new Error(
      `Attempting to set selection anchor in block without content (id ${o})`
    );
  if (!d.isBlockContainer || p.content === "none")
    throw new Error(
      `Attempting to set selection anchor in block without content (id ${r})`
    );
  let m, g;
  if (u.content === "table") {
    const f = qe.get(l.blockContent.node);
    m = l.blockContent.beforePos + f.positionAt(0, 0, l.blockContent.node) + 1 + 2;
  } else
    m = l.blockContent.beforePos + 1;
  if (p.content === "table") {
    const f = qe.get(d.blockContent.node), b = d.blockContent.beforePos + f.positionAt(
      f.height - 1,
      f.width - 1,
      d.blockContent.node
    ) + 1, k = n.doc.resolve(b).nodeAfter.nodeSize;
    g = b + k - 2;
  } else
    g = d.blockContent.afterPos - 1;
  n.setSelection(T.create(n.doc, m, g));
}
function Ss(n) {
  const t = I(n);
  let e = n.selection.$from, o = n.selection.$to;
  for (; o.parentOffset >= o.parent.nodeSize - 2 && o.depth > 0; )
    o = n.doc.resolve(o.pos + 1);
  for (; o.parentOffset === 0 && o.depth > 0; )
    o = n.doc.resolve(o.pos - 1);
  for (; e.parentOffset === 0 && e.depth > 0; )
    e = n.doc.resolve(e.pos - 1);
  for (; e.parentOffset >= e.parent.nodeSize - 2 && e.depth > 0; )
    e = n.doc.resolve(e.pos + 1);
  const r = go(
    n.doc.slice(e.pos, o.pos, !0),
    t
  );
  return {
    _meta: {
      startPos: e.pos,
      endPos: o.pos
    },
    ...r
  };
}
function Bs(n) {
  const { bnBlock: t } = Ce(n), e = I(n.doc), o = n.doc.resolve(t.beforePos), r = o.nodeBefore, s = n.doc.resolve(t.afterPos).nodeAfter;
  let i;
  return o.depth > 1 && (i = o.node(), i.type.isInGroup("bnBlock") || (i = o.node(o.depth - 1))), {
    block: B(t.node, e),
    prevBlock: r === null ? void 0 : B(r, e),
    nextBlock: s === null ? void 0 : B(s, e),
    parentBlock: i === void 0 ? void 0 : B(i, e)
  };
}
function Ft(n, t, e = "start") {
  const o = typeof t == "string" ? t : t.id, r = I(n.doc), s = gt(r), i = _(o, n.doc);
  if (!i)
    throw new Error(`Block with ID ${o} not found`);
  const c = Te(i), a = s.blockSchema[c.blockNoteType].content;
  if (c.isBlockContainer) {
    const l = c.blockContent;
    if (a === "none") {
      n.setSelection(X.create(n.doc, l.beforePos));
      return;
    }
    if (a === "inline")
      e === "start" ? n.setSelection(
        T.create(n.doc, l.beforePos + 1)
      ) : n.setSelection(
        T.create(n.doc, l.afterPos - 1)
      );
    else if (a === "table")
      e === "start" ? n.setSelection(
        T.create(n.doc, l.beforePos + 4)
      ) : n.setSelection(
        T.create(n.doc, l.afterPos - 4)
      );
    else
      throw new ne(a);
  } else {
    const l = e === "start" ? c.childContainer.node.firstChild : c.childContainer.node.lastChild;
    Ft(n, l.attrs.id, e);
  }
}
class Es {
  constructor(t) {
    this.editor = t;
  }
  /**
   * Gets a snapshot of the current selection. This contains all blocks (included nested blocks)
   * that the selection spans across.
   *
   * If the selection starts / ends halfway through a block, the returned data will contain the entire block.
   */
  getSelection() {
    return this.editor.transact((t) => Cs(t));
  }
  /**
   * Gets a snapshot of the current selection. This contains all blocks (included nested blocks)
   * that the selection spans across.
   *
   * If the selection starts / ends halfway through a block, the returned block will be
   * only the part of the block that is included in the selection.
   */
  getSelectionCutBlocks() {
    return this.editor.transact((t) => Ss(t));
  }
  /**
   * Sets the selection to a range of blocks.
   * @param startBlock The identifier of the block that should be the start of the selection.
   * @param endBlock The identifier of the block that should be the end of the selection.
   */
  setSelection(t, e) {
    return this.editor.transact((o) => vs(o, t, e));
  }
  /**
   * Gets a snapshot of the current text cursor position.
   * @returns A snapshot of the current text cursor position.
   */
  getTextCursorPosition() {
    return this.editor.transact((t) => Bs(t));
  }
  /**
   * Sets the text cursor position to the start or end of an existing block. Throws an error if the target block could
   * not be found.
   * @param targetBlock The identifier of an existing block that the text cursor should be moved to.
   * @param placement Whether the text cursor should be placed at the start or end of the block.
   */
  setTextCursorPosition(t, e = "start") {
    return this.editor.transact(
      (o) => Ft(o, t, e)
    );
  }
  /**
   * Gets the bounding box of the current selection.
   */
  getSelectionBoundingBox() {
    if (!this.editor.prosemirrorView)
      return;
    const { selection: t } = this.editor.prosemirrorState, { ranges: e } = t, o = Math.min(...e.map((s) => s.$from.pos)), r = Math.max(...e.map((s) => s.$to.pos));
    if (xe(t)) {
      const s = this.editor.prosemirrorView.nodeDOM(o);
      if (s)
        return s.getBoundingClientRect();
    }
    return fe(this.editor.prosemirrorView, o, r);
  }
}
class Ms {
  constructor(t, e) {
    /**
     * Stores the currently active transaction, which is the accumulated transaction from all {@link dispatch} calls during a {@link transact} calls
     */
    h(this, "activeTransaction", null);
    // Flag to indicate if we're in a `can` call
    h(this, "isInCan", !1);
    this.editor = t, this.options = e;
  }
  /**
   * For any command that can be executed, you can check if it can be executed by calling `editor.can(command)`.
   * @example
   * ```ts
   * if (editor.can(editor.undo)) {
   *   // show button
   * } else {
   *   // hide button
   * }
   */
  can(t) {
    try {
      return this.isInCan = !0, t();
    } finally {
      this.isInCan = !1;
    }
  }
  /**
   * Execute a prosemirror command. This is mostly for backwards compatibility with older code.
   *
   * @note You should prefer the {@link transact} method when possible, as it will automatically handle the dispatching of the transaction and work across blocknote transactions.
   *
   * @example
   * ```ts
   * editor.exec((state, dispatch, view) => {
   *   dispatch(state.tr.insertText("Hello, world!"));
   * });
   * ```
   */
  exec(t) {
    if (this.activeTransaction)
      throw new Error(
        "`exec` should not be called within a `transact` call, move the `exec` call outside of the `transact` call"
      );
    if (this.isInCan)
      return this.canExec(t);
    const e = this.prosemirrorState, o = this.prosemirrorView;
    return t(e, (s) => this.prosemirrorView.dispatch(s), o);
  }
  /**
   * Check if a command can be executed. A command should return `false` if it is not valid in the current state.
   *
   * @example
   * ```ts
   * if (editor.canExec(command)) {
   *   // show button
   * } else {
   *   // hide button
   * }
   * ```
   */
  canExec(t) {
    if (this.activeTransaction)
      throw new Error(
        "`canExec` should not be called within a `transact` call, move the `canExec` call outside of the `transact` call"
      );
    const e = this.prosemirrorState, o = this.prosemirrorView;
    return t(e, void 0, o);
  }
  /**
   * Execute a function within a "blocknote transaction".
   * All changes to the editor within the transaction will be grouped together, so that
   * we can dispatch them as a single operation (thus creating only a single undo step)
   *
   * @note There is no need to dispatch the transaction, as it will be automatically dispatched when the callback is complete.
   *
   * @example
   * ```ts
   * // All changes to the editor will be grouped together
   * editor.transact((tr) => {
   *   tr.insertText("Hello, world!");
   * // These two operations will be grouped together in a single undo step
   *   editor.transact((tr) => {
   *     tr.insertText("Hello, world!");
   *   });
   * });
   * ```
   */
  transact(t) {
    if (this.activeTransaction)
      return t(this.activeTransaction);
    try {
      this.activeTransaction = this.editor._tiptapEditor.state.tr;
      const e = t(this.activeTransaction), o = this.activeTransaction;
      return this.activeTransaction = null, o && // Only dispatch if the transaction was actually modified in some way
      (o.docChanged || o.selectionSet || o.scrolledIntoView || o.storedMarksSet || !o.isGeneric) && this.prosemirrorView.dispatch(o), e;
    } finally {
      this.activeTransaction = null;
    }
  }
  /**
   * Get the underlying prosemirror state
   * @note Prefer using `editor.transact` to read the current editor state, as that will ensure the state is up to date
   * @see https://prosemirror.net/docs/ref/#state.EditorState
   */
  get prosemirrorState() {
    if (this.activeTransaction)
      throw new Error(
        "`prosemirrorState` should not be called within a `transact` call, move the `prosemirrorState` call outside of the `transact` call or use `editor.transact` to read the current editor state"
      );
    return this.editor._tiptapEditor.state;
  }
  /**
   * Get the underlying prosemirror view
   * @see https://prosemirror.net/docs/ref/#view.EditorView
   */
  get prosemirrorView() {
    return this.editor._tiptapEditor.view;
  }
  isFocused() {
    var t;
    return ((t = this.prosemirrorView) == null ? void 0 : t.hasFocus()) || !1;
  }
  focus() {
    var t;
    (t = this.prosemirrorView) == null || t.focus();
  }
  /**
   * Checks if the editor is currently editable, or if it's locked.
   * @returns True if the editor is editable, false otherwise.
   */
  get isEditable() {
    if (!this.editor._tiptapEditor) {
      if (!this.editor.headless)
        throw new Error("no editor, but also not headless?");
      return !1;
    }
    return this.editor._tiptapEditor.isEditable === void 0 ? !0 : this.editor._tiptapEditor.isEditable;
  }
  /**
   * Makes the editor editable or locks it, depending on the argument passed.
   * @param editable True to make the editor editable, or false to lock it.
   */
  set isEditable(t) {
    if (!this.editor._tiptapEditor) {
      if (!this.editor.headless)
        throw new Error("no editor, but also not headless?");
      return;
    }
    this.editor._tiptapEditor.options.editable !== t && this.editor._tiptapEditor.setEditable(t);
  }
  /**
   * Undo the last action.
   */
  undo() {
    var t;
    return this.exec(((t = this.options) == null ? void 0 : t.undo) ?? ln);
  }
  /**
   * Redo the last action.
   */
  redo() {
    var t;
    return this.exec(((t = this.options) == null ? void 0 : t.redo) ?? dn);
  }
}
function Ps(n, t, e, o = { updateSelection: !0 }) {
  let { from: r, to: s } = typeof t == "number" ? { from: t, to: t } : { from: t.from, to: t.to }, i = !0, c = !0, a = "";
  if (e.forEach((l) => {
    l.check(), i && l.isText && l.marks.length === 0 ? a += l.text : i = !1, c = c ? l.isBlock : !1;
  }), r === s && c) {
    const { parent: l } = n.doc.resolve(r);
    l.isTextblock && !l.type.spec.code && !l.childCount && (r -= 1, s += 1);
  }
  return i ? n.insertText(a, r, s) : n.replaceWith(r, s, e), o.updateSelection && So(n, n.steps.length - 1, -1), !0;
}
class Ts {
  constructor(t) {
    this.editor = t;
  }
  /**
   * Insert a piece of content at the current cursor position.
   *
   * @param content can be a string, or array of partial inline content elements
   */
  insertInlineContent(t, { updateSelection: e = !1 } = {}) {
    const o = Y(t, this.editor.pmSchema);
    this.editor.transact((r) => {
      Ps(
        r,
        {
          from: r.selection.from,
          to: r.selection.to
        },
        o,
        {
          updateSelection: e
        }
      );
    });
  }
  /**
   * Gets the active text styles at the text cursor position or at the end of the current selection if it's active.
   */
  getActiveStyles() {
    return this.editor.transact((t) => {
      const e = {}, o = t.selection.$to.marks();
      for (const r of o) {
        const s = this.editor.schema.styleSchema[r.type.name];
        if (!s) {
          // Links are not considered styles in blocknote
          r.type.name !== "link" && // "blocknoteIgnore" tagged marks (such as comments) are also not considered BlockNote "styles"
          !r.type.spec.blocknoteIgnore && console.warn("mark not found in styleschema", r.type.name);
          continue;
        }
        s.propSchema === "boolean" ? e[s.type] = !0 : e[s.type] = r.attrs.stringValue;
      }
      return e;
    });
  }
  /**
   * Adds styles to the currently selected content.
   * @param styles The styles to add.
   */
  addStyles(t) {
    for (const [e, o] of Object.entries(t)) {
      const r = this.editor.schema.styleSchema[e];
      if (!r)
        throw new Error(`style ${e} not found in styleSchema`);
      if (r.propSchema === "boolean")
        this.editor._tiptapEditor.commands.setMark(e);
      else if (r.propSchema === "string")
        this.editor._tiptapEditor.commands.setMark(e, {
          stringValue: o
        });
      else
        throw new ne(r.propSchema);
    }
  }
  /**
   * Removes styles from the currently selected content.
   * @param styles The styles to remove.
   */
  removeStyles(t) {
    for (const e of Object.keys(t))
      this.editor._tiptapEditor.commands.unsetMark(e);
  }
  /**
   * Toggles styles on the currently selected content.
   * @param styles The styles to toggle.
   */
  toggleStyles(t) {
    for (const [e, o] of Object.entries(t)) {
      const r = this.editor.schema.styleSchema[e];
      if (!r)
        throw new Error(`style ${e} not found in styleSchema`);
      if (r.propSchema === "boolean")
        this.editor._tiptapEditor.commands.toggleMark(e);
      else if (r.propSchema === "string")
        this.editor._tiptapEditor.commands.toggleMark(e, {
          stringValue: o
        });
      else
        throw new ne(r.propSchema);
    }
  }
  /**
   * Gets the currently selected text.
   */
  getSelectedText() {
    return this.editor.transact((t) => t.doc.textBetween(t.selection.from, t.selection.to));
  }
  /**
   * Gets the URL of the last link in the current selection, or `undefined` if there are no links in the selection.
   */
  getSelectedLinkUrl() {
    return this.editor._tiptapEditor.getAttributes("link").href;
  }
  /**
   * Creates a new link to replace the selected content.
   * @param url The link URL.
   * @param text The text to display the link with.
   */
  createLink(t, e) {
    if (t === "")
      return;
    const o = this.editor.pmSchema.mark("link", { href: t });
    this.editor.transact((r) => {
      const { from: s, to: i } = r.selection;
      e ? r.insertText(e, s, i).addMark(s, s + e.length, o) : r.setSelection(T.create(r.doc, i)).addMark(
        s,
        i,
        o
      );
    });
  }
}
function xs(n, t) {
  const e = [];
  return n.forEach((o, r, s) => {
    s !== t && e.push(o);
  }), V.from(e);
}
function Is(n, t) {
  const e = [];
  for (let o = 0; o < n.childCount; o++)
    if (n.child(o).type.name === "tableRow")
      if (e.length > 0 && e[e.length - 1].type.name === "table") {
        const r = e[e.length - 1], s = r.copy(r.content.addToEnd(n.child(o)));
        e[e.length - 1] = s;
      } else {
        const r = t.nodes.table.createChecked(
          void 0,
          n.child(o)
        );
        e.push(r);
      }
    else
      e.push(n.child(o));
  return n = V.from(e), n;
}
function Ls(n, t) {
  let e = V.from(n.content);
  if (e = Is(e, t.state.schema), !Ds(e, t))
    return new q(e, n.openStart, n.openEnd);
  for (let o = 0; o < e.childCount; o++)
    if (e.child(o).type.spec.group === "blockContent") {
      const r = [e.child(o)];
      if (o + 1 < e.childCount && e.child(o + 1).type.name === "blockGroup") {
        const i = e.child(o + 1).child(0).child(0);
        (i.type.name === "bulletListItem" || i.type.name === "numberedListItem" || i.type.name === "checkListItem") && (r.push(e.child(o + 1)), e = xs(e, o + 1));
      }
      const s = t.state.schema.nodes.blockContainer.createChecked(
        void 0,
        r
      );
      e = e.replaceChild(o, s);
    }
  return new q(e, n.openStart, n.openEnd);
}
function Ds(n, t) {
  var s, i;
  const e = n.childCount === 1, o = ((s = n.firstChild) == null ? void 0 : s.type.spec.content) === "inline*", r = ((i = n.firstChild) == null ? void 0 : i.type.spec.content) === "tableRow+";
  if (e) {
    if (o)
      return !1;
    if (r) {
      const c = A(t.state);
      if (c.isBlockContainer)
        return !(c.blockContent.node.type.spec.content === "tableRow+");
    }
  }
  return !0;
}
const As = {
  enableInputRules: !0,
  enablePasteRules: !0,
  enableCoreExtensions: !1
};
class zt extends Ae {
  constructor(e) {
    var l, d, u, p, m, g, f, b, k, w, D, F, J, Q, Z, ee, v, M, Ue;
    super();
    /**
     * The underlying prosemirror schema
     */
    h(this, "pmSchema");
    /**
     * extensions that are added to the editor, can be tiptap extensions or prosemirror plugins
     */
    h(this, "extensions", {});
    h(this, "_tiptapEditor");
    /**
     * Used by React to store a reference to an `ElementRenderer` helper utility to make sure we can render React elements
     * in the correct context (used by `ReactRenderUtil`)
     */
    h(this, "elementRenderer", null);
    /**
     * Cache of all blocks. This makes sure we don't have to "recompute" blocks if underlying Prosemirror Nodes haven't changed.
     * This is especially useful when we want to keep track of the same block across multiple operations,
     * with this cache, blocks stay the same object reference (referential equality with ===).
     */
    h(this, "blockCache", /* @__PURE__ */ new WeakMap());
    /**
     * The dictionary contains translations for the editor.
     */
    h(this, "dictionary");
    /**
     * The schema of the editor. The schema defines which Blocks, InlineContent, and Styles are available in the editor.
     */
    h(this, "schema");
    h(this, "blockImplementations");
    h(this, "inlineContentImplementations");
    h(this, "styleImplementations");
    /**
     * The `uploadFile` method is what the editor uses when files need to be uploaded (for example when selecting an image to upload).
     * This method should set when creating the editor as this is application-specific.
     *
     * `undefined` means the application doesn't support file uploads.
     *
     * @param file The file that should be uploaded.
     * @returns The URL of the uploaded file OR an object containing props that should be set on the file block (such as an id)
     */
    h(this, "uploadFile");
    h(this, "onUploadStartCallbacks", []);
    h(this, "onUploadEndCallbacks", []);
    h(this, "resolveFileUrl");
    h(this, "resolveUsers");
    /**
     * Editor settings
     */
    h(this, "settings");
    // Manager instances
    h(this, "_blockManager");
    h(this, "_collaborationManager");
    h(this, "_eventManager");
    h(this, "_exportManager");
    h(this, "_extensionManager");
    h(this, "_selectionManager");
    h(this, "_stateManager");
    h(this, "_styleManager");
    /**
     * Mount the editor to a DOM element.
     *
     * @warning Not needed to call manually when using React, use BlockNoteView to take care of mounting
     */
    h(this, "mount", (e) => {
      this._tiptapEditor.mount({ mount: e });
    });
    /**
     * Unmount the editor from the DOM element it is bound to
     */
    h(this, "unmount", () => {
      this._tiptapEditor.unmount();
    });
    this.options = e;
    const o = e;
    if (o.onEditorContentChange)
      throw new Error(
        "onEditorContentChange initialization option is deprecated, use <BlockNoteView onChange={...} />, the useEditorChange(...) hook, or editor.onChange(...)"
      );
    if (o.onTextCursorPositionChange)
      throw new Error(
        "onTextCursorPositionChange initialization option is deprecated, use <BlockNoteView onSelectionChange={...} />, the useEditorSelectionChange(...) hook, or editor.onSelectionChange(...)"
      );
    if (o.onEditorReady)
      throw new Error(
        "onEditorReady is deprecated. Editor is immediately ready for use after creation."
      );
    if (o.editable)
      throw new Error(
        "editable initialization option is deprecated, use <BlockNoteView editable={true/false} />, or alternatively editor.isEditable = true/false"
      );
    this.dictionary = e.dictionary || rn, this.settings = {
      tables: {
        splitCells: ((l = e == null ? void 0 : e.tables) == null ? void 0 : l.splitCells) ?? !1,
        cellBackgroundColor: ((d = e == null ? void 0 : e.tables) == null ? void 0 : d.cellBackgroundColor) ?? !1,
        cellTextColor: ((u = e == null ? void 0 : e.tables) == null ? void 0 : u.cellTextColor) ?? !1,
        headers: ((p = e == null ? void 0 : e.tables) == null ? void 0 : p.headers) ?? !1
      }
    };
    const r = {
      defaultStyles: !0,
      schema: e.schema || bo.create(),
      ...e,
      placeholders: {
        ...this.dictionary.placeholders,
        ...e.placeholders
      }
    };
    if (r.collaboration || r.comments) {
      const y = {
        // Use collaboration options if available, otherwise provide defaults
        fragment: ((m = r.collaboration) == null ? void 0 : m.fragment) || new R.XmlFragment(),
        user: ((g = r.collaboration) == null ? void 0 : g.user) || {
          name: "User",
          color: "#FF0000"
        },
        provider: ((f = r.collaboration) == null ? void 0 : f.provider) || null,
        renderCursor: (b = r.collaboration) == null ? void 0 : b.renderCursor,
        showCursorLabels: (k = r.collaboration) == null ? void 0 : k.showCursorLabels,
        comments: r.comments,
        resolveUsers: r.resolveUsers
      };
      this._collaborationManager = new cs(
        this,
        y
      );
    } else
      this._collaborationManager = void 0;
    if (r.comments && !r.resolveUsers)
      throw new Error("resolveUsers is required when using comments");
    this.schema = r.schema, this.blockImplementations = r.schema.blockSpecs, this.inlineContentImplementations = r.schema.inlineContentSpecs, this.styleImplementations = r.schema.styleSpecs, this.extensions = {
      ...Jr({
        editor: this,
        domAttributes: r.domAttributes || {},
        blockSpecs: this.schema.blockSpecs,
        styleSpecs: this.schema.styleSpecs,
        inlineContentSpecs: this.schema.inlineContentSpecs,
        collaboration: r.collaboration,
        trailingBlock: r.trailingBlock,
        disableExtensions: r.disableExtensions,
        setIdAttribute: r.setIdAttribute,
        animations: r.animations ?? !0,
        tableHandles: ut(this, "table"),
        dropCursor: this.options.dropCursor ?? xo,
        placeholders: r.placeholders,
        tabBehavior: r.tabBehavior,
        pasteHandler: r.pasteHandler
      }),
      ...(w = this._collaborationManager) == null ? void 0 : w.initExtensions()
    }, (((D = r._tiptapOptions) == null ? void 0 : D.extensions) || []).forEach((y) => {
      this.extensions[y.name] = y;
    });
    for (let y of r.extensions || []) {
      typeof y == "function" && (y = y(this));
      const C = y.key ?? y.constructor.key();
      if (!C)
        throw new Error(
          `Extension ${y.constructor.name} does not have a key method`
        );
      if (this.extensions[C])
        throw new Error(
          `Extension ${y.constructor.name} already exists with key ${C}`
        );
      this.extensions[C] = y;
    }
    if (Object.entries(r._extensions || {}).forEach(([y, C]) => {
      const P = typeof C == "function" ? C(this) : C;
      if (!("plugin" in P)) {
        this.extensions[y] = P;
        return;
      }
      this.extensions[y] = new class extends S {
        static key() {
          return y;
        }
        constructor() {
          super(), this.addProsemirrorPlugin(P.plugin);
        }
        get priority() {
          return P.priority;
        }
      }();
    }), r.uploadFile) {
      const y = r.uploadFile;
      this.uploadFile = async (C, H) => {
        this.onUploadStartCallbacks.forEach(
          (P) => P.apply(this, [H])
        );
        try {
          return await y(C, H);
        } finally {
          this.onUploadEndCallbacks.forEach(
            (P) => P.apply(this, [H])
          );
        }
      };
    }
    this.resolveFileUrl = r.resolveFileUrl;
    const s = "ySyncPlugin" in this.extensions || "liveblocksExtension" in this.extensions;
    s && r.initialContent && console.warn(
      "When using Collaboration, initialContent might cause conflicts, because changes should come from the collaboration provider"
    );
    const i = Object.fromEntries(
      Object.values(this.schema.blockSpecs).map((y) => y.extensions).filter((y) => y !== void 0).flat().map((y) => [y.key ?? y.constructor.key(), y])
    ), c = [
      ...Object.entries({ ...this.extensions, ...i }).map(
        ([y, C]) => {
          if (C instanceof O || C instanceof W || C instanceof ie)
            return C;
          if (C instanceof S)
            return !C.plugins.length && !C.keyboardShortcuts && !C.inputRules && !C.tiptapExtensions ? void 0 : O.create({
              name: y,
              priority: C.priority,
              addProseMirrorPlugins: () => C.plugins,
              addExtensions: () => C.tiptapExtensions || [],
              // TODO maybe collect all input rules from all extensions into one plugin
              // TODO consider using the prosemirror-inputrules package instead
              addInputRules: C.inputRules ? () => C.inputRules.map(
                (H) => new Bo({
                  find: H.find,
                  handler: ({ range: P, match: Be, state: Re }) => {
                    const Ve = H.replace({
                      match: Be,
                      range: P,
                      editor: this
                    });
                    if (Ve) {
                      const Gt = this.getTextCursorPosition();
                      if (this.schema.blockSchema[Gt.block.type].content !== "inline")
                        return;
                      const jt = Ce(
                        Re.tr
                      ), Kt = Re.tr.deleteRange(
                        P.from,
                        P.to
                      );
                      ko(
                        Kt,
                        jt.bnBlock.beforePos,
                        Ve
                      );
                      return;
                    }
                    return null;
                  }
                })
              ) : void 0,
              addKeyboardShortcuts: C.keyboardShortcuts ? () => Object.fromEntries(
                Object.entries(C.keyboardShortcuts).map(
                  ([H, P]) => [
                    H,
                    () => P({ editor: this })
                  ]
                )
              ) : void 0
            });
        }
      )
    ].filter((y) => y !== void 0), a = {
      ...As,
      ...r._tiptapOptions,
      element: null,
      autofocus: r.autofocus ?? !1,
      extensions: c,
      editorProps: {
        ...(F = r._tiptapOptions) == null ? void 0 : F.editorProps,
        attributes: {
          // As of TipTap v2.5.0 the tabIndex is removed when the editor is not
          // editable, so you can't focus it. We want to revert this as we have
          // UI behaviour that relies on it.
          tabIndex: "0",
          ...(Q = (J = r._tiptapOptions) == null ? void 0 : J.editorProps) == null ? void 0 : Q.attributes,
          ...(Z = r.domAttributes) == null ? void 0 : Z.editor,
          class: _e(
            "bn-editor",
            r.defaultStyles ? "bn-default-styles" : "",
            ((v = (ee = r.domAttributes) == null ? void 0 : ee.editor) == null ? void 0 : v.class) || ""
          )
        },
        transformPasted: Ls
      }
    };
    try {
      const y = r.initialContent || (s ? [
        {
          type: "paragraph",
          id: "initialBlockId"
        }
      ] : [
        {
          type: "paragraph",
          id: ft.options.generateID()
        }
      ]);
      if (!Array.isArray(y) || y.length === 0)
        throw new Error(
          "initialContent must be a non-empty array of blocks, received: " + y
        );
      const C = Eo(a.extensions), H = y.map(
        (Be) => De(Be, C, this.schema.styleSchema).toJSON()
      ), P = Mo(
        {
          type: "doc",
          content: [
            {
              type: "blockGroup",
              content: H
            }
          ]
        },
        C,
        a.parseOptions
      );
      this._tiptapEditor = new Po({
        ...a,
        content: P.toJSON()
      }), this.pmSchema = this._tiptapEditor.schema;
    } catch (y) {
      throw new Error(
        "Error creating document from blocks passed as `initialContent`",
        { cause: y }
      );
    }
    this.pmSchema.cached.blockNoteEditor = this, this._blockManager = new as(this), this._eventManager = new ls(this), this._exportManager = new ws(this), this._extensionManager = new ys(this), this._selectionManager = new Es(this), this._stateManager = new Ms(
      this,
      s ? {
        undo: (M = this._collaborationManager) == null ? void 0 : M.getUndoCommand(),
        redo: (Ue = this._collaborationManager) == null ? void 0 : Ue.getRedoCommand()
      } : void 0
    ), this._styleManager = new Ts(this), this.emit("create");
  }
  get formattingToolbar() {
    return this._extensionManager.formattingToolbar;
  }
  get linkToolbar() {
    return this._extensionManager.linkToolbar;
  }
  get sideMenu() {
    return this._extensionManager.sideMenu;
  }
  get suggestionMenus() {
    return this._extensionManager.suggestionMenus;
  }
  get filePanel() {
    return this._extensionManager.filePanel;
  }
  get tableHandles() {
    return this._extensionManager.tableHandles;
  }
  get comments() {
    var e;
    return (e = this._collaborationManager) == null ? void 0 : e.comments;
  }
  get showSelectionPlugin() {
    return this._extensionManager.showSelectionPlugin;
  }
  /**
   * The plugin for forking a document, only defined if in collaboration mode
   */
  get forkYDocPlugin() {
    var e;
    return (e = this._collaborationManager) == null ? void 0 : e.forkYDocPlugin;
  }
  static create(e) {
    return new zt(e ?? {});
  }
  /**
   * Execute a prosemirror command. This is mostly for backwards compatibility with older code.
   *
   * @note You should prefer the {@link transact} method when possible, as it will automatically handle the dispatching of the transaction and work across blocknote transactions.
   *
   * @example
   * ```ts
   * editor.exec((state, dispatch, view) => {
   *   dispatch(state.tr.insertText("Hello, world!"));
   * });
   * ```
   */
  exec(e) {
    return this._stateManager.exec(e);
  }
  /**
   * Check if a command can be executed. A command should return `false` if it is not valid in the current state.
   *
   * @example
   * ```ts
   * if (editor.canExec(command)) {
   *   // show button
   * } else {
   *   // hide button
   * }
   * ```
   */
  canExec(e) {
    return this._stateManager.canExec(e);
  }
  /**
   * Execute a function within a "blocknote transaction".
   * All changes to the editor within the transaction will be grouped together, so that
   * we can dispatch them as a single operation (thus creating only a single undo step)
   *
   * @note There is no need to dispatch the transaction, as it will be automatically dispatched when the callback is complete.
   *
   * @example
   * ```ts
   * // All changes to the editor will be grouped together
   * editor.transact((tr) => {
   *   tr.insertText("Hello, world!");
   * // These two operations will be grouped together in a single undo step
   *   editor.transact((tr) => {
   *     tr.insertText("Hello, world!");
   *   });
   * });
   * ```
   */
  transact(e) {
    return this._stateManager.transact(e);
  }
  // TO DISCUSS
  /**
   * Shorthand to get a typed extension from the editor, by
   * just passing in the extension class.
   *
   * @param ext - The extension class to get
   * @param key - optional, the key of the extension in the extensions object (defaults to the extension name)
   * @returns The extension instance
   */
  extension(e, o = e.key()) {
    return this._extensionManager.extension(e, o);
  }
  /**
   * Get the underlying prosemirror state
   * @note Prefer using `editor.transact` to read the current editor state, as that will ensure the state is up to date
   * @see https://prosemirror.net/docs/ref/#state.EditorState
   */
  get prosemirrorState() {
    return this._stateManager.prosemirrorState;
  }
  /**
   * Get the underlying prosemirror view
   * @see https://prosemirror.net/docs/ref/#view.EditorView
   */
  get prosemirrorView() {
    return this._stateManager.prosemirrorView;
  }
  get domElement() {
    var e;
    return (e = this.prosemirrorView) == null ? void 0 : e.dom;
  }
  isFocused() {
    var e;
    return ((e = this.prosemirrorView) == null ? void 0 : e.hasFocus()) || !1;
  }
  get headless() {
    return !this._tiptapEditor.isInitialized;
  }
  focus() {
    this.headless || this.prosemirrorView.focus();
  }
  onUploadStart(e) {
    return this.onUploadStartCallbacks.push(e), () => {
      const o = this.onUploadStartCallbacks.indexOf(e);
      o > -1 && this.onUploadStartCallbacks.splice(o, 1);
    };
  }
  onUploadEnd(e) {
    return this.onUploadEndCallbacks.push(e), () => {
      const o = this.onUploadEndCallbacks.indexOf(e);
      o > -1 && this.onUploadEndCallbacks.splice(o, 1);
    };
  }
  /**
   * @deprecated, use `editor.document` instead
   */
  get topLevelBlocks() {
    return this.document;
  }
  /**
   * Gets a snapshot of all top-level (non-nested) blocks in the editor.
   * @returns A snapshot of all top-level (non-nested) blocks in the editor.
   */
  get document() {
    return this._blockManager.document;
  }
  /**
   * Gets a snapshot of an existing block from the editor.
   * @param blockIdentifier The identifier of an existing block that should be
   * retrieved.
   * @returns The block that matches the identifier, or `undefined` if no
   * matching block was found.
   */
  getBlock(e) {
    return this._blockManager.getBlock(e);
  }
  /**
   * Gets a snapshot of the previous sibling of an existing block from the
   * editor.
   * @param blockIdentifier The identifier of an existing block for which the
   * previous sibling should be retrieved.
   * @returns The previous sibling of the block that matches the identifier.
   * `undefined` if no matching block was found, or it's the first child/block
   * in the document.
   */
  getPrevBlock(e) {
    return this._blockManager.getPrevBlock(e);
  }
  /**
   * Gets a snapshot of the next sibling of an existing block from the editor.
   * @param blockIdentifier The identifier of an existing block for which the
   * next sibling should be retrieved.
   * @returns The next sibling of the block that matches the identifier.
   * `undefined` if no matching block was found, or it's the last child/block in
   * the document.
   */
  getNextBlock(e) {
    return this._blockManager.getNextBlock(e);
  }
  /**
   * Gets a snapshot of the parent of an existing block from the editor.
   * @param blockIdentifier The identifier of an existing block for which the
   * parent should be retrieved.
   * @returns The parent of the block that matches the identifier. `undefined`
   * if no matching block was found, or the block isn't nested.
   */
  getParentBlock(e) {
    return this._blockManager.getParentBlock(e);
  }
  /**
   * Traverses all blocks in the editor depth-first, and executes a callback for each.
   * @param callback The callback to execute for each block. Returning `false` stops the traversal.
   * @param reverse Whether the blocks should be traversed in reverse order.
   */
  forEachBlock(e, o = !1) {
    this._blockManager.forEachBlock(e, o);
  }
  /**
   * Executes a callback whenever the editor's contents change.
   * @param callback The callback to execute.
   *
   * @deprecated use {@link BlockNoteEditor.onChange} instead
   */
  onEditorContentChange(e) {
    this._tiptapEditor.on("update", e);
  }
  /**
   * Executes a callback whenever the editor's selection changes.
   * @param callback The callback to execute.
   *
   * @deprecated use `onSelectionChange` instead
   */
  onEditorSelectionChange(e) {
    this._tiptapEditor.on("selectionUpdate", e);
  }
  /**
   * Gets a snapshot of the current text cursor position.
   * @returns A snapshot of the current text cursor position.
   */
  getTextCursorPosition() {
    return this._selectionManager.getTextCursorPosition();
  }
  /**
   * Sets the text cursor position to the start or end of an existing block. Throws an error if the target block could
   * not be found.
   * @param targetBlock The identifier of an existing block that the text cursor should be moved to.
   * @param placement Whether the text cursor should be placed at the start or end of the block.
   */
  setTextCursorPosition(e, o = "start") {
    return this._selectionManager.setTextCursorPosition(e, o);
  }
  /**
   * Gets a snapshot of the current selection. This contains all blocks (included nested blocks)
   * that the selection spans across.
   *
   * If the selection starts / ends halfway through a block, the returned data will contain the entire block.
   */
  getSelection() {
    return this._selectionManager.getSelection();
  }
  /**
   * Gets a snapshot of the current selection. This contains all blocks (included nested blocks)
   * that the selection spans across.
   *
   * If the selection starts / ends halfway through a block, the returned block will be
   * only the part of the block that is included in the selection.
   */
  getSelectionCutBlocks() {
    return this._selectionManager.getSelectionCutBlocks();
  }
  /**
   * Sets the selection to a range of blocks.
   * @param startBlock The identifier of the block that should be the start of the selection.
   * @param endBlock The identifier of the block that should be the end of the selection.
   */
  setSelection(e, o) {
    return this._selectionManager.setSelection(e, o);
  }
  /**
   * Checks if the editor is currently editable, or if it's locked.
   * @returns True if the editor is editable, false otherwise.
   */
  get isEditable() {
    return this._stateManager.isEditable;
  }
  /**
   * Makes the editor editable or locks it, depending on the argument passed.
   * @param editable True to make the editor editable, or false to lock it.
   */
  set isEditable(e) {
    this._stateManager.isEditable = e;
  }
  /**
   * Inserts new blocks into the editor. If a block's `id` is undefined, BlockNote generates one automatically. Throws an
   * error if the reference block could not be found.
   * @param blocksToInsert An array of partial blocks that should be inserted.
   * @param referenceBlock An identifier for an existing block, at which the new blocks should be inserted.
   * @param placement Whether the blocks should be inserted just before, just after, or nested inside the
   * `referenceBlock`.
   */
  insertBlocks(e, o, r = "before") {
    return this._blockManager.insertBlocks(
      e,
      o,
      r
    );
  }
  /**
   * Updates an existing block in the editor. Since updatedBlock is a PartialBlock object, some fields might not be
   * defined. These undefined fields are kept as-is from the existing block. Throws an error if the block to update could
   * not be found.
   * @param blockToUpdate The block that should be updated.
   * @param update A partial block which defines how the existing block should be changed.
   */
  updateBlock(e, o) {
    return this._blockManager.updateBlock(e, o);
  }
  /**
   * Removes existing blocks from the editor. Throws an error if any of the blocks could not be found.
   * @param blocksToRemove An array of identifiers for existing blocks that should be removed.
   */
  removeBlocks(e) {
    return this._blockManager.removeBlocks(e);
  }
  /**
   * Replaces existing blocks in the editor with new blocks. If the blocks that should be removed are not adjacent or
   * are at different nesting levels, `blocksToInsert` will be inserted at the position of the first block in
   * `blocksToRemove`. Throws an error if any of the blocks to remove could not be found.
   * @param blocksToRemove An array of blocks that should be replaced.
   * @param blocksToInsert An array of partial blocks to replace the old ones with.
   */
  replaceBlocks(e, o) {
    return this._blockManager.replaceBlocks(e, o);
  }
  /**
   * Undo the last action.
   */
  undo() {
    return this._stateManager.undo();
  }
  /**
   * Redo the last action.
   */
  redo() {
    return this._stateManager.redo();
  }
  /**
   * Insert a piece of content at the current cursor position.
   *
   * @param content can be a string, or array of partial inline content elements
   */
  insertInlineContent(e, { updateSelection: o = !1 } = {}) {
    this._styleManager.insertInlineContent(e, { updateSelection: o });
  }
  /**
   * Gets the active text styles at the text cursor position or at the end of the current selection if it's active.
   */
  getActiveStyles() {
    return this._styleManager.getActiveStyles();
  }
  /**
   * Adds styles to the currently selected content.
   * @param styles The styles to add.
   */
  addStyles(e) {
    this._styleManager.addStyles(e);
  }
  /**
   * Removes styles from the currently selected content.
   * @param styles The styles to remove.
   */
  removeStyles(e) {
    this._styleManager.removeStyles(e);
  }
  /**
   * Toggles styles on the currently selected content.
   * @param styles The styles to toggle.
   */
  toggleStyles(e) {
    this._styleManager.toggleStyles(e);
  }
  /**
   * Gets the currently selected text.
   */
  getSelectedText() {
    return this._styleManager.getSelectedText();
  }
  /**
   * Gets the URL of the last link in the current selection, or `undefined` if there are no links in the selection.
   */
  getSelectedLinkUrl() {
    return this._styleManager.getSelectedLinkUrl();
  }
  /**
   * Creates a new link to replace the selected content.
   * @param url The link URL.
   * @param text The text to display the link with.
   */
  createLink(e, o) {
    this._styleManager.createLink(e, o);
  }
  /**
   * Checks if the block containing the text cursor can be nested.
   */
  canNestBlock() {
    return this._blockManager.canNestBlock();
  }
  /**
   * Nests the block containing the text cursor into the block above it.
   */
  nestBlock() {
    this._blockManager.nestBlock();
  }
  /**
   * Checks if the block containing the text cursor is nested.
   */
  canUnnestBlock() {
    return this._blockManager.canUnnestBlock();
  }
  /**
   * Lifts the block containing the text cursor out of its parent.
   */
  unnestBlock() {
    this._blockManager.unnestBlock();
  }
  /**
   * Moves the selected blocks up. If the previous block has children, moves
   * them to the end of its children. If there is no previous block, but the
   * current blocks share a common parent, moves them out of & before it.
   */
  moveBlocksUp() {
    return this._blockManager.moveBlocksUp();
  }
  /**
   * Moves the selected blocks down. If the next block has children, moves
   * them to the start of its children. If there is no next block, but the
   * current blocks share a common parent, moves them out of & after it.
   */
  moveBlocksDown() {
    return this._blockManager.moveBlocksDown();
  }
  /**
   * Exports blocks into a simplified HTML string. To better conform to HTML standards, children of blocks which aren't list
   * items are un-nested in the output HTML.
   *
   * @param blocks An array of blocks that should be serialized into HTML.
   * @returns The blocks, serialized as an HTML string.
   */
  blocksToHTMLLossy(e = this.document) {
    return this._exportManager.blocksToHTMLLossy(e);
  }
  /**
   * Serializes blocks into an HTML string in the format that would normally be rendered by the editor.
   *
   * Use this method if you want to server-side render HTML (for example, a blog post that has been edited in BlockNote)
   * and serve it to users without loading the editor on the client (i.e.: displaying the blog post)
   *
   * @param blocks An array of blocks that should be serialized into HTML.
   * @returns The blocks, serialized as an HTML string.
   */
  blocksToFullHTML(e) {
    return this._exportManager.blocksToFullHTML(e);
  }
  /**
   * Parses blocks from an HTML string. Tries to create `Block` objects out of any HTML block-level elements, and
   * `InlineNode` objects from any HTML inline elements, though not all element types are recognized. If BlockNote
   * doesn't recognize an HTML element's tag, it will parse it as a paragraph or plain text.
   * @param html The HTML string to parse blocks from.
   * @returns The blocks parsed from the HTML string.
   */
  tryParseHTMLToBlocks(e) {
    return this._exportManager.tryParseHTMLToBlocks(e);
  }
  /**
   * Serializes blocks into a Markdown string. The output is simplified as Markdown does not support all features of
   * BlockNote - children of blocks which aren't list items are un-nested and certain styles are removed.
   * @param blocks An array of blocks that should be serialized into Markdown.
   * @returns The blocks, serialized as a Markdown string.
   */
  blocksToMarkdownLossy(e = this.document) {
    return this._exportManager.blocksToMarkdownLossy(e);
  }
  /**
   * Creates a list of blocks from a Markdown string. Tries to create `Block` and `InlineNode` objects based on
   * Markdown syntax, though not all symbols are recognized. If BlockNote doesn't recognize a symbol, it will parse it
   * as text.
   * @param markdown The Markdown string to parse blocks from.
   * @returns The blocks parsed from the Markdown string.
   */
  tryParseMarkdownToBlocks(e) {
    return this._exportManager.tryParseMarkdownToBlocks(e);
  }
  /**
   * Updates the user info for the current user that's shown to other collaborators.
   */
  updateCollaborationUserInfo(e) {
    if (!this._collaborationManager)
      throw new Error(
        "Cannot update collaboration user info when collaboration is disabled."
      );
    this._collaborationManager.updateUserInfo(e);
  }
  /**
   * A callback function that runs whenever the editor's contents change.
   *
   * @param callback The callback to execute.
   * @returns A function to remove the callback.
   */
  onChange(e) {
    return this._eventManager.onChange(e);
  }
  /**
   * A callback function that runs whenever the text cursor position or selection changes.
   *
   * @param callback The callback to execute.
   * @returns A function to remove the callback.
   */
  onSelectionChange(e, o) {
    return this._eventManager.onSelectionChange(
      e,
      o
    );
  }
  /**
   * A callback function that runs when the editor has been initialized.
   *
   * This can be useful for plugins to initialize themselves after the editor has been initialized.
   *
   * @param callback The callback to execute.
   * @returns A function to remove the callback.
   */
  onCreate(e) {
    return this.on("create", e), () => {
      this.off("create", e);
    };
  }
  /**
   * A callback function that runs when the editor has been mounted.
   *
   * This can be useful for plugins to initialize themselves after the editor has been mounted.
   *
   * @param callback The callback to execute.
   * @returns A function to remove the callback.
   */
  onMount(e) {
    this._eventManager.onMount(e);
  }
  /**
   * A callback function that runs when the editor has been unmounted.
   *
   * This can be useful for plugins to clean up themselves after the editor has been unmounted.
   *
   * @param callback The callback to execute.
   * @returns A function to remove the callback.
   */
  onUnmount(e) {
    this._eventManager.onUnmount(e);
  }
  /**
   * Gets the bounding box of the current selection.
   * @returns The bounding box of the current selection.
   */
  getSelectionBoundingBox() {
    return this._selectionManager.getSelectionBoundingBox();
  }
  get isEmpty() {
    const e = this.document;
    return e.length === 0 || e.length === 1 && e[0].type === "paragraph" && e[0].content.length === 0;
  }
  openSuggestionMenu(e, o) {
    this.prosemirrorView && (this.focus(), this.transact((r) => {
      o != null && o.deleteTriggerCharacter && r.insertText(e), r.scrollIntoView().setMeta(this.suggestionMenus.plugins[0], {
        triggerCharacter: e,
        deleteTriggerCharacter: (o == null ? void 0 : o.deleteTriggerCharacter) || !1,
        ignoreQueryLength: (o == null ? void 0 : o.ignoreQueryLength) || !1
      });
    }));
  }
  // `forceSelectionVisible` determines whether the editor selection is shows
  // even when the editor is not focused. This is useful for e.g. creating new
  // links, so the user still sees the affected content when an input field is
  // focused.
  // TODO: Reconsider naming?
  getForceSelectionVisible() {
    return this.showSelectionPlugin.getEnabled();
  }
  setForceSelectionVisible(e) {
    this.showSelectionPlugin.setEnabled(e);
  }
  /**
   * Paste HTML into the editor. Defaults to converting HTML to BlockNote HTML.
   * @param html The HTML to paste.
   * @param raw Whether to paste the HTML as is, or to convert it to BlockNote HTML.
   */
  pasteHTML(e, o = !1) {
    this._exportManager.pasteHTML(e, o);
  }
  /**
   * Paste text into the editor. Defaults to interpreting text as markdown.
   * @param text The text to paste.
   */
  pasteText(e) {
    return this._exportManager.pasteText(e);
  }
  /**
   * Paste markdown into the editor.
   * @param markdown The markdown to paste.
   */
  pasteMarkdown(e) {
    return this._exportManager.pasteMarkdown(e);
  }
}
class hi {
  constructor(t, e, o) {
    this.mappings = e, this.options = o;
  }
  async resolveFile(t) {
    var o;
    if (!((o = this.options) != null && o.resolveFileUrl))
      return (await fetch(t)).blob();
    const e = await this.options.resolveFileUrl(t);
    return e instanceof Blob ? e : (await fetch(e)).blob();
  }
  mapStyles(t) {
    return Object.entries(t).map(([o, r]) => this.mappings.styleMapping[o](r, this));
  }
  mapInlineContent(t) {
    return this.mappings.inlineContentMapping[t.type](
      t,
      this
    );
  }
  transformInlineContent(t) {
    return t.map((e) => this.mapInlineContent(e));
  }
  async mapBlock(t, e, o, r) {
    return this.mappings.blockMapping[t.type](
      t,
      this,
      e,
      o,
      r
    );
  }
}
function ui(n) {
  return {
    createBlockMapping: (t) => t,
    createInlineContentMapping: (t) => t,
    createStyleMapping: (t) => t
  };
}
let he;
async function _s() {
  return he || (he = (async () => {
    const [n, t] = await Promise.all([
      import("emoji-mart"),
      // use a dynamic import to encourage bundle-splitting
      // and a smaller initial client bundle size
      import("@emoji-mart/data")
    ]), e = "default" in n ? n.default : n, o = "default" in t ? t.default : t;
    return await e.init({ data: o }), { emojiMart: e, emojiData: o };
  })(), he);
}
async function pi(n, t) {
  if (!("text" in n.schema.inlineContentSchema) || n.schema.inlineContentSchema.text !== wo.text)
    return [];
  const { emojiData: e, emojiMart: o } = await _s();
  return (t.trim() === "" ? Object.values(e.emojis) : await o.SearchIndex.search(t)).map((s) => ({
    id: s.skins[0].native,
    onItemClick: () => n.insertInlineContent(s.skins[0].native + " ")
  }));
}
function mi(n, ...t) {
  const e = [...n];
  for (const o of t)
    for (const r of o) {
      const s = e.findLastIndex(
        (i) => i.group === r.group
      );
      s === -1 ? e.push(r) : e.splice(s + 1, 0, r);
    }
  return e;
}
export {
  zt as BlockNoteEditor,
  S as BlockNoteExtension,
  bo as BlockNoteSchema,
  bi as COLORS_DARK_MODE_DEFAULT,
  ki as COLORS_DEFAULT,
  wi as CustomBlockNoteSchema,
  br as DEFAULT_LINK_PROTOCOL,
  yi as EMPTY_CELL_HEIGHT,
  Ci as EMPTY_CELL_WIDTH,
  Ae as EventEmitter,
  hi as Exporter,
  vi as FILE_AUDIO_ICON_SVG,
  Si as FILE_IMAGE_ICON_SVG,
  Bi as FILE_VIDEO_ICON_SVG,
  tr as FilePanelProsemirrorPlugin,
  er as FilePanelView,
  rr as FormattingToolbarProsemirrorPlugin,
  or as FormattingToolbarView,
  Vt as HTMLToBlocks,
  fr as LinkToolbarProsemirrorPlugin,
  Ir as SideMenuProsemirrorPlugin,
  Tr as SideMenuView,
  Or as SuggestionMenuProseMirrorPlugin,
  zr as TableHandlesProsemirrorPlugin,
  Fr as TableHandlesView,
  ft as UniqueID,
  ne as UnreachableCaseError,
  gr as VALID_LINK_PROTOCOLS,
  Ei as addDefaultPropsExternalHTML,
  Ee as addInlineContentAttributes,
  Jt as addInlineContentKeyboardShortcuts,
  Mi as addNodeAndExtensionsToSpec,
  Pi as addStyleAttributes,
  Ti as applyNonSelectableBlockFix,
  xi as assertEmpty,
  Ii as audioParse,
  Li as audioRender,
  Di as audioToExternalHTML,
  Ai as blockHasType,
  De as blockToNode,
  Gn as blocksToMarkdown,
  _i as camelToDataKebab,
  Oi as captureCellAnchor,
  Hi as checkPageBreakBlocksInSchema,
  He as cleanHTMLToMarkdown,
  mi as combineByGroup,
  to as contentNodeToInlineContent,
  eo as contentNodeToTableContent,
  Ni as createAudioBlockConfig,
  Ui as createAudioBlockSpec,
  Ri as createBlockConfig,
  Vi as createBlockNoteExtension,
  $i as createBlockSpec,
  Fi as createBlockSpecFromTiptapNode,
  zi as createBulletListItemBlockConfig,
  Gi as createBulletListItemBlockSpec,
  ji as createCheckListItemBlockSpec,
  Ki as createCheckListItemConfig,
  qi as createCodeBlockConfig,
  Yi as createCodeBlockSpec,
  Wi as createDefaultBlockDOMOutputSpec,
  Xi as createDividerBlockConfig,
  Ji as createDividerBlockSpec,
  Se as createExternalHTMLExporter,
  Qi as createFileBlockConfig,
  Zi as createFileBlockSpec,
  ea as createHeadingBlockConfig,
  ta as createHeadingBlockSpec,
  oa as createImageBlockConfig,
  na as createImageBlockSpec,
  li as createInlineContentSpec,
  Zt as createInlineContentSpecFromTipTapNode,
  bn as createInternalHTMLSerializer,
  ra as createInternalInlineContentSpec,
  sa as createInternalStyleSpec,
  ia as createNumberedListItemBlockConfig,
  aa as createNumberedListItemBlockSpec,
  ca as createPageBreakBlockConfig,
  la as createPageBreakBlockSpec,
  da as createParagraphBlockConfig,
  ha as createParagraphBlockSpec,
  ua as createQuoteBlockConfig,
  pa as createQuoteBlockSpec,
  ma as createStyleSpec,
  fa as createStyleSpecFromTipTapMark,
  di as createSuggestionMenu,
  ga as createTableBlockSpec,
  ba as createToggleListItemBlockConfig,
  ka as createToggleListItemBlockSpec,
  wa as createToggleWrapper,
  ya as createVideoBlockConfig,
  Ca as createVideoBlockSpec,
  va as defaultBlockSpecs,
  Sa as defaultBlockToHTML,
  wo as defaultInlineContentSchema,
  Ba as defaultInlineContentSpecs,
  $e as defaultProps,
  Ea as defaultStyleSchema,
  Ma as defaultStyleSpecs,
  Pa as defaultToggledState,
  po as docToBlocks,
  ut as editorHasBlockWithType,
  Ta as fileParse,
  xa as filenameFromURL,
  Ia as filterSuggestionItems,
  La as formatKeyboardShortcut,
  nr as formattingToolbarPluginKey,
  oo as getBackgroundColorAttribute,
  ns as getBlock,
  Da as getBlockCache,
  Aa as getBlockFromPos,
  Te as getBlockInfo,
  ye as getBlockInfoFromResolvedPos,
  A as getBlockInfoFromSelection,
  Ce as getBlockInfoFromTransaction,
  _a as getBlockInfoWithManualOffset,
  Jr as getBlockNoteExtensions,
  gt as getBlockNoteSchema,
  Oa as getBlockSchema,
  Et as getBlocksChangedByTransaction,
  Ha as getColspan,
  pi as getDefaultEmojiPickerItems,
  Na as getDefaultSlashMenuItems,
  hn as getInlineContentParseRules,
  Ua as getInlineContentSchema,
  Ra as getInlineContentSchemaFromSpecs,
  Va as getLanguageId,
  re as getNearestBlockPos,
  ss as getNextBlock,
  _ as getNodeById,
  $a as getPageBreakSlashMenuItems,
  is as getParentBlock,
  Fa as getParseRules,
  I as getPmSchema,
  rs as getPrevBlock,
  za as getRowspan,
  Ga as getStyleParseRules,
  ja as getStyleSchema,
  Ka as getStyleSchemaFromSpecs,
  qa as getTextAlignmentAttribute,
  uo as getTextColorAttribute,
  Ya as imageParse,
  Wa as imageRender,
  Xa as imageToExternalHTML,
  Y as inlineContentToNodes,
  un as insertBlocks,
  Ja as insertOrUpdateBlock,
  Qa as isAppleOS,
  Za as isLinkInlineContent,
  ht as isNodeBlock,
  ec as isPartialLinkInlineContent,
  tc as isPartialTableCell,
  oc as isSafari,
  nc as isStyledTextInlineContent,
  rc as isTableCell,
  Ge as isTableCellSelection,
  fo as isVideoUrl,
  mr as linkToolbarPluginKey,
  sc as mapTableCell,
  ui as mappingFactory,
  ks as markdownToBlocks,
  $t as markdownToHTML,
  _e as mergeCSSClasses,
  ic as mergeParagraphs,
  B as nodeToBlock,
  me as nodeToCustomInlineContent,
  ac as parseAudioElement,
  cc as parseDefaultProps,
  Qt as propsToAttributes,
  go as prosemirrorSliceToSlicedBlocks,
  We as removeAndInsertBlocks,
  Tt as selectedFragmentToHTML,
  xr as sideMenuPluginKey,
  lc as stylePropsToAttributes,
  dt as tableContentToNodes,
  oe as tableHandlesPluginKey,
  dc as tablePropSchema,
  Dr as trackPosition,
  mo as updateBlock,
  ro as updateBlockCommand,
  ko as updateBlockTr,
  hc as uploadToTmpFilesDotOrg_DEV_ONLY,
  uc as videoParse,
  pc as withPageBreak,
  mc as wrapInBlockStructure
};
//# sourceMappingURL=blocknote.js.map
