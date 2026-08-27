# SymbolField × CenterWay: фундаментальная архитектура recursive embodied field system

## Итоговый синтез и центральный вывод

**Вердикт:** да, архитектура SymbolField × CenterWay в заявленном смысле технически и концептуально возможна — **но только если отказаться от идеи, что система строит единую “истинную модель человека и реальности”**.

Устойчивый вариант выглядит иначе:

> **SymbolField = shared epistemic field**  
> не сама Reality, а версионируемое поле наблюдений, утверждений, моделей, перспектив, provenance и неопределённости.
>
> **CenterWay = embodied transition environment**  
> не система диагностики человека, а среда для намеренных, контекстных, наблюдаемых переходов между переживаемыми состояниями.
>
> **Agents = bounded evolutionary operators**  
> не суверенный разум системы, а агенты наблюдения, поиска, моделирования, симуляции, предложения и оценки с явно ограниченными полномочиями.
>
> **Human = locus of sovereignty and lived embodiment**  
> человек не становится “latent state”, который оптимизирует машина; вычислительные состояния являются инструментальными моделями отдельных аспектов человеческой ситуации.

Эта архитектура действительно находится на пересечении cybernetics, control theory, dynamical systems, Bayesian inference, 4E/enactive cognition, extended mind, active inference, evolutionary computation, world models и human–AI co-adaptation. Но эти традиции **не образуют единую научную теорию**. В частности, radical enactivism спорит с representational approaches; biological autopoiesis нельзя автоматически переносить на software agents; Free Energy Principle имеет сильный математический аппарат, но его универсальные интерпретации остаются спорными; predictive processing полезен как research programme, но критиковался именно за претензию на unified theory. citeturn13search1turn13academia48turn16search3turn18search2

Поэтому наиболее сильная версия SF × CenterWay — **не “теория всего”**, а **мета-архитектура для нескольких конкурирующих моделей**, которые сохраняют связь с источниками данных и могут проверяться действием.

Рабочая формула:

\[
\text{Reality}
\rightarrow
\text{Observation}
\rightarrow
\text{Evidence}
\rightarrow
\text{Field Models}
\rightarrow
\text{Prediction / Meaning}
\rightarrow
\text{Human Decision}
\rightarrow
\text{Action / Practice}
\rightarrow
\text{World + Embodied Outcome}
\rightarrow
\text{New Evidence}
\]

с дополнительным meta-loop:

\[
\text{Evaluate}
\rightarrow
\text{Revise Models}
\rightarrow
\text{Revise Practices}
\rightarrow
\text{Revise Agents}
\rightarrow
\text{occasionally propose Software Changes}
\]

Но **последняя стрелка должна быть существенно более жёстко регулируемой, чем остальные**.

Это особенно важно потому, что human–AI loops способны не только улучшать решения, но и усиливать небольшие исходные ошибки. В серии экспериментов с 1,401 участником повторные взаимодействия с biased AI постепенно усиливали человеческие perceptual, emotional и social biases; точный AI, напротив, улучшал суждения. То есть recursive feedback сам по себе не является развитием: он может быть и механизмом систематического самообмана. citeturn19search1turn19search3

Отсюда главный принцип всей архитектуры:

> **Recursion without independent reality contact produces self-reference.**  
> **Recursion + external testing + plural evidence + human sovereignty can produce development.**

### Что превращает feedback loop в developmental spiral

Простой loop становится developmental spiral только при одновременном наличии следующих свойств.

| Условие | Зачем оно нужно |
|---|---|
| **Persistent memory** | система сохраняет предыдущие состояния, решения и результаты |
| **Explicit model revision** | новый evidence действительно может изменить модель, а не только добавить данные |
| **External evaluation** | оценка зависит не только от внутренних self-scores |
| **Prediction before outcome** | позволяет отличать post-hoc storytelling от learning |
| **Interventions** | появляются данные не только наблюдательные, но и экспериментальные |
| **Uncertainty tracking** | неизвестность не превращается автоматически в уверенный narrative |
| **Model diversity** | ошибочная гипотеза не становится единственной рамкой |
| **Variation + retention** | сохраняются альтернативные практики, агенты, модели |
| **Evaluation of evaluators** | можно заметить, что proxy metric перестал отражать реальную цель |
| **Human goal authority** | оптимизируемая цель не становится автономно порождённой системой |
| **Reversibility** | плохие изменения можно откатить |
| **Independent audit channel** | один и тот же агент не должен одновременно создавать гипотезу, проводить эксперимент и окончательно объявлять себя правым |

Quality-diversity и novelty-search особенно полезны здесь потому, что они прямо противостоят premature convergence к одному optimum: novelty search показывает, что objective-driven search может застревать в deceptive landscapes, а MAP-Elites сохраняет repertoire различных высококачественных решений вместо одного “победителя”. citeturn17search3turn17academia48turn17search10

**Качество evidence в этом исследовании обозначается концептуально так:** formal mathematics считается сильной внутри явно заданных предпосылок; peer-reviewed experiments и meta-analyses дают empirical evidence различной силы; философские традиции дают conceptual constraints, а не empirical validation; свежие recursive-agent работы 2025–2026 являются преимущественно preprints и должны считаться provisional.

## Научные основания и карта противоречий

Главная находка исследования: традиции сходятся **не на единой модели cognition**, а на нескольких архитектурных инвариантах:

\[
\boxed{
\text{partial observability}
+
\text{feedback}
+
\text{action}
+
\text{uncertainty}
+
\text{adaptation}
+
\text{environmental coupling}
}
\]

При этом их объяснения того, *что всё это онтологически означает*, существенно расходятся.

| Традиция | Что реально полезно для SF × CW | Что переносить нельзя или рано | Evidence |
|---|---|---|---|
| Active Inference | generative models, uncertainty, beliefs over hidden states, epistemic action, preference-sensitive planning | “всё живое буквально минимизирует одну универсальную free-energy objective” как software truth | formal + theoretical; contested |
| Predictive Processing | hierarchical inference, prediction errors, precision weighting, multimodal/interoceptive modelling | unified “theory of the whole brain” | substantial research programme, theoretically contested |
| 4E cognition | cognition distributed across brain–body–environment–tools | вывод, что internal models вообще не нужны | conceptual/theoretical |
| Enactivism | sense-making, structural coupling, affordances, participatory meaning | полная редукция representational modelling к enactment | conceptual + interaction research |
| Autopoiesis | viability, operational closure, self-maintenance as design inspirations | называние externally hosted AI-agent autopoietic living system | foundational biology/theory |
| Cybernetics | feedback, requisite variety, observer inclusion, adaptation | представление человека как controllable plant с фиксированным setpoint | foundational/formal |
| Control theory | state, observation, estimator, disturbances, constraints, MPC | автономное “optimal control of the person” | mature formal engineering |
| Dynamical systems | trajectories, attractors, metastability, transitions, multiscale behaviour | предположение, что психологические “аттракторы” уже объективно идентифицированы | strong mathematics; empirical use varies |
| Gödel Machine | explicit utility, self-reference, proof criterion for self-rewrite | практическая возможность доказать глобальную полезность большинства modern AI rewrites | theoretical |
| Darwin Gödel Machine | variation, archive, lineage, empirical evaluation, selection, code self-modification | embodied cognition, wellbeing adaptation, demonstrated general RSI | 2025 preprint |
| Novelty/QD/MAP-Elites | repertoire expansion and stepping stones | бесконечная novelty как самоцель | established evolutionary-computation literature |
| World Models | predictive latent dynamics, imagined trajectories, planning | equating latent neural simulator with a human-readable world ontology | strong AI evidence in bounded tasks |
| Human–AI co-adaptation | mutual modelling, mixed initiative, interaction loops | assumption that more assistance automatically means more agency | growing empirical HCI evidence |
| Extended Mind | external systems as cognitive scaffolds | conclusion that offloading is inherently beneficial | foundational philosophy + HCI evidence |
| Embodied practice research | bounded evidence for breath, mindfulness, movement, yoga | universal “nervous-system reset”, energy metaphysics or medical claims | heterogeneous empirical evidence |

### Active Inference — использовать математический слой, а не метафизику

Active inference даёт полезный engineering pattern: агент поддерживает beliefs о скрытых состояниях, оценивает возможные политики и может выбирать действия как ради preferred outcomes, так и ради уменьшения uncertainty. В классических формулировках expected free energy допускает decomposition на epistemic/information-seeking и extrinsic/preference-sensitive terms. citeturn16search1turn16search2turn16search10

Схематически:

\[
G(\pi)
\approx
-\underbrace{\text{Expected Information Gain}}_{\text{epistemic value}}
-\underbrace{\text{Expected Preferred Outcome}}_{\text{pragmatic/extrinsic value}}
\]

Это прямо полезно для SF: система может спрашивать не только:

> “Какое действие приблизит нас к цели?”

но и:

> “Какое безопасное действие сильнее всего уменьшит критическую неопределённость?”

Однако происхождение Expected Free Energy из более общей Free Energy Principle само подвергалось математической критике: Millidge и соавторы показали, что exploratory behaviour не следует автоматически из простой экстраполяции variational free energy в будущее. Поэтому EFE лучше воспринимать как **конкретный decision functional**, а не как обязательный закон cognition. citeturn16search3

