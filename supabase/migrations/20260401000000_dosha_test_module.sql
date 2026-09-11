-- CenterWay: Dosha Test module schema + seed
-- Run in Supabase SQL editor (public schema).

-- Result enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dosha_result_type') THEN
    CREATE TYPE public.dosha_result_type AS ENUM (
      'vata',
      'pitta',
      'kapha',
      'vata_pitta',
      'pitta_kapha',
      'vata_kapha',
      'tridosha'
    );
  END IF;
END $$;

-- Test definitions
CREATE TABLE IF NOT EXISTS public.test_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Questions
CREATE TABLE IF NOT EXISTS public.test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.test_definitions(id) ON DELETE CASCADE,
  order_index integer NOT NULL CHECK (order_index > 0),
  question_code text NOT NULL,
  question_text text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, question_code),
  UNIQUE (test_id, order_index)
);

-- Options
CREATE TABLE IF NOT EXISTS public.test_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  option_order integer NOT NULL CHECK (option_order > 0),
  option_code text NOT NULL,
  option_text text NOT NULL,
  mapped_dosha text NOT NULL CHECK (mapped_dosha IN ('vata', 'pitta', 'kapha')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, option_code),
  UNIQUE (question_id, option_order)
);

-- Attempts
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  test_id uuid NOT NULL REFERENCES public.test_definitions(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  source text NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'abandoned')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  current_question_index integer NOT NULL DEFAULT 0 CHECK (current_question_index >= 0),
  score_vata integer NOT NULL DEFAULT 0 CHECK (score_vata >= 0),
  score_pitta integer NOT NULL DEFAULT 0 CHECK (score_pitta >= 0),
  score_kapha integer NOT NULL DEFAULT 0 CHECK (score_kapha >= 0),
  result_type public.dosha_result_type NULL,
  result_payload_json jsonb NULL,
  reminder_sent_count integer NOT NULL DEFAULT 0 CHECK (reminder_sent_count >= 0),
  version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Answers
CREATE TABLE IF NOT EXISTS public.test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.test_questions(id) ON DELETE RESTRICT,
  option_id uuid NOT NULL REFERENCES public.test_options(id) ON DELETE RESTRICT,
  mapped_dosha text NOT NULL CHECK (mapped_dosha IN ('vata', 'pitta', 'kapha')),
  answer_order integer NOT NULL CHECK (answer_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id),
  UNIQUE (attempt_id, answer_order)
);

