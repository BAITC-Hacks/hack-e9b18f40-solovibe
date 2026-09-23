/** Lightweight routing only. The model still interprets conditions and chooses actual tools. */
export function inferProcedure(objective: string): "plan" | "explain" {
  const text = objective.trim().toLowerCase();
  const change = /улучши|подбери|найди|собери|замени|сохрани.*(?:школ|мер|поликлин)|improve|build a|find a|replace|keep.*(?:school|clinic)|жақсарт|жоспар құр|ауыстыр|мектепті сақта/iu;
  if (change.test(text)) return "plan";
  const explanation = /почему|объясни|расскажи|что означает|за сч[её]т|какие.*(?:риски|эффекты)|explain|why|what (?:does|changed|are the)|how (?:does|is)|түсіндір|неге|неліктен|қандай.*(?:әсер|тәуекел)/iu;
  return explanation.test(text) ? "explain" : "plan";
}

/** Applying is a distinct user action; mentioning or asking how to apply is not authorization. */
export function explicitApplyIntent(objective:string):boolean {
  if(/(?:не\s+(?:примен|замен|использ)|do not|don't|қолданба|ауыстырма)/iu.test(objective))return false;
  return /(?:^|[.!?\n]\s*|(?:^|\s)(?:и|and|және)\s+)(?:(?:пожалуйста|please)[,\s]+)?(?:примени(?=\s|[,!.?]|$)|замени(?=\s|[,!.?]|$)|используй(?=\s|[,!.?]|$)|apply\b|replace\b|қолдан(?:ыңыз)?(?:\s|$)|ауыстыр(?:ыңыз)?(?:\s|$))/iu.test(objective.trim());
}