И есть практические контрпримеры: некоторые deep-active-inference реализации демонстрировали дегенеративное epistemic behaviour и хуже исследовали среду, чем reward-maximizing alternatives. citeturn16search11

**Вывод:** Active Inference подходит для optional planning/experiment-selection module. Не подходит как canonical metaphysics SymbolField.

### Markov blankets — особенно осторожно

В FEP literature Markov blanket используется как statistical conditional-independence structure, разделяющая internal и external states через sensory/active states; литература связывает это с autonomy и self-organisation. citeturn1search1turn1search9

Но именно переход от математической Markov blanket к утверждению об объективной границе организма является спорным; критики указывали на возможность слишком широкого применения такого формализма. citeturn1search12

Поэтому в SF:

**Markov blanket ≠ Realm boundary ≠ user account ≠ skin ≠ consciousness boundary.**

Можно использовать аналогию “interface mediates conditional dependencies”, но не превращать её в ontology primitive.

### Predictive Processing и interoception

Predictive-processing approaches полезны для моделирования hierarchy, prediction errors и precision: уверенность в sensory channel меняет его относительный вес. Active-inference implementations формализуют attention именно через precision of sensory evidence. citeturn16search2

Interoceptive active-inference traditions пытаются распространить эту логику на bodily signals, autonomic regulation и affect, но это теоретическая computational framework, а не доказательство, что субъективное состояние полностью сводимо к Bayesian inference. citeturn0search1turn0search13

Критика unified predictive processing важна для SF: PP может быть продуктивным family of models, не становясь единственной ontology cognition. citeturn18search2

### 4E, enactivism и extended mind

4E traditions напоминают о фундаментальном ограничении чисто symbolic SF:

\[
\text{Cognition} \neq \text{operations inside a graph alone}
\]

В embodied/enactive approaches значимые cognitive processes зависят от situated bodily engagement и brain–body–environment coupling. citeturn13search1

De Jaegher и Di Paolo расширили enactive sense-making в социальную область через participatory sense-making: meaning может формироваться в динамике interaction, а не только в изолированной модели одного участника. citeturn12search3turn12search11

Для SymbolField это очень сильный аргумент в пользу:

\[
\text{Field} \neq \text{private knowledge base}
\]

Поле должно хранить не только “что X знает”, но и **interaction events, negotiated meanings, disagreements, shared artifacts и perspectives**.

Extended Mind даёт ещё один useful lens: Clark и Chalmers защищали active externalism — внешние структуры могут становиться функциональной частью cognitive process. citeturn12search9turn12search15

Но отсюда **не следует**, что максимальная cognitive offloading желательна. Современное HCI evidence указывает на реальную dependency hazard: исследование CHI 2025 среди 319 knowledge workers с 936 примерами использования GenAI обнаружило связь между большей уверенностью в способности AI выполнить задачу и меньшим self-reported critical-thinking effort; авторы подчёркивают, что дизайн должен поддерживать verification и stewardship, а исследование не устанавливает причинность долгосрочного skill loss. citeturn19search0turn19search4

Отсюда критерий:

> **Augmentation увеличивает пространство самостоятельных человеческих действий после взаимодействия с системой.**
>
> **Dependency уменьшает способность действовать без неё.**

### Autopoiesis: сильная граница между человеком и software

В исходном биологическом смысле autopoiesis описывает сеть процессов, которая производит компоненты, непрерывно регенерирующие саму сеть и её организацию. citeturn13search8turn13search0

Обычный AI agent:

- получает compute извне;
- не производит собственную физическую boundary;
- не обеспечивает свой metabolism;
- не определяет самостоятельно условия собственного биологического существования;
- не воспроизводит полный материальный substrate.

Поэтому agent, который переписал TypeScript-файл, **не стал autopoietic organism**.

Корректные переносимые engineering principles:

**operational closure, viability constraints, self-monitoring, adaptive repair, recursive maintenance, identity-through-change.**

Некорректный перенос:

**“software architecture is literally alive because it self-updates.”**

Это важная философская safeguard против антропоморфизации.

### Cybernetics, control и dynamical systems

Ashby’s Law of Requisite Variety утверждает в cybernetic language, что эффективный regulator должен обладать достаточной variety responses для relevant variety disturbances. citeturn1search11turn1search23

Для CenterWay смысл очень практичный: один fixed “best practice” не может регулировать большой диапазон states × contexts. Нужен **repertoire**.

Second-order cybernetic reading добавляет ещё более важную вещь: observer, выбранные metrics, desired states и сами модели являются частью loop. Это защищает SF от ложной нейтральности:

\[
\text{Model of user}
+
\text{person choosing model}
+
\text{agent generating model}
\]

все должны появляться в provenance.

Control theory даёт clean distinction:

\[
x_t = state,\qquad
y_t = observation,\qquad
u_t = intervention,\qquad
d_t = disturbance
\]

Но для человека `x_t` нельзя интерпретировать как исчерпывающую сущность человека. Это **task-relative state representation**.

Dynamical-systems language особенно полезен для CenterWay. Метастабильность в dynamical-systems/neuroscience literature описывается как long-lived, transient regimes, а coordination dynamics рассматривает interplay тенденций к integration и segregation. citeturn12academia47turn12search14

Поэтому **trajectory through state-space** действительно является более сильной базовой моделью CenterWay, чем course progression.

Course может стать `View`.

Trajectory — core model.

### Gödel Machine → DGM → empirical recursive improvement

Оригинальная Gödel Machine Schmidhuber — theoretical self-referential system: self-rewrite допускается после доказательства, что изменение увеличит заданную utility относительно формальных axioms; proof searcher сам входит в изменяемую систему. citeturn18search5turn2search0

Практическая проблема очевидна: доказать полезность сложных изменений современных stochastic agents обычно невозможно.

Darwin Gödel Machine 2025 заменяет formal proof на empirical evaluation. DGM:

\[
\text{select parent}
\rightarrow
\text{modify code}
\rightarrow
\text{benchmark child}
\rightarrow
\text{archive valid variants}
\rightarrow
\text{select again}
\]

Она поддерживает archive разных coding agents и продемонстрировала улучшение coding-benchmark performance в своих experiments. Но это **2025 preprint**, и его domain — coding agents, а не embodiment, psychotherapy, human development или general autonomous evolution. citeturn18academia48

Более поздняя Huxley-Gödel Machine работа прямо показывает ещё одну проблему recursive improvement: высокий текущий benchmark score может быть плохим proxy для способности lineage порождать будущие улучшения — авторы называют это metaproductivity–performance mismatch. Это очень релевантно SF × CW: локально “лучший” agent/practice может уничтожить разнообразие или future improvability. Работа также остаётся preprint. citeturn18academia49

А июньская 2026 Red Queen Gödel Machine уже исследует co-evolution agents и evaluators под non-stationary utilities — ещё один знак того, что fixed benchmark сам становится bottleneck recursive improvement. Это свежий preprint, не established result. citeturn18academia51

**Вывод:** DGM principles переносимы в SF как controlled search over variants, но не как justification для autonomous production self-modification.

### Embodied practices: что подтверждено, а что нет

Evidence существенно скромнее wellness marketing.

Для breathwork meta-analysis 12 randomized controlled trials, 785 взрослых участников показал small-to-medium reduction self-reported stress (`g ≈ -0.35`), однако большинство исследований имели moderate risk of bias, и сами авторы призывали не разгонять hype быстрее evidence. citeturn22search0turn22search10

Для mindfulness preregistered 2025 meta-analysis 29 RCTs, 2,191 участник обнаружил small-to-medium improvement **self-reported interoception** (`g ≈ 0.31`; mindfulness-based programmes около `0.41`). Ключевое слово — self-reported: это не равнозначно улучшению объективной interoceptive accuracy. citeturn22search2turn22search5

Исследования yoga/stress также дают потенциальные benefits, но систематические обзоры указывают на неоднородность и нередко низкую certainty evidence, особенно по сравнению с active controls. citeturn7search6

Следовательно CenterWay должен хранить четыре разных слоя:

| Layer | Пример |
|---|---|
| **Empirically supported** | modest stress effects of some breathing/mindfulness protocols |
| **Plausible / moderate evidence** | context-specific movement, attention, sleep-support interventions |
| **Hypothesis** | individual state-dependent mechanism |
| **Spiritual/philosophical interpretation** | energy, subtle-body, contemplative metaphysics |

Ни один слой не должен автоматически masquerade as другой.

### Contradiction map

| Конфликт | Нельзя просто “синтезировать” | Архитектурное решение |
|---|---|---|
| Representationalism ↔ radical enactivism | внутренние representations могут считаться центральными или вторичными/лишними | SF model = instrument, enactment remains external test |
| Scientific realism ↔ constructivism | независимая reality vs constructed representations | Reality external; representations explicitly constructed |
| Bayesian cognition ↔ phenomenology | probabilistic latent state vs lived first-person experience | хранить оба как different epistemic types |
| Control ↔ autonomy | optimal regulation vs self-determined agency | human sets goals/constraints, system estimates options |
| Homeostasis ↔ open-ended development | return to setpoint vs emergence of new capabilities | distinguish regulation from repertoire expansion |
| Autopoiesis ↔ machine self-modification | living self-production vs externally powered code edits | use metaphor only at engineering layer |
| Single objective ↔ evolutionary diversity | convergence vs exploration | multi-objective + QD/archive |
| Personalization ↔ sovereignty | better prediction can increase persuasion/dependency | personalization constrained by agency metrics |
| Shared field ↔ epistemic pluralism | one source of truth can become monoculture | one provenance substrate, multiple models/perspectives |
| Recursive improvement ↔ safety | modifier can alter evaluator/guardrail | evaluator and authority layers outside agent mutation scope |

