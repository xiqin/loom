/**
 * context-index.js — 上下文文件的渐进式披露（L0/L1）
 *
 * 背景（Context 工程）：把 constitution / memory 整文件塞进上下文，
 * 会挤爆窗口（仓库地图 + 打开文件常占 99% token，用户输入只 1%）。
 * 解法是"先给目录，按需翻全文"——L0 摘要层告诉模型"有什么"，L1 详情层按节召回。
 *
 * 本模块把一个 markdown 文件按 `##` 二级标题切成节，提供：
 *   - outline()         L0：节标题 + token 估算（不含正文），用于"目录"
 *   - getSection(query) L1：按标题模糊匹配，返回单节全文
 *
 * 纯函数式，无状态、无 IO 副作用（读文件由调用方负责）。
 */

import { NodeFileSystem } from './fs-interface.js';
import { join } from 'node:path';

/** 每节软上限：超过则在 outline 标记 oversized，提示进一步拆分。 */
export const SECTION_TOKEN_BUDGET = 1500;

/**
 * doc 键 → .loom 下相对路径。MCP / CLI 用稳定的短键引用上下文文件，
 * 避免把易变的绝对路径暴露给模型。
 */
// 仅收录"散文式" markdown 文件——按 `##` 切节才有意义。
// workflow.yaml 是结构化配置，由流水线引擎直接加载，不走渐进式披露
// （markdown 解析 yaml 会得到 0 节，召回无意义），故不列入。
export const DOC_PATHS = {
  constitution: ['rules', 'constitution.md'],
  memory: ['memory', 'MEMORY.md'],
};

export const DOC_KEYS = Object.keys(DOC_PATHS);

/** 把 doc 键解析为 .loom 下的绝对路径；未知键返回 null。 */
export function resolveDocPath(loomDir, doc, fs = new NodeFileSystem()) {
  const rel = DOC_PATHS[doc];
  if (!rel) return null;
  return join(loomDir, ...rel);
}

/**
 * 粗略 token 估算。混合中英文 + 代码用 chars/3 的启发式，
 * 只用于预算判断（"这节会不会太大"），不追求精确。
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil([...text].length / 3);
}

/** 标题归一化：小写、压空白、去首尾标点，用于模糊匹配。 */
function normalizeTitle(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/^[#\s]+|[\s:：]+$/g, '').trim();
}

export class ContextIndex {
  /**
   * @param {string} text  markdown 全文
   * @param {string} [doc] doc 键（仅用于回显）
   */
  constructor(text, doc = null) {
    this.doc = doc;
    this.raw = text || '';
    this.title = null;
    this.preamble = '';
    this.sections = this._parse(this.raw);
  }

  _parse(text) {
    const lines = text.split('\n');
    const sections = [];
    let current = null;
    const preambleLines = [];
    // 围栏代码块内的 `#`/`##` 是代码/示例，不是标题——否则目录树、
    // 配置示例里以 `## ` 开头的行会被误判成节边界，撕裂正文。
    let inFence = false;
    let fenceChar = '';

    for (const line of lines) {
      const fence = line.match(/^\s*(```+|~~~+)/);
      if (fence) {
        const ch = fence[1][0];
        if (!inFence) { inFence = true; fenceChar = ch; }
        else if (ch === fenceChar) { inFence = false; fenceChar = ''; }
        if (current) current.bodyLines.push(line);
        else preambleLines.push(line);
        continue;
      }

      const h1 = !inFence && line.match(/^#\s+(.+)$/);
      const h2 = !inFence && line.match(/^##\s+(.+?)\s*$/);

      if (h1 && this.title === null && sections.length === 0 && !current) {
        this.title = h1[1].trim();
        continue;
      }
      if (h2) {
        if (current) sections.push(current);
        current = { title: h2[1].trim(), bodyLines: [] };
        continue;
      }
      if (current) current.bodyLines.push(line);
      else preambleLines.push(line);
    }
    if (current) sections.push(current);

    this.preamble = preambleLines.join('\n').trim();

    return sections.map((s, i) => {
      const body = s.bodyLines.join('\n').trim();
      const tokens = estimateTokens(`## ${s.title}\n${body}`);
      return {
        index: i,
        title: s.title,
        tokens,
        lines: body ? body.split('\n').length : 0,
        oversized: tokens > SECTION_TOKEN_BUDGET,
        _body: body,
      };
    });
  }

  /** L0：目录视图，只含标题 + 估算，不含正文。 */
  outline() {
    return {
      doc: this.doc,
      title: this.title,
      total_tokens: estimateTokens(this.raw),
      section_count: this.sections.length,
      sections: this.sections.map(s => ({
        title: s.title,
        tokens: s.tokens,
        lines: s.lines,
        oversized: s.oversized,
      })),
      hint: 'Call again with a section title to fetch its full text (L1).',
    };
  }

  /** 回退档：返回整篇原文。披露分节疑似丢信息（如前言区内容）时用。 */
  full() {
    return {
      doc: this.doc,
      title: this.title,
      total_tokens: estimateTokens(this.raw),
      content: this.raw,
    };
  }

  /** L1：按标题模糊匹配返回单节全文。无匹配返回 null。 */
  getSection(query) {
    if (!query) return null;
    const q = normalizeTitle(query);
    let hit =
      this.sections.find(s => normalizeTitle(s.title) === q) ||
      this.sections.find(s => normalizeTitle(s.title).includes(q)) ||
      this.sections.find(s => q.includes(normalizeTitle(s.title)));
    if (!hit) return null;
    return {
      doc: this.doc,
      title: hit.title,
      tokens: hit.tokens,
      oversized: hit.oversized,
      content: hit._body,
    };
  }
}

/**
 * 便捷封装：从 loomDir 读取 doc 文件并返回 ContextIndex；文件缺失返回 null。
 */
export function loadContextIndex(loomDir, doc, fs = new NodeFileSystem()) {
  const path = resolveDocPath(loomDir, doc, fs);
  if (!path || !fs.existsSync(path)) return null;
  return new ContextIndex(fs.readFileSync(path, 'utf-8'), doc);
}