-- User profile snapshot
CREATE TABLE IF NOT EXISTS public.user_test_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.test_definitions(id) ON DELETE CASCADE,
  latest_completed_attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  active_result_type public.dosha_result_type NOT NULL,
  score_vata integer NOT NULL,
  score_pitta integer NOT NULL,
  score_kapha integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, test_id)
);

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.test_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_test_definitions_updated_at') THEN
    CREATE TRIGGER trg_test_definitions_updated_at
      BEFORE UPDATE ON public.test_definitions
      FOR EACH ROW EXECUTE FUNCTION public.test_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_test_questions_updated_at') THEN
    CREATE TRIGGER trg_test_questions_updated_at
      BEFORE UPDATE ON public.test_questions
      FOR EACH ROW EXECUTE FUNCTION public.test_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_test_options_updated_at') THEN
    CREATE TRIGGER trg_test_options_updated_at
      BEFORE UPDATE ON public.test_options
      FOR EACH ROW EXECUTE FUNCTION public.test_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_test_attempts_updated_at') THEN
    CREATE TRIGGER trg_test_attempts_updated_at
      BEFORE UPDATE ON public.test_attempts
      FOR EACH ROW EXECUTE FUNCTION public.test_set_updated_at();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_attempts_status ON public.test_attempts(status);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_id ON public.test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test_id ON public.test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_last_activity_at ON public.test_attempts(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_test_attempts_result_type ON public.test_attempts(result_type);
CREATE INDEX IF NOT EXISTS idx_test_answers_attempt_id ON public.test_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_test_answers_question_id ON public.test_answers(question_id);

-- RLS
ALTER TABLE public.test_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_test_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_definitions' AND policyname = 'Admins and Support can view test_definitions') THEN
    EXECUTE $p$ CREATE POLICY "Admins and Support can view test_definitions" ON public.test_definitions FOR SELECT USING (public.get_my_role() IN ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_definitions' AND policyname = 'Admins can manage test_definitions') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage test_definitions" ON public.test_definitions FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_questions' AND policyname = 'Admins and Support can view test_questions') THEN
    EXECUTE $p$ CREATE POLICY "Admins and Support can view test_questions" ON public.test_questions FOR SELECT USING (public.get_my_role() IN ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_questions' AND policyname = 'Admins can manage test_questions') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage test_questions" ON public.test_questions FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_options' AND policyname = 'Admins and Support can view test_options') THEN
    EXECUTE $p$ CREATE POLICY "Admins and Support can view test_options" ON public.test_options FOR SELECT USING (public.get_my_role() IN ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_options' AND policyname = 'Admins can manage test_options') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage test_options" ON public.test_options FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_attempts' AND policyname = 'Admins and Support can view test_attempts') THEN
    EXECUTE $p$ CREATE POLICY "Admins and Support can view test_attempts" ON public.test_attempts FOR SELECT USING (public.get_my_role() IN ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_attempts' AND policyname = 'Admins can manage test_attempts') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage test_attempts" ON public.test_attempts FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_answers' AND policyname = 'Admins and Support can view test_answers') THEN
    EXECUTE $p$ CREATE POLICY "Admins and Support can view test_answers" ON public.test_answers FOR SELECT USING (public.get_my_role() IN ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'test_answers' AND policyname = 'Admins can manage test_answers') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage test_answers" ON public.test_answers FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_test_profiles' AND policyname = 'Admins and Support can view user_test_profiles') THEN
    EXECUTE $p$ CREATE POLICY "Admins and Support can view user_test_profiles" ON public.user_test_profiles FOR SELECT USING (public.get_my_role() IN ('admin', 'support')) $p$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_test_profiles' AND policyname = 'Admins can manage user_test_profiles') THEN
    EXECUTE $p$ CREATE POLICY "Admins can manage user_test_profiles" ON public.user_test_profiles FOR ALL USING (public.get_my_role() = 'admin') $p$;
  END IF;
END $$;

-- Seed test definition
INSERT INTO public.test_definitions (slug, title, version, status)
VALUES ('dosha-test', 'Dosha Test', 'v1', 'active')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  version = EXCLUDED.version,
  status = EXCLUDED.status;

-- Seed questions
WITH qz AS (
  SELECT id FROM public.test_definitions WHERE slug = 'dosha-test' LIMIT 1
)
INSERT INTO public.test_questions (test_id, order_index, question_code, question_text, status)
SELECT qz.id, x.order_index, x.question_code, x.question_text, 'active'
FROM qz
JOIN (
  VALUES
    (1, 'q01', 'Визначте себе та оберіть ваш варіант відповіді:'),
    (2, 'q02', 'Не любите яку погоду найбільше?'),
    (3, 'q03', 'Як ви описали б своє травлення?'),
    (4, 'q04', 'Як швидко ви засвоюєте нову інформацію?'),
    (5, 'q05', 'Як ви оцінюєте свою пам''ять?'),
    (6, 'q06', 'Який емоційний стан вам ближчий?'),
    (7, 'q07', 'Що найбільш відповідає вашому травному ритму?'),
    (8, 'q08', 'Який у вас сон?'),
    (9, 'q09', 'Як ви переносите навантаження?'),
    (10, 'q10', 'Який опис волосся вам ближчий?'),
    (11, 'q11', 'Який стан шкіри вам більш типовий?'),
    (12, 'q12', 'Яке співвідношення ваги до зросту вам ближче?')
) AS x(order_index, question_code, question_text) ON TRUE
ON CONFLICT (test_id, question_code) DO UPDATE SET
  order_index = EXCLUDED.order_index,
  question_text = EXCLUDED.question_text,
  status = EXCLUDED.status;

-- Seed options
WITH q AS (
  SELECT qq.id AS question_id, qq.question_code
  FROM public.test_questions qq
  JOIN public.test_definitions qd ON qd.id = qq.test_id
  WHERE qd.slug = 'dosha-test'
)
INSERT INTO public.test_options (question_id, option_order, option_code, option_text, mapped_dosha)
SELECT q.question_id, o.option_order, o.option_code, o.option_text, o.mapped_dosha
FROM q
JOIN (
  VALUES
    ('q01', 1, 'q01_a1', 'Дієте і рухаєтесь швидко', 'vata'),
    ('q01', 2, 'q01_a2', 'Дієте і рухаєтесь з середньою швидкістю', 'pitta'),
    ('q01', 3, 'q01_a3', 'Дієте і рухаєтесь повільно', 'kapha'),
    ('q02', 1, 'q02_a1', 'Не любите холодну погоду', 'vata'),
    ('q02', 2, 'q02_a2', 'Не любите спекотну погоду', 'pitta'),
    ('q02', 3, 'q02_a3', 'Не любите сиру погоду', 'kapha'),
    ('q03', 1, 'q03_a1', 'Нерегулярне травлення, нерегулярний апетит', 'vata'),
    ('q03', 2, 'q03_a2', 'Сильне травлення', 'pitta'),
    ('q03', 3, 'q03_a3', 'Повільне травлення, помірний апетит', 'kapha'),
    ('q04', 1, 'q04_a1', 'Швидко вбираєте знання', 'vata'),
    ('q04', 2, 'q04_a2', 'Середній час вивчення', 'pitta'),
    ('q04', 3, 'q04_a3', 'Повільно сприймаєте інформацію', 'kapha'),
    ('q05', 1, 'q05_a1', 'Швидко забуваєте', 'vata'),
    ('q05', 2, 'q05_a2', 'Середня пам''ять', 'pitta'),
    ('q05', 3, 'q05_a3', 'Гарна пам''ять', 'kapha'),
    ('q06', 1, 'q06_a1', 'Тривога, страх', 'vata'),
    ('q06', 2, 'q06_a2', 'Гнів, агресія', 'pitta'),
    ('q06', 3, 'q06_a3', 'Спокій, рівновага', 'kapha'),
    ('q07', 1, 'q07_a1', 'Схильність до закрепів', 'vata'),
    ('q07', 2, 'q07_a2', 'М''який стул, схильність до діареї', 'pitta'),
    ('q07', 3, 'q07_a3', 'Нормальний стул, інколи схильність до закрепів', 'kapha'),
    ('q08', 1, 'q08_a1', 'Чуткий, поверхневий сон, 6-7 годин', 'vata'),
    ('q08', 2, 'q08_a2', 'Гарний сон, близько 8 годин', 'pitta'),
    ('q08', 3, 'q08_a3', 'Важкий, довгий сон з тривалим пробудженням', 'kapha'),
    ('q09', 1, 'q09_a1', 'Швидко втомлюєтесь, але швидко відновлюєтесь', 'vata'),
    ('q09', 2, 'q09_a2', 'Середня, планована витривалість', 'pitta'),
    ('q09', 3, 'q09_a3', 'Сильна витривалість, але з інертністю', 'kapha'),
    ('q10', 1, 'q10_a1', 'Хвилясте або ламке, може випадати, але швидко росте', 'vata'),
    ('q10', 2, 'q10_a2', 'Тонке, схильне до раннього посивіння', 'pitta'),
    ('q10', 3, 'q10_a3', 'Темне, густе волосся', 'kapha'),
    ('q11', 1, 'q11_a1', 'Суха шкіра, помітні судини та сухожилля', 'vata'),
    ('q11', 2, 'q11_a2', 'Шкіра чутлива до запалень/подразнень', 'pitta'),
    ('q11', 3, 'q11_a3', 'Масляниста, гладка шкіра', 'kapha'),
    ('q12', 1, 'q12_a1', 'Легке, струнке тіло, вага частіше нижча за середню', 'vata'),
    ('q12', 2, 'q12_a2', 'Середня статура та середня вага', 'pitta'),
    ('q12', 3, 'q12_a3', 'Щільна статура, вага частіше вище за середню', 'kapha')
) AS o(question_code, option_order, option_code, option_text, mapped_dosha)
ON o.question_code = q.question_code
ON CONFLICT (question_id, option_code) DO UPDATE SET
  option_order = EXCLUDED.option_order,
  option_text = EXCLUDED.option_text,
  mapped_dosha = EXCLUDED.mapped_dosha;
