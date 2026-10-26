import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
// @ts-expect-error 构建脚本是纯 JS 模块，没有类型声明
import { collectCharset } from '../../../scripts/font-charset.mjs';

const root = join(__dirname, '../../..');

function textCalls(file: string) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const calls: { line: number; hasFamily: boolean }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && /\badd\.text$/.test(node.expression.getText(src))) {
      const style = node.arguments[3];
      const hasFamily = !!style && ts.isObjectLiteralExpression(style) && style.properties.some((p) => p.name?.getText(src) === 'fontFamily');
      calls.push({ line: src.getLineAndCharacterOfPosition(node.getStart()).line + 1, hasFamily });
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return calls;
}

describe('统一字体', () => {
  it('每个 add.text 都显式使用主题字体（否则 Phaser 会退回 Courier）', () => {
    const files = ['src/ui/theme.ts', ...readdirSync(join(root, 'src/scenes')).filter((f) => f.endsWith('.ts')).map((f) => `src/scenes/${f}`)];
    const missing: string[] = [];
    let total = 0;
    for (const f of files) {
      for (const c of textCalls(join(root, f))) {
        total++;
        if (!c.hasFamily) missing.push(`${f}:${c.line}`);
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('字体子集覆盖源码和配置里所有会显示的字符（改文案后请运行 npm run font:subset）', () => {
    const shipped = new Set(readFileSync(join(root, 'assets/fonts/charset.txt'), 'utf8'));
    const needed = [...(collectCharset(root) as string)];
    expect(needed.filter((ch) => !shipped.has(ch))).toEqual([]);
  });
});

describe('setFontFamily', () => {
  it('换成平台返回的字体名，并保留系统字体兜底', async () => {
    const theme = await import('../theme');
    const original = theme.FONT_FAMILY;
    theme.setFontFamily('Resource Han Rounded CN');
    expect(theme.FONT_FAMILY.startsWith("'Resource Han Rounded CN', ")).toBe(true);
    expect(theme.FONT_FAMILY).toContain('sans-serif');
    theme.setFontFamily(theme.FONT_NAME);
    expect(theme.FONT_FAMILY).toBe(original);
  });
});
