import A, { createContext as ye, useContext as se, useEffect as x, useState as w, useCallback as b, useMemo as M, useRef as N, useSyncExternalStore as xe, useLayoutEffect as Zt, forwardRef as At, useImperativeHandle as Dt, useReducer as Ft } from "react";
import { jsxs as v, Fragment as T, jsx as l } from "react/jsx-runtime";
import { useFloating as Ve, useTransitionStyles as Be, useDismiss as Ot, useInteractions as Gt, offset as U, shift as de, flip as q, size as Se, FloatingPortal as Ut } from "@floating-ui/react";
import { BlockNoteEditor as zt, BlockNoteSchema as jt, defaultStyleSpecs as Wt, createParagraphBlockSpec as qt, mergeCSSClasses as L, filenameFromURL as Ae, formatKeyboardShortcut as ue, VALID_LINK_PROTOCOLS as $t, DEFAULT_LINK_PROTOCOL as Xt, isTableCellSelection as Kt, blockHasType as I, editorHasBlockWithType as X, defaultProps as ee, mapTableCell as K, getDefaultEmojiPickerItems as Yt, getDefaultSlashMenuItems as Jt, filterSuggestionItems as Qt, EMPTY_CELL_WIDTH as en, EMPTY_CELL_HEIGHT as tn, isTableCell as Y, getColspan as et, getRowspan as tt, getBlockFromPos as nn, camelToDataKebab as nt, audioParse as on, createAudioBlockConfig as rn, fileParse as ln, createFileBlockConfig as cn, imageParse as an, createImageBlockConfig as sn, getPageBreakSlashMenuItems as dn, videoParse as un, createVideoBlockConfig as mn, defaultToggledState as te, UnreachableCaseError as ot, nodeToCustomInlineContent as De, inlineContentToNodes as hn, addInlineContentAttributes as gn, getInlineContentParseRules as fn, addInlineContentKeyboardShortcuts as bn, propsToAttributes as Cn, createInternalInlineContentSpec as pn, addStyleAttributes as Ce, getStyleParseRules as kn, stylePropsToAttributes as wn, createInternalStyleSpec as vn } from "@blocknote/core";
import { createPortal as me, flushSync as rt } from "react-dom";
import { ReactNodeViewRenderer as lt, useReactNodeView as it, NodeViewWrapper as ct, Mark as Hn, ReactMarkViewRenderer as Mn, ReactMarkViewContext as yn } from "@tiptap/react";
import { createRoot as xn } from "react-dom/client";
import { Node as Vn } from "@tiptap/core";
const at = ye(void 0);
function F(e) {
  return se(at);
}
function C(e) {
  const t = F();
  if (!(t != null && t.editor))
    throw new Error(
      "useBlockNoteEditor was called outside of a BlockNoteContext provider or BlockNoteView component"
    );
  return t.editor;
}
function he(e, t, n) {
  const o = F();
  t || (t = o == null ? void 0 : o.editor), x(() => {
    if (!t)
      throw new Error(
        "'editor' is required, either from BlockNoteContext or as a function argument"
      );
    return t.onSelectionChange(e, n);
  }, [e, t, n]);
}
function Bn(e, t) {
  const n = C();
  t = t || n;
  const [o, r] = w(() => {
    if (e)
      return t.getSelectionBoundingBox();
  }), i = b(() => {
    if (!e)
      return;
    const c = t.getSelectionBoundingBox();
    r(c);
  }, [t, e]);
  return he(i, t, !0), x(() => {
    r(e ? t.getSelectionBoundingBox() : void 0);
  }, [e, t]), o;
}
function Sn(e) {
  return e.getBoundingClientRect !== void 0;
}
function z(e, t, n, o) {
  const { refs: r, update: i, context: c, floatingStyles: s, isPositioned: d } = Ve({
    open: e,
    ...o
  }), { isMounted: a, styles: u } = Be(c), h = typeof (o == null ? void 0 : o.canDismiss) == "object" ? o.canDismiss : {
    enabled: o == null ? void 0 : o.canDismiss
  }, m = Ot(c, h), { getReferenceProps: g, getFloatingProps: f } = Gt([m]);
  return x(() => {
    t !== null && (t instanceof HTMLElement || Sn(t) ? r.setReference(t) : r.setReference({
      getBoundingClientRect: () => t
    }), i());
  }, [t, r, i]), M(() => ({
    isMounted: a,
    ref: r.setFloating,
    setReference: r.setReference,
    style: {
      display: "flex",
      ...u,
      ...s,
      zIndex: n
    },
    getFloatingProps: f,
    getReferenceProps: g,
    isPositioned: d
  }), [
    d,
    s,
    a,
    r.setFloating,
    r.setReference,
    u,
    n,
    f,
    g
  ]);
}
function D(e) {
  const [t, n] = w();
  return x(() => e((o) => {
    n({ ...o });
  }), [e]), t;
}
const Tn = ye(
  void 0
);
function p() {
  return se(Tn);
}
const Te = (e = {}, t = []) => M(() => {
  const n = zt.create(e);
  return window && (window.ProseMirror = n._tiptapEditor), n;
}, t);
function y() {
  return F().editor.dictionary;
}
function J(e, t) {
  const n = F();
  t || (t = n == null ? void 0 : n.editor), x(() => {
    if (!t)
      throw new Error(
        "'editor' is required, either from BlockNoteContext or as a function argument"
      );
    return t.onChange(e);
  }, [e, t]);
}
const Le = (e) => {
  const [t, n] = w(!1), [o, r] = w(e.editor.isEmpty), i = p();
  J(() => {
    r(e.editor.isEmpty);
  }, e.editor);
  const c = b(() => {
    n(!0);
  }, []), s = b(() => {
    n(!1);
  }, []);
  return x(() => {
    e.editable && e.autoFocus && e.editor.focus();
  }, [e.autoFocus, e.editable, e.editor]), /* @__PURE__ */ v(T, { children: [
    /* @__PURE__ */ l(
      i.Comments.Editor,
      {
        autoFocus: e.autoFocus,
        className: "bn-comment-editor",
        editor: e.editor,
        onFocus: c,
        onBlur: s,
        editable: e.editable
      }
    ),
    e.actions && /* @__PURE__ */ l("div", { className: "bn-comment-actions-wrapper", children: /* @__PURE__ */ l(e.actions, { isFocused: t, isEmpty: o }) })
  ] });
}, { textColor: Sl, backgroundColor: Tl, ...Ln } = Wt, _e = jt.create({
  blockSpecs: {
    paragraph: qt()
  },
  styleSpecs: Ln
});
function _n() {
  const e = C();
  if (!e.comments)
    throw new Error("Comments plugin not found");
  const t = e.comments, n = p(), o = y(), r = Te({
    trailingBlock: !1,
    dictionary: {
      ...o,
      placeholders: {
        emptyDocument: o.placeholders.new_comment
      }
    },
    schema: e.comments.commentEditorSchema || _e
  });
  return /* @__PURE__ */ l(n.Comments.Card, { className: "bn-thread", children: /* @__PURE__ */ l(
    Le,
    {
      autoFocus: !0,
      editable: !0,
      editor: r,
      actions: ({ isEmpty: i }) => /* @__PURE__ */ l(
        n.Generic.Toolbar.Root,
        {
          className: L(
            "bn-action-toolbar",
            "bn-comment-actions"
          ),
          variant: "action-toolbar",
          children: /* @__PURE__ */ l(
            n.Generic.Toolbar.Button,
            {
              className: "bn-button",
              mainTooltip: "Save",
              variant: "compact",
              isDisabled: i,
              onClick: async () => {
                await t.createThread({
                  initialComment: {
                    body: r.document
                  }
                }), t.stopPendingComment();
              },
              children: "Save"
            }
          )
        }
      )
    }
  ) });
}
const En = (e) => {
  const t = C();
  if (!t.comments)
    throw new Error(
      "FloatingComposerController can only be used when BlockNote editor has enabled comments"
    );
  const n = t.comments;
  x(() => {
    const u = n.onUpdate(
      (h) => t.setForceSelectionVisible(h.pendingComment)
    );
    return () => u();
  }, [n, t]);
  const o = D(n.onUpdate.bind(n)), r = Bn(o == null ? void 0 : o.pendingComment), { isMounted: i, ref: c, style: s, getFloatingProps: d } = z(
    (o == null ? void 0 : o.pendingComment) || !1,
    r || null,
    5e3,
    {
      placement: "bottom",
      middleware: [U(10), de(), q()],
      onOpenChange: (u) => {
        u || (n.stopPendingComment(), t.focus());
      },
      ...e.floatingOptions
    }
  );
  if (!i || !o)
    return null;
  const a = e.floatingComposer || _n;
  return /* @__PURE__ */ l("div", { ref: c, style: s, ...d(), children: /* @__PURE__ */ l(a, {}) });
};
var st = {
  color: void 0,
  size: void 0,
  className: void 0,
  style: void 0,
  attr: void 0
}, Fe = A.createContext && /* @__PURE__ */ A.createContext(st), Rn = ["attr", "size", "title"];
function In(e, t) {
  if (e == null) return {};
  var n = Nn(e, t), o, r;
  if (Object.getOwnPropertySymbols) {
    var i = Object.getOwnPropertySymbols(e);
    for (r = 0; r < i.length; r++)
      o = i[r], !(t.indexOf(o) >= 0) && Object.prototype.propertyIsEnumerable.call(e, o) && (n[o] = e[o]);
  }
  return n;
}
function Nn(e, t) {
  if (e == null) return {};
  var n = {};
  for (var o in e)
    if (Object.prototype.hasOwnProperty.call(e, o)) {
      if (t.indexOf(o) >= 0) continue;
      n[o] = e[o];
    }
  return n;
}
function re() {
  return re = Object.assign ? Object.assign.bind() : function(e) {
    for (var t = 1; t < arguments.length; t++) {
      var n = arguments[t];
      for (var o in n)
        Object.prototype.hasOwnProperty.call(n, o) && (e[o] = n[o]);
    }
    return e;
  }, re.apply(this, arguments);
}
function Oe(e, t) {
  var n = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    t && (o = o.filter(function(r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), n.push.apply(n, o);
  }
  return n;
}
function le(e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t] != null ? arguments[t] : {};
    t % 2 ? Oe(Object(n), !0).forEach(function(o) {
      Pn(e, o, n[o]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Oe(Object(n)).forEach(function(o) {
      Object.defineProperty(e, o, Object.getOwnPropertyDescriptor(n, o));
    });
  }
  return e;
}
function Pn(e, t, n) {
  return t = Zn(t), t in e ? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 }) : e[t] = n, e;
}
function Zn(e) {
  var t = An(e, "string");
  return typeof t == "symbol" ? t : t + "";
}
function An(e, t) {
  if (typeof e != "object" || !e) return e;
  var n = e[Symbol.toPrimitive];
  if (n !== void 0) {
    var o = n.call(e, t);
    if (typeof o != "object") return o;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e);
}
function dt(e) {
  return e && e.map((t, n) => /* @__PURE__ */ A.createElement(t.tag, le({
    key: n
  }, t.attr), dt(t.child)));
}
function k(e) {
  return (t) => /* @__PURE__ */ A.createElement(Dn, re({
    attr: le({}, e.attr)
  }, t), dt(e.child));
}
function Dn(e) {
  var t = (n) => {
    var {
      attr: o,
      size: r,
      title: i
    } = e, c = In(e, Rn), s = r || n.size || "1em", d;
    return n.className && (d = n.className), e.className && (d = (d ? d + " " : "") + e.className), /* @__PURE__ */ A.createElement("svg", re({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, n.attr, o, c, {
      className: d,
      style: le(le({
        color: e.color || n.color
      }, n.style), e.style),
      height: s,
      width: s,
      xmlns: "http://www.w3.org/2000/svg"
    }), i && /* @__PURE__ */ A.createElement("title", null, i), e.children);
  };
  return Fe !== void 0 ? /* @__PURE__ */ A.createElement(Fe.Consumer, null, (n) => t(n)) : t(st);
}
function Fn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M8 7V11L2 6L8 1V5H13C17.4183 5 21 8.58172 21 13C21 17.4183 17.4183 21 13 21H4V19H13C16.3137 19 19 16.3137 19 13C19 9.68629 16.3137 7 13 7H8Z" }, child: [] }] })(e);
}
function ut(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M7.29117 20.8242L2 22L3.17581 16.7088C2.42544 15.3056 2 13.7025 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C10.2975 22 8.6944 21.5746 7.29117 20.8242ZM7.58075 18.711L8.23428 19.0605C9.38248 19.6745 10.6655 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 13.3345 4.32549 14.6175 4.93949 15.7657L5.28896 16.4192L4.63416 19.3658L7.58075 18.711Z" }, child: [] }] })(e);
}
function On(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M7.24264 17.9967H3V13.754L14.435 2.319C14.8256 1.92848 15.4587 1.92848 15.8492 2.319L18.6777 5.14743C19.0682 5.53795 19.0682 6.17112 18.6777 6.56164L7.24264 17.9967ZM3 19.9967H21V21.9967H3V19.9967Z" }, child: [] }] })(e);
}
function Gn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M23 12L15.9289 19.0711L14.5147 17.6569L20.1716 12L14.5147 6.34317L15.9289 4.92896L23 12ZM3.82843 12L9.48528 17.6569L8.07107 19.0711L1 12L8.07107 4.92896L9.48528 6.34317L3.82843 12Z" }, child: [] }] })(e);
}
function Ee(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3 8L9.00319 2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8ZM10 4V9H5V20H19V4H10Z" }, child: [] }] })(e);
}
function Un(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3 4H21V6H3V4ZM5 19H19V21H5V19ZM3 14H21V16H3V14ZM5 9H19V11H5V9Z" }, child: [] }] })(e);
}
function zn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3 4H21V6H3V4ZM3 19H21V21H3V19ZM3 14H21V16H3V14ZM3 9H21V11H3V9Z" }, child: [] }] })(e);
}
function jn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3 4H21V6H3V4ZM3 19H17V21H3V19ZM3 14H21V16H3V14ZM3 9H17V11H3V9Z" }, child: [] }] })(e);
}
function Wn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3 4H21V6H3V4ZM7 19H21V21H7V19ZM3 14H21V16H3V14ZM7 9H21V11H7V9Z" }, child: [] }] })(e);
}
function qn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M8 11H12.5C13.8807 11 15 9.88071 15 8.5C15 7.11929 13.8807 6 12.5 6H8V11ZM18 15.5C18 17.9853 15.9853 20 13.5 20H6V4H12.5C14.9853 4 17 6.01472 17 8.5C17 9.70431 16.5269 10.7981 15.7564 11.6058C17.0979 12.3847 18 13.837 18 15.5ZM8 13V18H13.5C14.8807 18 16 16.8807 16 15.5C16 14.1193 14.8807 13 13.5 13H8Z" }, child: [] }] })(e);
}
function $n(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3.41436 5.99995L5.70726 3.70706L4.29304 2.29285L0.585938 5.99995L4.29304 9.70706L5.70726 8.29285L3.41436 5.99995ZM9.58594 5.99995L7.29304 3.70706L8.70726 2.29285L12.4144 5.99995L8.70726 9.70706L7.29304 8.29285L9.58594 5.99995ZM14.0002 2.99995H21.0002C21.5524 2.99995 22.0002 3.44767 22.0002 3.99995V20C22.0002 20.5522 21.5524 21 21.0002 21H3.00015C2.44787 21 2.00015 20.5522 2.00015 20V12H4.00015V19H20.0002V4.99995H14.0002V2.99995Z" }, child: [] }] })(e);
}
function Ge(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M5.55397 22H3.3999L10.9999 3H12.9999L20.5999 22H18.4458L16.0458 16H7.95397L5.55397 22ZM8.75397 14H15.2458L11.9999 5.88517L8.75397 14Z" }, child: [] }] })(e);
}
function ie(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M13 20H11V13H4V20H2V4H4V11H11V4H13V20ZM21.0005 8V20H19.0005L19 10.204L17 10.74V8.67L19.5005 8H21.0005Z" }, child: [] }] })(e);
}
function ce(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M4 4V11H11V4H13V20H11V13H4V20H2V4H4ZM18.5 8C20.5711 8 22.25 9.67893 22.25 11.75C22.25 12.6074 21.9623 13.3976 21.4781 14.0292L21.3302 14.2102L18.0343 18H22V20H15L14.9993 18.444L19.8207 12.8981C20.0881 12.5908 20.25 12.1893 20.25 11.75C20.25 10.7835 19.4665 10 18.5 10C17.5818 10 16.8288 10.7071 16.7558 11.6065L16.75 11.75H14.75C14.75 9.67893 16.4289 8 18.5 8Z" }, child: [] }] })(e);
}
function ae(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M22 8L21.9984 10L19.4934 12.883C21.0823 13.3184 22.25 14.7728 22.25 16.5C22.25 18.5711 20.5711 20.25 18.5 20.25C16.674 20.25 15.1528 18.9449 14.8184 17.2166L16.7821 16.8352C16.9384 17.6413 17.6481 18.25 18.5 18.25C19.4665 18.25 20.25 17.4665 20.25 16.5C20.25 15.5335 19.4665 14.75 18.5 14.75C18.214 14.75 17.944 14.8186 17.7056 14.9403L16.3992 13.3932L19.3484 10H15V8H22ZM4 4V11H11V4H13V20H11V13H4V20H2V4H4Z" }, child: [] }] })(e);
}
function mt(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M13 20H11V13H4V20H2V4H4V11H11V4H13V20ZM22 8V16H23.5V18H22V20H20V18H14.5V16.66L19.5 8H22ZM20 11.133L17.19 16H20V11.133Z" }, child: [] }] })(e);
}
function ht(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M22 8V10H17.6769L17.2126 12.6358C17.5435 12.5472 17.8912 12.5 18.25 12.5C20.4591 12.5 22.25 14.2909 22.25 16.5C22.25 18.7091 20.4591 20.5 18.25 20.5C16.4233 20.5 14.8827 19.2756 14.4039 17.6027L16.3271 17.0519C16.5667 17.8881 17.3369 18.5 18.25 18.5C19.3546 18.5 20.25 17.6046 20.25 16.5C20.25 15.3954 19.3546 14.5 18.25 14.5C17.6194 14.5 17.057 14.7918 16.6904 15.2478L14.8803 14.3439L16 8H22ZM4 4V11H11V4H13V20H11V13H4V20H2V4H4Z" }, child: [] }] })(e);
}
function gt(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M21.097 8L18.499 12.5C20.7091 12.5 22.5 14.2909 22.5 16.5C22.5 18.7091 20.7091 20.5 18.5 20.5C16.2909 20.5 14.5 18.7091 14.5 16.5C14.5 15.7636 14.699 15.0737 15.0461 14.4811L18.788 8H21.097ZM4 4V11H11V4H13V20H11V13H4V20H2V4H4ZM18.5 14.5C17.3954 14.5 16.5 15.3954 16.5 16.5C16.5 17.6046 17.3954 18.5 18.5 18.5C19.6046 18.5 20.5 17.6046 20.5 16.5C20.5 15.3954 19.6046 14.5 18.5 14.5Z" }, child: [] }] })(e);
}
function Xn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3 4H21V6H3V4ZM3 19H21V21H3V19ZM11 14H21V16H11V14ZM11 9H21V11H11V9ZM3 12.5L7 9V16L3 12.5Z" }, child: [] }] })(e);
}
function Kn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3 4H21V6H3V4ZM3 19H21V21H3V19ZM11 14H21V16H11V14ZM11 9H21V11H11V9ZM7 12.5L3 16V9L7 12.5Z" }, child: [] }] })(e);
}
function Ue(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M8 5H11V19H8V21H16V19H13V5H16V3H8V5ZM2 7C1.44772 7 1 7.44772 1 8V16C1 16.5523 1.44772 17 2 17H8V15H3V9H8V7H2ZM16 9H21V15H16V17H22C22.5523 17 23 16.5523 23 16V8C23 7.44772 22.5523 7 22 7H16V9Z" }, child: [] }] })(e);
}
function Yn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M15 20H7V18H9.92661L12.0425 6H9V4H17V6H14.0734L11.9575 18H15V20Z" }, child: [] }] })(e);
}
function Jn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M17 17H22V19H19V22H17V17ZM7 7H2V5H5V2H7V7ZM18.364 15.5355L16.9497 14.1213L18.364 12.7071C20.3166 10.7545 20.3166 7.58866 18.364 5.63604C16.4113 3.68342 13.2455 3.68342 11.2929 5.63604L9.87868 7.05025L8.46447 5.63604L9.87868 4.22183C12.6123 1.48816 17.0445 1.48816 19.7782 4.22183C22.5118 6.9555 22.5118 11.3877 19.7782 14.1213L18.364 15.5355ZM15.5355 18.364L14.1213 19.7782C11.3877 22.5118 6.9555 22.5118 4.22183 19.7782C1.48816 17.0445 1.48816 12.6123 4.22183 9.87868L5.63604 8.46447L7.05025 9.87868L5.63604 11.2929C3.68342 13.2455 3.68342 16.4113 5.63604 18.364C7.58866 20.3166 10.7545 20.3166 12.7071 18.364L14.1213 16.9497L15.5355 18.364ZM14.8284 7.75736L16.2426 9.17157L9.17157 16.2426L7.75736 14.8284L14.8284 7.75736Z" }, child: [] }] })(e);
}
function ft(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M18.3638 15.5355L16.9496 14.1213L18.3638 12.7071C20.3164 10.7545 20.3164 7.58866 18.3638 5.63604C16.4112 3.68341 13.2453 3.68341 11.2927 5.63604L9.87849 7.05025L8.46428 5.63604L9.87849 4.22182C12.6122 1.48815 17.0443 1.48815 19.778 4.22182C22.5117 6.95549 22.5117 11.3876 19.778 14.1213L18.3638 15.5355ZM15.5353 18.364L14.1211 19.7782C11.3875 22.5118 6.95531 22.5118 4.22164 19.7782C1.48797 17.0445 1.48797 12.6123 4.22164 9.87868L5.63585 8.46446L7.05007 9.87868L5.63585 11.2929C3.68323 13.2455 3.68323 16.4113 5.63585 18.364C7.58847 20.3166 10.7543 20.3166 12.7069 18.364L14.1211 16.9497L15.5353 18.364ZM14.8282 7.75736L16.2425 9.17157L9.17139 16.2426L7.75717 14.8284L14.8282 7.75736Z" }, child: [] }] })(e);
}
function bt(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M8.00008 6V9H5.00008V6H8.00008ZM3.00008 4V11H10.0001V4H3.00008ZM13.0001 4H21.0001V6H13.0001V4ZM13.0001 11H21.0001V13H13.0001V11ZM13.0001 18H21.0001V20H13.0001V18ZM10.7072 16.2071L9.29297 14.7929L6.00008 18.0858L4.20718 16.2929L2.79297 17.7071L6.00008 20.9142L10.7072 16.2071Z" }, child: [] }] })(e);
}
function Ct(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M8 4H21V6H8V4ZM5 3V6H6V7H3V6H4V4H3V3H5ZM3 14V11.5H5V11H3V10H6V12.5H4V13H6V14H3ZM5 19.5H3V18.5H5V18H3V17H6V21H3V20H5V19.5ZM8 11H21V13H8V11ZM8 18H21V20H8V18Z" }, child: [] }] })(e);
}
function pt(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M8 4H21V6H8V4ZM4.5 6.5C3.67157 6.5 3 5.82843 3 5C3 4.17157 3.67157 3.5 4.5 3.5C5.32843 3.5 6 4.17157 6 5C6 5.82843 5.32843 6.5 4.5 6.5ZM4.5 13.5C3.67157 13.5 3 12.8284 3 12C3 11.1716 3.67157 10.5 4.5 10.5C5.32843 10.5 6 11.1716 6 12C6 12.8284 5.32843 13.5 4.5 13.5ZM4.5 20.4C3.67157 20.4 3 19.7284 3 18.9C3 18.0716 3.67157 17.4 4.5 17.4C5.32843 17.4 6 18.0716 6 18.9C6 19.7284 5.32843 20.4 4.5 20.4ZM8 11H21V13H8V11ZM8 18H21V20H8V18Z" }, child: [] }] })(e);
}
function Qn(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M20 3C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3H20ZM11 5H5V10.999H7V9L10 12L7 15V13H5V19H11V17H13V19H19V13H17V15L14 12L17 9V10.999H19V5H13V7H11V5ZM13 13V15H11V13H13ZM13 9V11H11V9H13Z" }, child: [] }] })(e);
}
function eo(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M21 20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V20ZM19 11V5H13.001V7H15L12 10L9 7H11V5H5V11H7V13H5V19H11V17H9L12 14L15 17H13.001V19H19V13H17V11H19ZM11 13H9V11H11V13ZM15 13H13V11H15V13Z" }, child: [] }] })(e);
}
function kt(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M21 4H3V6H21V4ZM21 11H8V13H21V11ZM21 18H8V20H21V18ZM5 11H3V20H5V11Z" }, child: [] }] })(e);
}
function to(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M17.1538 14C17.3846 14.5161 17.5 15.0893 17.5 15.7196C17.5 17.0625 16.9762 18.1116 15.9286 18.867C14.8809 19.6223 13.4335 20 11.5862 20C9.94674 20 8.32335 19.6185 6.71592 18.8555V16.6009C8.23538 17.4783 9.7908 17.917 11.3822 17.917C13.9333 17.917 15.2128 17.1846 15.2208 15.7196C15.2208 15.0939 15.0049 14.5598 14.5731 14.1173C14.5339 14.0772 14.4939 14.0381 14.4531 14H3V12H21V14H17.1538ZM13.076 11H7.62908C7.4566 10.8433 7.29616 10.6692 7.14776 10.4778C6.71592 9.92084 6.5 9.24559 6.5 8.45207C6.5 7.21602 6.96583 6.165 7.89749 5.299C8.82916 4.43299 10.2706 4 12.2219 4C13.6934 4 15.1009 4.32808 16.4444 4.98426V7.13591C15.2448 6.44921 13.9293 6.10587 12.4978 6.10587C10.0187 6.10587 8.77917 6.88793 8.77917 8.45207C8.77917 8.87172 8.99709 9.23796 9.43293 9.55079C9.86878 9.86362 10.4066 10.1135 11.0463 10.3004C11.6665 10.4816 12.3431 10.7148 13.076 11H13.076Z" }, child: [] }] })(e);
}
function no(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M13 10V14H19V10H13ZM11 10H5V14H11V10ZM13 19H19V16H13V19ZM11 19V16H5V19H11ZM13 5V8H19V5H13ZM11 5H5V8H11V5ZM4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3Z" }, child: [] }] })(e);
}
function Re(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M13 6V21H11V6H5V4H19V6H13Z" }, child: [] }] })(e);
}
function oo(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M8 3V12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12V3H18V12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12V3H8ZM4 20H20V22H4V20Z" }, child: [] }] })(e);
}
function ro(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M2 3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934ZM8 5V19H16V5H8ZM4 5V7H6V5H4ZM18 5V7H20V5H18ZM4 9V11H6V9H4ZM18 9V11H20V9H18ZM4 13V15H6V13H4ZM18 13V15H20V13H18ZM4 17V19H6V17H4ZM18 17V19H20V17H18Z" }, child: [] }] })(e);
}
function wt(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M5 11.1005L7 9.1005L12.5 14.6005L16 11.1005L19 14.1005V5H5V11.1005ZM4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3ZM15.5 10C14.6716 10 14 9.32843 14 8.5C14 7.67157 14.6716 7 15.5 7C16.3284 7 17 7.67157 17 8.5C17 9.32843 16.3284 10 15.5 10Z" }, child: [] }] })(e);
}
function lo(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M21 15V18H24V20H21V23H19V20H16V18H19V15H21ZM21.0082 3C21.556 3 22 3.44495 22 3.9934L22.0007 13.3417C21.3749 13.1204 20.7015 13 20 13V5H4L4.001 19L13.2929 9.70715C13.6528 9.34604 14.22 9.31823 14.6123 9.62322L14.7065 9.70772L18.2521 13.2586C15.791 14.0069 14 16.2943 14 19C14 19.7015 14.1204 20.3749 14.3417 21.0007L2.9918 21C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082ZM8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7Z" }, child: [] }] })(e);
}
function io(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M20 3C20.5523 3 21 3.44772 21 4V5.757L19 7.757V5H5V13.1L9 9.1005L13.328 13.429L12.0012 14.7562L11.995 18.995L16.2414 19.0012L17.571 17.671L18.8995 19H19V16.242L21 14.242V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3H20ZM21.7782 7.80761L23.1924 9.22183L15.4142 17L13.9979 16.9979L14 15.5858L21.7782 7.80761ZM15.5 7C16.3284 7 17 7.67157 17 8.5C17 9.32843 16.3284 10 15.5 10C14.6716 10 14 9.32843 14 8.5C14 7.67157 14.6716 7 15.5 7Z" }, child: [] }] })(e);
}
function vt(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M22 18V20H2V18H22ZM2 3.5L10 8.5L2 13.5V3.5ZM22 11V13H12V11H22ZM22 4V6H12V4H22Z" }, child: [] }] })(e);
}
function co(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M3 3.9934C3 3.44476 3.44495 3 3.9934 3H20.0066C20.5552 3 21 3.44495 21 3.9934V20.0066C21 20.5552 20.5551 21 20.0066 21H3.9934C3.44476 21 3 20.5551 3 20.0066V3.9934ZM10.6219 8.41459C10.5562 8.37078 10.479 8.34741 10.4 8.34741C10.1791 8.34741 10 8.52649 10 8.74741V15.2526C10 15.3316 10.0234 15.4088 10.0672 15.4745C10.1897 15.6583 10.4381 15.708 10.6219 15.5854L15.5008 12.3328C15.5447 12.3035 15.5824 12.2658 15.6117 12.2219C15.7343 12.0381 15.6846 11.7897 15.5008 11.6672L10.6219 8.41459Z" }, child: [] }] })(e);
}
function Ht(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M2 16.0001H5.88889L11.1834 20.3319C11.2727 20.405 11.3846 20.4449 11.5 20.4449C11.7761 20.4449 12 20.2211 12 19.9449V4.05519C12 3.93977 11.9601 3.8279 11.887 3.73857C11.7121 3.52485 11.3971 3.49335 11.1834 3.66821L5.88889 8.00007H2C1.44772 8.00007 1 8.44778 1 9.00007V15.0001C1 15.5524 1.44772 16.0001 2 16.0001ZM23 12C23 15.292 21.5539 18.2463 19.2622 20.2622L17.8445 18.8444C19.7758 17.1937 21 14.7398 21 12C21 9.26016 19.7758 6.80629 17.8445 5.15557L19.2622 3.73779C21.5539 5.75368 23 8.70795 23 12ZM18 12C18 10.0883 17.106 8.38548 15.7133 7.28673L14.2842 8.71584C15.3213 9.43855 16 10.64 16 12C16 13.36 15.3213 14.5614 14.2842 15.2841L15.7133 16.7132C17.106 15.6145 18 13.9116 18 12Z" }, child: [] }] })(e);
}
function ao(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z" }, child: [] }] })(e);
}
function so(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z" }, child: [] }] })(e);
}
function uo(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 4V6H15V4H9Z" }, child: [] }] })(e);
}
function mo(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM9 11V17H11V11H9ZM13 11V17H15V11H13ZM9 4V6H15V4H9Z" }, child: [] }] })(e);
}
function ho(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M4 19H20V12H22V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V12H4V19ZM14 9H19L12 16L5 9H10V3H14V9Z" }, child: [] }] })(e);
}
function go(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V12L17.206 8.207L11.2071 14.2071L9.79289 12.7929L15.792 6.793L12 3H21Z" }, child: [] }] })(e);
}
function fo(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M5 10C3.9 10 3 10.9 3 12C3 13.1 3.9 14 5 14C6.1 14 7 13.1 7 12C7 10.9 6.1 10 5 10ZM19 10C17.9 10 17 10.9 17 12C17 13.1 17.9 14 19 14C20.1 14 21 13.1 21 12C21 10.9 20.1 10 19 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" }, child: [] }] })(e);
}
function bo(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M5 11V13H19V11H5Z" }, child: [] }] })(e);
}
function Co(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM8 13C8 15.2091 9.79086 17 12 17C14.2091 17 16 15.2091 16 13H8ZM8 11C8.82843 11 9.5 10.3284 9.5 9.5C9.5 8.67157 8.82843 8 8 8C7.17157 8 6.5 8.67157 6.5 9.5C6.5 10.3284 7.17157 11 8 11ZM16 11C16.8284 11 17.5 10.3284 17.5 9.5C17.5 8.67157 16.8284 8 16 8C15.1716 8 14.5 8.67157 14.5 9.5C14.5 10.3284 15.1716 11 16 11Z" }, child: [] }] })(e);
}
function ze(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "currentColor" }, child: [{ tag: "path", attr: { d: "M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM8 13H16C16 15.2091 14.2091 17 12 17C9.79086 17 8 15.2091 8 13ZM8 11C7.17157 11 6.5 10.3284 6.5 9.5C6.5 8.67157 7.17157 8 8 8C8.82843 8 9.5 8.67157 9.5 9.5C9.5 10.3284 8.82843 11 8 11ZM16 11C15.1716 11 14.5 10.3284 14.5 9.5C14.5 8.67157 15.1716 8 16 8C16.8284 8 17.5 8.67157 17.5 9.5C17.5 10.3284 16.8284 11 16 11Z" }, child: [] }] })(e);
}
let ne;
async function po() {
  return ne || (ne = (async () => {
    const [e, t] = await Promise.all([
      import("emoji-mart"),
      // use a dynamic import to encourage bundle-splitting
      // and a smaller initial client bundle size
      import("@emoji-mart/data")
    ]), n = "default" in e ? e.default : e, o = "default" in t ? t.default : t;
    return await n.init({ data: o }), { emojiMart: n, emojiData: o };
  })(), ne);
}
function ko(e) {
  const t = N(null), n = N(null);
  return n.current && n.current.update(e), x(() => ((async () => {
    const { emojiMart: o } = await po();
    n.current = new o.Picker({ ...e, ref: t });
  })(), () => {
    n.current = null;
  }), []), A.createElement("div", { ref: t });
}
const je = (e) => {
  const [t, n] = w(!1), o = p(), r = F();
  return /* @__PURE__ */ v(o.Generic.Popover.Root, { opened: t, children: [
    /* @__PURE__ */ l(o.Generic.Popover.Trigger, { children: /* @__PURE__ */ l(
      "div",
      {
        onClick: (i) => {
          i.preventDefault(), i.stopPropagation(), n(!t);
        },
        style: {
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        },
        children: e.children
      }
    ) }),
    /* @__PURE__ */ l(o.Generic.Popover.Content, { variant: "panel-popover", children: /* @__PURE__ */ l(
      ko,
      {
        perLine: 7,
        onClickOutside: () => n(!1),
        onEmojiSelect: (i) => {
          e.onEmojiSelect(i), n(!1);
        },
        theme: r == null ? void 0 : r.colorSchemePreference
      }
    ) })
  ] });
};
function wo(e, t) {
  return Ie(e, [t]).get(t);
}
function Ie(e, t) {
  const n = e.comments;
  if (!n)
    throw new Error("Comments plugin not found");
  const o = n.userStore, r = b(() => {
    const s = /* @__PURE__ */ new Map();
    for (const d of t) {
      const a = o.getUser(d);
      a && s.set(d, a);
    }
    return s;
  }, [o, t]), i = M(() => ({
    current: r()
  }), [r]), c = b(
    (s) => {
      const d = o.subscribe((a) => {
        i.current = r(), s();
      });
      return o.loadUsers(t), d;
    },
    [o, r, t, i]
  );
  return xe(c, () => i.current);
}
const vo = (e) => {
  const t = p(), n = y(), o = C();
  if (!o.comments)
    throw new Error(
      "ReactionBadge must be used inside a BlockNote editor with comments enabled"
    );
  const r = e.comment.reactions.find(
    (d) => d.emoji === e.emoji
  );
  if (!r)
    throw new Error(
      "Trying to render reaction badge for non-existing reaction"
    );
  const [i, c] = w([]), s = Ie(o, i);
  return /* @__PURE__ */ l(
    t.Generic.Badge.Root,
    {
      className: L("bn-badge", "bn-comment-reaction"),
      text: r.userIds.length.toString(),
      icon: r.emoji,
      isSelected: o.comments.threadStore.auth.canDeleteReaction(
        e.comment,
        r.emoji
      ),
      onClick: () => e.onReactionSelect(r.emoji),
      onMouseEnter: () => c(r.userIds),
      mainTooltip: n.comments.reactions.reacted_by,
      secondaryTooltip: `${Array.from(s.values()).map((d) => d.username).join(`
`)}`
    },
    r.emoji
  );
}, Ho = ({
  comment: e,
  thread: t,
  showResolveButton: n
}) => {
  const o = C();
  if (!o.comments)
    throw new Error("Comments plugin not found");
  const r = y(), i = Te(
    {
      initialContent: e.body,
      trailingBlock: !1,
      dictionary: {
        ...r,
        placeholders: {
          emptyDocument: r.placeholders.edit_comment
        }
      },
      schema: o.comments.commentEditorSchema || _e
    },
    [e.body]
  ), c = p(), [s, d] = w(!1);
  if (!o.comments)
    throw new Error("Comments plugin not found");
  const a = o.comments.threadStore, u = b(() => {
    d(!0);
  }, []), h = b(() => {
    i.replaceBlocks(i.document, e.body), d(!1);
  }, [i, e.body]), m = b(
    async (E) => {
      await a.updateComment({
        commentId: e.id,
        comment: {
          body: i.document
        },
        threadId: t.id
      }), d(!1);
    },
    [e, t.id, i, a]
  ), g = b(async () => {
    await a.deleteComment({
      commentId: e.id,
      threadId: t.id
    });
  }, [e, t.id, a]), f = b(
    async (E) => {
      a.auth.canAddReaction(e, E) ? await a.addReaction({
        threadId: t.id,
        commentId: e.id,
        emoji: E
      }) : a.auth.canDeleteReaction(e, E) && await a.deleteReaction({
        threadId: t.id,
        commentId: e.id,
        emoji: E
      });
    },
    [a, e, t.id]
  ), H = b(async () => {
    await a.resolveThread({
      threadId: t.id
    });
  }, [t.id, a]), B = b(async () => {
    await a.unresolveThread({
      threadId: t.id
    });
  }, [t.id, a]), V = wo(o, e.userId);
  if (!e.body)
    return null;
  let S;
  const _ = a.auth.canAddReaction(e), P = a.auth.canDeleteComment(e), W = a.auth.canUpdateComment(e), O = n && (t.resolved ? a.auth.canUnresolveThread(t) : a.auth.canResolveThread(t));
  s || (S = /* @__PURE__ */ v(
    c.Generic.Toolbar.Root,
    {
      className: L("bn-action-toolbar", "bn-comment-actions"),
      variant: "action-toolbar",
      children: [
        _ && /* @__PURE__ */ l(
          je,
          {
            onEmojiSelect: (E) => f(E.native),
            children: /* @__PURE__ */ l(
              c.Generic.Toolbar.Button,
              {
                mainTooltip: r.comments.actions.add_reaction,
                variant: "compact",
                children: /* @__PURE__ */ l(ze, { size: 16 })
              },
              "add-reaction"
            )
          }
        ),
        O && (t.resolved ? /* @__PURE__ */ l(
          c.Generic.Toolbar.Button,
          {
            mainTooltip: "Re-open",
            variant: "compact",
            onClick: B,
            children: /* @__PURE__ */ l(Fn, { size: 16 })
          },
          "reopen"
        ) : /* @__PURE__ */ l(
          c.Generic.Toolbar.Button,
          {
            mainTooltip: r.comments.actions.resolve,
            variant: "compact",
            onClick: H,
            children: /* @__PURE__ */ l(so, { size: 16 })
          },
          "resolve"
        )),
        (P || W) && /* @__PURE__ */ v(c.Generic.Menu.Root, { position: "bottom-start", children: [
          /* @__PURE__ */ l(c.Generic.Menu.Trigger, { children: /* @__PURE__ */ l(
            c.Generic.Toolbar.Button,
            {
              mainTooltip: r.comments.actions.more_actions,
              variant: "compact",
              children: /* @__PURE__ */ l(fo, { size: 16 })
            },
            "more-actions"
          ) }),
          /* @__PURE__ */ v(c.Generic.Menu.Dropdown, { className: "bn-menu-dropdown", children: [
            W && /* @__PURE__ */ l(
              c.Generic.Menu.Item,
              {
                icon: /* @__PURE__ */ l(On, {}),
                onClick: u,
                children: r.comments.actions.edit_comment
              },
              "edit-comment"
            ),
            P && /* @__PURE__ */ l(
              c.Generic.Menu.Item,
              {
                icon: /* @__PURE__ */ l(mo, {}),
                onClick: g,
                children: r.comments.actions.delete_comment
              },
              "delete-comment"
            )
          ] })
        ] })
      ]
    }
  ));
  const $ = e.createdAt.toLocaleDateString(void 0, {
    month: "short",
    day: "numeric"
  });
  if (!e.body)
    throw new Error("soft deletes are not yet supported");
  return /* @__PURE__ */ l(
    c.Comments.Comment,
    {
      authorInfo: V ?? "loading",
      timeString: $,
      edited: e.updatedAt.getTime() !== e.createdAt.getTime(),
      showActions: "hover",
      actions: S,
      className: "bn-thread-comment",
      children: /* @__PURE__ */ l(
        Le,
        {
          autoFocus: s,
          editor: i,
          editable: s,
          actions: e.reactions.length > 0 || s ? ({ isEmpty: E }) => /* @__PURE__ */ v(T, { children: [
            e.reactions.length > 0 && !s && /* @__PURE__ */ v(
              c.Generic.Badge.Group,
              {
                className: L(
                  "bn-badge-group",
                  "bn-comment-reactions"
                ),
                children: [
                  e.reactions.map((Z) => /* @__PURE__ */ l(
                    vo,
                    {
                      comment: e,
                      emoji: Z.emoji,
                      onReactionSelect: f
                    },
                    Z.emoji
                  )),
                  _ && /* @__PURE__ */ l(
                    je,
                    {
                      onEmojiSelect: (Z) => f(Z.native),
                      children: /* @__PURE__ */ l(
                        c.Generic.Badge.Root,
                        {
                          className: L(
                            "bn-badge",
                            "bn-comment-add-reaction"
                          ),
                          text: "+",
                          icon: /* @__PURE__ */ l(ze, { size: 16 }),
                          mainTooltip: r.comments.actions.add_reaction
                        }
                      )
                    }
                  )
                ]
              }
            ),
            s && /* @__PURE__ */ v(
              c.Generic.Toolbar.Root,
              {
                variant: "action-toolbar",
                className: L(
                  "bn-action-toolbar",
                  "bn-comment-actions"
                ),
                children: [
                  /* @__PURE__ */ l(
                    c.Generic.Toolbar.Button,
                    {
                      mainTooltip: r.comments.save_button_text,
                      variant: "compact",
                      onClick: m,
                      isDisabled: E,
                      children: r.comments.save_button_text
                    }
                  ),
                  /* @__PURE__ */ l(
                    c.Generic.Toolbar.Button,
                    {
                      className: "bn-button",
                      mainTooltip: r.comments.cancel_button_text,
                      variant: "compact",
                      onClick: h,
                      children: r.comments.cancel_button_text
                    }
                  )
                ]
              }
            )
          ] }) : void 0
        }
      )
    }
  );
}, Mo = ({
  thread: e,
  maxCommentsBeforeCollapse: t
}) => {
  const n = p(), o = y(), r = C(), i = Ie(r, e.resolvedBy ? [e.resolvedBy] : []), c = e.comments.map((s, d) => /* @__PURE__ */ l(
    Ho,
    {
      thread: e,
      comment: s,
      showResolveButton: d === 0
    },
    s.id
  ));
  if (e.resolved && e.resolvedUpdatedAt && e.resolvedBy) {
    if (!i.get(e.resolvedBy))
      throw new Error(
        `User ${e.resolvedBy} resolved thread ${e.id}, but their data could not be found.`
      );
    const d = e.comments.findLastIndex(
      (a) => e.resolvedUpdatedAt.getTime() > a.createdAt.getTime()
    ) + 1;
    c.splice(
      d,
      0,
      /* @__PURE__ */ l(
        n.Comments.Comment,
        {
          className: "bn-thread-comment",
          authorInfo: e.resolvedBy && i.get(e.resolvedBy) || "loading",
          timeString: e.resolvedUpdatedAt.toLocaleDateString(void 0, {
            month: "short",
            day: "numeric"
          }),
          edited: !1,
          showActions: !1,
          children: /* @__PURE__ */ l("div", { className: "bn-resolved-text", children: o.comments.sidebar.marked_as_resolved })
        },
        "resolved-comment"
      )
    );
  }
  return t && c.length > t && c.splice(
    1,
    c.length - 2,
    /* @__PURE__ */ l(
      n.Comments.ExpandSectionsPrompt,
      {
        className: "bn-thread-expand-prompt",
        children: o.comments.sidebar.more_replies(e.comments.length - 2)
      },
      "expand-prompt"
    )
  ), c;
}, Mt = ({
  thread: e,
  selected: t,
  referenceText: n,
  maxCommentsBeforeCollapse: o,
  onFocus: r,
  onBlur: i,
  tabIndex: c
}) => {
  const s = p(), d = y(), a = C(), u = a.comments;
  if (!u)
    throw new Error("Comments plugin not found");
  const h = Te({
    trailingBlock: !1,
    dictionary: {
      ...d,
      placeholders: {
        emptyDocument: d.placeholders.comment_reply
      }
    },
    schema: a.comments.commentEditorSchema || _e
  }), m = b(async () => {
    await u.threadStore.addComment({
      comment: {
        body: h.document
      },
      threadId: e.id
    }), h.removeBlocks(h.document);
  }, [u, h, e.id]);
  return /* @__PURE__ */ v(
    s.Comments.Card,
    {
      className: "bn-thread",
      headerText: n,
      onFocus: r,
      onBlur: i,
      selected: t,
      tabIndex: c,
      children: [
        /* @__PURE__ */ l(s.Comments.CardSection, { className: "bn-thread-comments", children: /* @__PURE__ */ l(
          Mo,
          {
            thread: e,
            maxCommentsBeforeCollapse: t ? void 0 : o || 5
          }
        ) }),
        t && /* @__PURE__ */ l(s.Comments.CardSection, { className: "bn-thread-composer", children: /* @__PURE__ */ l(
          Le,
          {
            autoFocus: !1,
            editable: !0,
            editor: h,
            actions: ({ isEmpty: g }) => g ? null : /* @__PURE__ */ l(
              s.Generic.Toolbar.Root,
              {
                variant: "action-toolbar",
                className: L(
                  "bn-action-toolbar",
                  "bn-comment-actions"
                ),
                children: /* @__PURE__ */ l(
                  s.Generic.Toolbar.Button,
                  {
                    mainTooltip: d.comments.save_button_text,
                    variant: "compact",
                    isDisabled: g,
                    onClick: m,
                    children: d.comments.save_button_text
                  }
                )
              }
            )
          }
        ) })
      ]
    }
  );
};
function yt(e) {
  const t = e.comments;
  if (!t)
    throw new Error("Comments plugin not found");
  const n = t.threadStore, o = N(void 0);
  o.current || (o.current = n.getThreads());
  const r = b(
    (i) => n.subscribe((c) => {
      o.current = c, i();
    }),
    [n]
  );
  return xe(r, () => o.current);
}
const yo = (e) => {
  const t = C();
  if (!t.comments)
    throw new Error(
      "FloatingComposerController can only be used when BlockNote editor has enabled comments"
    );
  const n = D(
    t.comments.onUpdate.bind(t.comments)
  ), { isMounted: o, ref: r, style: i, getFloatingProps: c, setReference: s } = z(!!(n != null && n.selectedThreadId), null, 5e3, {
    placement: "bottom",
    middleware: [U(10), de(), q()],
    onOpenChange: (h) => {
      var m;
      h || ((m = t.comments) == null || m.selectThread(void 0), t.focus());
    },
    ...e.floatingOptions
  }), d = b(() => {
    var m;
    if (!(n != null && n.selectedThreadId))
      return;
    const h = (m = t.domElement) == null ? void 0 : m.querySelector(
      `[data-bn-thread-id="${n == null ? void 0 : n.selectedThreadId}"]`
    );
    h && s(h);
  }, [s, t, n == null ? void 0 : n.selectedThreadId]);
  x(() => {
    if (n != null && n.selectedThreadId)
      return t.onChange(() => {
        d();
      });
  }, [t, d, n == null ? void 0 : n.selectedThreadId]), Zt(d, [d]);
  const a = yt(t);
  if (!o || !n || !n.selectedThreadId)
    return null;
  const u = e.floatingThread || Mt;
  return /* @__PURE__ */ l("div", { ref: r, style: i, ...c(), children: /* @__PURE__ */ l(
    u,
    {
      thread: a.get(n.selectedThreadId),
      selected: !0
    }
  ) });
}, xo = (e) => {
  const t = p(), n = y(), { block: o } = e, r = C(), [i, c] = w(""), s = b(
    (u) => {
      c(u.currentTarget.value);
    },
    []
  ), d = b(
    (u) => {
      u.key === "Enter" && (u.preventDefault(), r.updateBlock(o, {
        props: {
          name: Ae(i),
          url: i
        }
      }));
    },
    [r, o, i]
  ), a = b(() => {
    r.updateBlock(o, {
      props: {
        name: Ae(i),
        url: i
      }
    });
  }, [r, o, i]);
  return /* @__PURE__ */ v(t.FilePanel.TabPanel, { className: "bn-tab-panel", children: [
    /* @__PURE__ */ l(
      t.FilePanel.TextInput,
      {
        className: "bn-text-input",
        placeholder: n.file_panel.embed.url_placeholder,
        value: i,
        onChange: s,
        onKeyDown: d,
        "data-test": "embed-input"
      }
    ),
    /* @__PURE__ */ l(
      t.FilePanel.Button,
      {
        className: "bn-button",
        onClick: a,
        "data-test": "embed-input-button",
        children: n.file_panel.embed.embed_button[o.type] || n.file_panel.embed.embed_button.file
      }
    )
  ] });
}, Vo = (e) => {
  var h, m;
  const t = p(), n = y(), { block: o, setLoading: r } = e, i = C(), [c, s] = w(!1);
  x(() => {
    c && setTimeout(() => {
      s(!1);
    }, 3e3);
  }, [c]);
  const d = b(
    (g) => {
      if (g === null)
        return;
      async function f(H) {
        if (r(!0), i.uploadFile !== void 0)
          try {
            let B = await i.uploadFile(H, o.id);
            typeof B == "string" && (B = {
              props: {
                name: H.name,
                url: B
              }
            }), i.updateBlock(o, B);
          } catch {
            s(!0);
          } finally {
            r(!1);
          }
      }
      f(g);
    },
    [o, i, r]
  ), a = i.schema.blockSpecs[o.type], u = (m = (h = a.implementation.meta) == null ? void 0 : h.fileBlockAccept) != null && m.length ? a.implementation.meta.fileBlockAccept.join(",") : "*/*";
  return /* @__PURE__ */ v(t.FilePanel.TabPanel, { className: "bn-tab-panel", children: [
    /* @__PURE__ */ l(
      t.FilePanel.FileInput,
      {
        className: "bn-file-input",
        "data-test": "upload-input",
        accept: u,
        placeholder: n.file_panel.upload.file_placeholder[o.type] || n.file_panel.upload.file_placeholder.file,
        value: null,
        onChange: d
      }
    ),
    c && /* @__PURE__ */ l("div", { className: "bn-error-text", children: n.file_panel.upload.upload_error })
  ] });
}, xt = (e) => {
  const t = p(), n = y(), o = C(), [r, i] = w(!1), c = e.tabs ?? [
    ...o.uploadFile !== void 0 ? [
      {
        name: n.file_panel.upload.title,
        tabPanel: /* @__PURE__ */ l(Vo, { block: e.block, setLoading: i })
      }
    ] : [],
    {
      name: n.file_panel.embed.title,
      tabPanel: /* @__PURE__ */ l(xo, { block: e.block })
    }
  ], [s, d] = w(
    e.defaultOpenTab || c[0].name
  );
  return /* @__PURE__ */ l(
    t.FilePanel.Root,
    {
      className: "bn-panel",
      defaultOpenTab: s,
      openTab: s,
      setOpenTab: d,
      tabs: c,
      loading: r
    }
  );
}, Bo = (e) => {
  const t = C();
  if (!t.filePanel)
    throw new Error(
      "FileToolbarController can only be used when BlockNote editor schema contains file block"
    );
  const n = D(
    t.filePanel.onUpdate.bind(t.filePanel)
  ), { isMounted: o, ref: r, style: i, getFloatingProps: c } = z(
    (n == null ? void 0 : n.show) || !1,
    (n == null ? void 0 : n.referencePos) || null,
    5e3,
    {
      placement: "bottom",
      middleware: [U(10), q()],
      onOpenChange: (h) => {
        h || (t.filePanel.closeMenu(), t.focus());
      },
      ...e.floatingOptions
    }
  );
  if (!o || !n)
    return null;
  const { show: s, referencePos: d, ...a } = n, u = e.filePanel || xt;
  return /* @__PURE__ */ l("div", { ref: r, style: i, ...c(), children: /* @__PURE__ */ l(u, { ...a }) });
};
function So(e, t) {
  if (t == null)
    return !1;
  if ("composedPath" in e)
    return e.composedPath().includes(t);
  const n = e;
  return n.target != null && t.contains(n.target);
}
function j(e, t) {
  J(e, t), he(e, t);
}
function To(e) {
  return (t) => {
    e.forEach((n) => {
      typeof n == "function" ? n(t) : n != null && (n.current = t);
    });
  };
}
function R(e) {
  const t = F();
  if (e || (e = t == null ? void 0 : t.editor), !e)
    throw new Error(
      "'editor' is required, either from BlockNoteContext or as a function argument"
    );
  const n = e, [o, r] = w(() => {
    var c;
    return ((c = n.getSelection()) == null ? void 0 : c.blocks) || [n.getTextCursorPosition().block];
  }), i = b(
    () => {
      var c;
      return r(
        ((c = n.getSelection()) == null ? void 0 : c.blocks) || [n.getTextCursorPosition().block]
      );
    },
    [n]
  );
  return j(i, n), o;
}
const Lo = {
  bold: qn,
  italic: Yn,
  underline: oo,
  strike: to,
  code: Gn
};
function _o(e, t) {
  return e in t.schema.styleSchema && t.schema.styleSchema[e].type === e && t.schema.styleSchema[e].propSchema === "boolean";
}
const oe = (e) => {
  const t = y(), n = p(), o = C(), r = _o(
    e.basicTextStyle,
    o
  ), i = R(o), [c, s] = w(
    e.basicTextStyle in o.getActiveStyles()
  );
  j(() => {
    r && s(e.basicTextStyle in o.getActiveStyles());
  }, o);
  const d = (h) => {
    if (o.focus(), !!r) {
      if (o.schema.styleSchema[h].propSchema !== "boolean")
        throw new Error("can only toggle boolean styles");
      o.toggleStyles({ [h]: !0 });
    }
  };
  if (!M(() => r ? !!i.find((h) => h.content !== void 0) : !1, [r, i]) || !o.isEditable)
    return null;
  const u = Lo[e.basicTextStyle];
  return /* @__PURE__ */ l(
    n.FormattingToolbar.Button,
    {
      className: "bn-button",
      "data-test": e.basicTextStyle,
      onClick: () => d(e.basicTextStyle),
      isSelected: c,
      label: t.formatting_toolbar[e.basicTextStyle].tooltip,
      mainTooltip: t.formatting_toolbar[e.basicTextStyle].tooltip,
      secondaryTooltip: ue(
        t.formatting_toolbar[e.basicTextStyle].secondary_tooltip,
        t.generic.ctrl_shortcut
      ),
      icon: /* @__PURE__ */ l(u, {})
    }
  );
}, He = (e) => {
  const t = e.textColor || "default", n = e.backgroundColor || "default", o = e.size || 16, r = M(
    () => ({
      pointerEvents: "none",
      fontSize: (o * 0.75).toString() + "px",
      height: o.toString() + "px",
      lineHeight: o.toString() + "px",
      textAlign: "center",
      width: o.toString() + "px"
    }),
    [o]
  );
  return /* @__PURE__ */ l(
    "div",
    {
      className: "bn-color-icon",
      "data-background-color": n,
      "data-text-color": t,
      style: r,
      children: "A"
    }
  );
}, We = [
  "default",
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink"
], ge = (e) => {
  const t = p(), n = y();
  return /* @__PURE__ */ v(T, { children: [
    /* @__PURE__ */ l(() => e.text ? /* @__PURE__ */ v(T, { children: [
      /* @__PURE__ */ l(t.Generic.Menu.Label, { children: n.color_picker.text_title }),
      We.map((i) => /* @__PURE__ */ l(
        t.Generic.Menu.Item,
        {
          onClick: () => {
            e.onClick && e.onClick(), e.text.setColor(i);
          },
          "data-test": "text-color-" + i,
          icon: /* @__PURE__ */ l(He, { textColor: i, size: e.iconSize }),
          checked: e.text.color === i,
          children: n.color_picker.colors[i]
        },
        "text-color-" + i
      ))
    ] }) : null, {}),
    /* @__PURE__ */ l(() => e.background ? /* @__PURE__ */ v(T, { children: [
      /* @__PURE__ */ l(t.Generic.Menu.Label, { children: n.color_picker.background_title }),
      We.map((i) => /* @__PURE__ */ l(
        t.Generic.Menu.Item,
        {
          onClick: () => {
            e.onClick && e.onClick(), e.background.setColor(i);
          },
          "data-test": "background-color-" + i,
          icon: /* @__PURE__ */ l(He, { backgroundColor: i, size: e.iconSize }),
          checked: e.background.color === i,
          children: n.color_picker.colors[i]
        },
        "background-color-" + i
      ))
    ] }) : null, {})
  ] });
};
function qe(e, t) {
  return `${e}Color` in t.schema.styleSchema && t.schema.styleSchema[`${e}Color`].type === `${e}Color` && t.schema.styleSchema[`${e}Color`].propSchema === "string";
}
const Eo = () => {
  const e = p(), t = y(), n = C(), o = qe("text", n), r = qe("background", n), i = R(n), [c, s] = w(
    o && n.getActiveStyles().textColor || "default"
  ), [d, a] = w(
    r && n.getActiveStyles().backgroundColor || "default"
  );
  j(() => {
    o && s(n.getActiveStyles().textColor || "default"), r && a(
      n.getActiveStyles().backgroundColor || "default"
    );
  }, n);
  const u = b(
    (g) => {
      if (!o)
        throw Error(
          "Tried to set text color, but style does not exist in editor schema."
        );
      g === "default" ? n.removeStyles({ textColor: g }) : n.addStyles({ textColor: g }), setTimeout(() => {
        n.focus();
      });
    },
    [n, o]
  ), h = b(
    (g) => {
      if (!r)
        throw Error(
          "Tried to set background color, but style does not exist in editor schema."
        );
      g === "default" ? n.removeStyles({ backgroundColor: g }) : n.addStyles({ backgroundColor: g }), setTimeout(() => {
        n.focus();
      });
    },
    [r, n]
  );
  return !M(() => {
    if (!o && !r)
      return !1;
    for (const g of i)
      if (g.content !== void 0)
        return !0;
    return !1;
  }, [r, i, o]) || !n.isEditable ? null : /* @__PURE__ */ v(e.Generic.Menu.Root, { children: [
    /* @__PURE__ */ l(e.Generic.Menu.Trigger, { children: /* @__PURE__ */ l(
      e.FormattingToolbar.Button,
      {
        className: "bn-button",
        "data-test": "colors",
        label: t.formatting_toolbar.colors.tooltip,
        mainTooltip: t.formatting_toolbar.colors.tooltip,
        icon: /* @__PURE__ */ l(
          He,
          {
            textColor: c,
            backgroundColor: d,
            size: 20
          }
        )
      }
    ) }),
    /* @__PURE__ */ l(
      e.Generic.Menu.Dropdown,
      {
        className: "bn-menu-dropdown bn-color-picker-dropdown",
        children: /* @__PURE__ */ l(
          ge,
          {
            text: o ? {
              color: c,
              setColor: u
            } : void 0,
            background: r ? {
              color: d,
              setColor: h
            } : void 0
          }
        )
      }
    )
  ] });
}, $e = (e) => {
  for (const t of $t)
    if (e.startsWith(t))
      return e;
  return `${Xt}://${e}`;
}, Vt = (e) => {
  const t = p(), n = y(), { url: o, text: r, editLink: i, showTextField: c } = e, [s, d] = w(o), [a, u] = w(r);
  x(() => {
    d(o), u(r);
  }, [r, o]);
  const h = b(
    (H) => {
      H.key === "Enter" && (H.preventDefault(), i($e(s), a));
    },
    [i, s, a]
  ), m = b(
    (H) => d(H.currentTarget.value),
    []
  ), g = b(
    (H) => u(H.currentTarget.value),
    []
  ), f = b(
    () => i($e(s), a),
    [i, s, a]
  );
  return /* @__PURE__ */ v(t.Generic.Form.Root, { children: [
    /* @__PURE__ */ l(
      t.Generic.Form.TextInput,
      {
        className: "bn-text-input",
        name: "url",
        icon: /* @__PURE__ */ l(ft, {}),
        autoFocus: !0,
        placeholder: n.link_toolbar.form.url_placeholder,
        value: s,
        onKeyDown: h,
        onChange: m,
        onSubmit: f
      }
    ),
    c !== !1 && /* @__PURE__ */ l(
      t.Generic.Form.TextInput,
      {
        className: "bn-text-input",
        name: "title",
        icon: /* @__PURE__ */ l(Re, {}),
        placeholder: n.link_toolbar.form.title_placeholder,
        value: a,
        onKeyDown: h,
        onChange: g,
        onSubmit: f
      }
    )
  ] });
};
function Ro(e) {
  return "link" in e.schema.inlineContentSchema && e.schema.inlineContentSchema.link === "link";
}
const Io = () => {
  const e = C(), t = p(), n = y(), o = Ro(e), r = R(e), [i, c] = w(!1), [s, d] = w(e.getSelectedLinkUrl() || ""), [a, u] = w(e.getSelectedText());
  j(() => {
    u(e.getSelectedText() || ""), d(e.getSelectedLinkUrl() || "");
  }, e), x(() => {
    const f = (H) => {
      (H.ctrlKey || H.metaKey) && H.key === "k" && (c(!0), H.preventDefault());
    };
    if (!e.headless)
      return e.prosemirrorView.dom.addEventListener("keydown", f), () => {
        e.prosemirrorView.dom.removeEventListener("keydown", f);
      };
  }, [e.prosemirrorView, e.headless]);
  const h = b(
    (f) => {
      e.createLink(f), c(!1), e.focus();
    },
    [e]
  ), m = e.transact(
    (f) => Kt(f.selection)
  );
  return !M(() => {
    if (!o)
      return !1;
    for (const f of r)
      if (f.content === void 0)
        return !1;
    return !m;
  }, [o, r, m]) || !("link" in e.schema.inlineContentSchema) || !e.isEditable ? null : /* @__PURE__ */ v(t.Generic.Popover.Root, { opened: i, children: [
    /* @__PURE__ */ l(t.Generic.Popover.Trigger, { children: /* @__PURE__ */ l(
      t.FormattingToolbar.Button,
      {
        className: "bn-button",
        "data-test": "createLink",
        label: n.formatting_toolbar.link.tooltip,
        mainTooltip: n.formatting_toolbar.link.tooltip,
        secondaryTooltip: ue(
          n.formatting_toolbar.link.secondary_tooltip,
          n.generic.ctrl_shortcut
        ),
        icon: /* @__PURE__ */ l(ft, {}),
        onClick: () => c(!0)
      }
    ) }),
    /* @__PURE__ */ l(
      t.Generic.Popover.Content,
      {
        className: "bn-popover-content bn-form-popover",
        variant: "form-popover",
        children: /* @__PURE__ */ l(
          Vt,
          {
            url: s,
            text: a,
            editLink: h,
            showTextField: !1
          }
        )
      }
    )
  ] });
}, No = () => {
  const e = y(), t = p(), n = C(), [o, r] = w(), i = R(n), c = M(() => {
    if (i.length !== 1)
      return;
    const a = i[0];
    if (I(a, n, a.type, {
      url: "string",
      caption: "string"
    }))
      return r(a.props.caption), a;
  }, [n, i]), s = b(
    (a) => {
      c && X(n, c.type, {
        caption: "string"
      }) && a.key === "Enter" && (a.preventDefault(), n.updateBlock(c, {
        props: {
          caption: o
        }
      }));
    },
    [o, n, c]
  ), d = b(
    (a) => r(a.currentTarget.value),
    []
  );
  return !c || c.props.url === "" || !n.isEditable ? null : /* @__PURE__ */ v(t.Generic.Popover.Root, { children: [
    /* @__PURE__ */ l(t.Generic.Popover.Trigger, { children: /* @__PURE__ */ l(
      t.FormattingToolbar.Button,
      {
        className: "bn-button",
        label: e.formatting_toolbar.file_caption.tooltip,
        mainTooltip: e.formatting_toolbar.file_caption.tooltip,
        icon: /* @__PURE__ */ l(Ue, {}),
        isSelected: c.props.caption !== ""
      }
    ) }),
    /* @__PURE__ */ l(
      t.Generic.Popover.Content,
      {
        className: "bn-popover-content bn-form-popover",
        variant: "form-popover",
        children: /* @__PURE__ */ l(t.Generic.Form.Root, { children: /* @__PURE__ */ l(
          t.Generic.Form.TextInput,
          {
            name: "file-caption",
            icon: /* @__PURE__ */ l(Ue, {}),
            value: o || "",
            autoFocus: !0,
            placeholder: e.formatting_toolbar.file_caption.input_placeholder,
            onKeyDown: s,
            onChange: d
          }
        ) })
      }
    )
  ] });
}, Po = () => {
  const e = y(), t = p(), n = C(), o = R(n), r = M(() => {
    if (o.length !== 1)
      return;
    const c = o[0];
    if (I(c, n, c.type, { url: "string" }))
      return c;
  }, [n, o]), i = b(() => {
    n.focus(), n.removeBlocks([r]);
  }, [n, r]);
  return !r || r.props.url === "" || !n.isEditable ? null : /* @__PURE__ */ l(
    t.FormattingToolbar.Button,
    {
      className: "bn-button",
      label: e.formatting_toolbar.file_delete.tooltip[r.type] || e.formatting_toolbar.file_delete.tooltip.file,
      mainTooltip: e.formatting_toolbar.file_delete.tooltip[r.type] || e.formatting_toolbar.file_delete.tooltip.file,
      icon: /* @__PURE__ */ l(uo, {}),
      onClick: i
    }
  );
}, Zo = () => {
  const e = y(), t = p(), n = C(), [o, r] = w(), i = R(n), c = M(() => {
    if (i.length !== 1)
      return;
    const a = i[0];
    if (I(a, n, a.type, {
      url: "string",
      name: "string"
    }))
      return r(a.props.name), a;
  }, [n, i]), s = b(
    (a) => {
      c && X(n, c.type, {
        name: "string"
      }) && a.key === "Enter" && (a.preventDefault(), n.updateBlock(c, {
        props: {
          name: o
        }
      }));
    },
    [o, n, c]
  ), d = b(
    (a) => r(a.currentTarget.value),
    []
  );
  return !c || c.props.name === "" || !n.isEditable ? null : /* @__PURE__ */ v(t.Generic.Popover.Root, { children: [
    /* @__PURE__ */ l(t.Generic.Popover.Trigger, { children: /* @__PURE__ */ l(
      t.FormattingToolbar.Button,
      {
        className: "bn-button",
        label: e.formatting_toolbar.file_rename.tooltip[c.type] || e.formatting_toolbar.file_rename.tooltip.file,
        mainTooltip: e.formatting_toolbar.file_rename.tooltip[c.type] || e.formatting_toolbar.file_rename.tooltip.file,
        icon: /* @__PURE__ */ l(Ge, {})
      }
    ) }),
    /* @__PURE__ */ l(
      t.Generic.Popover.Content,
      {
        className: "bn-popover-content bn-form-popover",
        variant: "form-popover",
        children: /* @__PURE__ */ l(t.Generic.Form.Root, { children: /* @__PURE__ */ l(
          t.Generic.Form.TextInput,
          {
            name: "file-name",
            icon: /* @__PURE__ */ l(Ge, {}),
            value: o || "",
            autoFocus: !0,
            placeholder: e.formatting_toolbar.file_rename.input_placeholder[c.type] || e.formatting_toolbar.file_rename.input_placeholder.file,
            onKeyDown: s,
            onChange: d
          }
        ) })
      }
    )
  ] });
}, Ao = () => {
  const e = y(), t = p(), n = C(), o = R(n), [r, i] = w(!1);
  x(() => {
    i(!1);
  }, [o]);
  const c = o.length === 1 ? o[0] : void 0;
  return c === void 0 || !I(c, n, c.type, {
    url: "string"
  }) || !n.isEditable ? null : /* @__PURE__ */ v(t.Generic.Popover.Root, { opened: r, position: "bottom", children: [
    /* @__PURE__ */ l(t.Generic.Popover.Trigger, { children: /* @__PURE__ */ l(
      t.FormattingToolbar.Button,
      {
        className: "bn-button",
        onClick: () => i(!r),
        isSelected: r,
        mainTooltip: e.formatting_toolbar.file_replace.tooltip[c.type] || e.formatting_toolbar.file_replace.tooltip.file,
        label: e.formatting_toolbar.file_replace.tooltip[c.type] || e.formatting_toolbar.file_replace.tooltip.file,
        icon: /* @__PURE__ */ l(io, {})
      }
    ) }),
    /* @__PURE__ */ l(
      t.Generic.Popover.Content,
      {
        className: "bn-popover-content bn-panel-popover",
        variant: "panel-popover",
        children: /* @__PURE__ */ l(xt, { block: c })
      }
    )
  ] });
}, Do = () => {
  const e = y(), t = p(), n = C(), o = R(n), [r, i] = w(
    () => n.canNestBlock()
  );
  j(() => {
    i(n.canNestBlock());
  }, n);
  const c = b(() => {
    n.focus(), n.nestBlock();
  }, [n]);
  return !M(() => !o.find(
    (d) => n.schema.blockSchema[d.type].content !== "inline"
  ), [n.schema.blockSchema, o]) || !n.isEditable ? null : /* @__PURE__ */ l(
    t.FormattingToolbar.Button,
    {
      className: "bn-button",
      "data-test": "nestBlock",
      onClick: c,
      isDisabled: !r,
      label: e.formatting_toolbar.nest.tooltip,
      mainTooltip: e.formatting_toolbar.nest.tooltip,
      secondaryTooltip: ue(
        e.formatting_toolbar.nest.secondary_tooltip,
        e.generic.ctrl_shortcut
      ),
      icon: /* @__PURE__ */ l(Kn, {})
    }
  );
}, Fo = () => {
  const e = y(), t = p(), n = C(), o = R(n), [r, i] = w(
    () => n.canUnnestBlock()
  );
  j(() => {
    i(n.canUnnestBlock());
  }, n);
  const c = b(() => {
    n.focus(), n.unnestBlock();
  }, [n]);
  return !M(() => !o.find(
    (d) => n.schema.blockSchema[d.type].content !== "inline"
  ), [n.schema.blockSchema, o]) || !n.isEditable ? null : /* @__PURE__ */ l(
    t.FormattingToolbar.Button,
    {
      className: "bn-button",
      "data-test": "unnestBlock",
      onClick: c,
      isDisabled: !r,
      label: e.formatting_toolbar.unnest.tooltip,
      mainTooltip: e.formatting_toolbar.unnest.tooltip,
      secondaryTooltip: ue(
        e.formatting_toolbar.unnest.secondary_tooltip,
        e.generic.ctrl_shortcut
      ),
      icon: /* @__PURE__ */ l(Xn, {})
    }
  );
}, Oo = (e) => [
  {
    name: e.slash_menu.paragraph.title,
    type: "paragraph",
    icon: Re,
    isSelected: (t) => t.type === "paragraph"
  },
  {
    name: e.slash_menu.heading.title,
    type: "heading",
    props: { level: 1 },
    icon: ie,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 1
  },
  {
    name: e.slash_menu.heading_2.title,
    type: "heading",
    props: { level: 2 },
    icon: ce,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 2
  },
  {
    name: e.slash_menu.heading_3.title,
    type: "heading",
    props: { level: 3 },
    icon: ae,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 3
  },
  {
    name: e.slash_menu.heading_4.title,
    type: "heading",
    props: { level: 4 },
    icon: mt,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 4
  },
  {
    name: e.slash_menu.heading_5.title,
    type: "heading",
    props: { level: 5 },
    icon: ht,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 5
  },
  {
    name: e.slash_menu.heading_6.title,
    type: "heading",
    props: { level: 6 },
    icon: gt,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 6
  },
  {
    name: e.slash_menu.toggle_heading.title,
    type: "heading",
    props: { level: 1, isToggleable: !0 },
    icon: ie,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 1 && "isToggleable" in t.props && t.props.isToggleable
  },
  {
    name: e.slash_menu.toggle_heading_2.title,
    type: "heading",
    props: { level: 2, isToggleable: !0 },
    icon: ce,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 2 && "isToggleable" in t.props && t.props.isToggleable
  },
  {
    name: e.slash_menu.toggle_heading_3.title,
    type: "heading",
    props: { level: 3, isToggleable: !0 },
    icon: ae,
    isSelected: (t) => t.type === "heading" && "level" in t.props && t.props.level === 3 && "isToggleable" in t.props && t.props.isToggleable
  },
  {
    name: e.slash_menu.quote.title,
    type: "quote",
    icon: kt,
    isSelected: (t) => t.type === "quote"
  },
  {
    name: e.slash_menu.toggle_list.title,
    type: "toggleListItem",
    icon: vt,
    isSelected: (t) => t.type === "toggleListItem"
  },
  {
    name: e.slash_menu.bullet_list.title,
    type: "bulletListItem",
    icon: pt,
    isSelected: (t) => t.type === "bulletListItem"
  },
  {
    name: e.slash_menu.numbered_list.title,
    type: "numberedListItem",
    icon: Ct,
    isSelected: (t) => t.type === "numberedListItem"
  },
  {
    name: e.slash_menu.check_list.title,
    type: "checkListItem",
    icon: bt,
    isSelected: (t) => t.type === "checkListItem"
  }
], Go = (e) => {
  const t = p(), n = y(), o = C(), r = R(o), [i, c] = w(o.getTextCursorPosition().block), s = M(() => (e.items || Oo(n)).filter(
    (u) => u.type in o.schema.blockSchema
  ), [o, n, e.items]), d = M(
    () => s.find((u) => u.type === i.type) !== void 0,
    [i.type, s]
  ), a = M(() => {
    const u = (h) => {
      o.focus(), o.transact(() => {
        for (const m of r)
          o.updateBlock(m, {
            type: h.type,
            props: h.props
          });
      });
    };
    return s.map((h) => {
      const m = h.icon;
      return {
        text: h.name,
        icon: /* @__PURE__ */ l(m, { size: 16 }),
        onClick: () => u(h),
        isSelected: h.isSelected(i)
      };
    });
  }, [i, s, o, r]);
  return j(() => {
    c(o.getTextCursorPosition().block);
  }, o), !d || !o.isEditable ? null : /* @__PURE__ */ l(
    t.FormattingToolbar.Select,
    {
      className: "bn-select",
      items: a
    }
  );
}, Uo = () => {
  const e = y(), t = p(), n = C(), o = b(() => {
    var r;
    (r = n.comments) == null || r.startPendingComment(), n.formattingToolbar.closeMenu();
  }, [n]);
  return n.comments ? /* @__PURE__ */ l(
    t.FormattingToolbar.Button,
    {
      className: "bn-button",
      label: e.formatting_toolbar.comment.tooltip,
      mainTooltip: e.formatting_toolbar.comment.tooltip,
      icon: /* @__PURE__ */ l(ut, {}),
      onClick: o
    }
  ) : null;
}, zo = () => {
  const e = y(), t = p(), n = C(), o = b(() => {
    n._tiptapEditor.chain().focus().addPendingComment().run();
  }, [n]);
  return (
    // We manually check if a comment extension (like liveblocks) is installed
    // By adding default support for this, the user doesn't need to customize the formatting toolbar
    !n._tiptapEditor.commands.addPendingComment || !n.isEditable ? null : /* @__PURE__ */ l(
      t.FormattingToolbar.Button,
      {
        className: "bn-button",
        label: e.formatting_toolbar.comment.tooltip,
        mainTooltip: e.formatting_toolbar.comment.tooltip,
        icon: /* @__PURE__ */ l(ut, {}),
        onClick: o
      }
    )
  );
};
function Me(e, t) {
  try {
    const n = new URL(e, t);
    if (n.protocol !== "javascript:")
      return n.href;
  } catch {
  }
  return "#";
}
const jo = () => {
  const e = y(), t = p(), n = C(), o = R(n), r = M(() => {
    if (o.length !== 1)
      return;
    const c = o[0];
    if (I(c, n, c.type, { url: "string" }))
      return c;
  }, [n, o]), i = b(() => {
    r && r.props.url && (n.focus(), n.resolveFileUrl ? n.resolveFileUrl(r.props.url).then(
      (c) => window.open(Me(c, window.location.href))
    ) : window.open(Me(r.props.url, window.location.href)));
  }, [n, r]);
  return !r || r.props.url === "" ? null : /* @__PURE__ */ l(
    t.FormattingToolbar.Button,
    {
      className: "bn-button",
      label: e.formatting_toolbar.file_download.tooltip[r.type] || e.formatting_toolbar.file_download.tooltip.file,
      mainTooltip: e.formatting_toolbar.file_download.tooltip[r.type] || e.formatting_toolbar.file_download.tooltip.file,
      icon: /* @__PURE__ */ l(ho, {}),
      onClick: i
    }
  );
}, Wo = () => {
  const e = y(), t = p(), n = C(), o = R(n), r = M(() => {
    if (o.length !== 1)
      return;
    const c = o[0];
    if (I(c, n, c.type, {
      url: "string",
      showPreview: "boolean"
    }))
      return c;
  }, [n, o]), i = b(() => {
    r && X(n, r.type, {
      showPreview: "boolean"
    }) && n.updateBlock(r, {
      props: {
        showPreview: !r.props.showPreview
      }
    });
  }, [n, r]);
  return !r || r.props.url === "" || !n.isEditable ? null : /* @__PURE__ */ l(
    t.FormattingToolbar.Button,
    {
      className: "bn-button",
      label: "Toggle preview",
      mainTooltip: e.formatting_toolbar.file_preview_toggle.tooltip,
      icon: /* @__PURE__ */ l(lo, {}),
      isSelected: r.props.showPreview,
      onClick: i
    }
  );
}, qo = () => {
  const e = y(), t = p(), n = C(), o = R(n), r = M(() => {
    var s;
    if (o.length !== 1)
      return;
    const c = o[0];
    if (c.type === "table")
      return (s = n.tableHandles) == null ? void 0 : s.getMergeDirection(c);
  }, [n, o]), i = b(() => {
    var c;
    (c = n.tableHandles) == null || c.mergeCells();
  }, [n]);
  return !n.isEditable || r === void 0 || !n.settings.tables.splitCells ? null : /* @__PURE__ */ l(
    t.FormattingToolbar.Button,
    {
      className: "bn-button",
      label: e.formatting_toolbar.table_cell_merge.tooltip,
      mainTooltip: e.formatting_toolbar.table_cell_merge.tooltip,
      icon: r === "horizontal" ? /* @__PURE__ */ l(Qn, {}) : /* @__PURE__ */ l(eo, {}),
      onClick: i
    }
  );
}, $o = {
  left: jn,
  center: Un,
  right: Wn,
  justify: zn
}, pe = (e) => {
  const t = p(), n = y(), o = C(), r = R(o), i = M(() => {
    var u;
    const a = r[0];
    if (I(a, o, a.type, {
      textAlignment: ee.textAlignment
    }))
      return a.props.textAlignment;
    if (a.type === "table") {
      const h = (u = o.tableHandles) == null ? void 0 : u.getCellSelection();
      if (!h)
        return;
      const m = h.cells.map(
        ({ row: f, col: H }) => K(
          a.content.rows[f].cells[H]
        ).props.textAlignment
      ), g = m[0];
      if (m.every((f) => f === g))
        return g;
    }
  }, [o, r]), c = b(
    (a) => {
      var u;
      o.focus();
      for (const h of r)
        if (I(h, o, h.type, {
          textAlignment: ee.textAlignment
        }) && X(o, h.type, {
          textAlignment: ee.textAlignment
        }))
          o.updateBlock(h, {
            props: { textAlignment: a }
          });
        else if (h.type === "table") {
          const m = (u = o.tableHandles) == null ? void 0 : u.getCellSelection();
          if (!m)
            continue;
          const g = h.content.rows.map(
            (f) => ({
              ...f,
              cells: f.cells.map((H) => K(H))
            })
          );
          m.cells.forEach(({ row: f, col: H }) => {
            g[f].cells[H].props.textAlignment = a;
          }), o.updateBlock(h, {
            type: "table",
            content: {
              ...h.content,
              type: "tableContent",
              rows: g
            }
          }), o.setTextCursorPosition(h);
        }
    },
    [o, r]
  );
  if (!M(() => !!r.find(
    (a) => I(a, o, a.type, {
      textAlignment: ee.textAlignment
    }) || a.type === "table" && a.children
  ), [o, r]) || !o.isEditable)
    return null;
  const d = $o[e.textAlignment];
  return /* @__PURE__ */ l(
    t.FormattingToolbar.Button,
    {
      className: "bn-button",
      "data-test": `alignText${e.textAlignment.slice(0, 1).toUpperCase() + e.textAlignment.slice(1)}`,
      onClick: () => c(e.textAlignment),
      isSelected: i === e.textAlignment,
      label: n.formatting_toolbar[`align_${e.textAlignment}`].tooltip,
      mainTooltip: n.formatting_toolbar[`align_${e.textAlignment}`].tooltip,
      icon: /* @__PURE__ */ l(d, {})
    }
  );
}, Xo = (e) => [
  /* @__PURE__ */ l(Go, { items: e }, "blockTypeSelect"),
  /* @__PURE__ */ l(qo, {}, "tableCellMergeButton"),
  /* @__PURE__ */ l(No, {}, "fileCaptionButton"),
  /* @__PURE__ */ l(Ao, {}, "replaceFileButton"),
  /* @__PURE__ */ l(Zo, {}, "fileRenameButton"),
  /* @__PURE__ */ l(Po, {}, "fileDeleteButton"),
  /* @__PURE__ */ l(jo, {}, "fileDownloadButton"),
  /* @__PURE__ */ l(Wo, {}, "filePreviewButton"),
  /* @__PURE__ */ l(oe, { basicTextStyle: "bold" }, "boldStyleButton"),
  /* @__PURE__ */ l(oe, { basicTextStyle: "italic" }, "italicStyleButton"),
  /* @__PURE__ */ l(
    oe,
    {
      basicTextStyle: "underline"
    },
    "underlineStyleButton"
  ),
  /* @__PURE__ */ l(oe, { basicTextStyle: "strike" }, "strikeStyleButton"),
  /* @__PURE__ */ l(pe, { textAlignment: "left" }, "textAlignLeftButton"),
  /* @__PURE__ */ l(pe, { textAlignment: "center" }, "textAlignCenterButton"),
  /* @__PURE__ */ l(pe, { textAlignment: "right" }, "textAlignRightButton"),
  /* @__PURE__ */ l(Eo, {}, "colorStyleButton"),
  /* @__PURE__ */ l(Do, {}, "nestBlockButton"),
  /* @__PURE__ */ l(Fo, {}, "unnestBlockButton"),
  /* @__PURE__ */ l(Io, {}, "createLinkButton"),
  /* @__PURE__ */ l(Uo, {}, "addCommentButton"),
  /* @__PURE__ */ l(zo, {}, "addTiptapCommentButton")
], Bt = (e) => {
  const t = p();
  return /* @__PURE__ */ l(
    t.FormattingToolbar.Root,
    {
      className: "bn-toolbar bn-formatting-toolbar",
      children: e.children || Xo(e.blockTypeSelectItems)
    }
  );
}, Xe = (e) => {
  switch (e) {
    case "left":
      return "top-start";
    case "center":
      return "top";
    case "right":
      return "top-end";
    default:
      return "top-start";
  }
}, Ko = (e) => {
  const t = N(null), n = C(), [o, r] = w(
    () => {
      const m = n.getTextCursorPosition().block;
      return "textAlignment" in m.props ? Xe(
        m.props.textAlignment
      ) : "top-start";
    }
  );
  j(() => {
    const m = n.getTextCursorPosition().block;
    "textAlignment" in m.props ? r(
      Xe(
        m.props.textAlignment
      )
    ) : r("top-start");
  }, n);
  const i = D(
    n.formattingToolbar.onUpdate.bind(n.formattingToolbar)
  ), { isMounted: c, ref: s, style: d, getFloatingProps: a } = z(
    (i == null ? void 0 : i.show) || !1,
    (i == null ? void 0 : i.referencePos) || null,
    3e3,
    {
      placement: o,
      middleware: [U(10), de(), q()],
      onOpenChange: (m, g) => {
        m || (n.formattingToolbar.closeMenu(), n.focus());
      },
      canDismiss: {
        enabled: !0,
        escapeKey: !0,
        outsidePress: (m) => {
          var H;
          const g = (H = n._tiptapEditor) == null ? void 0 : H.view;
          return !g || !m.target ? !1 : !So(m, g.dom.parentElement);
        }
      },
      ...e.floatingOptions
    }
  ), u = M(() => To([t, s]), [t, s]);
  if (!c || !i)
    return null;
  if (!i.show && t.current)
    return /* @__PURE__ */ l(
      "div",
      {
        ref: u,
        style: d,
        dangerouslySetInnerHTML: { __html: t.current.innerHTML }
      }
    );
  const h = e.formattingToolbar || Bt;
  return /* @__PURE__ */ l("div", { ref: u, style: d, ...a(), children: /* @__PURE__ */ l(h, {}) });
}, Yo = (e) => {
  const t = p(), n = y();
  return /* @__PURE__ */ l(
    t.LinkToolbar.Button,
    {
      className: "bn-button",
      label: n.link_toolbar.delete.tooltip,
      mainTooltip: n.link_toolbar.delete.tooltip,
      isSelected: !1,
      onClick: e.deleteLink,
      icon: /* @__PURE__ */ l(Jn, {})
    }
  );
}, Jo = (e) => {
  const t = p(), n = y();
  return /* @__PURE__ */ v(t.Generic.Popover.Root, { children: [
    /* @__PURE__ */ l(t.Generic.Popover.Trigger, { children: /* @__PURE__ */ l(
      t.LinkToolbar.Button,
      {
        className: "bn-button",
        mainTooltip: n.link_toolbar.edit.tooltip,
        isSelected: !1,
        children: n.link_toolbar.edit.text
      }
    ) }),
    /* @__PURE__ */ l(
      t.Generic.Popover.Content,
      {
        className: "bn-popover-content bn-form-popover",
        variant: "form-popover",
        children: /* @__PURE__ */ l(Vt, { ...e })
      }
    )
  ] });
}, Qo = (e) => {
  const t = p(), n = y();
  return /* @__PURE__ */ l(
    t.LinkToolbar.Button,
    {
      className: "bn-button",
      mainTooltip: n.link_toolbar.open.tooltip,
      label: n.link_toolbar.open.tooltip,
      isSelected: !1,
      onClick: () => {
        window.open(Me(e.url, window.location.href), "_blank");
      },
      icon: /* @__PURE__ */ l(go, {})
    }
  );
}, er = (e) => {
  const t = p();
  return /* @__PURE__ */ l(
    t.LinkToolbar.Root,
    {
      className: "bn-toolbar bn-link-toolbar",
      onMouseEnter: e.stopHideTimer,
      onMouseLeave: e.startHideTimer,
      children: e.children || /* @__PURE__ */ v(T, { children: [
        /* @__PURE__ */ l(
          Jo,
          {
            url: e.url,
            text: e.text,
            editLink: e.editLink
          }
        ),
        /* @__PURE__ */ l(Qo, { url: e.url }),
        /* @__PURE__ */ l(Yo, { deleteLink: e.deleteLink })
      ] })
    }
  );
}, tr = (e) => {
  const t = C(), n = {
    deleteLink: t.linkToolbar.deleteLink,
    editLink: t.linkToolbar.editLink,
    startHideTimer: t.linkToolbar.startHideTimer,
    stopHideTimer: t.linkToolbar.stopHideTimer
  }, o = D(
    t.linkToolbar.onUpdate.bind(t.linkToolbar)
  ), { isMounted: r, ref: i, style: c, getFloatingProps: s } = z(
    (o == null ? void 0 : o.show) || !1,
    (o == null ? void 0 : o.referencePos) || null,
    4e3,
    {
      placement: "top-start",
      middleware: [U(10), q()],
      onOpenChange: (m) => {
        m || (t.linkToolbar.closeMenu(), t.focus());
      },
      ...e.floatingOptions
    }
  );
  if (!r || !o)
    return null;
  const { show: d, referencePos: a, ...u } = o, h = e.linkToolbar || er;
  return /* @__PURE__ */ l("div", { ref: i, style: c, ...s(), children: /* @__PURE__ */ l(h, { ...u, ...n }) });
};
function nr(e) {
  return k({ attr: { viewBox: "0 0 1024 1024" }, child: [{ tag: "path", attr: { d: "M482 152h60q8 0 8 8v704q0 8-8 8h-60q-8 0-8-8V160q0-8 8-8Z" }, child: [] }, { tag: "path", attr: { d: "M192 474h672q8 0 8 8v60q0 8-8 8H160q-8 0-8-8v-60q0-8 8-8Z" }, child: [] }] })(e);
}
const or = (e) => {
  const t = p(), n = y(), o = C(), r = b(() => {
    const i = e.block.content;
    if (i !== void 0 && Array.isArray(i) && i.length === 0)
      o.setTextCursorPosition(e.block), o.openSuggestionMenu("/");
    else {
      const s = o.insertBlocks(
        [{ type: "paragraph" }],
        e.block,
        "after"
      )[0];
      o.setTextCursorPosition(s), o.openSuggestionMenu("/");
    }
  }, [o, e.block]);
  return /* @__PURE__ */ l(
    t.SideMenu.Button,
    {
      className: "bn-button",
      label: n.side_menu.add_block_label,
      icon: /* @__PURE__ */ l(nr, { size: 24, onClick: r, "data-test": "dragHandleAdd" })
    }
  );
};
function St(e) {
  return k({ attr: { viewBox: "0 0 24 24" }, child: [{ tag: "path", attr: { fill: "none", d: "M0 0h24v24H0V0z" }, child: [] }, { tag: "path", attr: { d: "M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" }, child: [] }] })(e);
}
function rr(e) {
  return k({ attr: { viewBox: "0 0 24 24" }, child: [{ tag: "path", attr: { fill: "none", d: "M0 0h24v24H0z" }, child: [] }, { tag: "path", attr: { d: "m7 10 5 5 5-5z" }, child: [] }] })(e);
}
const lr = (e) => {
  const t = p(), n = C(), o = e.block;
  return !I(o, n, o.type, {
    textColor: "string"
  }) && !I(o, n, o.type, {
    backgroundColor: "string"
  }) ? null : /* @__PURE__ */ v(t.Generic.Menu.Root, { position: "right", sub: !0, children: [
    /* @__PURE__ */ l(t.Generic.Menu.Trigger, { sub: !0, children: /* @__PURE__ */ l(
      t.Generic.Menu.Item,
      {
        className: "bn-menu-item",
        subTrigger: !0,
        children: e.children
      }
    ) }),
    /* @__PURE__ */ l(
      t.Generic.Menu.Dropdown,
      {
        sub: !0,
        className: "bn-menu-dropdown bn-color-picker-dropdown",
        children: /* @__PURE__ */ l(
          ge,
          {
            iconSize: 18,
            text: I(o, n, o.type, {
              textColor: "string"
            }) && X(n, o.type, {
              textColor: "string"
            }) ? {
              color: o.props.textColor,
              setColor: (r) => n.updateBlock(o, {
                type: o.type,
                props: { textColor: r }
              })
            } : void 0,
            background: I(o, n, o.type, {
              backgroundColor: "string"
            }) && X(n, o.type, {
              backgroundColor: "string"
            }) ? {
              color: o.props.backgroundColor,
              setColor: (r) => n.updateBlock(o, {
                props: { backgroundColor: r }
              })
            } : void 0
          }
        )
      }
    )
  ] });
}, ir = (e) => {
  const t = p(), n = C();
  return /* @__PURE__ */ l(
    t.Generic.Menu.Item,
    {
      className: "bn-menu-item",
      onClick: () => n.removeBlocks([e.block]),
      children: e.children
    }
  );
}, cr = (e) => {
  const t = p(), n = C();
  if (e.block.type !== "table" || !n.settings.tables.headers)
    return null;
  const o = !!e.block.content.headerRows;
  return /* @__PURE__ */ l(
    t.Generic.Menu.Item,
    {
      className: "bn-menu-item",
      checked: o,
      onClick: () => {
        const r = n.getBlock(e.block.id);
        r && n.updateBlock(r, {
          ...r,
          content: {
            ...r.content,
            headerRows: o ? void 0 : 1
          }
        });
      },
      children: e.children
    }
  );
}, ar = (e) => {
  const t = p(), n = C();
  if (e.block.type !== "table" || !n.settings.tables.headers)
    return null;
  const o = !!e.block.content.headerCols;
  return /* @__PURE__ */ l(
    t.Generic.Menu.Item,
    {
      className: "bn-menu-item",
      checked: o,
      onClick: () => {
        n.updateBlock(e.block, {
          type: "table",
          content: {
            ...e.block.content,
            type: "tableContent",
            headerCols: o ? void 0 : 1
          }
        });
      },
      children: e.children
    }
  );
}, sr = (e) => {
  const t = p(), n = y();
  return /* @__PURE__ */ l(
    t.Generic.Menu.Dropdown,
    {
      className: "bn-menu-dropdown bn-drag-handle-menu",
      children: e.children || /* @__PURE__ */ v(T, { children: [
        /* @__PURE__ */ l(ir, { ...e, children: n.drag_handle.delete_menuitem }),
        /* @__PURE__ */ l(lr, { ...e, children: n.drag_handle.colors_menuitem }),
        /* @__PURE__ */ l(cr, { ...e, children: n.drag_handle.header_row_menuitem }),
        /* @__PURE__ */ l(ar, { ...e, children: n.drag_handle.header_column_menuitem })
      ] })
    }
  );
}, dr = (e) => {
  const t = p(), n = y(), o = e.dragHandleMenu || sr;
  return /* @__PURE__ */ v(
    t.Generic.Menu.Root,
    {
      onOpenChange: (r) => {
        r ? e.freezeMenu() : e.unfreezeMenu();
      },
      position: "left",
      children: [
        /* @__PURE__ */ l(t.Generic.Menu.Trigger, { children: /* @__PURE__ */ l(
          t.SideMenu.Button,
          {
            label: n.side_menu.drag_handle_label,
            draggable: !0,
            onDragStart: (r) => e.blockDragStart(r, e.block),
            onDragEnd: e.blockDragEnd,
            className: "bn-button",
            icon: /* @__PURE__ */ l(St, { size: 24, "data-test": "dragHandle" })
          }
        ) }),
        /* @__PURE__ */ l(o, { block: e.block, children: e.children })
      ]
    }
  );
}, ur = (e) => {
  const t = p(), n = M(() => {
    var r;
    const o = {
      "data-block-type": e.block.type
    };
    return e.block.type === "heading" && (o["data-level"] = e.block.props.level.toString()), (r = e.editor.schema.blockSpecs[e.block.type].implementation.meta) != null && r.fileBlockAccept && (e.block.props.url ? o["data-url"] = "true" : o["data-url"] = "false"), o;
  }, [e.block.props, e.block.type, e.editor.schema.blockSpecs]);
  return /* @__PURE__ */ l(t.SideMenu.Root, { className: "bn-side-menu", ...n, children: e.children || /* @__PURE__ */ v(T, { children: [
    /* @__PURE__ */ l(or, { ...e }),
    /* @__PURE__ */ l(dr, { ...e })
  ] }) });
}, mr = (e) => {
  const t = C(), n = {
    blockDragStart: t.sideMenu.blockDragStart,
    blockDragEnd: t.sideMenu.blockDragEnd,
    freezeMenu: t.sideMenu.freezeMenu,
    unfreezeMenu: t.sideMenu.unfreezeMenu
  }, o = D(
    t.sideMenu.onUpdate.bind(t.sideMenu)
  ), { isMounted: r, ref: i, style: c, getFloatingProps: s } = z(
    (o == null ? void 0 : o.show) || !1,
    (o == null ? void 0 : o.referencePos) || null,
    1e3,
    {
      placement: "left-start",
      ...e.floatingOptions
    }
  );
  if (!r || !o)
    return null;
  const { show: d, referencePos: a, ...u } = o, h = e.sideMenu || ur;
  return /* @__PURE__ */ l("div", { ref: i, style: c, ...s(), children: /* @__PURE__ */ l(h, { ...u, ...n, editor: t }) });
};
async function hr(e, t) {
  return (await Yt(e, t)).map(
    ({ id: n, onItemClick: o }) => ({
      id: n,
      onItemClick: o,
      icon: n
    })
  );
}
function gr(e) {
  const t = p(), n = y(), { items: o, loadingState: r, selectedIndex: i, onItemClick: c, columns: s } = e, d = r === "loading-initial" || r === "loading" ? /* @__PURE__ */ l(
    t.GridSuggestionMenu.Loader,
    {
      className: "bn-grid-suggestion-menu-loader",
      columns: s
    }
  ) : null, a = M(() => {
    const u = [];
    for (let h = 0; h < o.length; h++) {
      const m = o[h];
      u.push(
        /* @__PURE__ */ l(
          t.GridSuggestionMenu.Item,
          {
            className: "bn-grid-suggestion-menu-item",
            item: m,
            id: `bn-grid-suggestion-menu-item-${h}`,
            isSelected: h === i,
            onClick: () => c == null ? void 0 : c(m)
          },
          m.id
        )
      );
    }
    return u;
  }, [t, o, c, i]);
  return /* @__PURE__ */ v(
    t.GridSuggestionMenu.Root,
    {
      id: "bn-grid-suggestion-menu",
      columns: s,
      className: "bn-grid-suggestion-menu",
      children: [
        d,
        a,
        a.length === 0 && e.loadingState === "loaded" && /* @__PURE__ */ l(
          t.GridSuggestionMenu.EmptyItem,
          {
            className: "bn-grid-suggestion-menu-empty-item",
            columns: s,
            children: n.suggestion_menu.no_items_title
          }
        )
      ]
    }
  );
}
function Tt(e, t, n, o = 3) {
  const r = N(0);
  x(() => {
    t !== void 0 && (e.length > 0 ? r.current = t.length : t.length - r.current > o && n());
  }, [n, o, e.length, t]);
}
function Lt(e, t) {
  const [n, o] = w([]), [r, i] = w(!1), c = N(void 0), s = N(void 0);
  return x(() => {
    const d = e;
    c.current = e, i(!0), t(e).then((a) => {
      c.current === d && (o(a), i(!1), s.current = d);
    });
  }, [e, t]), {
    items: n || [],
    // The query that was used to retrieve the last set of items may not be the
    // same as the current query as the items from the current query may not
    // have been retrieved yet. This is useful when using the returns of this
    // hook in other hooks.
    usedQuery: s.current,
    loadingState: s.current === void 0 ? "loading-initial" : r ? "loading" : "loaded"
  };
}
function fr(e, t, n, o, r) {
  const [i, c] = w(0), s = o !== void 0 && o > 1;
  return x(() => {
    var a;
    const d = (u) => (u.key === "ArrowLeft" && (u.preventDefault(), n.length && c((i - 1 + n.length) % n.length)), u.key === "ArrowRight" && (u.preventDefault(), n.length && c((i + 1 + n.length) % n.length)), u.key === "ArrowUp" ? (u.preventDefault(), n.length && c(
      (i - o + n.length) % n.length
    ), !0) : u.key === "ArrowDown" ? (u.preventDefault(), n.length && c((i + o) % n.length), !0) : u.key === "Enter" && !u.isComposing ? (u.stopPropagation(), u.preventDefault(), n.length && (r == null || r(n[i])), !0) : !1);
    return (a = e.domElement) == null || a.addEventListener(
      "keydown",
      d,
      !0
    ), () => {
      var u;
      (u = e.domElement) == null || u.removeEventListener(
        "keydown",
        d,
        !0
      );
    };
  }, [e.domElement, n, i, r, o, s]), x(() => {
    c(0);
  }, [t]), {
    selectedIndex: n.length === 0 ? void 0 : i
  };
}
function br(e) {
  const n = F().setContentEditableProps, o = C(), {
    getItems: r,
    gridSuggestionMenuComponent: i,
    query: c,
    clearQuery: s,
    closeMenu: d,
    onItemClick: a,
    columns: u
  } = e, h = b(
    (V) => {
      d(), s(), a == null || a(V);
    },
    [a, d, s]
  ), { items: m, usedQuery: g, loadingState: f } = Lt(
    c,
    r
  );
  Tt(m, g, d);
  const { selectedIndex: H } = fr(
    o,
    c,
    m,
    u,
    h
  );
  return x(() => (n((V) => ({
    ...V,
    "aria-expanded": !0,
    "aria-controls": "bn-suggestion-menu"
  })), () => {
    n((V) => ({
      ...V,
      "aria-expanded": !1,
      "aria-controls": void 0
    }));
  }), [n]), x(() => (n((V) => ({
    ...V,
    "aria-activedescendant": H ? "bn-suggestion-menu-item-" + H : void 0
  })), () => {
    n((V) => ({
      ...V,
      "aria-activedescendant": void 0
    }));
  }), [n, H]), /* @__PURE__ */ l(
    i,
    {
      items: m,
      onItemClick: h,
      loadingState: f,
      selectedIndex: H,
      columns: u
    }
  );
}
function Cr(e) {
  const t = C(), {
    triggerCharacter: n,
    gridSuggestionMenuComponent: o,
    columns: r,
    minQueryLength: i,
    onItemClick: c,
    getItems: s,
    floatingOptions: d
  } = e, a = M(() => c || ((S) => {
    S.onItemClick(t);
  }), [t, c]), u = M(() => s || (async (S) => await hr(
    t,
    S
  )), [t, s]), h = {
    closeMenu: t.suggestionMenus.closeMenu,
    clearQuery: t.suggestionMenus.clearQuery
  }, m = b(
    (S) => t.suggestionMenus.onUpdate(n, S),
    [t.suggestionMenus, n]
  ), g = D(m), { isMounted: f, ref: H, style: B, getFloatingProps: V } = z(
    (g == null ? void 0 : g.show) || !1,
    (g == null ? void 0 : g.referencePos) || null,
    2e3,
    {
      placement: "bottom-start",
      middleware: [
        U(10),
        // Flips the menu placement to maximize the space available, and prevents
        // the menu from being cut off by the confines of the screen.
        q(),
        Se({
          apply({ availableHeight: S, elements: _ }) {
            Object.assign(_.floating.style, {
              maxHeight: `${S - 10}px`
            });
          }
        })
      ],
      onOpenChange(S) {
        S || t.suggestionMenus.closeMenu();
      },
      ...d
    }
  );
  return !f || !g || !(g != null && g.ignoreQueryLength) && i && (g.query.startsWith(" ") || g.query.length < i) ? null : /* @__PURE__ */ l("div", { ref: H, style: B, ...V(), children: /* @__PURE__ */ l(
    br,
    {
      query: g.query,
      closeMenu: h.closeMenu,
      clearQuery: h.clearQuery,
      getItems: u,
      columns: r,
      gridSuggestionMenuComponent: o || gr,
      onItemClick: a
    }
  ) });
}
function pr(e) {
  const t = p(), n = y(), { items: o, loadingState: r, selectedIndex: i, onItemClick: c } = e, s = r === "loading-initial" || r === "loading" ? /* @__PURE__ */ l(
    t.SuggestionMenu.Loader,
    {
      className: "bn-suggestion-menu-loader"
    }
  ) : null, d = M(() => {
    let a;
    const u = [];
    for (let h = 0; h < o.length; h++) {
      const m = o[h];
      m.group !== a && (a = m.group, u.push(
        /* @__PURE__ */ l(
          t.SuggestionMenu.Label,
          {
            className: "bn-suggestion-menu-label",
            children: a
          },
          a
        )
      )), u.push(
        /* @__PURE__ */ l(
          t.SuggestionMenu.Item,
          {
            className: L(
              "bn-suggestion-menu-item",
              m.size === "small" ? "bn-suggestion-menu-item-small" : ""
            ),
            item: m,
            id: `bn-suggestion-menu-item-${h}`,
            isSelected: h === i,
            onClick: () => c == null ? void 0 : c(m)
          },
          m.title
        )
      );
    }
    return u;
  }, [t, o, c, i]);
  return /* @__PURE__ */ v(
    t.SuggestionMenu.Root,
    {
      id: "bn-suggestion-menu",
      className: "bn-suggestion-menu",
      children: [
        d,
        d.length === 0 && (e.loadingState === "loading" || e.loadingState === "loaded") && /* @__PURE__ */ l(
          t.SuggestionMenu.EmptyItem,
          {
            className: "bn-suggestion-menu-item",
            children: n.suggestion_menu.no_items_title
          }
        ),
        s
      ]
    }
  );
}
function kr(e, t) {
  const [n, o] = w(0);
  return {
    selectedIndex: n,
    setSelectedIndex: o,
    handler: (r) => {
      if (r.key === "ArrowUp")
        return r.preventDefault(), e.length && o((n - 1 + e.length) % e.length), !0;
      if (r.key === "ArrowDown")
        return r.preventDefault(), e.length && o((n + 1) % e.length), !0;
      const i = wr(r) ? r.nativeEvent.isComposing : r.isComposing;
      return r.key === "Enter" && !i ? (r.preventDefault(), r.stopPropagation(), e.length && (t == null || t(e[n])), !0) : !1;
    }
  };
}
function wr(e) {
  return e.nativeEvent !== void 0;
}
function vr(e, t, n, o, r) {
  const { selectedIndex: i, setSelectedIndex: c, handler: s } = kr(n, o);
  return x(() => {
    var d;
    return (d = r || e.domElement) == null || d.addEventListener("keydown", s, !0), () => {
      var a;
      (a = r || e.domElement) == null || a.removeEventListener(
        "keydown",
        s,
        !0
      );
    };
  }, [e.domElement, n, i, o, r, s]), x(() => {
    c(0);
  }, [t, c]), {
    selectedIndex: n.length === 0 ? void 0 : i
  };
}
function Hr(e) {
  const n = F().setContentEditableProps, o = C(), {
    getItems: r,
    suggestionMenuComponent: i,
    query: c,
    clearQuery: s,
    closeMenu: d,
    onItemClick: a
  } = e, u = b(
    (B) => {
      d(), s(), a == null || a(B);
    },
    [a, d, s]
  ), { items: h, usedQuery: m, loadingState: g } = Lt(
    c,
    r
  );
  Tt(h, m, d);
  const { selectedIndex: f } = vr(
    o,
    c,
    h,
    u
  );
  return x(() => (n((B) => ({
    ...B,
    "aria-expanded": !0,
    "aria-controls": "bn-suggestion-menu"
  })), () => {
    n((B) => ({
      ...B,
      "aria-expanded": !1,
      "aria-controls": void 0
    }));
  }), [n]), x(() => (n((B) => ({
    ...B,
    "aria-activedescendant": f ? "bn-suggestion-menu-item-" + f : void 0
  })), () => {
    n((B) => ({
      ...B,
      "aria-activedescendant": void 0
    }));
  }), [n, f]), /* @__PURE__ */ l(
    i,
    {
      items: h,
      onItemClick: u,
      loadingState: g,
      selectedIndex: f
    }
  );
}
const Mr = {
  heading: ie,
  heading_2: ce,
  heading_3: ae,
  heading_4: mt,
  heading_5: ht,
  heading_6: gt,
  toggle_heading: ie,
  toggle_heading_2: ce,
  toggle_heading_3: ae,
  quote: kt,
  toggle_list: vt,
  numbered_list: Ct,
  bullet_list: pt,
  check_list: bt,
  paragraph: Re,
  table: no,
  image: wt,
  video: ro,
  audio: Ht,
  file: Ee,
  emoji: Co,
  code_block: $n,
  divider: bo
};
function yr(e) {
  return Jt(e).map((t) => {
    const n = Mr[t.key];
    return {
      ...t,
      icon: /* @__PURE__ */ l(n, { size: 18 })
    };
  });
}
function xr(e) {
  const t = C(), {
    triggerCharacter: n,
    suggestionMenuComponent: o,
    minQueryLength: r,
    onItemClick: i,
    getItems: c,
    floatingOptions: s
  } = e, d = M(() => i || ((V) => {
    V.onItemClick(t);
  }), [t, i]), a = M(() => c || (async (V) => Qt(
    yr(t),
    V
  )), [t, c]), u = {
    closeMenu: t.suggestionMenus.closeMenu,
    clearQuery: t.suggestionMenus.clearQuery
  }, h = b(
    (V) => t.suggestionMenus.onUpdate(n, V),
    [t.suggestionMenus, n]
  ), m = D(h), { isMounted: g, ref: f, style: H, getFloatingProps: B } = z(
    (m == null ? void 0 : m.show) || !1,
    (m == null ? void 0 : m.referencePos) || null,
    2e3,
    {
      placement: "bottom-start",
      middleware: [
        U(10),
        // Flips the menu placement to maximize the space available, and prevents
        // the menu from being cut off by the confines of the screen.
        q({
          mainAxis: !0,
          crossAxis: !1
        }),
        de(),
        Se({
          apply({ availableHeight: V, elements: S }) {
            Object.assign(S.floating.style, {
              maxHeight: `${V - 10}px`,
              minHeight: "300px"
            });
          }
        })
      ],
      onOpenChange(V) {
        V || t.suggestionMenus.closeMenu();
      },
      ...s
    }
  );
  return !g || !m || !(m != null && m.ignoreQueryLength) && r && (m.query.startsWith(" ") || m.query.length < r) ? null : /* @__PURE__ */ l(
    "div",
    {
      ref: f,
      style: H,
      ...B(),
      onMouseDown: (V) => V.preventDefault(),
      children: /* @__PURE__ */ l(
        Hr,
        {
          query: m.query,
          closeMenu: u.closeMenu,
          clearQuery: u.clearQuery,
          getItems: a,
          suggestionMenuComponent: o || pr,
          onItemClick: d
        }
      )
    }
  );
}
const Vr = (e, t = 0.3) => {
  const n = Math.floor(e) + t, o = Math.ceil(e) - t;
  return e >= n && e <= o ? Math.round(e) : e < n ? Math.floor(e) : Math.ceil(e);
}, Br = (e) => {
  const t = p(), n = N(!1), [o, r] = w(), i = b(
    (s) => {
      e.onMouseDown(), r({
        originalContent: e.block.content,
        originalCroppedContent: {
          rows: e.editor.tableHandles.cropEmptyRowsOrColumns(
            e.block,
            e.orientation === "addOrRemoveColumns" ? "columns" : "rows"
          )
        },
        startPos: e.orientation === "addOrRemoveColumns" ? s.clientX : s.clientY
      }), n.current = !1, s.preventDefault();
    },
    [e]
  ), c = b(() => {
    n.current || e.editor.updateBlock(e.block, {
      type: "table",
      content: {
        ...e.block.content,
        rows: e.orientation === "addOrRemoveColumns" ? e.editor.tableHandles.addRowsOrColumns(
          e.block,
          "columns",
          1
        ) : e.editor.tableHandles.addRowsOrColumns(
          e.block,
          "rows",
          1
        )
      }
    });
  }, [e.block, e.orientation, e.editor]);
  return x(() => {
    const s = (d) => {
      var f, H;
      if (!o)
        throw new Error("editingState is undefined");
      n.current = !0;
      const a = (e.orientation === "addOrRemoveColumns" ? d.clientX : d.clientY) - o.startPos, u = e.orientation === "addOrRemoveColumns" ? ((f = o.originalCroppedContent.rows[0]) == null ? void 0 : f.cells.length) ?? 0 : o.originalCroppedContent.rows.length, h = e.orientation === "addOrRemoveColumns" ? ((H = o.originalContent.rows[0]) == null ? void 0 : H.cells.length) ?? 0 : o.originalContent.rows.length, m = e.orientation === "addOrRemoveColumns" ? e.block.content.rows[0].cells.length : e.block.content.rows.length, g = h + Vr(
        a / (e.orientation === "addOrRemoveColumns" ? en : tn),
        0.3
      );
      g >= u && g > 0 && g !== m && (e.editor.updateBlock(e.block, {
        type: "table",
        content: {
          ...e.block.content,
          rows: e.orientation === "addOrRemoveColumns" ? e.editor.tableHandles.addRowsOrColumns(
            {
              type: "table",
              content: o.originalCroppedContent
            },
            "columns",
            g - u
          ) : e.editor.tableHandles.addRowsOrColumns(
            {
              type: "table",
              content: o.originalCroppedContent
            },
            "rows",
            g - u
          )
        }
      }), e.block.content && e.editor.setTextCursorPosition(e.block));
    };
    return o && window.addEventListener("mousemove", s), () => {
      window.removeEventListener("mousemove", s);
    };
  }, [o, e.block, e.editor, e.orientation]), x(() => {
    const s = e.onMouseUp, d = () => {
      r(void 0), s();
    };
    return o && window.addEventListener("mouseup", d), () => {
      window.removeEventListener("mouseup", d);
    };
  }, [o, e.onMouseUp]), e.editor.isEditable ? /* @__PURE__ */ l(
    t.TableHandle.ExtendButton,
    {
      className: L(
        "bn-extend-button",
        e.orientation === "addOrRemoveColumns" ? "bn-extend-button-add-remove-columns" : "bn-extend-button-add-remove-rows",
        o !== null ? "bn-extend-button-editing" : ""
      ),
      onClick: c,
      onMouseDown: i,
      children: e.children || /* @__PURE__ */ l(ao, { size: 18, "data-test": "extendButton" })
    }
  ) : null;
}, Ke = (e) => {
  const t = p(), n = y(), r = C().tableHandles;
  return r ? /* @__PURE__ */ l(
    t.Generic.Menu.Item,
    {
      onClick: () => {
        r.addRowOrColumn(
          e.index,
          e.orientation === "row" ? { orientation: "row", side: e.side } : { orientation: "column", side: e.side }
        );
      },
      children: n.table_handle[`add_${e.side}_menuitem`]
    }
  ) : null;
}, Sr = (e) => {
  const t = p(), n = y(), r = C().tableHandles;
  return r ? /* @__PURE__ */ l(
    t.Generic.Menu.Item,
    {
      onClick: () => {
        r.removeRowOrColumn(e.index, e.orientation);
      },
      children: e.orientation === "row" ? n.table_handle.delete_row_menuitem : n.table_handle.delete_column_menuitem
    }
  ) : null;
}, Tr = (e) => {
  const t = p(), n = y(), o = C(), r = o.tableHandles, i = M(() => !r || !e.block ? [] : e.orientation === "row" ? r.getCellsAtRowHandle(e.block, e.index) : r.getCellsAtColumnHandle(e.block, e.index), [e.block, e.index, e.orientation, r]), c = (d, a) => {
    const u = e.block.content.rows.map((h) => ({
      ...h,
      cells: h.cells.map((m) => K(m))
    }));
    i.forEach(({ row: h, col: m }) => {
      a === "text" ? u[h].cells[m].props.textColor = d : u[h].cells[m].props.backgroundColor = d;
    }), o.updateBlock(e.block, {
      type: "table",
      content: {
        ...e.block.content,
        rows: u
      }
    }), o.setTextCursorPosition(e.block);
  };
  if (!i || !i[0] || !r || o.settings.tables.cellTextColor === !1 && o.settings.tables.cellBackgroundColor === !1)
    return null;
  const s = K(i[0].cell);
  return /* @__PURE__ */ v(t.Generic.Menu.Root, { position: "right", sub: !0, children: [
    /* @__PURE__ */ l(t.Generic.Menu.Trigger, { sub: !0, children: /* @__PURE__ */ l(
      t.Generic.Menu.Item,
      {
        className: "bn-menu-item",
        subTrigger: !0,
        children: e.children || n.drag_handle.colors_menuitem
      }
    ) }),
    /* @__PURE__ */ l(
      t.Generic.Menu.Dropdown,
      {
        sub: !0,
        className: "bn-menu-dropdown bn-color-picker-dropdown",
        children: /* @__PURE__ */ l(
          ge,
          {
            iconSize: 18,
            text: o.settings.tables.cellTextColor ? {
              // All cells have the same text color
              color: i.every(
                ({ cell: d }) => Y(d) && d.props.textColor === s.props.textColor
              ) ? s.props.textColor : "default",
              setColor: (d) => {
                c(d, "text");
              }
            } : void 0,
            background: o.settings.tables.cellBackgroundColor ? {
              color: i.every(
                ({ cell: d }) => Y(d) && d.props.backgroundColor === s.props.backgroundColor
              ) ? s.props.backgroundColor : "default",
              setColor: (d) => c(d, "background")
            } : void 0
          }
        )
      }
    )
  ] });
}, Lr = (e) => {
  const t = p(), n = y(), o = C();
  if (!o.tableHandles || e.index !== 0 || e.orientation !== "row" || !o.settings.tables.headers)
    return null;
  const i = !!e.block.content.headerRows;
  return /* @__PURE__ */ l(
    t.Generic.Menu.Item,
    {
      className: "bn-menu-item",
      checked: i,
      onClick: () => {
        const c = o.getBlock(e.block.id);
        c && o.updateBlock(c, {
          ...c,
          content: {
            ...c.content,
            headerRows: i ? void 0 : 1
          }
        });
      },
      children: n.drag_handle.header_row_menuitem
    }
  );
}, _r = (e) => {
  const t = p(), n = y(), o = C();
  if (!o.tableHandles || e.index !== 0 || e.orientation !== "column" || !o.settings.tables.headers)
    return null;
  const i = !!e.block.content.headerCols;
  return /* @__PURE__ */ l(
    t.Generic.Menu.Item,
    {
      className: "bn-menu-item",
      checked: i,
      onClick: () => {
        const c = o.getBlock(e.block.id);
        c && o.updateBlock(c, {
          ...c,
          content: {
            ...c.content,
            headerCols: i ? void 0 : 1
          }
        });
      },
      children: n.drag_handle.header_column_menuitem
    }
  );
}, Er = (e) => {
  const t = p();
  return /* @__PURE__ */ l(t.Generic.Menu.Dropdown, { className: "bn-table-handle-menu", children: e.children || /* @__PURE__ */ v(T, { children: [
    /* @__PURE__ */ l(
      Sr,
      {
        orientation: e.orientation,
        block: e.block,
        index: e.index
      }
    ),
    /* @__PURE__ */ l(
      Ke,
      {
        orientation: e.orientation,
        block: e.block,
        index: e.index,
        side: e.orientation === "row" ? "above" : "left"
      }
    ),
    /* @__PURE__ */ l(
      Ke,
      {
        orientation: e.orientation,
        block: e.block,
        index: e.index,
        side: e.orientation === "row" ? "below" : "right"
      }
    ),
    /* @__PURE__ */ l(
      Lr,
      {
        orientation: e.orientation,
        block: e.block,
        index: e.index
      }
    ),
    /* @__PURE__ */ l(
      _r,
      {
        orientation: e.orientation,
        block: e.block,
        index: e.index
      }
    ),
    /* @__PURE__ */ l(
      Tr,
      {
        orientation: e.orientation,
        block: e.block,
        index: e.index
      }
    )
  ] }) });
}, Rr = (e) => {
  const t = p(), [n, o] = w(!1), r = e.tableHandleMenu || Er, i = M(() => {
    const c = e.editor.tableHandles;
    return !c || !e.block || e.block.type !== "table" ? !1 : e.orientation === "column" ? c.getCellsAtColumnHandle(e.block, e.index).every(({ cell: s }) => et(s) === 1) : c.getCellsAtRowHandle(e.block, e.index).every(({ cell: s }) => tt(s) === 1);
  }, [e.block, e.editor.tableHandles, e.index, e.orientation]);
  return /* @__PURE__ */ v(
    t.Generic.Menu.Root,
    {
      onOpenChange: (c) => {
        c ? (e.freezeHandles(), e.hideOtherSide()) : (e.unfreezeHandles(), e.showOtherSide(), e.editor.focus());
      },
      position: "right",
      children: [
        /* @__PURE__ */ l(t.Generic.Menu.Trigger, { children: /* @__PURE__ */ l(
          t.TableHandle.Root,
          {
            className: L(
              "bn-table-handle",
              n ? "bn-table-handle-dragging" : "",
              i ? "" : "bn-table-handle-not-draggable"
            ),
            draggable: i,
            onDragStart: (c) => {
              o(!0), e.dragStart(c);
            },
            onDragEnd: () => {
              e.dragEnd(), o(!1);
            },
            style: e.orientation === "column" ? { transform: "rotate(0.25turn)" } : void 0,
            children: e.children || /* @__PURE__ */ l(St, { size: 24, "data-test": "tableHandle" })
          }
        ) }),
        me(
          /* @__PURE__ */ l(
            r,
            {
              orientation: e.orientation,
              block: e.block,
              index: e.index
            }
          ),
          e.menuContainer
        )
      ]
    }
  );
};
function Ye(e, t, n) {
  const { refs: o, update: r, context: i, floatingStyles: c } = Ve({
    open: t,
    placement: e === "addOrRemoveColumns" ? "right" : "bottom",
    middleware: [
      Se({
        apply({ rects: a, elements: u }) {
          Object.assign(
            u.floating.style,
            e === "addOrRemoveColumns" ? {
              height: `${a.reference.height}px`
            } : {
              width: `${a.reference.width}px`
            }
          );
        }
      })
    ]
  }), { isMounted: s, styles: d } = Be(i);
  return x(() => {
    r();
  }, [n, r]), x(() => {
    n !== null && o.setReference({
      getBoundingClientRect: () => n
    });
  }, [e, n, o]), M(
    () => ({
      isMounted: s,
      ref: o.setFloating,
      style: {
        display: "flex",
        ...d,
        ...c
      }
    }),
    [c, s, o.setFloating, d]
  );
}
function Ir(e, t, n) {
  const o = Ye(
    "addOrRemoveRows",
    t,
    n
  ), r = Ye(
    "addOrRemoveColumns",
    e,
    n
  );
  return M(
    () => ({
      addOrRemoveRowsButton: o,
      addOrRemoveColumnsButton: r
    }),
    [r, o]
  );
}
function Nr(e, t, n) {
  return n && n.draggedCellOrientation === "row" ? new DOMRect(
    t.x,
    n.mousePos,
    t.width,
    0
  ) : new DOMRect(
    t.x,
    e.y,
    t.width,
    e.height
  );
}
function Pr(e, t, n) {
  return n && n.draggedCellOrientation === "col" ? new DOMRect(
    n.mousePos,
    t.y,
    0,
    t.height
  ) : new DOMRect(
    e.x,
    t.y,
    e.width,
    t.height
  );
}
function Zr(e) {
  return new DOMRect(
    e.x,
    e.y,
    e.width,
    0
  );
}
function ke(e, t, n, o, r) {
  const { refs: i, update: c, context: s, floatingStyles: d } = Ve({
    open: t,
    placement: e === "row" ? "left" : e === "col" ? "top" : "bottom-end",
    middleware: [
      U(
        e === "row" ? -10 : e === "col" ? -12 : { mainAxis: 1, crossAxis: -1 }
      )
    ]
  }), { isMounted: a, styles: u } = Be(s);
  return x(() => {
    c();
  }, [n, o, c]), x(() => {
    n === null || o === null || // Ignore cell handle when dragging
    r && e === "cell" || i.setReference({
      getBoundingClientRect: () => (e === "row" ? Nr : e === "col" ? Pr : Zr)(n, o, r)
    });
  }, [r, e, n, o, i]), M(
    () => ({
      isMounted: a,
      ref: i.setFloating,
      style: {
        display: "flex",
        ...u,
        ...d
      }
    }),
    [d, a, i.setFloating, u]
  );
}
function Ar(e, t, n, o) {
  const r = ke(
    "row",
    e,
    t,
    n,
    o
  ), i = ke(
    "col",
    e,
    t,
    n,
    o
  ), c = ke(
    "cell",
    e,
    t,
    n,
    o
  );
  return M(
    () => ({
      rowHandle: r,
      colHandle: i,
      cellHandle: c
    }),
    [i, r, c]
  );
}
const Dr = (e) => {
  var c, s;
  const t = p(), n = y(), o = C(), r = (d, a) => {
    const u = e.block.content.rows.map((h) => ({
      ...h,
      cells: h.cells.map((m) => K(m))
    }));
    a === "text" ? u[e.rowIndex].cells[e.colIndex].props.textColor = d : u[e.rowIndex].cells[e.colIndex].props.backgroundColor = d, o.updateBlock(e.block, {
      type: "table",
      content: {
        ...e.block.content,
        rows: u
      }
    }), o.setTextCursorPosition(e.block);
  }, i = (s = (c = e.block.content.rows[e.rowIndex]) == null ? void 0 : c.cells) == null ? void 0 : s[e.colIndex];
  return !i || o.settings.tables.cellTextColor === !1 && o.settings.tables.cellBackgroundColor === !1 ? null : /* @__PURE__ */ v(t.Generic.Menu.Root, { position: "right", sub: !0, children: [
    /* @__PURE__ */ l(t.Generic.Menu.Trigger, { sub: !0, children: /* @__PURE__ */ l(
      t.Generic.Menu.Item,
      {
        className: "bn-menu-item",
        subTrigger: !0,
        children: e.children || n.drag_handle.colors_menuitem
      }
    ) }),
    /* @__PURE__ */ l(
      t.Generic.Menu.Dropdown,
      {
        sub: !0,
        className: "bn-menu-dropdown bn-color-picker-dropdown",
        children: /* @__PURE__ */ l(
          ge,
          {
            iconSize: 18,
            text: o.settings.tables.cellTextColor ? {
              color: Y(i) ? i.props.textColor : "default",
              setColor: (d) => r(d, "text")
            } : void 0,
            background: o.settings.tables.cellBackgroundColor ? {
              color: Y(i) ? i.props.backgroundColor : "default",
              setColor: (d) => r(d, "background")
            } : void 0
          }
        )
      }
    )
  ] });
}, Fr = (e) => {
  var i, c;
  const t = p(), n = y(), o = C(), r = (c = (i = e.block.content.rows[e.rowIndex]) == null ? void 0 : i.cells) == null ? void 0 : c[e.colIndex];
  return !r || !Y(r) || tt(r) === 1 && et(r) === 1 || !o.settings.tables.splitCells ? null : /* @__PURE__ */ l(
    t.Generic.Menu.Item,
    {
      onClick: () => {
        var s;
        (s = o.tableHandles) == null || s.splitCell({
          row: e.rowIndex,
          col: e.colIndex
        });
      },
      children: n.table_handle.split_cell_menuitem
    }
  );
}, Or = (e) => {
  const t = p();
  return /* @__PURE__ */ l(
    t.Generic.Menu.Dropdown,
    {
      className: "bn-menu-dropdown bn-table-handle-menu",
      children: e.children || /* @__PURE__ */ v(T, { children: [
        /* @__PURE__ */ l(
          Fr,
          {
            block: e.block,
            rowIndex: e.rowIndex,
            colIndex: e.colIndex
          }
        ),
        /* @__PURE__ */ l(
          Dr,
          {
            block: e.block,
            rowIndex: e.rowIndex,
            colIndex: e.colIndex
          }
        )
      ] })
    }
  );
}, Gr = (e) => {
  const t = p(), n = e.tableCellMenu || Or;
  return !e.editor.settings.tables.splitCells && !e.editor.settings.tables.cellBackgroundColor && !e.editor.settings.tables.cellTextColor ? null : /* @__PURE__ */ v(
    t.Generic.Menu.Root,
    {
      onOpenChange: (o) => {
        o ? e.freezeHandles() : (e.unfreezeHandles(), e.editor.focus());
      },
      position: "right",
      children: [
        /* @__PURE__ */ l(t.Generic.Menu.Trigger, { children: /* @__PURE__ */ l(t.Generic.Menu.Button, { className: "bn-table-cell-handle", children: e.children || /* @__PURE__ */ l(rr, { size: 12, "data-test": "tableCellHandle" }) }) }),
        me(
          /* @__PURE__ */ l(
            n,
            {
              block: e.block,
              rowIndex: e.rowIndex,
              colIndex: e.colIndex
            }
          ),
          e.menuContainer
        )
      ]
    }
  );
}, Ur = (e) => {
  var $, E;
  const t = C(), [n, o] = w(null);
  if (!t.tableHandles)
    throw new Error(
      "TableHandlesController can only be used when BlockNote editor schema contains table block"
    );
  const r = {
    rowDragStart: t.tableHandles.rowDragStart,
    colDragStart: t.tableHandles.colDragStart,
    dragEnd: t.tableHandles.dragEnd,
    freezeHandles: t.tableHandles.freezeHandles,
    unfreezeHandles: t.tableHandles.unfreezeHandles
  }, { freezeHandles: i, unfreezeHandles: c } = r, s = b(() => {
    i(), _(!0), V(!0);
  }, [i]), d = b(() => {
    c(), _(!1), V(!1);
  }, [c]), a = D(
    t.tableHandles.onUpdate.bind(t.tableHandles)
  ), u = M(() => {
    var Z, Q;
    return a != null && a.draggingState ? {
      draggedCellOrientation: (Z = a == null ? void 0 : a.draggingState) == null ? void 0 : Z.draggedCellOrientation,
      mousePos: (Q = a == null ? void 0 : a.draggingState) == null ? void 0 : Q.mousePos
    } : void 0;
  }, [
    a == null ? void 0 : a.draggingState,
    ($ = a == null ? void 0 : a.draggingState) == null ? void 0 : $.draggedCellOrientation,
    (E = a == null ? void 0 : a.draggingState) == null ? void 0 : E.mousePos
  ]), { rowHandle: h, colHandle: m, cellHandle: g } = Ar(
    (a == null ? void 0 : a.show) || !1,
    (a == null ? void 0 : a.referencePosCell) || null,
    (a == null ? void 0 : a.referencePosTable) || null,
    u
  ), { addOrRemoveColumnsButton: f, addOrRemoveRowsButton: H } = Ir(
    (a == null ? void 0 : a.showAddOrRemoveColumnsButton) || !1,
    (a == null ? void 0 : a.showAddOrRemoveRowsButton) || !1,
    (a == null ? void 0 : a.referencePosTable) || null
  ), [B, V] = w(!1), [S, _] = w(!1);
  if (!a)
    return null;
  const P = e.tableHandle || Rr, W = e.extendButton || Br, O = e.tableCellHandle || Gr;
  return /* @__PURE__ */ v(T, { children: [
    /* @__PURE__ */ l("div", { ref: o }),
    /* @__PURE__ */ v(Ut, { root: a.widgetContainer, children: [
      !B && n && h.isMounted && a.rowIndex !== void 0 && /* @__PURE__ */ l("div", { ref: h.ref, style: h.style, children: /* @__PURE__ */ l(
        P,
        {
          editor: t,
          orientation: "row",
          showOtherSide: () => _(!1),
          hideOtherSide: () => _(!0),
          index: a.rowIndex,
          block: a.block,
          dragStart: r.rowDragStart,
          dragEnd: r.dragEnd,
          freezeHandles: r.freezeHandles,
          unfreezeHandles: r.unfreezeHandles,
          menuContainer: n
        }
      ) }),
      !S && n && m.isMounted && a.colIndex !== void 0 && /* @__PURE__ */ l("div", { ref: m.ref, style: m.style, children: /* @__PURE__ */ l(
        P,
        {
          editor: t,
          orientation: "column",
          showOtherSide: () => V(!1),
          hideOtherSide: () => V(!0),
          index: a.colIndex,
          block: a.block,
          dragStart: r.colDragStart,
          dragEnd: r.dragEnd,
          freezeHandles: r.freezeHandles,
          unfreezeHandles: r.unfreezeHandles,
          menuContainer: n
        }
      ) }),
      n && g.isMounted && a.colIndex !== void 0 && a.rowIndex !== void 0 && /* @__PURE__ */ l("div", { ref: g.ref, style: g.style, children: /* @__PURE__ */ l(
        O,
        {
          editor: t,
          block: a.block,
          rowIndex: a.rowIndex,
          colIndex: a.colIndex,
          menuContainer: n,
          freezeHandles: r.freezeHandles,
          unfreezeHandles: r.unfreezeHandles
        }
      ) }),
      /* @__PURE__ */ l(
        "div",
        {
          ref: H.ref,
          style: H.style,
          children: /* @__PURE__ */ l(
            W,
            {
              editor: t,
              orientation: "addOrRemoveRows",
              block: a.block,
              onMouseDown: s,
              onMouseUp: d
            }
          )
        }
      ),
      /* @__PURE__ */ l(
        "div",
        {
          ref: f.ref,
          style: f.style,
          children: /* @__PURE__ */ l(
            W,
            {
              editor: t,
              orientation: "addOrRemoveColumns",
              block: a.block,
              onMouseDown: s,
              onMouseUp: d
            }
          )
        }
      )
    ] })
  ] });
};
function zr(e) {
  const t = C();
  if (!t)
    throw new Error(
      "BlockNoteDefaultUI must be used within a BlockNoteContext.Provider"
    );
  return /* @__PURE__ */ v(T, { children: [
    e.formattingToolbar !== !1 && /* @__PURE__ */ l(Ko, {}),
    e.linkToolbar !== !1 && /* @__PURE__ */ l(tr, {}),
    e.slashMenu !== !1 && /* @__PURE__ */ l(xr, { triggerCharacter: "/" }),
    e.emojiPicker !== !1 && /* @__PURE__ */ l(
      Cr,
      {
        triggerCharacter: ":",
        columns: 10,
        minQueryLength: 2
      }
    ),
    e.sideMenu !== !1 && /* @__PURE__ */ l(mr, {}),
    t.filePanel && e.filePanel !== !1 && /* @__PURE__ */ l(Bo, {}),
    t.tableHandles && e.tableHandles !== !1 && /* @__PURE__ */ l(Ur, {}),
    t.comments && e.comments !== !1 && /* @__PURE__ */ v(T, { children: [
      /* @__PURE__ */ l(En, {}),
      /* @__PURE__ */ l(yo, {})
    ] })
  ] });
}
const jr = () => {
  const e = M(
    () => {
      var c;
      return (c = window.matchMedia) == null ? void 0 : c.call(window, "(prefers-color-scheme: dark)");
    },
    []
  ), t = M(
    () => {
      var c;
      return (c = window.matchMedia) == null ? void 0 : c.call(window, "(prefers-color-scheme: light)");
    },
    []
  ), n = e == null ? void 0 : e.matches, o = t == null ? void 0 : t.matches, [r, i] = w(n ? "dark" : o ? "light" : "no-preference");
  return x(() => {
    i(n ? "dark" : o ? "light" : "no-preference");
  }, [n, o]), x(() => {
    if (typeof (e == null ? void 0 : e.addEventListener) == "function") {
      const c = ({ matches: d }) => d && i("dark"), s = ({ matches: d }) => d && i("light");
      return e == null || e.addEventListener("change", c), t == null || t.addEventListener("change", s), () => {
        e == null || e.removeEventListener("change", c), t == null || t.removeEventListener("change", s);
      };
    } else {
      const c = () => i(
        e.matches ? "dark" : t.matches ? "light" : "no-preference"
      );
      return e == null || e.addEventListener("change", c), t == null || t.addEventListener("change", c), () => {
        e == null || e.removeEventListener("change", c), t == null || t.removeEventListener("change", c);
      };
    }
  }, [e, t]), typeof window.matchMedia != "function", r;
}, _t = ye(void 0);
function Wr() {
  return se(_t);
}
function qr() {
  const e = /* @__PURE__ */ new Set();
  let t = {};
  return {
    /**
     * Subscribe to the editor instance's changes.
     */
    subscribe(n) {
      return e.add(n), () => {
        e.delete(n);
      };
    },
    getSnapshot() {
      return t;
    },
    getServerSnapshot() {
      return t;
    },
    /**
     * Adds a new NodeView Renderer to the editor.
     */
    setRenderer(n, o) {
      t = {
        ...t,
        [n]: me(o.reactElement, o.element, n)
      }, e.forEach((r) => r());
    },
    /**
     * Removes a NodeView Renderer from the editor.
     */
    removeRenderer(n) {
      const o = { ...t };
      delete o[n], t = o, e.forEach((r) => r());
    }
  };
}
const $r = ({
  contentComponent: e
}) => {
  const t = xe(
    e.subscribe,
    e.getSnapshot,
    e.getServerSnapshot
  );
  return /* @__PURE__ */ l(T, { children: Object.values(t) });
}, Xr = At((e, t) => {
  const [n, o] = w();
  return Dt(t, () => (r, i) => {
    rt(() => {
      o({ node: r, container: i });
    }), o(void 0);
  }, []), /* @__PURE__ */ l(T, { children: n && me(n.node, n.container) });
}), Je = () => {
};
function Kr(e, t) {
  const {
    editor: n,
    className: o,
    theme: r,
    children: i,
    editable: c,
    onSelectionChange: s,
    onChange: d,
    formattingToolbar: a,
    linkToolbar: u,
    slashMenu: h,
    emojiPicker: m,
    sideMenu: g,
    filePanel: f,
    tableHandles: H,
    comments: B,
    autoFocus: V,
    renderEditor: S = !0,
    ..._
  } = e, [P, W] = w(), O = F(), $ = jr(), E = (O == null ? void 0 : O.colorSchemePreference) || $, Z = r || (E === "dark" ? "dark" : "light");
  J(d || Je, n), he(s || Je, n), x(() => {
    n.isEditable = c !== !1;
  }, [c, n]);
  const Q = b(
    (Pt) => {
      n.elementRenderer = Pt;
    },
    [n]
  ), It = M(() => ({
    ...O,
    editor: n,
    setContentEditableProps: W,
    colorSchemePreference: Z
  }), [O, n, Z]), Nt = M(() => ({
    editorProps: {
      autoFocus: V,
      contentEditableProps: P
    },
    defaultUIProps: {
      formattingToolbar: a,
      linkToolbar: u,
      slashMenu: h,
      emojiPicker: m,
      sideMenu: g,
      filePanel: f,
      tableHandles: H,
      comments: B
    }
  }), [
    V,
    P,
    a,
    u,
    h,
    m,
    g,
    f,
    H,
    B
  ]);
  return /* @__PURE__ */ l(at.Provider, { value: It, children: /* @__PURE__ */ v(_t.Provider, { value: Nt, children: [
    /* @__PURE__ */ l(Xr, { ref: Q }),
    /* @__PURE__ */ l(
      Yr,
      {
        className: o,
        renderEditor: S,
        editable: c,
        editorColorScheme: Z,
        ref: t,
        ..._,
        children: i
      }
    )
  ] }) });
}
const Yr = A.forwardRef(
  ({ className: e, renderEditor: t, editable: n, editorColorScheme: o, children: r, ...i }, c) => /* @__PURE__ */ l(
    "div",
    {
      className: L("bn-container", o, e),
      "data-color-scheme": o,
      ...i,
      ref: c,
      children: t ? /* @__PURE__ */ l(Jr, { editable: n, children: r }) : r
    }
  )
), Ll = A.forwardRef(Kr), Jr = (e) => {
  const t = Wr(), n = C(), o = M(() => qr(), []), r = b(
    (i) => {
      e.editable !== void 0 && e.editable !== n.isEditable && (n.isEditable = e.editable), n._tiptapEditor.contentComponent = o, i ? n.mount(i) : n.unmount();
    },
    [n, o, e.editable]
  );
  return /* @__PURE__ */ v(T, { children: [
    /* @__PURE__ */ l($r, { contentComponent: o }),
    /* @__PURE__ */ l(Qr, { ...t.editorProps, ...e, mount: r }),
    /* @__PURE__ */ l(zr, { ...t.defaultUIProps }),
    e.children
  ] });
}, Qr = (e) => {
  const { autoFocus: t, mount: n, contentEditableProps: o } = e;
  return /* @__PURE__ */ l(
    "div",
    {
      "aria-autocomplete": "list",
      "aria-haspopup": "listbox",
      "data-bn-autofocus": t,
      ref: n,
      ...o
    }
  );
};
function G(e, t) {
  let n;
  const o = document.createElement("div");
  let r;
  if (t != null && t.elementRenderer)
    t.elementRenderer(
      e((d) => n = d || void 0),
      o
    );
  else {
    if (!(t != null && t.headless))
      throw new Error(
        "elementRenderer not available, expected headless editor"
      );
    r = xn(o), rt(() => {
      r.render(e((d) => n = d || void 0));
    });
  }
  if (!o.childElementCount)
    return console.warn("ReactInlineContentSpec: renderHTML() failed"), {
      dom: document.createElement("span")
    };
  n == null || n.setAttribute("data-tmp-find", "true");
  const i = o.cloneNode(!0), c = i.firstElementChild, s = i.querySelector(
    "[data-tmp-find]"
  );
  return s == null || s.removeAttribute("data-tmp-find"), r == null || r.unmount(), {
    dom: c,
    contentDOM: s || void 0
  };
}
function we(e) {
  var t;
  return (
    // Creates `blockContent` element
    /* @__PURE__ */ l(
      ct,
      {
        onDragOver: (n) => n.preventDefault(),
        ...Object.fromEntries(
          Object.entries(e.domAttributes || {}).filter(
            ([n]) => n !== "class"
          )
        ),
        className: L(
          "bn-block-content",
          ((t = e.domAttributes) == null ? void 0 : t.class) || ""
        ),
        "data-content-type": e.blockType,
        ...Object.fromEntries(
          Object.entries(e.blockProps).filter(([n, o]) => {
            const r = e.propSchema[n];
            return o !== r.default;
          }).map(([n, o]) => [nt(n), o])
        ),
        "data-file-block": e.isFileBlock === !0 || void 0,
        children: e.children
      }
    )
  );
}
function fe(e, t, n) {
  return (o = {}) => {
    const r = typeof e == "function" ? e(o) : e, i = typeof t == "function" ? t(o) : t, c = n ? typeof n == "function" ? n(o) : n : void 0;
    return {
      config: r,
      implementation: {
        ...i,
        toExternalHTML(s, d) {
          const a = i.toExternalHTML || i.render;
          return G((h) => /* @__PURE__ */ l(
            we,
            {
              blockType: s.type,
              blockProps: s.props,
              propSchema: r.propSchema,
              domAttributes: this.blockContentDOMAttributes,
              children: /* @__PURE__ */ l(
                a,
                {
                  block: s,
                  editor: d,
                  contentRef: (m) => {
                    h(m), m && (m.className = L(
                      "bn-inline-content",
                      m.className
                    ));
                  }
                }
              )
            }
          ), d);
        },
        render(s, d) {
          if (this.renderType === "nodeView")
            return lt(
              (a) => {
                var g;
                const u = nn(
                  a.getPos,
                  d,
                  a.editor,
                  r.type
                ), h = it().nodeViewContentRef;
                if (!h)
                  throw new Error("nodeViewContentRef is not set");
                const m = i.render;
                return /* @__PURE__ */ l(
                  we,
                  {
                    blockType: u.type,
                    blockProps: u.props,
                    propSchema: r.propSchema,
                    isFileBlock: !!((g = i.meta) != null && g.fileBlockAccept),
                    domAttributes: this.blockContentDOMAttributes,
                    children: /* @__PURE__ */ l(
                      m,
                      {
                        block: u,
                        editor: d,
                        contentRef: (f) => {
                          h(f), f && (f.className = L(
                            "bn-inline-content",
                            f.className
                          ), f.dataset.nodeViewContent = "");
                        }
                      }
                    )
                  }
                );
              },
              {
                className: "bn-react-node-view-renderer"
              }
            )(this.props);
          {
            const a = i.render;
            return G((h) => /* @__PURE__ */ l(
              we,
              {
                blockType: s.type,
                blockProps: s.props,
                propSchema: r.propSchema,
                domAttributes: this.blockContentDOMAttributes,
                children: /* @__PURE__ */ l(
                  a,
                  {
                    block: s,
                    editor: d,
                    contentRef: (m) => {
                      h(m), m && (m.className = L(
                        "bn-inline-content",
                        m.className
                      ));
                    }
                  }
                )
              }
            ), d);
          }
        }
      },
      extensions: c
    };
  };
}
function Ne(e) {
  const t = C(), [n, o] = w("loading"), [r, i] = w();
  if (x(() => {
    let c = !0;
    return (async () => {
      let s = "";
      o("loading");
      try {
        s = t.resolveFileUrl ? await t.resolveFileUrl(e) : e;
      } catch {
        o("error");
        return;
      }
      c && (o("loaded"), i(s));
    })(), () => {
      c = !1;
    };
  }, [t, e]), n !== "loaded")
    return {
      loadingState: n
    };
  if (!r)
    throw new Error("Finished fetching file but did not get download URL.");
  return {
    loadingState: n,
    downloadUrl: r
  };
}
const Pe = (e) => /* @__PURE__ */ v("figure", { children: [
  e.children,
  /* @__PURE__ */ l("figcaption", { children: e.caption })
] });
function el(e) {
  const t = C();
  x(() => t.onUploadEnd(e), [e, t]);
}
function tl(e) {
  const t = C();
  x(() => t.onUploadStart(e), [e, t]);
}
function Et(e) {
  const [t, n] = w(!1);
  return tl((o) => {
    o === e && n(!0);
  }), el((o) => {
    o === e && n(!1);
  }), t;
}
const nl = (e) => {
  const t = y(), n = b(
    (r) => {
      r.preventDefault();
    },
    []
  ), o = b(() => {
    e.editor.transact(
      (r) => r.setMeta(e.editor.filePanel.plugins[0], {
        block: e.block
      })
    );
  }, [e.block, e.editor]);
  return /* @__PURE__ */ v(
    "div",
    {
      className: "bn-add-file-button",
      onMouseDown: n,
      onClick: o,
      children: [
        /* @__PURE__ */ l("div", { className: "bn-add-file-button-icon", children: e.buttonIcon || /* @__PURE__ */ l(Ee, { size: 24 }) }),
        /* @__PURE__ */ l("div", { className: "bn-add-file-button-text", children: e.block.type in t.file_blocks.add_button_text ? t.file_blocks.add_button_text[e.block.type] : t.file_blocks.add_button_text.file })
      ]
    }
  );
}, ol = (e) => /* @__PURE__ */ v(
  "div",
  {
    className: "bn-file-name-with-icon",
    contentEditable: !1,
    draggable: !1,
    children: [
      /* @__PURE__ */ l("div", { className: "bn-file-icon", children: /* @__PURE__ */ l(Ee, { size: 24 }) }),
      /* @__PURE__ */ l("p", { className: "bn-file-name", children: e.block.props.name })
    ]
  }
), Ze = (e) => {
  const t = Et(e.block.id);
  return /* @__PURE__ */ l(
    "div",
    {
      className: "bn-file-block-content-wrapper",
      onMouseEnter: e.onMouseEnter,
      onMouseLeave: e.onMouseLeave,
      style: e.style,
      children: t ? (
        // Show loader while a file is being uploaded.
        /* @__PURE__ */ l("div", { className: "bn-file-loading-preview", children: "Loading..." })
      ) : e.block.props.url === "" ? (
        // Show the add file button if the file has not been uploaded yet.
        /* @__PURE__ */ l(nl, { ...e })
      ) : (
        // Show the file preview, or the file name and icon.
        /* @__PURE__ */ v(T, { children: [
          e.block.props.showPreview === !1 || !e.children ? (
            // Show file name and icon.
            /* @__PURE__ */ l(ol, { ...e })
          ) : (
            // Show preview.
            e.children
          ),
          e.block.props.caption && // Show the caption if there is one.
          /* @__PURE__ */ l("p", { className: "bn-file-caption", children: e.block.props.caption })
        ] })
      )
    }
  );
}, be = (e) => /* @__PURE__ */ v("div", { children: [
  e.children,
  /* @__PURE__ */ l("p", { children: e.caption })
] }), rl = (e) => {
  const t = Ne(e.block.props.url);
  return /* @__PURE__ */ l(
    "audio",
    {
      className: "bn-audio",
      src: t.loadingState === "loading" ? e.block.props.url : t.downloadUrl,
      controls: !0,
      contentEditable: !1,
      draggable: !1
    }
  );
}, ll = (e) => {
  if (!e.block.props.url)
    return /* @__PURE__ */ l("p", { children: "Add audio" });
  const t = e.block.props.showPreview ? /* @__PURE__ */ l("audio", { src: e.block.props.url }) : /* @__PURE__ */ l("a", { href: e.block.props.url, children: e.block.props.name || e.block.props.url });
  return e.block.props.caption ? e.block.props.showPreview ? /* @__PURE__ */ l(Pe, { caption: e.block.props.caption, children: t }) : /* @__PURE__ */ l(be, { caption: e.block.props.caption, children: t }) : t;
}, il = (e) => /* @__PURE__ */ l(
  Ze,
  {
    ...e,
    buttonIcon: /* @__PURE__ */ l(Ht, { size: 24 }),
    children: /* @__PURE__ */ l(rl, { ...e })
  }
), _l = fe(
  rn,
  (e) => ({
    render: il,
    parse: on(e),
    toExternalHTML: ll,
    runsBefore: ["file"]
  })
), El = fe(cn, {
  render: (e) => /* @__PURE__ */ l(Ze, { ...e }),
  parse: ln(),
  toExternalHTML: (e) => {
    if (!e.block.props.url)
      return /* @__PURE__ */ l("p", { children: "Add file" });
    const t = /* @__PURE__ */ l("a", { href: e.block.props.url, children: e.block.props.name || e.block.props.url });
    return e.block.props.caption ? /* @__PURE__ */ l(be, { caption: e.block.props.caption, children: t }) : t;
  }
}), Rt = (e) => {
  const [t, n] = w(void 0), [o, r] = w(
    e.block.props.previewWidth
  ), [i, c] = w(!1), s = N(null);
  x(() => {
    const g = (H) => {
      var _, P;
      let B;
      const V = "touches" in H ? H.touches[0].clientX : H.clientX;
      e.block.props.textAlignment === "center" ? t.handleUsed === "left" ? B = t.initialWidth + (t.initialClientX - V) * 2 : B = t.initialWidth + (V - t.initialClientX) * 2 : t.handleUsed === "left" ? B = t.initialWidth + t.initialClientX - V : B = t.initialWidth + V - t.initialClientX, r(
        Math.min(
          Math.max(B, 64),
          ((P = (_ = e.editor.domElement) == null ? void 0 : _.firstElementChild) == null ? void 0 : P.clientWidth) || Number.MAX_VALUE
        )
      );
    }, f = () => {
      n(void 0), e.editor.updateBlock(e.block, {
        props: {
          previewWidth: o
        }
      });
    };
    return t && (window.addEventListener("mousemove", g), window.addEventListener("touchmove", g), window.addEventListener("mouseup", f), window.addEventListener("touchend", f)), () => {
      window.removeEventListener("mousemove", g), window.removeEventListener("touchmove", g), window.removeEventListener("mouseup", f), window.removeEventListener("touchend", f);
    };
  }, [e, t, o]);
  const d = b(() => {
    e.editor.isEditable && c(!0);
  }, [e.editor.isEditable]), a = b(() => {
    c(!1);
  }, []), u = b(
    (g) => {
      g.preventDefault();
      const f = "touches" in g ? g.touches[0].clientX : g.clientX;
      n({
        handleUsed: "left",
        initialWidth: s.current.clientWidth,
        initialClientX: f
      });
    },
    []
  ), h = b(
    (g) => {
      g.preventDefault();
      const f = "touches" in g ? g.touches[0].clientX : g.clientX;
      n({
        handleUsed: "right",
        initialWidth: s.current.clientWidth,
        initialClientX: f
      });
    },
    []
  ), m = Et(e.block.id);
  return /* @__PURE__ */ l(
    Ze,
    {
      ...e,
      onMouseEnter: d,
      onMouseLeave: a,
      style: e.block.props.url && !m && e.block.props.showPreview ? {
        width: o ? `${o}px` : "fit-content"
      } : void 0,
      children: /* @__PURE__ */ v(
        "div",
        {
          className: "bn-visual-media-wrapper",
          style: { position: "relative" },
          ref: s,
          children: [
            e.children,
            (i || t) && /* @__PURE__ */ v(T, { children: [
              /* @__PURE__ */ l(
                "div",
                {
                  className: "bn-resize-handle",
                  style: { left: "4px" },
                  onMouseDown: u,
                  onTouchStart: u
                }
              ),
              /* @__PURE__ */ l(
                "div",
                {
                  className: "bn-resize-handle",
                  style: { right: "4px" },
                  onMouseDown: h,
                  onTouchStart: h
                }
              )
            ] }),
            t && /* @__PURE__ */ l(
              "div",
              {
                style: {
                  position: "absolute",
                  height: "100%",
                  width: "100%"
                }
              }
            )
          ]
        }
      )
    }
  );
}, cl = (e) => {
  const t = Ne(e.block.props.url);
  return /* @__PURE__ */ l(
    "img",
    {
      className: "bn-visual-media",
      src: t.loadingState === "loading" ? e.block.props.url : t.downloadUrl,
      alt: e.block.props.caption || "BlockNote image",
      contentEditable: !1,
      draggable: !1
    }
  );
}, al = (e) => {
  if (!e.block.props.url)
    return /* @__PURE__ */ l("p", { children: "Add image" });
  const t = e.block.props.showPreview ? /* @__PURE__ */ l(
    "img",
    {
      src: e.block.props.url,
      alt: e.block.props.name || e.block.props.caption || "BlockNote image",
      width: e.block.props.previewWidth
    }
  ) : /* @__PURE__ */ l("a", { href: e.block.props.url, children: e.block.props.name || e.block.props.url });
  return e.block.props.caption ? e.block.props.showPreview ? /* @__PURE__ */ l(Pe, { caption: e.block.props.caption, children: t }) : /* @__PURE__ */ l(be, { caption: e.block.props.caption, children: t }) : t;
}, sl = (e) => /* @__PURE__ */ l(
  Rt,
  {
    ...e,
    buttonIcon: /* @__PURE__ */ l(wt, { size: 24 }),
    children: /* @__PURE__ */ l(cl, { ...e })
  }
), Rl = fe(
  sn,
  (e) => ({
    render: sl,
    parse: an(e),
    toExternalHTML: al
  })
);
function dl(e) {
  return k({ attr: { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, child: [{ tag: "path", attr: { d: "M14 3v4a1 1 0 0 0 1 1h4" }, child: [] }, { tag: "path", attr: { d: "M19 18v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1" }, child: [] }, { tag: "path", attr: { d: "M3 14h3m4.5 0h3m4.5 0h3" }, child: [] }, { tag: "path", attr: { d: "M5 10v-5a2 2 0 0 1 2 -2h7l5 5v2" }, child: [] }] })(e);
}
const ul = {
  page_break: dl
};
function Il(e) {
  return dn(e).map((t) => {
    const n = ul[t.key];
    return {
      ...t,
      icon: /* @__PURE__ */ l(n, { size: 18 })
    };
  });
}
const ml = (e) => {
  const t = Ne(e.block.props.url);
  return /* @__PURE__ */ l(
    "video",
    {
      className: "bn-visual-media",
      src: t.loadingState === "loading" ? e.block.props.url : t.downloadUrl,
      controls: !0,
      contentEditable: !1,
      draggable: !1
    }
  );
}, hl = (e) => {
  if (!e.block.props.url)
    return /* @__PURE__ */ l("p", { children: "Add video" });
  const t = e.block.props.showPreview ? /* @__PURE__ */ l("video", { src: e.block.props.url }) : /* @__PURE__ */ l("a", { href: e.block.props.url, children: e.block.props.name || e.block.props.url });
  return e.block.props.caption ? e.block.props.showPreview ? /* @__PURE__ */ l(Pe, { caption: e.block.props.caption, children: t }) : /* @__PURE__ */ l(be, { caption: e.block.props.caption, children: t }) : t;
}, gl = (e) => /* @__PURE__ */ l(
  Rt,
  {
    ...e,
    buttonIcon: /* @__PURE__ */ l(co, { size: 24 }),
    children: /* @__PURE__ */ l(ml, { ...e })
  }
), Nl = fe(
  mn,
  (e) => ({
    render: gl,
    parse: un(e),
    toExternalHTML: hl
  })
), fl = (e, t) => {
  if (t.type === "toggled")
    return !e;
  if (t.type === "childAdded")
    return !0;
  if (t.type === "lastChildRemoved")
    return !1;
  throw new ot(t);
}, Pl = (e) => {
  const { block: t, editor: n, children: o, toggledState: r } = e, [i, c] = Ft(
    fl,
    (r || te).get(t)
  ), [s, d] = w(t.children.length), a = (m) => {
    (r || te).set(
      n.getBlock(m),
      !i
    ), c({
      type: "toggled"
    });
  }, u = (m) => {
    (r || te).set(m, !0), c({
      type: "childAdded"
    });
  }, h = (m) => {
    (r || te).set(m, !1), c({
      type: "lastChildRemoved"
    });
  };
  return J(() => {
    if ("isToggleable" in t.props && !t.props.isToggleable)
      return;
    const m = n.getBlock(t), g = m.children.length ?? 0;
    g > s ? i || u(m) : g === 0 && g < s && i && h(m), d(g);
  }), "isToggleable" in t.props && !t.props.isToggleable ? o : /* @__PURE__ */ v("div", { children: [
    /* @__PURE__ */ v("div", { className: "bn-toggle-wrapper", "data-show-children": i, children: [
      /* @__PURE__ */ l(
        "button",
        {
          className: "bn-toggle-button",
          type: "button",
          onMouseDown: (m) => m.preventDefault(),
          onClick: () => a(n.getBlock(t)),
          children: /* @__PURE__ */ l(
            "svg",
            {
              xmlns: "http://www.w3.org/2000/svg",
              height: "1em",
              viewBox: "0 -960 960 960",
              width: "1em",
              fill: "currentcolor",
              children: /* @__PURE__ */ l("path", { d: "M472-480 332-620q-18-18-18-44t18-44q18-18 44-18t44 18l183 183q9 9 14 21t5 24q0 12-5 24t-14 21L420-252q-18 18-44 18t-44-18q-18-18-18-44t18-44l140-140Z" })
            }
          )
        }
      ),
      o
    ] }),
    i && s === 0 && /* @__PURE__ */ l(
      "button",
      {
        className: "bn-toggle-add-block-button",
        type: "button",
        onClick: () => {
          const m = n.updateBlock(t, {
            // Single empty block with default type.
            children: [{}]
          });
          n.setTextCursorPosition(m.children[0].id, "end"), n.focus();
        },
        children: n.dictionary.toggle_blocks.add_block_button
      }
    )
  ] });
}, Zl = (e) => {
  const [t, n] = w("none"), o = N(null), r = C(), i = D(
    r.formattingToolbar.onUpdate.bind(r.formattingToolbar)
  ), c = M(() => ({
    display: "flex",
    position: "fixed",
    bottom: 0,
    zIndex: 3e3,
    transform: t
  }), [t]);
  if (x(() => {
    const d = window.visualViewport;
    function a() {
      const u = document.body, h = d.offsetLeft, m = d.height - u.getBoundingClientRect().height + d.offsetTop;
      n(
        `translate(${h}px, ${m}px) scale(${1 / d.scale})`
      );
    }
    return window.visualViewport.addEventListener("scroll", a), window.visualViewport.addEventListener("resize", a), a(), () => {
      window.visualViewport.removeEventListener("scroll", a), window.visualViewport.removeEventListener("resize", a);
    };
  }, []), !i)
    return null;
  if (!i.show && o.current)
    return /* @__PURE__ */ l(
      "div",
      {
        ref: o,
        style: c,
        dangerouslySetInnerHTML: { __html: o.current.innerHTML }
      }
    );
  const s = e.formattingToolbar || Bt;
  return /* @__PURE__ */ l("div", { ref: o, style: c, children: /* @__PURE__ */ l(s, {}) });
}, bl = A.memo(
  ({
    thread: e,
    selectedThreadId: t,
    editor: n,
    maxCommentsBeforeCollapse: o,
    referenceText: r
  }) => {
    const i = b(
      (s) => {
        var d;
        s.target.closest(".bn-action-toolbar") || (d = n.comments) == null || d.selectThread(e.id);
      },
      [n.comments, e.id]
    ), c = b(
      (s) => {
        var u;
        if (!s.relatedTarget || s.relatedTarget.closest(".bn-action-toolbar"))
          return;
        const d = s.target instanceof Node ? s.target : null, a = s.relatedTarget instanceof Node ? s.relatedTarget.closest(".bn-thread") : null;
        (!d || !a || !a.contains(d)) && ((u = n.comments) == null || u.selectThread(void 0));
      },
      [n.comments]
    );
    return /* @__PURE__ */ l(
      Mt,
      {
        thread: e,
        selected: e.id === t,
        referenceText: r,
        maxCommentsBeforeCollapse: o,
        onFocus: i,
        onBlur: c,
        tabIndex: 0
      }
    );
  }
);
function Cl(e, t, n) {
  if (t === "recent-activity")
    return e.sort(
      (o, r) => r.comments[r.comments.length - 1].createdAt.getTime() - o.comments[o.comments.length - 1].createdAt.getTime()
    );
  if (t === "oldest")
    return e.sort(
      (o, r) => o.createdAt.getTime() - r.createdAt.getTime()
    );
  if (t === "position")
    return e.sort((o, r) => {
      var s, d;
      const i = ((s = n == null ? void 0 : n.get(o.id)) == null ? void 0 : s.from) || Number.MAX_VALUE, c = ((d = n == null ? void 0 : n.get(r.id)) == null ? void 0 : d.from) || Number.MAX_VALUE;
      return i - c;
    });
  throw new ot(t);
}
function Qe(e, t) {
  return e.transact((n) => {
    if (!t)
      return "Original content deleted";
    if (n.doc.nodeSize < t.to)
      return "";
    const o = n.doc.textBetween(
      t.from,
      t.to
    );
    return o.length > 15 ? `${o.slice(0, 15)}…` : o;
  });
}
function Al(e) {
  const t = C();
  if (!t.comments)
    throw new Error("Comments plugin not found");
  const n = D(
    t.comments.onUpdate.bind(t.comments)
  ), o = n == null ? void 0 : n.selectedThreadId, r = yt(t), i = M(() => {
    const c = Array.from(r.values()), s = Cl(
      c,
      e.sort || "position",
      n == null ? void 0 : n.threadPositions
    ), d = [];
    for (const a of s)
      a.resolved ? (e.filter === "resolved" || e.filter === "all") && d.push({
        thread: a,
        referenceText: Qe(
          t,
          n == null ? void 0 : n.threadPositions.get(a.id)
        )
      }) : (e.filter === "open" || e.filter === "all") && d.push({
        thread: a,
        referenceText: Qe(
          t,
          n == null ? void 0 : n.threadPositions.get(a.id)
        )
      });
    return d;
  }, [r, n == null ? void 0 : n.threadPositions, e.filter, e.sort, t]);
  return /* @__PURE__ */ l("div", { className: "bn-threads-sidebar", children: i.map((c) => /* @__PURE__ */ l(
    bl,
    {
      thread: c.thread,
      selectedThreadId: o,
      editor: t,
      referenceText: c.referenceText,
      maxCommentsBeforeCollapse: e.maxCommentsBeforeCollapse
    },
    c.thread.id
  )) });
}
function Dl(e) {
  const t = F();
  if (e || (e = t == null ? void 0 : t.editor), !e)
    throw new Error(
      "'editor' is required, either from BlockNoteContext or as a function argument"
    );
  const n = e, [o, r] = w(() => n.getActiveStyles()), i = b(() => {
    r(n.getActiveStyles());
  }, [n]);
  return J(i, n), he(i, n), o;
}
function pl() {
  const [, e] = w(0);
  return () => e((t) => t + 1);
}
const Fl = (e) => {
  const t = pl();
  x(() => {
    const n = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          t();
        });
      });
    };
    return e.on("transaction", n), () => {
      e.off("transaction", n);
    };
  }, [e]);
};
function kl(e) {
  return e.currentTarget instanceof HTMLElement && e.relatedTarget instanceof HTMLElement ? e.currentTarget.contains(e.relatedTarget) : !1;
}
function Ol({
  onBlur: e,
  onFocus: t
} = {}) {
  const n = N(null), [o, r] = w(!1), i = N(!1), c = (a) => {
    r(a), i.current = a;
  }, s = (a) => {
    i.current || (c(!0), t == null || t(a));
  }, d = (a) => {
    i.current && !kl(a) && (c(!1), e == null || e(a));
  };
  return x(() => {
    const a = n.current;
    if (a)
      return a.addEventListener("focusin", s), a.addEventListener("focusout", d), () => {
        a == null || a.removeEventListener("focusin", s), a == null || a.removeEventListener("focusout", d);
      };
  }, [s, d]), { ref: n, focused: o };
}
function ve(e) {
  return (
    // Creates inline content section element
    /* @__PURE__ */ l(
      ct,
      {
        as: "span",
        className: "bn-inline-content-section",
        "data-inline-content-type": e.inlineContentType,
        ...Object.fromEntries(
          Object.entries(e.inlineContentProps).filter(([t, n]) => {
            const o = e.propSchema[t];
            return n !== o.default;
          }).map(([t, n]) => [nt(t), n])
        ),
        children: e.children
      }
    )
  );
}
function Gl(e, t) {
  var o;
  const n = Vn.create({
    name: e.type,
    inline: !0,
    group: "inline",
    selectable: e.content === "styled",
    atom: e.content === "none",
    draggable: (o = t.meta) == null ? void 0 : o.draggable,
    content: e.content === "styled" ? "inline*" : "",
    addAttributes() {
      return Cn(e.propSchema);
    },
    addKeyboardShortcuts() {
      return bn(e);
    },
    parseHTML() {
      return fn(
        e,
        t.parse
      );
    },
    renderHTML({ node: r }) {
      const i = this.options.editor, c = De(
        r,
        i.schema.inlineContentSchema,
        i.schema.styleSchema
      ), s = t.toExternalHTML || t.render, d = G(
        (a) => /* @__PURE__ */ l(
          s,
          {
            contentRef: (u) => {
              a(u), u && (u.dataset.editable = "");
            },
            inlineContent: c,
            updateInlineContent: () => {
            },
            editor: i
          }
        ),
        i
      );
      return gn(
        d,
        e.type,
        r.attrs,
        e.propSchema
      );
    },
    addNodeView() {
      const r = this.options.editor;
      return (i) => lt(
        (c) => {
          const s = it().nodeViewContentRef;
          if (!s)
            throw new Error("nodeViewContentRef is not set");
          const d = t.render;
          return /* @__PURE__ */ l(
            ve,
            {
              inlineContentProps: c.node.attrs,
              inlineContentType: e.type,
              propSchema: e.propSchema,
              children: /* @__PURE__ */ l(
                d,
                {
                  contentRef: (a) => {
                    s(a), a && (a.dataset.editable = "");
                  },
                  editor: r,
                  inlineContent: De(
                    c.node,
                    r.schema.inlineContentSchema,
                    r.schema.styleSchema
                  ),
                  updateInlineContent: (a) => {
                    const u = hn(
                      [a],
                      r.pmSchema
                    ), h = c.getPos();
                    h !== void 0 && r.transact(
                      (m) => m.replaceWith(h, h + c.node.nodeSize, u)
                    );
                  }
                }
              )
            }
          );
        },
        {
          className: "bn-ic-react-node-view-renderer",
          as: "span"
          // contentDOMElementTag: "span", (requires tt upgrade)
        }
      )(i);
    }
  });
  return pn(
    e,
    {
      node: n,
      render(r, i, c) {
        const s = t.render;
        return G((a) => /* @__PURE__ */ l(
          ve,
          {
            inlineContentProps: r.props,
            inlineContentType: e.type,
            propSchema: e.propSchema,
            children: /* @__PURE__ */ l(
              s,
              {
                contentRef: (u) => {
                  a(u), u && (u.dataset.editable = "");
                },
                editor: c,
                inlineContent: r,
                updateInlineContent: i
              }
            )
          }
        ), c);
      },
      toExternalHTML(r, i) {
        const c = t.toExternalHTML || t.render;
        return G((d) => /* @__PURE__ */ l(
          ve,
          {
            inlineContentProps: r.props,
            inlineContentType: e.type,
            propSchema: e.propSchema,
            children: /* @__PURE__ */ l(
              c,
              {
                contentRef: (a) => {
                  d(a), a && (a.dataset.editable = "");
                },
                editor: i,
                inlineContent: r,
                updateInlineContent: () => {
                }
              }
            )
          }
        ), i);
      }
    }
  );
}
function Ul(e, t) {
  const n = Hn.create({
    name: e.type,
    addAttributes() {
      return wn(e.propSchema);
    },
    parseHTML() {
      return kn(e);
    },
    renderHTML({ mark: o }) {
      const r = t.render, i = G(
        (c) => /* @__PURE__ */ l(
          r,
          {
            editor: this.options.editor,
            value: e.propSchema === "boolean" ? void 0 : o.attrs.stringValue,
            contentRef: (s) => {
              c(s), s && (s.dataset.editable = "");
            }
          }
        ),
        this.options.editor
      );
      return Ce(
        i,
        e.type,
        o.attrs.stringValue,
        e.propSchema
      );
    },
    addMarkView() {
      const o = this.options.editor;
      return (r) => {
        const i = Mn((c) => {
          const s = se(yn).markViewContentRef;
          if (!s)
            throw new Error("markViewContentRef is not set");
          const d = t.render;
          return /* @__PURE__ */ l(
            d,
            {
              editor: o,
              contentRef: (a) => {
                s(a), a && (a.dataset.markViewContent = "");
              },
              value: e.propSchema === "boolean" ? void 0 : c.mark.attrs.stringValue
            }
          );
        })(r);
        return i.didMountContentDomElement = !0, i;
      };
    }
  });
  return vn(e, {
    mark: n,
    render(o, r) {
      const i = t.render, c = G(
        (s) => /* @__PURE__ */ l(
          i,
          {
            editor: r,
            value: o,
            contentRef: (d) => {
              s(d), d && (d.dataset.editable = "");
            }
          }
        ),
        r
      );
      return Ce(
        c,
        e.type,
        o,
        e.propSchema
      );
    },
    toExternalHTML(o, r) {
      const i = t.render, c = G(
        (s) => /* @__PURE__ */ l(
          i,
          {
            editor: r,
            value: o,
            contentRef: (d) => {
              s(d), d && (d.dataset.editable = "");
            }
          }
        ),
        r
      );
      return Ce(
        c,
        e.type,
        o,
        e.propSchema
      );
    }
  });
}
function zl(e, t) {
  const n = e.getBoundingClientRect(), o = t.getBoundingClientRect(), r = n.top < o.top, i = n.bottom > o.bottom;
  return r && i ? "both" : r ? "top" : i ? "bottom" : "none";
}
export {
  or as AddBlockButton,
  Ke as AddButton,
  Uo as AddCommentButton,
  nl as AddFileButton,
  zo as AddTiptapCommentButton,
  il as AudioBlock,
  rl as AudioPreview,
  ll as AudioToExternalHTML,
  oe as BasicTextStyleButton,
  lr as BlockColorsItem,
  we as BlockContentWrapper,
  at as BlockNoteContext,
  zr as BlockNoteDefaultUI,
  Jr as BlockNoteViewEditor,
  Ll as BlockNoteViewRaw,
  Go as BlockTypeSelect,
  Dr as ColorPickerButton,
  Eo as ColorStyleButton,
  Ho as Comment,
  Mo as Comments,
  Tn as ComponentsContext,
  Io as CreateLinkButton,
  Sr as DeleteButton,
  Yo as DeleteLinkButton,
  dr as DragHandleButton,
  sr as DragHandleMenu,
  Jo as EditLinkButton,
  Vt as EditLinkMenuItems,
  xo as EmbedTab,
  Zl as ExperimentalMobileFormattingToolbarController,
  Br as ExtendButton,
  Pe as FigureWithCaption,
  Ze as FileBlockWrapper,
  No as FileCaptionButton,
  Po as FileDeleteButton,
  jo as FileDownloadButton,
  ol as FileNameWithIcon,
  xt as FilePanel,
  Bo as FilePanelController,
  Wo as FilePreviewButton,
  Zo as FileRenameButton,
  Ao as FileReplaceButton,
  _n as FloatingComposer,
  En as FloatingComposerController,
  yo as FloatingThreadController,
  Bt as FormattingToolbar,
  Ko as FormattingToolbarController,
  Cr as GridSuggestionMenuController,
  br as GridSuggestionMenuWrapper,
  sl as ImageBlock,
  cl as ImagePreview,
  al as ImageToExternalHTML,
  ve as InlineContentWrapper,
  er as LinkToolbar,
  tr as LinkToolbarController,
  be as LinkWithCaption,
  Do as NestBlockButton,
  Qo as OpenLinkButton,
  _l as ReactAudioBlock,
  El as ReactFileBlock,
  Rl as ReactImageBlock,
  Nl as ReactVideoBlock,
  ir as RemoveBlockItem,
  Rt as ResizableFileBlockWrapper,
  ur as SideMenu,
  mr as SideMenuController,
  Fr as SplitButton,
  xr as SuggestionMenuController,
  Hr as SuggestionMenuWrapper,
  Gr as TableCellButton,
  Or as TableCellMenu,
  qo as TableCellMergeButton,
  ar as TableColumnHeaderItem,
  Rr as TableHandle,
  Er as TableHandleMenu,
  Ur as TableHandlesController,
  cr as TableRowHeaderItem,
  pe as TextAlignButton,
  Mt as Thread,
  Al as ThreadsSidebar,
  Pl as ToggleWrapper,
  Fo as UnnestBlockButton,
  Vo as UploadTab,
  gl as VideoBlock,
  ml as VideoPreview,
  hl as VideoToExternalHTML,
  Oo as blockTypeSelectItems,
  fe as createReactBlockSpec,
  Gl as createReactInlineContentSpec,
  Ul as createReactStyleSpec,
  zl as elementOverflow,
  hr as getDefaultReactEmojiPickerItems,
  yr as getDefaultReactSlashMenuItems,
  Xo as getFormattingToolbarItems,
  Il as getPageBreakReactSlashMenuItems,
  Qe as getReferenceText,
  To as mergeRefs,
  Dl as useActiveStyles,
  F as useBlockNoteContext,
  C as useBlockNoteEditor,
  Tt as useCloseSuggestionMenuNoItems,
  p as useComponentsContext,
  Te as useCreateBlockNote,
  y as useDictionary,
  J as useEditorChange,
  j as useEditorContentOrSelectionChange,
  Fl as useEditorForceUpdate,
  Bn as useEditorSelectionBoundingBox,
  he as useEditorSelectionChange,
  Ir as useExtendButtonsPositioning,
  Ol as useFocusWithin,
  fr as useGridSuggestionMenuKeyboardNavigation,
  Lt as useLoadSuggestionMenuItems,
  el as useOnUploadEnd,
  tl as useOnUploadStart,
  jr as usePrefersColorScheme,
  Ne as useResolveUrl,
  R as useSelectedBlocks,
  kr as useSuggestionMenuKeyboardHandler,
  vr as useSuggestionMenuKeyboardNavigation,
  Ar as useTableHandlesPositioning,
  yt as useThreads,
  z as useUIElementPositioning,
  D as useUIPluginState,
  Et as useUploadLoading,
  wo as useUser,
  Ie as useUsers
};
//# sourceMappingURL=blocknote-react.js.map