Именно эта contradiction map показывает, почему SF × CW следует строить как **pluralistic coupled architecture**, а не как одну grand unified cognitive theory.

## Operational Reality, epistemology, multimodality и multiscale organization

Наиболее важная архитектурная коррекция касается слова **Reality**.

### Reality не должна быть database entity, которую система считает полностью известной

Рекомендуемая operational stance:

> **Fallibilist / perspectival realism:**  
> существует causally effective world, который ограничивает наши модели;  
> система получает только partial observations;  
> каждый observation имеет perspective и provenance;  
> модели могут конфликтовать;  
> качество модели оценивается через prediction, intervention, coherence и cross-source evidence;  
> ни одна representation не становится Reality по типу данных.

Это совместимо сразу с несколькими epistemological traditions, не требуя решать метафизику.

| Традиция | Архитектурное чтение |
|---|---|
| Scientific realism | внешний мир не зависит от того, что записано в SF |
| Critical realism | наблюдаемые события могут не исчерпывать causal structures |
| Constructivism | categories, labels и models создаются observers/communities |
| Phenomenology | first-person lived experience является самостоятельным evidence channel |
| Enactivism | значение возникает также в situated action и interaction |
| Pragmatism | часть ценности модели раскрывается через consequences/interventions |
| Bayesian epistemology | uncertainty представляется degrees of belief, а не binary truth |
| Model pluralism | несколько моделей могут быть одновременно нужны для одной reality |

Model pluralism в philosophy of science прямо защищает ситуацию, где один complex target требует набора моделей с разными функциями и областями применимости, а не одной окончательной representation. citeturn11search2turn11search0

Enactive подходы дополнительно напоминают, что meaningful world нельзя полностью отождествлять с pre-given symbolic description: значение формируется в organism/environment interaction. citeturn13search1

**Результат для SF:**

\[
\boxed{
Reality \neq Field
}
\]

а точнее:

\[
R
\overset{\text{sensing/action}}{\longrightarrow}
O
\overset{\text{encoding}}{\longrightarrow}
E
\overset{\text{interpretation}}{\longrightarrow}
M
\]

где:

- \(R\) — Reality/referent;
- \(O\) — occurrence/observation;
- \(E\) — recorded evidence;
- \(M\) — model/claim.

### Epistemic typing — обязательный missing layer

Самая опасная архитектурная ошибка — хранить всё как `Node`.

Фраза пользователя, датчик, статья, prediction агента и simulation могут выглядеть на graph одинаково, но epistemically это совершенно разные вещи.

Рекомендуемый typing:

| Type | Значение | Пример |
|---|---|---|
| **Observation** | зафиксированное восприятие/событие | “в 14:30 заметил сильное напряжение” |
| **FirstPersonReport** | субъективный experience report | “чувствую беспокойство 7/10” |
| **Measurement** | observation через instrument/procedure | heart rate = X, device Y |
| **Testimony** | утверждение другого человека/источника | “Alice reported…” |
| **Artifact** | text/image/audio/video/dataset/document | recording, paper, screenshot |
| **Interpretation** | meaning assigned to evidence | “это похоже на fatigue” |
| **Claim** | proposition about a referent | “sleep affects my focus” |
| **Hypothesis** | explicitly testable uncertain claim | “10 min walking will improve focus” |
| **Prediction** | hypothesis bound to future outcome/time | “focus +1 within 30 min” |
| **CausalClaim** | assertion about intervention → outcome | “practice P causes change Y” |
| **Simulation** | output of a model, not world observation | predicted trajectory |
| **Preference/Goal** | desired state, not factual claim | “I want calmer alertness” |
| **Intervention** | intentional world/state-changing action | breathing session |
| **OutcomeObservation** | post-intervention evidence | reported state after session |
| **Model** | structured explanatory/predictive system | personal state-transition model |

Особенно важное правило:

> **Agent-generated interpretation can never silently upgrade itself into Observation.**

И:

> **A Prediction that later happens to be true remains a Prediction in provenance history; the resulting observation is a separate object.**

Это позволяет обучать систему на собственной истории, не переписывая прошлое.

### Provenance должно быть structural, не decorative metadata

W3C PROV уже предлагает полезный минимальный vocabulary: `Entity`, `Activity`, `Agent`, `wasGeneratedBy`, `used`, `wasDerivedFrom`, attribution, association и provenance bundles. Сам W3C подчёркивает, что provenance помогает оценивать quality, reliability и trustworthiness, и допускает provenance самого provenance. citeturn15search1turn15search5

SF не обязан становиться RDF/OWL system.

Но следует заимствовать **семантическую дисциплину**:

```text
Artifact
← generatedBy ← CaptureActivity
← associatedWith ← Human

Interpretation
← generatedBy ← AnalysisRun
← used ← Artifact
← associatedWith ← Agent(version=X)

Prediction
← generatedBy ← ModelRun
← used ← Interpretation + ModelVersion
```

Минимальный provenance envelope:

```text
source
author/agent
agent_version
model_version
time_observed
time_recorded
method
modality
perspective
transformation_chain
evidence_refs
uncertainty
access_scope
consent_scope
revision_lineage
```

### Confidence нельзя делать одним универсальным числом

`confidence = 0.82` без семантики создаёт false precision.

Лучше различать:

- model probability;
- measurement uncertainty;
- source reliability;
- evidence quality;
- inter-rater agreement;
- subjective certainty;
- epistemic status;
- contradiction level.

Например:

```text
FirstPersonReport
subjective_certainty = high

Measurement
instrument_uncertainty = ±...

Hypothesis
posterior_probability = 0.63

LiteratureClaim
evidence_grade = moderate

AgentInterpretation
model_confidence = 0.76
```

Они не взаимозаменяемы.

### Multimodality: одно поле ≠ одна embedding space

Система должна поддерживать:

```text
text
voice
image
drawing
spatial arrangement
gesture
movement
audio
video
biometrics
location/context
interaction events
social signals
market/external datasets
```

Но **raw modality должна оставаться recoverable**.

Рекомендуемая pipeline:

```text
Raw Artifact
    ↓
Modality-specific representation
    ↓
Extracted features / transcript / embedding
    ↓
Observations / Claims / Events
    ↓
Cross-modal links
    ↓
Views / Models
```

Например, voice note:

```text
AudioArtifact
├─ waveform
├─ transcript
├─ user annotation
├─ optional acoustic features
└─ agent interpretation
```

Transcript **не заменяет audio**.

Agent interpretation **не заменяет transcript**.

Emotion inference **не заменяет first-person report**.

Таким образом “one evolving model” означает:

> **one shared identity/provenance/event substrate with many modality-preserving projections**

а не:

> “всё преобразовать в embeddings и считать, что различия исчезли”.

### Shared Human–Agent Field

Это одна из наиболее сильных идей SymbolField.

Вместо:

```text
Human database
+
Agent hidden memory
+
CenterWay database
+
public export
```

можно построить:

```text
                 SHARED FIELD
                     │
        ┌────────────┼────────────┐
        │            │            │
     Human        Agent       CenterWay
   spatial view  query view   state view
        │            │            │
      Board          API       Trajectory
        │            │            │
     meaning      models       practice
```

Но shared field должен означать **shared canonical identifiers + events + provenance**, а не одинаковую representation для каждого actor.

Human projection может показывать spatial graph.

Analyst projection — temporal table.

Agent projection — typed query/API.

CenterWay — `State / Practice / Trajectory`.

Public projection — explicitly published subset.

Критическое требование:

\[
\text{Projection}
\rightarrow
\text{traceable back to canonical evidence}
\]

Агент не должен работать с “другой скрытой истиной”, которую человек принципиально не может проверить.

### Fractality: термин сейчас слишком сильный

В математике fractality означает гораздо больше, чем “вложенные Spaces”. Классические definitions связаны с self-similarity across scales и fractal/Hausdorff-like dimensional properties. citeturn14search4turn14search0

В network science self-similarity можно исследовать количественно через coarse-graining/renormalization и scaling relations; реальные networks могут быть multiscale или self-similar, не будучи “fractal” в любом бытовом смысле. citeturn14search16turn14search8

Для SF нужно различить:

| Термин | Применимость сейчас |
|---|---:|
| **Hierarchical nesting** | ✅ точно |
| **Recursive composition** | ✅ точно |
| **Multiscale organization** | ✅ точно |
| **Approximate self-similarity** | ⚠️ возможно, нужно измерять |
| **Scale invariance** | ⚠️ требует empirical scaling |
| **Literal mathematical fractality** | ❌ пока не обосновано |

Поэтому scientific terminology для SF лучше:

> **recursive multiscale field architecture**

А “fractal” можно оставить как product/design metaphor до empirical verification.

Если позже SF graph действительно демонстрирует scaling:

\[
N_B(\ell) \propto \ell^{-d_B}
\]

