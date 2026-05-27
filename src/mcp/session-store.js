/**
 * session-store.js — MCP 连接级 spec 绑定
 *
 * 每个 MCP 连接可以 attach 到一个 spec_dir，后续调用不需要每次传 spec_dir。
 * 连接断开后绑定自动清除。
 */

export class SessionStore {
  constructor() {
    /** @type {Map<string, { specDir: string, projectRoot: string, attachedAt: string }>} */
    this._sessions = new Map();
  }

  attach(sessionId, specDir, projectRoot) {
    this._sessions.set(sessionId, {
      specDir,
      projectRoot,
      attachedAt: new Date().toISOString()
    });
  }

  detach(sessionId) {
    this._sessions.delete(sessionId);
  }

  get(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  /**
   * 解析 spec_dir：参数 > 绑定 > 报错
   */
  resolveSpecDir(sessionId, explicitSpecDir) {
    if (explicitSpecDir) return explicitSpecDir;
    const session = this.get(sessionId);
    if (session?.specDir) return session.specDir;
    return null;
  }

  resolveProjectRoot(sessionId, explicitRoot) {
    if (explicitRoot) return explicitRoot;
    const session = this.get(sessionId);
    if (session?.projectRoot) return session.projectRoot;
    return process.cwd();
  }
}
