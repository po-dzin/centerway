"use client";

type LessonHeaderProps = {
  title: string;
  subtitle: string;
};

type LessonPracticeProps = {
  steps: string[];
  duration: string;
  supportHint: string;
};

type LessonNextStepProps = {
  nextTitle: string;
  nextText: string;
  ctaHref: string;
  ctaLabel: string;
};

export function PilotLessonHeader({ title, subtitle }: LessonHeaderProps) {
  return (
    <section className="section">
      <div className="container reveal">
        <p className="eyebrow">CENTERWAY LESSON PILOT</p>
        <h1 style={{ marginTop: "0.75rem", maxWidth: "22ch" }}>{title}</h1>
        <p className="lead" style={{ maxWidth: "64ch" }}>{subtitle}</p>
      </div>
    </section>
  );
}

export function PilotLessonPractice({ steps, duration, supportHint }: LessonPracticeProps) {
  return (
    <section className="section section-muted">
      <div className="container reveal">
        <h2>Практичний блок</h2>
        <article className="pricing-card" style={{ gap: "1rem" }}>
          <p className="pricing-label">Тривалість</p>
          <p className="pricing-value">{duration}</p>
          <ol className="timeline" style={{ margin: 0 }}>
            {steps.map((step, idx) => (
              <li key={`${step}-${idx}`}>
                <span className="step-index">{idx + 1}</span>
                <div>
                  <p style={{ color: "var(--cw-text)" }}>{step}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="role-trust-note" style={{ marginTop: "0.5rem" }}>
            <p>{supportHint}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

export function PilotLessonNextStep({ nextTitle, nextText, ctaHref, ctaLabel }: LessonNextStepProps) {
  return (
    <section className="section">
      <div className="container reveal">
        <h2>{nextTitle}</h2>
        <div className="bio-card" style={{ gap: "1rem" }}>
          <p>{nextText}</p>
          <div>
            <a className="btn btn-primary" href={ctaHref}>
              {ctaLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
