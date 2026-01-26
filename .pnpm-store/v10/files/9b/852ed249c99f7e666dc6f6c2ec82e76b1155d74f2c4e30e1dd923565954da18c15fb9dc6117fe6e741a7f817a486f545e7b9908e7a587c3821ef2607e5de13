var A = Object.defineProperty;
var p = (d, r, e) => r in d ? A(d, r, { enumerable: !0, configurable: !0, writable: !0, value: e }) : d[r] = e;
var o = (d, r, e) => p(d, typeof r != "symbol" ? r + "" : r, e);
import * as T from "yjs";
import { v4 as I } from "uuid";
class v {
}
class b extends v {
  constructor(r, e) {
    super(), this.userId = r, this.role = e;
  }
  /**
   * Auth: should be possible by anyone with comment access
   */
  canCreateThread() {
    return !0;
  }
  /**
   * Auth: should be possible by anyone with comment access
   */
  canAddComment(r) {
    return !0;
  }
  /**
   * Auth: should only be possible by the comment author
   */
  canUpdateComment(r) {
    return r.userId === this.userId;
  }
  /**
   * Auth: should be possible by the comment author OR an editor of the document
   */
  canDeleteComment(r) {
    return r.userId === this.userId || this.role === "editor";
  }
  /**
   * Auth: should only be possible by an editor of the document
   */
  canDeleteThread(r) {
    return this.role === "editor";
  }
  /**
   * Auth: should be possible by anyone with comment access
   */
  canResolveThread(r) {
    return !0;
  }
  /**
   * Auth: should be possible by anyone with comment access
   */
  canUnresolveThread(r) {
    return !0;
  }
  /**
   * Auth: should be possible by anyone with comment access
   *
   * Note: will also check if the user has already reacted with the same emoji. TBD: is that a nice design or should this responsibility be outside of auth?
   */
  canAddReaction(r, e) {
    return e ? !r.reactions.some(
      (t) => t.emoji === e && t.userIds.includes(this.userId)
    ) : !0;
  }
  /**
   * Auth: should be possible by anyone with comment access
   *
   * Note: will also check if the user has already reacted with the same emoji. TBD: is that a nice design or should this responsibility be outside of auth?
   */
  canDeleteReaction(r, e) {
    return e ? r.reactions.some(
      (t) => t.emoji === e && t.userIds.includes(this.userId)
    ) : !0;
  }
}
class w {
  constructor(r) {
    o(this, "auth");
    this.auth = r;
  }
}
class j extends w {
  constructor(e, t, a) {
    super(a);
    // TipTapThreadStore does not support addThreadToDocument
    o(this, "addThreadToDocument");
    this.userId = e, this.provider = t;
  }
  /**
   * Creates a new thread with an initial comment.
   */
  async createThread(e) {
    let t = this.provider.createThread({
      data: e.metadata
    });
    return t = this.provider.addComment(t.id, {
      content: e.initialComment.body,
      data: {
        metadata: e.initialComment.metadata,
        userId: this.userId
      }
    }), this.tiptapThreadToThreadData(t);
  }
  /**
   * Adds a comment to a thread.
   */
  async addComment(e) {
    const t = this.provider.addComment(e.threadId, {
      content: e.comment.body,
      data: {
        metadata: e.comment.metadata,
        userId: this.userId
      }
    });
    return this.tiptapCommentToCommentData(
      t.comments[t.comments.length - 1]
    );
  }
  /**
   * Updates a comment in a thread.
   */
  async updateComment(e) {
    const t = this.provider.getThreadComment(
      e.threadId,
      e.commentId,
      !0
    );
    if (!t)
      throw new Error("Comment not found");
    this.provider.updateComment(e.threadId, e.commentId, {
      content: e.comment.body,
      data: {
        ...t.data,
        metadata: e.comment.metadata
      }
    });
  }
  tiptapCommentToCommentData(e) {
    var a, s, n;
    const t = [];
    for (const h of ((a = e.data) == null ? void 0 : a.reactions) || []) {
      const m = t.find(
        (i) => i.emoji === h.emoji
      );
      m ? (m.userIds.push(h.userId), m.createdAt = new Date(
        Math.min(m.createdAt.getTime(), h.createdAt)
      )) : t.push({
        emoji: h.emoji,
        createdAt: new Date(h.createdAt),
        userIds: [h.userId]
      });
    }
    return {
      type: "comment",
      id: e.id,
      body: e.content,
      metadata: (s = e.data) == null ? void 0 : s.metadata,
      userId: (n = e.data) == null ? void 0 : n.userId,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
      reactions: t
    };
  }
  tiptapThreadToThreadData(e) {
    var t;
    return {
      type: "thread",
      id: e.id,
      comments: e.comments.map(
        (a) => this.tiptapCommentToCommentData(a)
      ),
      resolved: !!e.resolvedAt,
      metadata: (t = e.data) == null ? void 0 : t.metadata,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt)
    };
  }
  /**
   * Deletes a comment from a thread.
   */
  async deleteComment(e) {
    this.provider.deleteComment(e.threadId, e.commentId);
  }
  /**
   * Deletes a thread.
   */
  async deleteThread(e) {
    this.provider.deleteThread(e.threadId);
  }
  /**
   * Marks a thread as resolved.
   */
  async resolveThread(e) {
    this.provider.updateThread(e.threadId, {
      resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  /**
   * Marks a thread as unresolved.
   */
  async unresolveThread(e) {
    this.provider.updateThread(e.threadId, {
      resolvedAt: null
    });
  }
  /**
   * Adds a reaction to a comment.
   *
   * Auth: should be possible by anyone with comment access
   */
  async addReaction(e) {
    var a;
    const t = this.provider.getThreadComment(
      e.threadId,
      e.commentId,
      !0
    );
    if (!t)
      throw new Error("Comment not found");
    this.provider.updateComment(e.threadId, e.commentId, {
      data: {
        ...t.data,
        reactions: [
          ...((a = t.data) == null ? void 0 : a.reactions) || [],
          {
            emoji: e.emoji,
            createdAt: Date.now(),
            userId: this.userId
          }
        ]
      }
    });
  }
  /**
   * Deletes a reaction from a comment.
   *
   * Auth: should be possible by the reaction author
   */
  async deleteReaction(e) {
    var a;
    const t = this.provider.getThreadComment(
      e.threadId,
      e.commentId,
      !0
    );
    if (!t)
      throw new Error("Comment not found");
    this.provider.updateComment(e.threadId, e.commentId, {
      data: {
        ...t.data,
        reactions: (((a = t.data) == null ? void 0 : a.reactions) || []).filter(
          (s) => s.emoji !== e.emoji && s.userId !== this.userId
        )
      }
    });
  }
  getThread(e) {
    const t = this.provider.getThread(e);
    if (!t)
      throw new Error("Thread not found");
    return this.tiptapThreadToThreadData(t);
  }
  getThreads() {
    return new Map(
      this.provider.getThreads().map((e) => [e.id, this.tiptapThreadToThreadData(e)])
    );
  }
  subscribe(e) {
    const t = () => {
      e(this.getThreads());
    };
    return this.provider.watchThreads(t), () => {
      this.provider.unwatchThreads(t);
    };
  }
}
function g(d) {
  const r = new T.Map();
  if (r.set("id", d.id), r.set("userId", d.userId), r.set("createdAt", d.createdAt.getTime()), r.set("updatedAt", d.updatedAt.getTime()), d.deletedAt ? (r.set("deletedAt", d.deletedAt.getTime()), r.set("body", void 0)) : r.set("body", d.body), d.reactions.length > 0)
    throw new Error("Reactions should be empty in commentToYMap");
  return r.set("reactionsByUser", new T.Map()), r.set("metadata", d.metadata), r;
}
function y(d) {
  var t;
  const r = new T.Map();
  r.set("id", d.id), r.set("createdAt", d.createdAt.getTime()), r.set("updatedAt", d.updatedAt.getTime());
  const e = new T.Array();
  return e.push(d.comments.map((a) => g(a))), r.set("comments", e), r.set("resolved", d.resolved), r.set("resolvedUpdatedAt", (t = d.resolvedUpdatedAt) == null ? void 0 : t.getTime()), r.set("resolvedBy", d.resolvedBy), r.set("metadata", d.metadata), r;
}
function C(d) {
  return {
    emoji: d.get("emoji"),
    createdAt: new Date(d.get("createdAt")),
    userId: d.get("userId")
  };
}
function D(d) {
  return [...d.values()].map(
    (e) => C(e)
  ).reduce(
    (e, t) => {
      const a = e.find((s) => s.emoji === t.emoji);
      return a ? (a.userIds.push(t.userId), a.createdAt = new Date(
        Math.min(
          a.createdAt.getTime(),
          t.createdAt.getTime()
        )
      )) : e.push({
        emoji: t.emoji,
        createdAt: t.createdAt,
        userIds: [t.userId]
      }), e;
    },
    []
  );
}
function u(d) {
  return {
    type: "comment",
    id: d.get("id"),
    userId: d.get("userId"),
    createdAt: new Date(d.get("createdAt")),
    updatedAt: new Date(d.get("updatedAt")),
    deletedAt: d.get("deletedAt") ? new Date(d.get("deletedAt")) : void 0,
    reactions: D(d.get("reactionsByUser")),
    metadata: d.get("metadata"),
    body: d.get("body")
  };
}
function c(d) {
  return {
    type: "thread",
    id: d.get("id"),
    createdAt: new Date(d.get("createdAt")),
    updatedAt: new Date(d.get("updatedAt")),
    comments: (d.get("comments") || []).map(
      (r) => u(r)
    ),
    resolved: d.get("resolved"),
    resolvedUpdatedAt: new Date(d.get("resolvedUpdatedAt")),
    resolvedBy: d.get("resolvedBy"),
    metadata: d.get("metadata")
  };
}
class f extends w {
  constructor(r, e) {
    super(e), this.threadsYMap = r;
  }
  // TODO: async / reactive interface?
  getThread(r) {
    const e = this.threadsYMap.get(r);
    if (!e)
      throw new Error("Thread not found");
    return c(e);
  }
  getThreads() {
    const r = /* @__PURE__ */ new Map();
    return this.threadsYMap.forEach((e, t) => {
      r.set(t, c(e));
    }), r;
  }
  subscribe(r) {
    const e = () => {
      r(this.getThreads());
    };
    return this.threadsYMap.observeDeep(e), () => {
      this.threadsYMap.unobserveDeep(e);
    };
  }
}
class Y extends f {
  constructor(e, t, a, s) {
    super(a, s);
    o(this, "doRequest", async (e, t, a) => {
      const s = await fetch(`${this.BASE_URL}${e}`, {
        method: t,
        body: JSON.stringify(a),
        headers: {
          "Content-Type": "application/json",
          ...this.headers
        }
      });
      if (!s.ok)
        throw new Error(`Failed to ${t} ${e}: ${s.statusText}`);
      return s.json();
    });
    o(this, "addThreadToDocument", async (e) => {
      const { threadId: t, ...a } = e;
      return this.doRequest(`/${t}/addToDocument`, "POST", a);
    });
    o(this, "createThread", async (e) => this.doRequest("", "POST", e));
    o(this, "addComment", (e) => {
      const { threadId: t, ...a } = e;
      return this.doRequest(`/${t}/comments`, "POST", a);
    });
    o(this, "updateComment", (e) => {
      const { threadId: t, commentId: a, ...s } = e;
      return this.doRequest(`/${t}/comments/${a}`, "PUT", s);
    });
    o(this, "deleteComment", (e) => {
      const { threadId: t, commentId: a, ...s } = e;
      return this.doRequest(
        `/${t}/comments/${a}?soft=${!!s.softDelete}`,
        "DELETE"
      );
    });
    o(this, "deleteThread", (e) => this.doRequest(`/${e.threadId}`, "DELETE"));
    o(this, "resolveThread", (e) => this.doRequest(`/${e.threadId}/resolve`, "POST"));
    o(this, "unresolveThread", (e) => this.doRequest(`/${e.threadId}/unresolve`, "POST"));
    o(this, "addReaction", (e) => {
      const { threadId: t, commentId: a, ...s } = e;
      return this.doRequest(
        `/${t}/comments/${a}/reactions`,
        "POST",
        s
      );
    });
    o(this, "deleteReaction", (e) => this.doRequest(
      `/${e.threadId}/comments/${e.commentId}/reactions/${e.emoji}`,
      "DELETE"
    ));
    this.BASE_URL = e, this.headers = t;
  }
}
class $ extends f {
  constructor(e, t, a) {
    super(t, a);
    o(this, "transact", (e) => async (t) => this.threadsYMap.doc.transact(() => e(t)));
    o(this, "createThread", this.transact(
      (e) => {
        if (!this.auth.canCreateThread())
          throw new Error("Not authorized");
        const t = /* @__PURE__ */ new Date(), a = {
          type: "comment",
          id: I(),
          userId: this.userId,
          createdAt: t,
          updatedAt: t,
          reactions: [],
          metadata: e.initialComment.metadata,
          body: e.initialComment.body
        }, s = {
          type: "thread",
          id: I(),
          createdAt: t,
          updatedAt: t,
          comments: [a],
          resolved: !1,
          metadata: e.metadata
        };
        return this.threadsYMap.set(s.id, y(s)), s;
      }
    ));
    // YjsThreadStore does not support addThreadToDocument
    o(this, "addThreadToDocument");
    o(this, "addComment", this.transact(
      (e) => {
        const t = this.threadsYMap.get(e.threadId);
        if (!t)
          throw new Error("Thread not found");
        if (!this.auth.canAddComment(c(t)))
          throw new Error("Not authorized");
        const a = /* @__PURE__ */ new Date(), s = {
          type: "comment",
          id: I(),
          userId: this.userId,
          createdAt: a,
          updatedAt: a,
          deletedAt: void 0,
          reactions: [],
          metadata: e.comment.metadata,
          body: e.comment.body
        };
        return t.get("comments").push([
          g(s)
        ]), t.set("updatedAt", (/* @__PURE__ */ new Date()).getTime()), s;
      }
    ));
    o(this, "updateComment", this.transact(
      (e) => {
        const t = this.threadsYMap.get(e.threadId);
        if (!t)
          throw new Error("Thread not found");
        const a = l(
          t.get("comments"),
          (n) => n.get("id") === e.commentId
        );
        if (a === -1)
          throw new Error("Comment not found");
        const s = t.get("comments").get(a);
        if (!this.auth.canUpdateComment(u(s)))
          throw new Error("Not authorized");
        s.set("body", e.comment.body), s.set("updatedAt", (/* @__PURE__ */ new Date()).getTime()), s.set("metadata", e.comment.metadata);
      }
    ));
    o(this, "deleteComment", this.transact(
      (e) => {
        const t = this.threadsYMap.get(e.threadId);
        if (!t)
          throw new Error("Thread not found");
        const a = l(
          t.get("comments"),
          (n) => n.get("id") === e.commentId
        );
        if (a === -1)
          throw new Error("Comment not found");
        const s = t.get("comments").get(a);
        if (!this.auth.canDeleteComment(u(s)))
          throw new Error("Not authorized");
        if (s.get("deletedAt"))
          throw new Error("Comment already deleted");
        e.softDelete ? (s.set("deletedAt", (/* @__PURE__ */ new Date()).getTime()), s.set("body", void 0)) : t.get("comments").delete(a), t.get("comments").toArray().every((n) => n.get("deletedAt")) && (e.softDelete ? t.set("deletedAt", (/* @__PURE__ */ new Date()).getTime()) : this.threadsYMap.delete(e.threadId)), t.set("updatedAt", (/* @__PURE__ */ new Date()).getTime());
      }
    ));
    o(this, "deleteThread", this.transact((e) => {
      if (!this.auth.canDeleteThread(
        c(this.threadsYMap.get(e.threadId))
      ))
        throw new Error("Not authorized");
      this.threadsYMap.delete(e.threadId);
    }));
    o(this, "resolveThread", this.transact((e) => {
      const t = this.threadsYMap.get(e.threadId);
      if (!t)
        throw new Error("Thread not found");
      if (!this.auth.canResolveThread(c(t)))
        throw new Error("Not authorized");
      t.set("resolved", !0), t.set("resolvedUpdatedAt", (/* @__PURE__ */ new Date()).getTime()), t.set("resolvedBy", this.userId);
    }));
    o(this, "unresolveThread", this.transact((e) => {
      const t = this.threadsYMap.get(e.threadId);
      if (!t)
        throw new Error("Thread not found");
      if (!this.auth.canUnresolveThread(c(t)))
        throw new Error("Not authorized");
      t.set("resolved", !1), t.set("resolvedUpdatedAt", (/* @__PURE__ */ new Date()).getTime());
    }));
    o(this, "addReaction", this.transact(
      (e) => {
        const t = this.threadsYMap.get(e.threadId);
        if (!t)
          throw new Error("Thread not found");
        const a = l(
          t.get("comments"),
          (i) => i.get("id") === e.commentId
        );
        if (a === -1)
          throw new Error("Comment not found");
        const s = t.get("comments").get(a);
        if (!this.auth.canAddReaction(u(s), e.emoji))
          throw new Error("Not authorized");
        const n = /* @__PURE__ */ new Date(), h = `${this.userId}-${e.emoji}`, m = s.get("reactionsByUser");
        if (!m.has(h)) {
          const i = new T.Map();
          i.set("emoji", e.emoji), i.set("createdAt", n.getTime()), i.set("userId", this.userId), m.set(h, i);
        }
      }
    ));
    o(this, "deleteReaction", this.transact(
      (e) => {
        const t = this.threadsYMap.get(e.threadId);
        if (!t)
          throw new Error("Thread not found");
        const a = l(
          t.get("comments"),
          (m) => m.get("id") === e.commentId
        );
        if (a === -1)
          throw new Error("Comment not found");
        const s = t.get("comments").get(a);
        if (!this.auth.canDeleteReaction(u(s), e.emoji))
          throw new Error("Not authorized");
        const n = `${this.userId}-${e.emoji}`;
        s.get("reactionsByUser").delete(n);
      }
    ));
    this.userId = e;
  }
}
function l(d, r) {
  for (let e = 0; e < d.length; e++)
    if (r(d.get(e)))
      return e;
  return -1;
}
export {
  b as DefaultThreadStoreAuth,
  Y as RESTYjsThreadStore,
  w as ThreadStore,
  v as ThreadStoreAuth,
  j as TiptapThreadStore,
  $ as YjsThreadStore,
  f as YjsThreadStoreBase
};
//# sourceMappingURL=comments.js.map
