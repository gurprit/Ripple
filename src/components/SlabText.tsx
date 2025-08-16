import React, { useEffect, useRef, useState } from 'react';

interface SlabTextProps {
  text: string;
  maxWordsPerLine?: number;
  shortWordLength?: number;
  paddingFactor?: number;
}

const SlabText: React.FC<SlabTextProps> = ({
  text,
  maxWordsPerLine = 3,
  shortWordLength = 6,
  paddingFactor = 0.92
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [fontSizes, setFontSizes] = useState<number[]>([]);

  const isShort = (word: string) => word.length < shortWordLength;

  const chunkWords = (words: string[]): string[] => {
    const result: string[] = [];
    let line: string[] = [];

    for (let i = 0; i < words.length; i++) {
      line.push(words[i]);
      const lineWordCount = line.length;
      const shortCount = line.filter(isShort).length;

      const nextWord = words[i + 1];

      const nextWordWillBreak =
        lineWordCount >= maxWordsPerLine ||
        (lineWordCount >= 4 && shortCount === lineWordCount) ||
        (lineWordCount === 2 && !isShort(line[0]) && !isShort(line[1])) ||
        (!nextWord || line.join(' ').length + nextWord.length > 30);

      if (nextWordWillBreak) {
        result.push(line.join(' '));
        line = [];
      }
    }

    if (line.length) {
      result.push(line.join(' '));
    }

    return result;
  };

  const debounce = (func: () => void, delay = 50) => {
    let timer: NodeJS.Timeout;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(func, delay);
    };
  };

  const layoutText = () => {
    if (!containerRef.current || !measureRef.current) return;
  
    const rawWords = text.trim().split(/\s+/);
    const containerWidth = containerRef.current.offsetWidth * paddingFactor;
  
    const brokenLines = chunkWords(rawWords);
    const calculatedFontSizes: number[] = [];
  
    brokenLines.forEach(line => {
      let min = 10;
      let max = 400;
      let bestFit = min;
  
      while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        measureRef.current!.style.fontSize = `${mid}px`;
        measureRef.current!.textContent = line;
        const width = measureRef.current!.offsetWidth;
  
        if (width <= containerWidth) {
          bestFit = mid;
          min = mid + 1;
        } else {
          max = mid - 1;
        }
      }

      calculatedFontSizes.push(bestFit);
    });
  
    setLines(brokenLines);
    setFontSizes(calculatedFontSizes);
  };
  

  useEffect(() => {
    layoutText();

    const handleResize = debounce(() => {
      layoutText();
    });

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [text]);

  return (
    <div ref={containerRef} className="slab-text-container">
      <span ref={measureRef} style={{ visibility: 'hidden', position: 'absolute', whiteSpace: 'nowrap', pointerEvents: 'none', fontFamily: 'Abril Fatface' }} />
      {lines.map((line, i) => (
        <div key={i} className="slab-line" style={{ fontSize: `${fontSizes[i]}px`, fontFamily: 'Abril Fatface', lineHeight: 1.05 }}>
          {line}
        </div>
      ))}
    </div>
  );
};

export default SlabText;
