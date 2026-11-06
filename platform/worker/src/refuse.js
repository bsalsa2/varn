// Questions about targeting, engagement, jamming, weapons or tracking people are refused before any model is called.
export const REFUSAL = "Varn is detection and research only. I can't help with that.";
const PATTERNS = [
  /\b(target(?:s|ed|ing)?|engag(?:e|es|ed|ing|ement)|jam(?:s|med|ming)?|spoof(?:s|ed|ing)?|neutrali[sz]e|disable (?:a |the )?drone)\b/i,
  /\b(shoot(?:ing)?(?: down)?|take down|bring down|knock down|intercept(?:or|ors|ion)?|kill|attack(?:s|ing)?|strike|bomb(?:s|ing)?|weapon(?:s|ize|ise|ized)?|missile|firearm|ordnance|payload)\b/i,
  /\b(track|follow|locate|find|spy on|surveil|stalk|doxx?)\b[^.?!]{0,40}\b(person|people|man|woman|neighbou?r|ex|someone|somebody|individual|child|kid|him|her|them|licen[sc]e plate|phone)\b/i,
];
export const shouldRefuse = (q) => PATTERNS.some((p) => p.test(String(q)));