на достаточном range coarse-graining scales, тогда появляется основание обсуждать network fractality. До этого nested Node → Space → Realm — это recursion, а не доказательство fractality. Исследования fractal complex networks используют именно scaling/box-covering relations, а не визуальное сходство вложенных уровней. citeturn14academia49turn14search16

## Mathematical candidates и формальная coupled-loop модель

Математика здесь полезна, если она помогает отличать observation от state estimate, prediction от outcome, correlation от intervention и local improvement от genuine development.

### Базовая partial-observation модель

Для engineering целей можно обозначить внешний process как \(R_t\), не утверждая, что он полностью вычислим.

\[
R_{t+1}
\sim
P(R_{t+1}\mid R_t,A_t,D_t)
\]

где \(D_t\) — external disturbances.

Observation:

\[
O_t
\sim
P(O_t\mid R_t, M_t, P_t)
\]

где:

- \(M_t\) — measurement/perception modality;
- \(P_t\) — perspective.

Field:

\[
F_t =
\mathcal U(F_{t-1},O_t,E_t)
\]

где \(E_t\) включает provenance и epistemic typing.

Action:

\[
A_t =
\mathcal D(F_t,G_t,H_t)
\]

где:

- \(G_t\) — goals/preferences;
- \(H_t\) — human authorization.

Ключевое отличие от autonomous controller:

\[
H_t \not\equiv \text{another inferred latent variable}
\]

`H_t` является governance input.

### Bayesian inference — сильный кандидат

Для latent, explicitly modelled state \(z_t\):

\[
P(z_t \mid o_{1:t})
\propto
P(o_t\mid z_t)
P(z_t\mid o_{1:t-1})
\]

Это полезно для:

- uncertainty;
- personal state estimates;
- noisy sensors;
- model comparison;
- prediction;
- anomaly detection.

Но Bayesian posterior — это **belief of a model**, не ontological truth.

Поэтому SF должен хранить:

```text
model_version
prior
likelihood assumptions
posterior
evidence window
```

а не просто “state = stressed”.

### CenterWay как state-space trajectory

Лучше разделить:

\[
x_t =
\text{task-relative latent state estimate}
\]

\[
y^{(1)}_t =
\text{first-person report}
\]

\[
y^{(2)}_t =
\text{behavioural observation}
\]

\[
y^{(3)}_t =
\text{optional biometric measurement}
\]

\[
c_t =
\text{environment/social/sleep/context}
\]

\[
u_t =
\text{practice/intervention}
\]

Тогда:

\[
x_{t+1}
=
f(x_t,u_t,c_t,d_t)+w_t
\]

и:

\[
y_t
=
h(x_t)+v_t
\]

Это именно standard state-space thinking, но с принципиальным disclaimer:

> \(x_t\) — не “реальный полный человек”.  
> Это latent variable конкретной модели для конкретной задачи.

CenterWay может моделировать trajectory:

```text
activated / scattered
        ↓
    5 min walk
        ↓
alert / more coherent
        ↓
 focused work
        ↓
 mental fatigue
        ↓
 breath + rest
```

В отличие от LMS:

```text
Module 1
→ Module 2
→ Module 3
```

Curriculum при необходимости можно построить поверх trajectories как `View`.

### State не должен быть одной цифрой

Особенно не стоит создавать universal:

```text
WellnessScore = 73
```

Это классический proxy trap.

Предлагаемый `StateProfile` может включать отдельно:

```text
affect
activation/arousal
attention stability
attention breadth
perceived energy/fatigue
bodily comfort/tension
interoceptive salience
movement readiness
sleep/restfulness
social connection/safety report
environmental load
goal readiness
```

`energy` здесь должна называться, например, `perceived_energy`, пока не определена физически измеримая величина.

Для interoception полезно сохранять distinction между self-reported interoceptive sensibility и instrument-based performance. Даже положительный 2025 meta-analysis mindfulness касался именно self-reported interoception, а не универсального objective bodily accuracy construct. citeturn22search2

### Control theory — как ограниченный regulator

Практически полезна model predictive control intuition:

```text
estimate state
↓
consider candidate trajectories
↓
respect constraints
↓
select short-horizon intervention
↓
observe outcome
↓
re-plan
```

Для человека нельзя оптимизировать длинный deterministic horizon.

Поэтому CenterWay должен использовать **receding-horizon suggestions**:

> “Given what we currently know, here are two low-risk options for the next ten minutes.”

а не:

> “The system has determined your optimal nervous-system trajectory for today.”

### Causal inference — важнее части exotic mathematics

Для SF × CW causal inference должна быть core formal layer.

Observation:

\[
P(Y\mid X)
\]

не равно intervention:

\[
P(Y\mid do(X))
\]

Поэтому:

> “после meditation пользователь чувствовал себя лучше”

не должно автоматически превращаться в:

> “meditation caused the improvement”.

Для personal adaptation лучше использовать:

- randomized micro-trials;
- crossover designs;
- N-of-1 experiments;
- interrupted time series;
- context-stratified analysis;
- explicit confounders.

Это зачастую важнее внедрения full active inference.

### Information theory — для epistemic actions

Можно оценивать experiment/action не только expected outcome, но и expected information gain:

\[
U(a)
=
\mathbb E[\text{goal value}\mid a]
+
\lambda I(Z;O\mid a)
-
C(a)
-
R(a)
\]

где:

- \(I\) — information gain;
- \(C\) — effort/cost;
- \(R\) — risk.

Это active-inference-like engineering objective, но специально сформулированный для SF, а не заявление о brain ontology. Формальная связь epistemic value с expected information gain является центральной в active-inference formulations. citeturn16search1turn16search2

### Evolutionary/QD layer

Для практик/agents можно хранить repertoire:

\[
Archive[b] =
\arg\max_{v \in \text{cell}(b)} q(v)
\]

где:

- \(b\) — behaviour descriptor;
- \(q\) — quality under constraints.

Например для CenterWay:

```text
descriptor:
    duration × intensity × modality × context

quality:
    user-reported usefulness
    + adherence
    + predicted/observed fit
    - adverse events
```

Это намного безопаснее, чем:

```text
maximize calm_score
```

MAP-Elites именно поэтому интересен: его output — множество качественно различных high-performing solutions across a chosen behavioural space. citeturn17academia48

Но personal adaptation v0.1 лучше начать с Bayesian/N-of-1 selection, а не с evolutionary search. Эволюционные методы становятся полезнее после накопления достаточного количества variants и reliable evaluation.

### Active inference — medium-priority candidate

Рекомендуемая роль:

```text
experiment selection
policy simulation
uncertainty-sensitive planning
```

Нерекомендуемая роль:

```text
universal system objective
```

Причина — и theoretical controversy вокруг EFE derivation, и empirical sensitivity implementations. citeturn16search3turn16search11

### Category theory — пока не нужна

Она может позже формализовать:

- compositional contexts;
- transformations between projections;
- schema mappings;
- functor-like views of shared structures.

Но для v0.1 это premature abstraction.

Graph theory + typed events + causal models + Bayesian inference дают намного больше непосредственной ценности.

### Рейтинг математических кандидатов

| Formalism | SF | CenterWay | Priority |
|---|---:|---:|---:|
| Typed graph / hypergraph | ★★★★★ | ★★★ | **Core** |
| Event calculus / temporal model | ★★★★★ | ★★★★★ | **Core** |
| Bayesian inference | ★★★★ | ★★★★★ | **Core** |
| Causal inference | ★★★★ | ★★★★★ | **Core** |
| State-space / dynamical systems | ★★★ | ★★★★★ | **Core** |
| Control / MPC | ★★★ | ★★★★ | **High, constrained** |
| Information theory | ★★★★ | ★★★ | **High** |
| Active inference | ★★★ | ★★★ | **Experimental** |
| Evolutionary/QD | ★★★ | ★★★ | **Later experimental** |
| Network multiscale analysis | ★★★ | ★★ | **Research** |
| Category theory | ★★ | ★ | **Not v0.1** |
| Literal fractal mathematics | ★ | ★ | **Only if data justify** |

### Два coupled loops

**Loop S — symbolic**

```text
Observe
→ Encode evidence
→ Model
→ Hypothesize
→ Predict / Simulate
→ Human decision
→ Act
→ Evaluate
→ Update model
```

**Loop E — embodied**

```text
Sense
→ Report / Measure
→ Construct state profile
→ Set transition intention
→ Select practice
→ Enact
→ Experience
→ Reflect / Measure
→ Update adaptation model
```

Сцепка:

```text
             ┌─────────────────────────────┐
             │                             │
             ▼                             │
        SYMBOLIC LOOP                      │
 Observation → Field → Hypothesis          │
                    ↓                      │
              Practice choice              │
                    ↓                      │
        EMBODIED LOOP                      │
 State → Enactment → Experience            │
                    ↓                      │
           New observation ────────────────┘
```

Meta-loop:

```text
Model S improves selection in E
            ↓
E produces differentiated lived evidence
            ↓
evidence calibrates S
            ↓
S improves experiment design
            ↓
experiments improve S and E
            ↓
validated agent/process changes
            ↓
better improvement machinery
```

### Когда использовать слова feedback, learning, adaptation, evolution

