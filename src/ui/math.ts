import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Explicit TeX delimiters plus the legacy variable notation used by the demo pack. */
export function mathSegments(
  text: string,
): Array<{ text: string; math: boolean; block: boolean }> {
  const pattern =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$|\\dot\{m\}|\\eta_(?:\{(?:th|p)\}|th|p)|\b(?:F_N|p_t|p_0|V_0|T_3\^0|D_a|varphi_d)\b(?:\s*\/\s*p_0)?|[ηε]d/g;
  const parts: ReturnType<typeof mathSegments> = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index!;
    if (index > last)
      parts.push({ text: text.slice(last, index), math: false, block: false });
    let formula = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[0];
    formula = formula
      .replace(/\\eta_th/g, '\\eta_{th}')
      .replace(/varphi_d/g, '\\varphi_d')
      .replace(/ηd/g, '\\eta_d')
      .replace(/εd/g, '\\varepsilon_d');
    if (/^p_t\s*\/\s*p_0$/.test(formula)) formula = '\\frac{p_t}{p_0}';
    parts.push({
      text: formula,
      math: true,
      block: Boolean(match[1] ?? match[2]),
    });
    last = index + match[0].length;
  }
  if (last < text.length)
    parts.push({ text: text.slice(last), math: false, block: false });
  return parts;
}

/** No authored text is inserted as HTML. Invalid TeX remains readable as text. */
export function renderMath(container: HTMLElement, text: string): void {
  container.replaceChildren();
  for (const part of mathSegments(text)) {
    if (!part.math) {
      container.append(document.createTextNode(part.text));
      continue;
    }
    const node = document.createElement('span');
    try {
      katex.render(part.text, node, {
        displayMode: part.block,
        throwOnError: true,
        trust: false,
        strict: 'warn',
        output: 'htmlAndMathml',
      });
    } catch {
      node.textContent = part.text;
    }
    container.append(node);
  }
}
