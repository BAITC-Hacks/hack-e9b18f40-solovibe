import { test } from "node:test";
import assert from "node:assert/strict";
import { inferProcedure } from "../intent";
test("plain-language explanations and plan changes route without a mode selector", () => {
  for (const text of ["Почему такая оценка?", "Explain the current plan", "Қаланың бағасын түсіндір"]) assert.equal(inferProcedure(text), "explain");
  for (const text of ["Сохрани школу в Нуре, улучши результат", "Keep the school and improve the plan", "Нұрадағы мектепті сақта", "Объясни и улучши план"]) assert.equal(inferProcedure(text), "plan");
});