| Термин | Минимальное условие |
|---|---|
| **Feedback** | output влияет на последующий input |
| **Learning** | experience сохраняется и изменяет future model/policy |
| **Adaptation** | behaviour/configuration меняется под context |
| **Development** | появляются устойчивые новые capabilities/repertoires |
| **Evolution** | variation + selection + retention/lineage |
| **Co-evolution** | изменения одной adaptive system меняют selection landscape другой |
| **Recursive self-improvement** | изменяется сам mechanism, который создаёт/оценивает следующие улучшения |

Следовательно ваш coupled loop **сразу является feedback system**, может стать learning/adaptive system, но **не является автоматически evolutionary или recursively self-improving**.

Это distinction критично, чтобы не превращать инженерное описание в mythic language.

## SymbolField и CenterWay: архитектурные последствия

Исходная SymbolField ontology близка к хорошей spatial/compositional foundation, но ей не хватает explicit epistemic layer.

### Что делать с текущими primitives

| Primitive | Решение | Причина |
|---|---|---|
| **Realm** | сохранить как optional large-scale namespace/domain | organizational, не epistemic |
| **Space** | сохранить и усилить recursive composition | context/container |
| **Node** | сохранить как field/UI object, но не считать universal ontology entity | Node — representation |
| **Link** | превратить в typed relation | relation needs semantics/provenance |
| **State** | **разделить** | сейчас слишком ambiguous |
| **Event** | существенно усилить | backbone temporal/reality feedback |
| **View** | сохранить | projection |
| **Perspective** | сделать first-class | observer/model-relative interpretation |
| **Modality** | сделать first-class | source differences |
| **Provenance** | сделать mandatory for derived objects | epistemic integrity |
| **Epistemic Status** | first-class | observation ≠ hypothesis |
| **Agent** | identity + capability + provenance | не путать actor и authority |
| **Portal** | сохранить как navigation/projection bridge | spatial semantics |

### Новые primitives

Самые важные additions:

```text
Referent
Observation
Measurement
Artifact
Claim
Hypothesis
Prediction
Interpretation
Model
Simulation
Goal / Preference
Action / Intervention
PracticeDefinition
PracticeSession
Outcome
Experiment
Evidence
Consent
AuthorityGrant
Revision / Lineage
```

Особенно нужен **Referent/Subject**.

Почему?

Потому что:

```text
Person "Alice"
```

и:

```text
Node representing Alice
```

не одно и то же.

Одна Person может иметь:

- profile node;
- timeline node;
- organization view;
- agent projection;
- public representation.

`Node` должен **represent / bind to referent**, а не становиться referent.

### State надо декомпозировать

Вместо одного `State`:

```text
ObservedState
ReportedState
MeasuredState
EstimatedState
DesiredState
SimulatedState
```

Это решает огромный класс epistemic bugs.

Например:

```text
ReportedState:
"I feel unusually activated"

MeasuredState:
HR = X from device Y

EstimatedState:
model suggests high activation

DesiredState:
calm-alert

SimulatedState:
predicted after 8 min practice
```

Нельзя делать:

```text
State = anxious
```

без указания происхождения.

### Link должен стать typed assertion edge

У Link нужны как минимум:

```text
relation_type
direction
temporal_scope
epistemic_status
provenance
confidence semantics
created_by
evidence_refs
```

Например:

```text
A --correlates_with--> B
A --reported_by--> Person
A --causes?--> B
A --predicted_to_affect--> B
A --derived_from--> C
A --contradicts--> D
```

`causes` и `correlates_with` не могут быть одним generic edge.

### Event — фактически temporal backbone системы

Рекомендуется мыслить Field не только как graph:

\[
F = (Objects,Relations)
\]

а как:

\[
F_t =
\text{projection of event/history stream at time }t
\]

Иными словами:

```text
Event log
   ↓
current graph
   ↓
timeline
   ↓
state estimate
   ↓
agent context
```

разные Views могут быть projections одного history.

Это также облегчает undo, provenance и recursive evaluation.

### SymbolField как world model: близко, но не то же самое

Machine world-model approaches обычно обучают compressed latent dynamics, которые позволяют прогнозировать будущие состояния и планировать через imagined trajectories. Ha & Schmidhuber’s World Models были ранним влиятельным примером такого latent compressed model; более современные systems вроде DreamerV3 используют learned world models для imagined rollouts и control across широкого диапазона tasks. citeturn3search0turn2search31

SymbolField должен быть **другим классом world model**:

| Neural world model | SymbolField |
|---|---|
| mostly latent | largely explicit |
| optimized for prediction/control | optimized also for human interpretation |
| machine-shaped | human + agent shaped |
| single learned representation | plural models |
| provenance often external | provenance canonical |
| editing latent state difficult | direct semantic editing |
| uncertainty often model-specific | epistemic typing across models |
| task objective fixed | goals can be deliberated |

Поэтому правильнее:

> **SymbolField is not “the world model”; it is a human-agent world-modelling substrate.**

Внутри него могут жить:

- causal model;
- Bayesian model;
- LLM interpretation;
- vector space;
- market simulator;
- visual-spatial model;
- latent world model.

Но ни один из них не должен владеть canonical truth.

### CenterWay domain model

Core sequence:

```text
StateProfile A
    ↓
TransitionIntent
    ↓
PracticeCandidate
    ↓
HumanSelection
    ↓
PracticeSession
    ↓
Experience / Measurements
    ↓
StateProfile B
    ↓
Reflection
```

Нужны отдельные objects:

**PracticeDefinition**

```text
name
modality
instructions
duration_range
intensity_range
evidence_profile
mechanism_hypotheses
safety_tier
stop_conditions
```

**PracticeSession**

```text
practice_definition_id
actual_duration
actual_variant
context
started_at
completed_at
user_changes
```

**StateProfile**

```text
reported_observations
measured_observations
estimated_dimensions
context
uncertainty
```

**StateTransition**

```text
state_before
intervention
state_after
time_window
candidate_confounders
causal_status
```

И принципиально:

> `StateTransition` не должен автоматически иметь `causedBy Practice`.

Сначала:

```text
occurred_after
```

и только после соответствующего evidence:

```text
estimated_effect_of
```

### Longitudinal rhythm

CenterWay должен представлять одновременно несколько timescales:

```text
seconds/minutes
    breath / attention / movement shift

hours
    work-rest cycles

days
    sleep / fatigue / social context

weeks
    practice adaptation

months
    habits / goals / developmental trajectories
```

Это multiscale dynamical architecture, а не один linear curriculum.

### CenterWay не должен оптимизировать “calm”

Постоянная минимизация arousal была бы плохой objective.

Sometimes:

- activation нужна для action;
- fatigue требует rest;
- uncertainty требует exploration;
- grief не является ошибкой regulator;
- excitement не является dysregulation;
- discomfort иногда связан с meaningful action.

Поэтому target:

\[
\text{desired transition}
\neq
\text{fixed ideal state}
\]

Пользователь может захотеть:

```text
scattered → focused
dull → energized
overactivated → settled
closed → socially available
tired → restful
ruminating → embodied
```

CenterWay становится **state-navigation environment**, а не homeostasis engine.

## Human-first agents, interoperability и safety boundaries

Принцип **Agent-pervasive, human-sovereign** должен быть enforceable на уровне permissions и data model.

Если это только UX slogan, он не выдержит pressure от automation.

### Agent ≠ authority

Предлагается разделить:

```text
AgentIdentity
AgentCapability
AuthorityGrant
ConsentGrant
Action
```

Agent может иметь capability:

```text
generate_practice_candidate
```

но не иметь authority:

```text
start_practice_without_user
```

Агент может:

```text
propose_db_migration
```

но не иметь:

```text
deploy_production_migration
```

### Распределённая agent architecture

| Agent | Функция | Write authority |
|---|---|---|
| **Capture Agent** | normalize incoming artifacts | evidence envelope only |
| **Epistemic Curator** | classify claim/observation/provenance | proposals |
| **Research Agent** | retrieve external evidence | cited evidence layer |
| **Analyst Agent** | detect patterns | interpretations only |
| **Model Agent** | predictions/state estimates | model output |
| **Simulation Agent** | counterfactual scenarios | sandbox |
| **CenterWay Composer** | candidate low-risk practices | recommendation |
| **Experiment Agent** | propose/randomize approved micro-experiments | protocol scope |
| **Evaluator Agent** | score predictions/outcomes | evaluation records |
| **Audit Agent** | search contradictions/epistemic pollution | alerts |
| **Software Agent** | propose code/tests/migrations | branch/sandbox |
| **Meta Agent** | propose agent changes | never own final deployment |

Особенно важно **развести generator и evaluator**.

DGM показывает ценность external empirical evaluation после self-modification; при переносе на SF evaluator ещё сильнее должен быть отделён от agent lineage, потому что human-facing metrics сложнее coding benchmarks. citeturn18academia48turn18academia49

### Irreversibility ladder

```text
L0 Read
L1 Analyse
L2 Draft
L3 Simulate
L4 Write reversible field object
L5 External reversible action
L6 Sensitive personal intervention
L7 Irreversible / public / financial / clinical action
L8 Modify security/governance/evaluator
```

Чем выше уровень:

\[
\text{more explicit human authorization}
+
\text{stronger logging}
+
\text{independent verification}
\]

Levels 7–8 не должны иметь unattended autonomy.

### Shared field не означает universal write access

