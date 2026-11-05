// Which questions want a whole-picture briefing. Shared by the Worker and the browser panel (the panel fetches extra
// app data only for these questions).
export const isBriefing = (q) => /\b(brief(ing)?|summar(y|i[sz]e)|overview|catch me up|status|what('?s| is| are)? (going on|happening|on (the )?screen|up)|anything (new|interesting|notable)|what should i (look|see))\b/i.test(String(q));
