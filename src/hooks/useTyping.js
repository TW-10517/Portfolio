import { useEffect, useState } from "react";

export function useTyping(words, enabled = true) {
  const [text, setText] = useState(words[0] || "");

  useEffect(() => {
    if (!enabled || words.length === 0) {
      setText(words[0] || "");
      return;
    }
    let ri = 0;
    let ci = 0;
    let deleting = false;
    let timeout;

    const tick = () => {
      const word = words[ri];
      if (!deleting) {
        ci++;
        setText(word.slice(0, ci));
        if (ci === word.length) {
          deleting = true;
          timeout = setTimeout(tick, 1400);
          return;
        }
      } else {
        ci--;
        setText(word.slice(0, ci));
        if (ci === 0) {
          deleting = false;
          ri = (ri + 1) % words.length;
        }
      }
      timeout = setTimeout(tick, deleting ? 45 : 90);
    };
    timeout = setTimeout(tick, 300);
    return () => clearTimeout(timeout);
  }, [words.join("|"), enabled]);

  return text;
}