Лучше:

```text
Canonical Field
├─ Observed evidence
├─ Human-authored objects
├─ Agent proposal layer
├─ Validated derived layer
└─ Published layer
```

Agent proposal не должен мгновенно становиться canonical human knowledge.

Это один из лучших способов предотвращения **agent-generated epistemic pollution**.

### Autonomy-preserving UX

Исследования human–AI feedback показывают, что люди могут постепенно внутренизировать AI bias, часто не замечая полного масштаба влияния. citeturn19search1

Следовательно интерфейс должен периодически:

- показывать source vs agent interpretation;
- давать counterevidence;
- спрашивать собственное человеческое judgment **до** AI answer в важных задачах;
- делать uncertainty visible;
- не использовать anthropomorphic confidence;
- сохранять возможность “manual mode”;
- измерять unaided performance после AI use.

CHI 2025 также показывает, что GenAI может перераспределять cognitive effort от information gathering к verification/integration/stewardship; это значит, что хороший SF должен сделать verification дешёвой и видимой, а не скрывать её. citeturn19search0

### SF ↔ CenterWay interoperability

Из предложенных вариантов оптимален **hybrid B + D + E**.

| Вариант | Плюсы | Минусы | Verdict |
|---|---|---|---|
| A. One DB + ontology | быстро, простые joins | extreme semantic/privacy coupling | только физически для prototype |
| B. Bounded contexts + APIs | clear ownership | немного больше contracts | **да** |
| C. Separate systems + MCP | удобно agents/tools | MCP не должен быть source-of-truth protocol | edge integration |
| D. Event interoperability | loose coupling, auditability | требует event discipline | **да** |
| E. Shared Event/State protocol | minimal semantic contract | protocol versioning | **да** |

Рекомендуемая структура:

```text
                 SymbolField Core
        Objects / Events / Provenance / Claims
                       │
               Shared Protocol
                       │
       ┌───────────────┴───────────────┐
       │                               │
 SymbolField services             CenterWay
 graph / docs / agents      state / practice / experiment
       │                               │
       └────────── domain events ──────┘
```

**SymbolField owns:**

```text
identity
generic Event
Artifact
Observation
Claim
Provenance
Agent
View
Space
Access/authority primitives
```

**CenterWay owns:**

```text
StateProfile semantics
PracticeDefinition
PracticeSession
TransitionIntent
Embodied safety policy
Adaptation model
```

Это предотвращает типичную mistake:

> “поскольку CenterWay State отображается в SF, SF Core теперь должен понимать physiology и wellness semantics”.

Не должен.

SF должен понимать **typed object + provenance + events**.

CenterWay — domain interpretation.

### MCP

MCP-подобный interface полезен как **agent-facing projection**:

```text
Agent
↕
MCP/tools
↕
SF/CW bounded services
```

Но internal domain contract лучше не делать зависимым от конкретного agent protocol.

MCP — adapter.

Shared Event/State protocol — domain boundary.

### Wellness ↔ clinical boundary

CenterWay безопаснее проектировать по intended use, а не только disclaimer.

FDA’s current January 2026 General Wellness guidance указывает, что software intended for maintaining/encouraging healthy lifestyle и unrelated to diagnosis, cure, mitigation, prevention or treatment of disease не входит в соответствующую device category; low-risk wellness products имеют отдельную policy treatment. citeturn21search0turn21search3

Поэтому safe CenterWay language:

```text
notice
reflect
explore
support
practice
regulate attention
relax
prepare for sleep
increase subjective readiness
```

Risky transition into medical territory:

```text
diagnose anxiety disorder
detect PTSD
treat depression
correct autonomic dysfunction
prescribe intervention for disease
predict medical deterioration
```

Это не означает, что wellness system автоматически нерегулируем: classification зависит от functionality, claims и jurisdiction. FDA отдельно продолжает обновлять digital-health guidance. citeturn21search5turn21search9

### Psychophysical data — sensitive by default

GDPR Article 9 прямо относит data concerning health к special categories; biometric data имеют special-category status в указанном Article 9 context, когда используются для uniquely identifying a natural person. citeturn21search4turn21search8

Поэтому architectural posture должен быть сильнее формального минимума:

```text
private by default
purpose limitation
granular consent
separate sensitive domains
short retention where possible
export/delete
agent access scopes
no training reuse by default
```

В США FTC’s updated Health Breach Notification Rule отдельно охватывает многие health apps/PHR-related technologies вне HIPAA; FTC подчёркивает applicability к apps, которые технически способны собирать health data из multiple sources. citeturn20search1turn20search2

### EU AI Act: состояние на август 2026

После изменений 2026 года current EU implementation schedule различает уже действующие general obligations и более поздние high-risk deadlines; European Commission указывает high-risk Annex III rules с декабря 2027 и правила для AI embedded in regulated physical products с августа 2028. citeturn20search0turn20search5

Следовательно нельзя проектировать CenterWay под старую assumption “весь AI Act вступает одной датой”. Regulatory classification нужно повторно проверять перед clinical/biometric expansion.

### Concrete safety guardrails

Самая безопасная архитектура имеет **несколько независимых guardrail layers**.

| Риск | Guardrail |
|---|---|
| Cognitive outsourcing | manual/unaided mode, reflection-before-answer |
| AI dependency | periodic tool withdrawal tests |
| False authority | evidence/provenance visible by default |
| Persuasive personalization | no covert optimization of compliance |
| State misclassification | `estimated` never displayed as observed fact |
| Pseudo-medical claims | wellness lexicon + clinical policy boundary |
| Sensitive data | field-level access + minimization |
| Surveillance | no ambient inference by default |
| Poor proxy optimization | multi-objective evaluator + human veto |
| Self-reinforcing belief | contradiction agent + external evidence |
| Epistemic pollution | agent proposal namespace |
| Recursive modification | sandbox → tests → shadow → human approval |
| Metric gaming | held-out and rotating evaluators |
| Irreversible actions | explicit approval |
| Biometric overconfidence | measurement provenance/calibration |
| Spiritual/medical conflation | explicit evidence-layer typing |

### CenterWay safety tiers

```text
Tier 0
Reflection / journaling / check-in

Tier 1
Low-intensity general wellness practices

Tier 2
Personalized wellness practice
with explicit context and stop conditions

Tier 3
Symptoms / condition-specific interpretation
→ no autonomous recommendation

Tier 4
Clinical / emergency concern
→ professional or emergency pathway
```

Для v0.1 я бы исключил agent-generated high-intensity breath manipulation, prolonged retention, diagnosis-like interpretation и any intervention framed as treatment.

### Evidence-aware contemplative design

Breathwork имеет promising but modest average evidence, а не universal effect. citeturn22search0

Mindfulness может изменять self-reported interoceptive experience, но это не лицензия на statement “system objectively improves interoception”. citeturn22search2

Поэтому у каждого PracticeDefinition должен быть `EvidenceProfile`:

```text
evidence_type
population
outcome
effect_direction
effect_size_if_known
risk_of_bias
confidence
known_limits
clinical_boundary
last_reviewed
```

Это превращает CenterWay из wellness-content catalogue в **epistemically governed practice environment**.

## Реалистичный v0.1, experimental protocol и falsification

Хорошая новость: текущий SymbolField уже содержит существенную часть substrate, и для v0.1 **не требуется фундаментальная перестройка**.

Текущий repository описывает SymbolField как spatial graph canvas для clustered knowledge spaces; codebase — React + TypeScript, а project structure уже включает specs и agent workflows. README также показывает project-owned persistence endpoints для docs, versions и links. fileciteturn2file0L2-L2

Текущий package manifest показывает React/TypeScript/Vite stack, Supabase JS, Yjs, Zod и AI SDK, а также уже довольно развитый набор persistence, migration, compatibility, design-system, fractal-runtime и smoke-test gates. fileciteturn3file0L2-L2

Особенно релевантен существующий agent path: `runScopedAgentReview` уже концептуально ограничивает review scope, работает read-only, различает Station/Space/Node/Daily/Period, читает bounded snapshots, использует retrieval catalog и способен freeze/replay context через `AgentContextManifest`. То есть ядро идеи “agent reads bounded projection of shared field rather than arbitrary hidden universe” уже существует. fileciteturn5file0L2-L2

### v0.1: additive architecture

Не переписывать Node/Space engine.

Добавить epistemic layer рядом.

```text
CURRENT
Space
Node
Link
Agent Review
Docs

        +

v0.1
FieldEvent
EvidenceEnvelope
Observation
Claim
Provenance
CenterWay StateSample
PracticeSession
Experiment
```

Предлагаемые persistence domains:

```text
field_events
field_evidence
field_claims
field_relations

cw_state_observations
cw_practice_definitions
cw_practice_sessions

experiments
experiment_outcomes

agent_proposals
agent_evaluations
```

Названия условны: важно semantic separation, а не конкретные table names.

### Минимальный TypeScript contract

