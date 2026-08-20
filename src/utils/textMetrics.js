// Measuring narration length by splitting on whitespace silently breaks for
// languages that don't put spaces between words. A full Japanese sentence
// counts as ONE "word", so a 64-character line was being given a 4-second
// scene when it needs about fifteen — the narration got cut off almost
// immediately. These helpers measure in units that map to speaking time in
// any script the app offers.

// Han, Hiragana, Katakana, and Hangul: scripts written without word spaces.
const SPACELESS_SCRIPT = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/g;

// A speaker gets through roughly 5.5 of these characters in the time they'd
// speak 2.3 English words, so one character is worth about 0.42 of a word.
// Everything downstream is calibrated in words, so converting here keeps a
// single timing model instead of forking it per language.
const WORD_EQUIVALENT_PER_CHAR = 0.42;

// Sentence terminators, including the ideographic ones — splitting only on
// ".!?" never finds a boundary in Japanese, which ends sentences with "。".
export const SENTENCE_BOUNDARY = /(?<=[.!?。！？])\s*/;

export function splitSentences(text) {
  return (text || "")
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Length of `text` expressed in English-word equivalents, so a given count
// means the same amount of speaking time whatever the script.
export function countSpokenWords(text) {
  if (!text) return 0;
  const spaceless = (text.match(SPACELESS_SCRIPT) || []).length;
  const remainder = text.replace(SPACELESS_SCRIPT, " ");
  const spaced = remainder.trim().split(/\s+/).filter(Boolean).length;
  return spaced + spaceless * WORD_EQUIVALENT_PER_CHAR;
}

export function hasSpacelessScript(text) {
  SPACELESS_SCRIPT.lastIndex = 0;
  return SPACELESS_SCRIPT.test(text || "");
}

// How many characters of a spaceless script fit the same budget, used to give
// a model a target it can actually act on ("30 words" means little in
// Japanese).
export function charsForWords(words) {
  return Math.round(words / WORD_EQUIVALENT_PER_CHAR);
}

// Tokens to break lines and caption chunks on. Latin text breaks between
// words; spaceless scripts have no word gaps, so every character is its own
// break opportunity — otherwise a Japanese sentence is a single unbreakable
// token that runs straight off the edge of the canvas.
const WRAP_TOKEN = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]|[^\s぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]+/g;

export function tokenizeForWrap(text) {
  return (text || "").match(WRAP_TOKEN) || [];
}

export function isSpacelessToken(token) {
  SPACELESS_SCRIPT.lastIndex = 0;
  return SPACELESS_SCRIPT.test(token);
}

// Joins tokens the way the script expects: a space between Latin words, and
// nothing at all between characters of a spaceless script.
export function joinTokens(tokens) {
  return tokens.reduce((acc, token, i) => {
    if (i === 0) return token;
    const glue = isSpacelessToken(token) || isSpacelessToken(tokens[i - 1]) ? "" : " ";
    return acc + glue + token;
  }, "");
}
