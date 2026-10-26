// 收集游戏里会显示的全部字符：src 下 TS 的字符串/模板字面量（不含注释和测试）
// + 配置 JSON 的全部字符串 + 固定的 ASCII/标点集合。
// 字体子集脚本和覆盖率测试共用这一份逻辑，改了文案后测试会提醒重新生成字体。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import ts from 'typescript';

const ASCII = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)).join('');
const EXTRA = '，。！？：；、·…—～“”‘’（）《》【】「」→←↑↓×÷％＋－★☆♪°';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__') walk(p, out);
    } else if (['.ts', '.json'].includes(extname(p)) && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function tsStrings(file) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out = [];
  const visit = (node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) out.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

function jsonStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) jsonStrings(v, out);
  return out;
}

export function collectCharset(root) {
  const set = new Set([...ASCII, ...EXTRA]);
  for (const file of walk(join(root, 'src'))) {
    const strings = file.endsWith('.json') ? jsonStrings(JSON.parse(readFileSync(file, 'utf8'))) : tsStrings(file);
    for (const s of strings) for (const ch of s) if (ch.codePointAt(0) > 0x7f && !/\s/.test(ch)) set.add(ch);
  }
  return [...set].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}
