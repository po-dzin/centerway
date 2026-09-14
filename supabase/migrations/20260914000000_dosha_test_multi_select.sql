-- Dosha test: a question may carry up to two chosen options.
--
-- Until v3 an attempt held exactly one row per question, and the table said so
-- with UNIQUE (attempt_id, question_id). A reader who recognises themselves in
-- two descriptions now marks both; the question's weight is split between them
-- in code (src/lib/dosha/doshaTest.ts, scoreDoshaChoices), so the score columns
-- stay integers and nothing else about the row changes.
--
-- What stays forbidden is choosing the same option twice in one attempt, and
-- two rows sharing an answer_order. The "at most two per question" rule lives
-- in the complete route, next to the other shape checks — a count constraint
-- here would need a trigger for a limit the product may still move.
--
-- Constraint names carry the table's earlier name (quiz_answers_*).

ALTER TABLE public.test_answers
  DROP CONSTRAINT IF EXISTS quiz_answers_attempt_id_question_id_key;

ALTER TABLE public.test_answers
  DROP CONSTRAINT IF EXISTS test_answers_attempt_id_question_id_key;

ALTER TABLE public.test_answers
  ADD CONSTRAINT test_answers_attempt_id_option_id_key UNIQUE (attempt_id, option_id);