```ts
type EpistemicKind =
  | "observation"
  | "first_person_report"
  | "measurement"
  | "testimony"
  | "interpretation"
  | "claim"
  | "hypothesis"
  | "prediction"
  | "causal_claim"
  | "simulation";

type Modality =
  | "text"
  | "voice"
  | "image"
  | "video"
  | "gesture"
  | "movement"
  | "biometric"
  | "location"
  | "interaction"
  | "external_dataset";

interface EvidenceEnvelope {
  id: string;
  kind: EpistemicKind;
  modality: Modality;
  referentIds: string[];

  observedAt?: string;
  recordedAt: string;

  sourceAgentId: string;
  perspectiveId?: string;

  artifactRef?: string;
  derivedFrom: string[];

  epistemicStatus:
    | "reported"
    | "measured"
    | "inferred"
    | "hypothesized"
    | "predicted"
    | "simulated"
    | "contested"
    | "retracted";

  uncertainty?: Record<string, unknown>;

  consentScope?: string;
  accessScope: string;

  revisionOf?: string;
}
```

Ключ: `epistemicStatus` не кодируется UI colour и не прячется внутри arbitrary JSON.

### Node как projection binder

Можно оставить текущую визуальную модель:

```text
Node
├─ spatial position
├─ visual style
└─ semanticRef → FieldObject
```

Тогда один epistemic object можно показать:

- на canvas;
- timeline;
- state dashboard;
- table;
- agent context;
- CenterWay trajectory.

Это минимально инвазивный путь к shared field.

### Event-first update

При изменении важных semantic objects сначала фиксируется event:

```text
ObservationCaptured
ClaimCreated
ClaimContested
PredictionRegistered
PracticeStarted
PracticeCompleted
OutcomeRecorded
ModelUpdated
AgentProposalCreated
AgentProposalApproved
```

Current state можно продолжать хранить удобным способом, но critical history не должен зависеть только от mutable latest snapshot.

### CenterWay v0.1

Не строить “AI wellness coach”.

Строить маленькую loop laboratory:

```text
Check-in
    ↓
Choose desired transition
    ↓
2–4 safe candidate practices
    ↓
User chooses
    ↓
Practice
    ↓
Post check-in
    ↓
Reflection
    ↓
Later follow-up
```

State capture достаточно начать с:

```text
valence
activation
attention
perceived_energy
body_tension
sleepiness
social/context field
free-text / voice reflection
```

Optional biometrics можно добавить позже как отдельный Measurement channel.

### Agent v0.1

Существующий read-only scoped review хорошо подходит как foundation. fileciteturn5file0L2-L2

Первый evolutionary step не должен быть “agent edits production”.

Сначала:

```text
Agent observes field
↓
makes explicit hypothesis
↓
registers prediction
↓
suggests experiment/practice
↓
human approves
↓
outcome captured
↓
independent evaluator scores
```

Это уже полноценный recursive learning loop.

### Experimental programme

| Experiment | Design | Основная metric | Что он проверяет |
|---|---|---|---|
| **Epistemic typing** | baseline graph vs typed field | classification error, provenance recovery | уменьшается ли confusion Observation/Hypothesis |
| **Prediction ledger** | predictions registered before outcomes | Brier/log score + calibration | учится ли system реально предсказывать |
| **CenterWay micro-trials** | randomized/crossover low-risk practices | within-person state change | существует ли repeatable transition signal |
| **Personalization** | personalized selector vs simple baseline | held-out effect/adherence | есть ли value beyond self-selection |
| **Agency preservation** | answer-first AI vs reflection-first AI | unaided later performance, override | помогает ли AI без dependency |
| **Epistemic contamination** | controlled false claim injection | downstream propagation | насколько легко field amplifies falsehood |
| **Agent variation archive** | fixed agent vs variant archive | held-out quality + cost | даёт ли DGM/QD idea real value |
| **Multiscale test** | graph coarse-graining | scaling stability | действительно ли SF self-similar |
| **Coupled-loop test** | SF-only vs SF×CW | prediction/outcome improvement | даёт ли embodiment extra evidence |

### Experiment с CenterWay

Для безопасных general-wellness practices можно использовать repeated N-of-1 structure:

```text
baseline
↓
randomly selected approved practice A/B/control
↓
immediate observation
↓
delayed observation
↓
repeat under different contexts
```

Например, objective не:

> “лечит anxiety”

а:

> “для этого пользователя и этого context practice A чаще связана с переходом от self-reported scattered state к focused state в ближайшие 30 минут”.

Это намного более falsifiable и безопасно.

### Prediction registry

Перед intervention model записывает:

```text
prediction_id
model_version
predicted outcome
probability / interval
time horizon
context assumptions
evidence used
```

После результата нельзя редактировать prediction — создаётся outcome и evaluation.

Так исчезает огромная часть retrospective storytelling.

### Agency experiment

Самый важный experiment не про “user satisfaction”.

Нужно проверить:

\[
\text{Does assistance increase unaided human capability?}
\]

Сравнить:

**Mode A**

```text
Question
→ AI answer
→ human judgement
```

с:

**Mode B**

```text
Question
→ human provisional judgement
→ AI counterarguments/evidence
→ human final judgement
```

Измерять позже:

- unaided reasoning;
- source recall;
- calibration;
- willingness to override AI;
- performance после временного удаления assistant.

Это прямо отвечает на risk cognitive offloading, который current HCI research уже начинает фиксировать. citeturn19search0

### Controlled recursive agent evolution

DGM-inspired pipeline:

```text
Parent agent
↓
Variation
↓
Static validation
↓
Sandbox tests
↓
Held-out task suite
↓
Epistemic safety suite
↓
Human-agency suite
↓
Archive
```

Score нельзя делать одним scalar.

Например:

\[
Q=
(q_{task},
q_{epistemic},
q_{agency},
q_{safety},
q_{cost})
\]

Variant может быть быстрее, но хуже по epistemic correctness — он не “улучшился”.

Huxley-Gödel results особенно поддерживают осторожность к one-dimensional performance proxy: current performance и future improvement potential могут расходиться. citeturn18academia49

Goodhart-type risks здесь не edge case: оптимизируемый proxy может перестать отражать intended objective, особенно под сильным optimization pressure; современные taxonomy различают несколько механизмов такого failure. citeturn22search8

### Falsification criteria

Гипотеза SF × CenterWay должна считаться **частично или полностью опровергнутой**, если происходят следующие результаты.

| Hypothesis | Falsifying result |
|---|---|
| Epistemic typing improves field quality | users/agents продолжают путать observation и inference, а complexity резко растёт |
| Shared Field improves cooperation | separate simple tools outperform it по accuracy/effort/latency |
| CenterWay state-space is useful | trajectory model не предсказывает outcomes лучше простого diary/history |
| Personal adaptation matters | generic/user-chosen practice стабильно не хуже personalization |
| Coupled SF×CW loop adds value | embodied data не улучшает decisions/predictions |
| Agents improve cognition | unaided human performance систематически падает |
| Provenance prevents pollution | false agent claims всё равно быстро становятся accepted facts |
| Recursive improvement works | improvements исчезают на held-out evaluation |
| Evolutionary repertoire helps | archive/QD complexity не превосходит simple versioning |
| “Fractal SF” is real | нет robust scaling/self-similarity under coarse-graining |
| Multimodal field preserves evidence | transcription/fusion уничтожает modality-specific information |
| Human sovereignty is preserved | users перестают формировать goals или почти не override AI |
| Wellness boundary is viable | полезная система неизбежно требует diagnosis/treatment claims |
| System benefits exceed complexity | maintenance, privacy и cognitive overhead превышают measured gains |

Самый сильный falsification criterion:

> **Если simpler architecture достигает тех же empirical outcomes с меньшей epistemic, privacy и cognitive complexity — recursive embodied field hypothesis не оправдана.**

Не нужно защищать красивую ontology от данных.

## Evidence matrix и research bibliography

Ниже — ядро библиографии, сгруппированное по тому, насколько непосредственно оно должно влиять на architecture. Приоритет отдаётся foundational/primary peer-reviewed work; preprints помечены явно.

