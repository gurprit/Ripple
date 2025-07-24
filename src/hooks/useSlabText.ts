import { useEffect, useRef, useState } from 'react';

export function useSlabText(
  text: string,
  {
    minFontSize = 12,
    maxFontSize = 80,
    lineGap = 0.2,
  }: { minFontSize?: number; maxFontSize?: number; lineGap?: number }
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<string[][]>([]);
  const [fontSizes, setFontSizes] = useState<number[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const words = text.trim().split(/\s+/);
    const containerWidth = container.clientWidth;

    const s = document.createElement('span');
    Object.assign(s.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'nowrap',
      fontFamily: getComputedStyle(container).fontFamily,
      fontWeight: 'normal',
    });
    document.body.appendChild(s);

    const newLines: string[][] = [];
    const newSizes: number[] = [];

    let i = 0;
    while (i < words.length) {
      let j = i;
      while (j < words.length) {
        s.style.fontSize = `${maxFontSize}px`;
        s.textContent = words.slice(i, j + 1).join(' ');
        if (s.offsetWidth > containerWidth) break;
        j++;
      }

      const slice = j === i ? [words[i++]] : words.slice(i, j);
      s.style.fontSize = `${maxFontSize}px`;
      s.textContent = slice.join(' ');
      const widthAtMax = s.offsetWidth;

      const fontSize = Math.max(
        minFontSize,
        Math.min(maxFontSize, (containerWidth / widthAtMax) * maxFontSize)
      );

      newLines.push(slice);
      newSizes.push(fontSize);
      i = j;
    }

    document.body.removeChild(s);
    setLines(newLines);
    setFontSizes(newSizes);
  }, [text, minFontSize, maxFontSize]);

  return { containerRef, lines, fontSizes, lineGap };
}
