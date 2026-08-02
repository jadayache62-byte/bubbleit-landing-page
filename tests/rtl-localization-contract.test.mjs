import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const i18n = fs.readFileSync(new URL("../lib/i18n.tsx", import.meta.url), "utf8");
const root = fileURLToPath(new URL("..", import.meta.url));
const translated = new Set(
  [...i18n.matchAll(/^\s*"((?:[^"\\]|\\.)+)"\s*:/gm)].map((match) =>
    JSON.parse(`"${match[1]}"`),
  ),
);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

test("the initial document language and direction come from a server-readable cookie", () => {
  assert.match(layout, /await cookies\(\)/);
  assert.match(layout, /lang=\{lang\}/);
  assert.match(layout, /dir=\{lang === "ar" \? "rtl" : "ltr"\}/);
  assert.match(layout, /<LanguageProvider initialLang=\{lang\}>/);
});

test("language changes persist for both immediate UI and the next server render", () => {
  assert.match(i18n, /document\.documentElement\.lang = lang/);
  assert.match(i18n, /document\.documentElement\.dir = lang === "ar" \? "rtl" : "ltr"/);
  assert.match(i18n, /document\.cookie = `\$\{LANG_COOKIE\}=\$\{next\}/);
  assert.match(i18n, /window\.localStorage\.setItem\(LANG_STORAGE_KEY, next\)/);
});

test("every literal customer-flow translation key has Arabic copy", () => {
  const sources = [...sourceFiles(path.join(root, "app")), ...sourceFiles(path.join(root, "components"))]
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const keys = new Set(
    [...sources.matchAll(/\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`$\\]*)`)\s*\)/g)]
      .map((match) => match[1] ?? match[2] ?? match[3]),
  );
  assert.deepEqual([...keys].filter((key) => !translated.has(key)).sort(), []);
});

test("dynamic labels, translated branches, and runtime failures cannot bypass Arabic copy", () => {
  const controlledProperties = new Set([
    "ariaLabel",
    "copy",
    "description",
    "label",
    "message",
    "placeholder",
    "title",
  ]);
  const localizedSetters = new Set([
    "setError",
    "setFeedback",
    "setMessage",
    "setNotice",
    "setPaymentNotice",
  ]);
  const failures = [];
  const files = [
    ...sourceFiles(path.join(root, "app")),
    ...sourceFiles(path.join(root, "components")),
  ].filter(
    (candidate) =>
      candidate.endsWith(".tsx") &&
      !candidate.includes(`${path.sep}app${path.sep}api${path.sep}`),
  );

  const literalCopy = (node) =>
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    /[A-Za-z]{2}/.test(node.text);

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const parsed = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const report = (node, message) => {
      const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1;
      failures.push(`${path.relative(root, file)}:${line}: ${message}`);
    };
    const checkTranslationArgument = (node) => {
      if (literalCopy(node) && !translated.has(node.text)) {
        report(node, `missing Arabic copy for ${JSON.stringify(node.text)}`);
      }
      ts.forEachChild(node, checkTranslationArgument);
    };
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t"
      ) {
        node.arguments.forEach(checkTranslationArgument);
      }
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        controlledProperties.has(node.name.text) &&
        literalCopy(node.initializer) &&
        !translated.has(node.initializer.text)
      ) {
        report(
          node.initializer,
          `controlled ${node.name.text} is not a localization key: ${JSON.stringify(node.initializer.text)}`,
        );
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        /(?:LABELS|STEPS)$/.test(node.name.text) &&
        node.initializer
      ) {
        checkTranslationArgument(node.initializer);
      }
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Error" &&
        node.arguments?.some(literalCopy)
      ) {
        report(node, "runtime error contains hard-coded English");
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        localizedSetters.has(node.expression.text) &&
        node.arguments.some(literalCopy)
      ) {
        report(node, `${node.expression.text} contains hard-coded English`);
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }

  assert.deepEqual(failures, []);
});

test("page metadata comes from the server-locale catalog", () => {
  const pages = sourceFiles(path.join(root, "app")).filter(
    (candidate) =>
      candidate.endsWith(`${path.sep}page.tsx`) ||
      candidate.endsWith(`${path.sep}layout.tsx`),
  );
  const failures = pages
    .filter((file) => /export const metadata\s*=/.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));
  const metadataCatalog = fs.readFileSync(
    path.join(root, "lib", "localized-metadata.ts"),
    "utf8",
  );

  assert.deepEqual(failures, []);
  assert.match(
    metadataCatalog,
    /Record<MetadataKey, Record<Lang, LocalizedMetadataCopy>>/,
  );
  assert.match(metadataCatalog, /await cookies\(\)/);
});

test("release UI has no untranslated JSX copy or accessible labels", () => {
  const allowedBrandText = new Set([
    "Instagram @bubbleitqa",
    "TikTok @bubbleitqa",
    "© 2026 Bubbleit.",
    "Bubbleit",
  ]);
  const failures = [];

  for (const file of [...sourceFiles(path.join(root, "app")), ...sourceFiles(path.join(root, "components"))].filter((candidate) => candidate.endsWith(".tsx"))) {
    const source = fs.readFileSync(file, "utf8");
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isJsxText(node)) {
        const copy = node.text.trim();
        if (/[A-Za-z]{2}/.test(copy) && !allowedBrandText.has(copy)) {
          failures.push(`${path.relative(root, file)}: untranslated text ${JSON.stringify(copy)}`);
        }
      }
      if (
        ts.isJsxAttribute(node) &&
        ["aria-label", "placeholder", "title"].includes(node.name.text) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        /[A-Za-z]{2}/.test(node.initializer.text)
      ) {
        failures.push(`${path.relative(root, file)}: untranslated ${node.name.text} ${JSON.stringify(node.initializer.text)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }

  assert.deepEqual(failures, []);
});