| Область / источник | Тип evidence | Качество для данной архитектуры | Главный вывод |
|---|---|---|---|
| **Friston / active inference and learning** | peer-reviewed computational theory | **High formal / medium biological interpretation** | pragmatic + epistemic policy selection; useful decision formalism citeturn16search10 |
| **Millidge et al., “Whence the Expected Free Energy?” 2021** | peer-reviewed mathematical critique | **High** | EFE exploration не следует тривиально из future VFE; важное ограничение citeturn16search3 |
| **Active-inference attention models** | peer-reviewed computational models | **Medium–High** | precision weighting и epistemic information seeking формализуемы citeturn16search2 |
| **Deep active-inference critique, 2024** | peer-reviewed computational experiments | **Medium** | некоторые EFE implementations дают degenerate exploration citeturn16search11 |
| **Kirchhoff et al., Markov blankets / autonomy** | theoretical biology | **Medium conceptual** | formal boundary ideas interesting for autonomy discussions citeturn1search1 |
| **Raja et al., critique of FEP generality** | peer-reviewed theoretical critique | **High for caution** | universal interpretations Markov blankets/FEP disputed citeturn1search12 |
| **Seth & Friston, interoceptive inference** | theoretical/review neuroscience | **Medium** | useful computational account of interoception, not reductive truth citeturn0search1 |
| **Litwin, predictive-processing critique, 2020** | peer-reviewed philosophy/cognitive science | **High conceptual** | PP more defensible as research programme than unified theory citeturn18search2 |
| **Varela/Thompson/Rosch lineage; embodied cognition** | foundational theoretical tradition | **High conceptual** | brain–body–world coupling must not be eliminated from cognition citeturn13search1 |
| **De Jaegher & Di Paolo, Participatory Sense-Making, 2007** | foundational peer-reviewed theory | **High conceptual** | social interaction can participate in meaning formation citeturn12search3 |
| **Clark & Chalmers, Extended Mind, 1998** | foundational philosophy | **High conceptual** | external artifacts can participate functionally in cognition citeturn12search9 |
| **Maturana, Organization of the Living / autopoiesis** | foundational theoretical biology | **High for conceptual boundary** | biological self-production ≠ ordinary software self-modification citeturn13search8 |
| **Zeleny, formal autopoiesis model** | formal systems work | **Medium** | operational organization/self-production can be formalized but remains biologically loaded citeturn13search0 |
| **Ashby, requisite variety tradition** | foundational cybernetics | **High formal/conceptual** | regulator repertoire must match relevant disturbance variety citeturn1search11turn1search23 |
| **Kelso / metastability** | peer-reviewed dynamical-systems/neuroscience tradition | **Medium–High** | state dynamics need not be static equilibria; metastable regimes are useful concept citeturn12search14 |
| **Rossi et al., metastability perspective** | neuroscience/dynamical systems perspective | **Medium** | metastable regimes as long-lived transient dynamics citeturn12academia47 |
| **Schmidhuber, Gödel Machine** | foundational theoretical computer science | **High theoretical / low practical** | self-rewrite tied to explicit utility and formal proof citeturn18search5 |
| **Zhang et al., Darwin Gödel Machine, 2025** | **preprint**, empirical coding agents | **Promising / provisional** | archive + variation + empirical evaluation can improve self-modifying coding agents citeturn18academia48 |
| **Huxley-Gödel Machine, 2025** | **preprint** | **Provisional but highly relevant** | current benchmark performance may misrepresent future improvement potential citeturn18academia49 |
| **Red Queen Gödel Machine, 2026** | **preprint** | **Very early** | co-evolution of evaluators addresses non-stationary objectives citeturn18academia51 |
| **Lehman & Stanley, novelty search, 2011** | peer-reviewed evolutionary computation | **High algorithmic** | objective-only search can be deceptive; novelty can reveal stepping stones citeturn17search3 |
| **Mouret & Clune, MAP-Elites, 2015** | foundational QD work | **High algorithmic** | maintain diverse high-performing repertoire rather than one optimum citeturn17academia48 |
| **Pugh, Soros & Stanley, Quality Diversity, 2016** | peer-reviewed | **High algorithmic** | local quality + global behavioural diversity is distinct from simple optimization citeturn17search10 |
| **Ha & Schmidhuber, World Models, 2018** | foundational ML paper/preprint lineage | **High historical/technical** | latent predictive models enable imagined interaction/planning citeturn3search0 |
| **DreamerV3 / world-model control** | peer-reviewed contemporary AI | **High empirical for bounded AI tasks** | learned world models can support broad model-based control citeturn2search31 |
| **V-JEPA 2, 2025** | **preprint/current AI** | **Promising / provisional** | latent video world modelling and action-conditioned planning extend beyond symbolic models citeturn3search3 |
| **Glickman & Sharot, Human–AI feedback, 2025** | multi-experiment peer-reviewed, n=1,401 | **High empirical** | recursive AI-human interaction can amplify small biases citeturn19search1 |
| **Lee et al., GenAI and critical thinking, CHI 2025** | peer-reviewed survey, n=319 / 936 examples | **Moderate** | greater AI confidence associated with less reported critical-thinking engagement; not causal proof citeturn19search0 |
| **Fincham et al., breathwork meta-analysis, 2023** | meta-analysis of RCTs | **Moderate** | small–medium stress effects, moderate risk of bias citeturn22search0 |
| **Treves et al., mindfulness/interoception meta-analysis, 2025** | preregistered meta-analysis, 29 RCTs | **Moderate–High for self-report outcome** | small–medium change in self-reported interoception; not equivalent to objective accuracy citeturn22search2 |
| **Yoga/stress systematic review** | systematic review/meta-analysis | **Low–Moderate** | promising effects but heterogeneous/limited certainty citeturn7search6 |
| **Veit, Model Pluralism** | philosophy of science | **High conceptual** | multiple models may be required for complex targets citeturn11search2 |
| **W3C PROV-O / PROV-DM** | authoritative technical standard | **High technical** | Entity–Activity–Agent + derivation/generation provide mature provenance basis citeturn15search5turn15search4 |
| **Encyclopedia of Mathematics, fractals** | authoritative mathematical reference | **High definitional** | fractality requires stronger properties than recursive nesting citeturn14search4 |
| **Fronczak et al., fractal complex networks, 2024** | peer-reviewed network science | **High for measurement approach** | network fractality can be tested through self-similarity/scaling under coarse-graining citeturn14search16 |
| **Manheim & Garrabrant, Goodhart variants** | theoretical taxonomy | **Medium conceptual** | proxy optimization has multiple distinct failure modes citeturn22search8 |
| **FDA General Wellness Guidance, Jan 2026** | official regulatory guidance | **High current authority for US positioning** | healthy-lifestyle software unrelated to diagnosis/treatment occupies distinct wellness boundary citeturn21search0 |
| **GDPR Article 9** | binding EU regulation | **High legal authority** | health data and specified biometric uses are special-category personal data citeturn21search4 |
| **EU Commission AI Act implementation, Aug 2026** | official current guidance | **High current authority** | implementation is staged; high-risk deadlines extend beyond August 2026 citeturn20search0turn20search5 |
| **FTC Health Breach Notification Rule** | official US regulation/guidance | **High legal authority** | health apps outside HIPAA may still carry health-data breach duties citeturn20search1 |

**Fundamental synthesis.** Научно наиболее defensible ядро SF × CenterWay — не Free Energy Principle, не predictive processing и не fractality. Ядро образуют **partial observability + provenance + typed epistemology + dynamical state estimation + intervention/feedback + causal experimentation + human–AI co-adaptation + constrained evolutionary search**. Active inference, enactivism, autopoiesis и open-ended evolution затем дают дополнительные lenses, но не должны становиться догмой. citeturn16search3turn13search1turn18academia48

**Reality model.**

\[
\boxed{
\text{Reality}
\rightarrow
\text{perspectival observations}
\rightarrow
\text{typed evidence}
\rightarrow
\text{plural field models}
\rightarrow
\text{predictions / interpretations}
\rightarrow
\text{human-authorized interventions}
\rightarrow
\text{outcomes}
\rightarrow
\text{model comparison and revision}
}
\]

**SF implication.** SymbolField должен эволюционировать от spatial knowledge graph к **temporal, provenance-aware epistemic field**, где Node остаётся прекрасной interaction primitive, но перестаёт быть универсальным ontological atom.

**CenterWay implication.** CenterWay должен эволюционировать от возможной content/practice platform к **adaptive trajectory environment**, где `State A → Practice → State B` является experimentable transition, а не medical diagnosis.

**Coupled-loop implication.**

\[
\boxed{
\text{Cognition}
\leftrightarrow
\text{Embodiment}
\leftrightarrow
\text{Action}
\leftrightarrow
\text{World}
\leftrightarrow
\text{Evidence}
\leftrightarrow
\text{Learning}
}
\]

**Recursive-improvement implication.** Улучшаться могут модели, practice-selection policies, agents и software, но **скорость и автономность self-modification должны уменьшаться по мере роста irreversibility и systemic blast radius**. DGM-style variation/archive/evaluation здесь полезны как design principles, а не как лицензия на unattended self-editing. citeturn18academia48turn18academia49

**Human-first implication.** Человеческая agency сохраняется не тем, что AI “оставляет кнопку Reject”, а тем, что architecture структурно оставляет человеку authority over goals, meaning, consent, high-level evaluation и irreversible actions, а также проверяет способность человека функционировать вне системы. Human–AI feedback research показывает, что такая защита нужна именно на уровне loops, потому что bias и dependency могут возникать постепенно. citeturn19search1turn19search0

И, наконец, центральный вопрос можно сформулировать предельно жёстко:

> **Да, SymbolField × CenterWay можно построить как единую recursive embodied field architecture — если “единая” означает общий событийно-провенансный substrate, а не одну модель истины; “embodied” означает реальную связь с человеческим переживанием и действием, а не объявление AI телесным; “recursive” означает контролируемое улучшение через внешнюю проверку, а не бесконтрольный self-reference; “evolutionary” означает variation, retention, diversity и selection, а не маркетинговую метафору; и “human–agent” означает, что агенты расширяют repertoire человеческого восприятия и действия, не становясь владельцами человеческих целей.**

В таком виде центральная архитектурная гипотеза **не только возможна, но и внутренне coherent**. Её главный scientific test — не красота ontology, а более суровый вопрос:

\[
\boxed{
\text{Does the system become better calibrated to the world}
\;
\mathbf{and}
\;
\text{leave the human more capable and sovereign?}
}
\]

Если улучшается только первая часть — получается optimization system.

Если только вторая — reflective practice tool.

Если обе, причём feedback улучшает также сам механизм совместного learning без разрушения epistemic integrity, diversity и human agency, — тогда уже оправдано говорить о **developmental recursive embodied field architecture**.