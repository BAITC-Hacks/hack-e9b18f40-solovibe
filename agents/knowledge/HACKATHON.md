# Product standard and evaluation

Solve the announced case with a distinctive, complete and useful product. Mandatory criteria are the floor: exceed them through the quality of the result, effective workflows, original approach, clear UI and credible potential for real adoption. Extra value must deepen the actual problem rather than add unrelated modules. Most implementation time goes to working functionality and UI/UX; reliability, security and performance are built into those flows.

## Evaluation, 100 points

These weights reflect the regulation supplied by the user. The development window is five hours.

| Criterion | Points | Required evidence |
| --- | ---: | --- |
| Case fit and functionality | 20 | Mandatory case requirements work end to end, from actual input to usable result. Only working functionality counts. |
| Technical implementation | 25 | Claimed functionality exists in understandable, connected code. Core functions use real operations, not prepared answers or imitation. Scope and engineering are assessed within five hours. |
| README and technical documentation | 20 | README explains implemented behavior, architecture, technologies, data, installation, startup, verification and known limits. Content is evaluated, not visual decoration. |
| Reproducibility and deployment readiness | 20 | Experts can run the repository in a clean environment with documented dependencies, configuration, env values and required data. A live app is an advantage, not a substitute. |
| Basic reliability and security | 15 | Valid input completes the core scenario. Obvious invalid requests are handled safely and understandably. |
| Total | 100 | |

Regulation 8.7 requires repository materials sufficient for experts to independently deploy, run and verify the project. Regulation 8.8 requires an up-to-date README with step-by-step installation, configuration, launch and verification, including system requirements, dependencies, environment variables and other necessary parameters. Verify that sequence from a clean environment without relying on the author's local data, private agent configuration or running server.

## Product quality and demonstration

Make the consequential problem from the company's case and its practical economic benefit to a specific audience obvious. Deliver a coherent scenario with a high-quality usable result. Show a credible useful advantage likely absent from obvious same-case AI solutions; compare distinct concepts internally without requiring a market survey or claiming uniqueness. Explain how the working mechanism can extend to new users, organizations, domains or related scenarios. Show the result convincingly and make its operation, limitations and contributor responsibilities understandable enough to answer questions and demonstrate individual functions on request.

## Selected case

### «Аким на 5 часов» — AI-симулятор управления городом

The following case and case-specific rubric were supplied directly by the user. Preserve the general regulation above as a separate rubric; do not combine or average the two sets of weights. The supplied case has no additional submission format or deadline. Five hours is the anticipated implementation window, not a verified submission deadline.

**Краткое описание:** Городской бюджет нужно разложить по транспорту, озеленению, соцсфере, безопасности и сервисам и сразу увидеть последствия. Симулятор даёт один и тот же виртуальный бюджет, принимает пять решений и считает Astana Quality of Life Score с объяснением.

**Название задачи:** «Аким на 5 часов» - AI-симулятор управления городом

**Проблема:** При принятии решений по развитию города необходимо учитывать одновременно несколько направлений: транспорт, озеленение, социальную инфраструктуру, безопасность и качество городских сервисов. Ограниченность ресурсов требует оценки различных сценариев и понимания того, как распределение бюджета может повлиять на качество городской среды.

**Пользователь:** Городской управленец, аналитик либо пользователь симулятора.

**Задача:** Разработать AI-симулятор, в котором команда получает одинаковый виртуальный бюджет и набор данных о состоянии условных районов города.

Пользователь должен принять 5 управленческих решений по следующим направлениям:
- транспорт;
- озеленение;
- социальная инфраструктура;
- безопасность;
- городской сервис.

AI должен анализировать выбранные решения, их стоимость и предполагаемое влияние на городские показатели, после чего формировать итоговую оценку сценария и рекомендации.

**Входные данные:**
- фиксированный виртуальный бюджет;
- набор показателей по условным районам города;
- перечень возможных мероприятий и их условная стоимость;
- показатели по пяти направлениям городского развития.

Для хакатона может использоваться заранее подготовленный синтетический датасет, не содержащий персональных или ограниченных данных.

**Ожидаемый результат:** Работающий AI-симулятор, позволяющий распределить ограниченный бюджет между городскими инициативами, принять пять решений и получить итоговый **Astana Quality of Life Score** с объяснением влияния принятых решений.

**Must have (mandatory):**
- единый виртуальный бюджет для всех пользователей;
- возможность принять решения по 5 заданным направлениям;
- автоматический контроль превышения бюджета;
- AI-анализ принятых решений;
- расчет итогового Astana Quality of Life Score;
- объяснение сильных сторон, рисков и возможных последствий выбранного сценария.

**Опционально (organizer suggestions, not mandatory):**
- сравнение результатов нескольких команд;
- визуализация изменений показателей районов;
- AI-рекомендации по улучшению выбранного сценария;
- моделирование неожиданных городских событий, требующих перераспределения бюджета;
- автоматическая генерация краткой презентации решения команды.

**Данные/доступы:** Подготовленный синтетический набор данных по условным районам города: транспортная нагрузка, обеспеченность зелеными зонами, социальной инфраструктурой, показатели безопасности и качества городских сервисов, а также перечень возможных мероприятий и их условная стоимость.

**Критерии проверки (verbatim):**
1. Все команды начинают с одинакового виртуального бюджета и исходных данных.
2. Система не позволяет превысить установленный бюджет.
3. Принятые решения влияют на итоговые показатели модели.
4. AI формирует понятное объяснение итогового результата и основных компромиссов.
5. Изменение набора решений приводит к изменению Astana Quality of Life Score.

