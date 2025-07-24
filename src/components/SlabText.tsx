import { useEffect, useRef, useState } from 'react';

interface SlabTextProps {
  text: string;
  maxWordsPerLine?: number;
  shortWordLength?: number;
  paddingFactor?: number;
}

export default function SlabText({
  text,
  maxWordsPerLine = 3,
  shortWordLength = 6,
  paddingFactor = 0.92,
}: SlabTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const [linesWithSizes, setLinesWithSizes] = useState<{ text: string; fontSize: number }[]>([]);

  const breakIntoLines = (words: string[]): string[] => {
    const lines: string[] = [];
    let i = 0;

    while (i < words.length) {
      let lineWords: string[] = [];
      let wordCount = 0;

      while (i < words.length && wordCount < maxWordsPerLine) {
        const word = words[i];
        lineWords.push(word);
        wordCount++;

        const shortWords = lineWords.filter(w => w.length < shortWordLength).length;
        const longWords = lineWords.filter(w => w.length >= shortWordLength).length;

        if (lineWords.length >= 4 && shortWords === 4) break;
        if (lineWords.length === 2 && longWords === 2) break;

        i++;
      }

      lines.push(lineWords.join(' '));
    }

    return lines;
  };

  const measureFontSize = (line: string, baseSize: number, containerWidth: number): number => {
    const span = measureRef.current;
    if (!span) return baseSize;

    span.textContent = line;
    span.style.fontSize = `${baseSize}px`;
    span.style.display = 'inline-block';

    const measuredWidth = span.offsetWidth;
    const scale = containerWidth / measuredWidth;
    const newFontSize = Math.floor(baseSize * Math.min(scale, 1));

    console.log(`📐 Measuring line: "${line}"`);
    console.log(`🔤 Span content: "${span.textContent}"`);
    console.log(`📏 Measured width: ${measuredWidth}px`);
    console.log(`🧱 Line: "${line}" | MeasuredWidth: ${measuredWidth}px | Container: ${containerWidth}px | FontSize: ${newFontSize}px`);

    return newFontSize;
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const fullWidth = container.offsetWidth;
      const adjustedWidth = fullWidth * paddingFactor;
      const words = text.split(/\s+/);

      console.log(`📦 Container width: ${fullWidth} → adjusted: ${adjustedWidth}`);
      console.log(`📚 Words: (${words.length})`, words);

      const rawLines = breakIntoLines(words);

      const newLinesWithSizes = rawLines.map((line) => ({
        text: line,
        fontSize: measureFontSize(line, 999, adjustedWidth),
      }));

      setLinesWithSizes(newLinesWithSizes);
    });
  }, [text, paddingFactor]);

  return (
    <div ref={containerRef} className="slab-text w-full">
      <span
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          padding: 0,
          margin: 0,
          fontFamily: "'Abril Fatface', serif",
          fontWeight: 400,
          letterSpacing: 0,
        }}
      />
      {linesWithSizes.map(({ text: line, fontSize }, index) => (
        <div
          key={index}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${fontSize * 1.1}px`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