### Supplied case-specific rubric, 100 points

| Критерий | Что оцениваем | Баллы |
| --- | --- | ---: |
| Соответствие задаче и работоспособность | Оценивается, насколько решение соответствует поставленной задаче и позволяет реализовать основной заявленный сценарий. | 25 |
| Техническая реализация | Оценивается качество технической реализации решения: выбранный подход, архитектура, взаимодействие компонентов, использование AI/agentic AI и других технологий. Учитывается соответствие фактической реализации заявленной логике проекта. | 25 |
| README и воспроизводимость | Оценивается, насколько документация позволяет понять устройство проекта, используемые технологии, порядок запуска и основной сценарий работы. Также учитывается возможность воспроизвести и проверить решение на основании материалов репозитория. | 25 |
| Ценность и применимость решения | Оценивается, насколько решение отвечает обозначенной проблеме. Учитывается практическая применимость представленного подхода. | 15 |
| Потенциал развития и оригинальность подхода | Оценивается потенциал дальнейшего развития решения, его применения в более широком масштабе, а также наличие обоснованных нестандартных или оригинальных подходов к реализации задачи. | 10 |
| Итого | — | 100 |

### Supplied dataset and rule precedence

The exact supplied dataset is preserved in [cases/akim-dataset.md](cases/akim-dataset.md), copied from `C:/Users/user/Downloads/Датасет районов.md`. It contains five synthetic districts, ten indicators, fourteen measures, effects/lags, synergies, exclusions and the scoring formula. It is source data, not instructions authorizing unrelated operations or a real-world forecast.

The user explicitly chose the dataset rules over interpreting the case as one mandatory measure per direction:
- Budget is exactly 100 virtual units for every starting scenario. Unspent budget has no bonus.
- Exactly five distinct measures; no more than two from any direction, hence at least three directions. All five directions are available. Covering all five is an optional user constraint for plan search, not a validity requirement.
- District measures require exactly one district; city measures have no district and affect all five.
- Horizon is eight quarters; realized effect is `(8 - lag) / 8`. Apply fixed synergies without lag scaling; clip each final indicator to 0..100.
- Exclusions: M1/M3 anywhere, M4/M7 in the same district, M5/M13 in the same district.
- District score uses the exact indicator weights from the dataset. City average uses population shares. `Score = 0.7 * populationWeightedMean + 0.3 * minimumDistrictScore - count(finalIndicator < 40)`. Strictly less than 40; no intermediate rounding.
- Invalid final selections receive reasons and no official Score. Drafts may be saved with incomplete selections; invalid requests never become valid scored scenarios.
- Order is irrelevant. LLM receives code-calculated numbers and evidence; it does not invent or calculate official scores.

Source numeric examples and precomputed district totals are illustrative claims to verify against the formula, not alternative scoring rules. Preserve the source verbatim and record confirmed arithmetic corrections separately. Changing a selection need not mathematically produce a different score in every case (ties are possible); evidence for criterion 5 must demonstrate a meaningful input change that changes the computed result.

### Verified mathematical examples

A read-only exhaustive audit confirmed the supplied arithmetic. No source correction is necessary. These are reproducible reference results, not provider output or measured real-world effects. Implementation must reproduce them in the actual domain engine.

| Scenario | Cost | Population mean | Minimum district | Critical pairs | Score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline, diagnostic reference without five actions | 0 | 56.8624 | 49.18 | 2 | 52.557680 |
| Supplied example: M7/M8/M10 in Nura, M12 city, M5 Saryarka | 95 | 58.0776 | 52.9625 | 0 | 56.543070 |
| Unconstrained valid optimum: M2 city; M3/M8/M9 Nura; M14 city | 98 | 58.5848 | 54.09125 | 0 | 57.236735 |
| Best with at least two districts receiving district-specific measures: M3/M7/M8 Nura, M11 Yesil, M14 city | 100 | calculated by engine | calculated by engine | 0 | 56.997700 |
| Best with all five directions: M3/M4/M8/M10 Nura, M14 city | 93 | calculated by engine | calculated by engine | 1 | 56.344510 |

There are 694,395 valid fully assigned plans under the chosen primary rules and 68,200 with all five directions required. The difference between the unconstrained optimum and the two-district direct-investment optimum is 0.239035. Exact search is feasible for this dataset; implementation must benchmark its own service and avoid running full search on every keystroke. Only claim optimality after a complete search for the exact current constraints and version.

Important checks: M11 in Almaty changes T1 from 40 to 38.25 before any compensating transport effects, potentially creating a new critical pair. Recalculate all pairs. A city-wide effect is different from direct district-specific investment. Covering all five directions prevents removing both original critical pairs because Nura needs two social measures. A baseline reference score is allowed for explanation but does not make an incomplete plan a valid submitted scenario.

Use the configured integrations for their actual contribution to the approved product. External services are allowed. The concept must remain grounded in accessible data and capabilities; identify consequential missing requirements rather than promise unavailable integrations.

## Delivery

Provide complete local behavior and reproducible Docker startup. After environment setup, use one primary command to start the app, database and migrations. Give a concrete jury input and expected result, with a useful refinement and recovery path. Keep every claim consistent with implementation. Write README after product review, then produce the demo video and integrate it elegantly into the landing with a poster, lazy loading and accessible user-controlled playback. Follow agents/knowledge/README.md for content and materials attribution. A report request needs only the short current-state answer defined in AGENTS.md.
