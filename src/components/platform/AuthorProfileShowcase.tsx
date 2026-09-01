import { Icon } from "@/components/Icon";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { PlatformOfferCarousel } from "@/components/platform/PlatformOfferCarousel";
import type { StorefrontCard } from "@/lib/platform/offers";
import type { Author } from "@/lms-core";
import styles from "./AuthorProfileShowcase.module.css";
import { ConsultBoundary, ConsultFaq } from "@/components/platform/ConsultPageSections";
import { consultationSteps } from "@/components/platform/consultPageContract";

function courseCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} курс`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} курси`;
  return `${count} курсів`;
}

/** Public author identity and course showcase. */
export function AuthorProfileShowcase({ author, courses }: { author: Author; courses: StorefrontCard[] }) {
  return (
    <main>
      {author.background ? (
        <div
          className={styles.banner}
          aria-hidden="true"
          style={{ backgroundImage: `url("${author.background.src}")` }}
        />
      ) : null}
      <header className={author.background ? `${styles.hero} ${styles.heroWithBanner}` : styles.hero}>
        <div className={styles.identity}>
          {author.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.portrait} src={author.photo.src} alt={author.photo.alt} />
          ) : (
            <span className={styles.portraitFallback} aria-hidden="true">
              {author.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className={styles.identityCopy}>
            <p className={styles.label}>Профіль автора</p>
            <h1 className={styles.name}>{author.name}</h1>
            <div className={styles.statusLine}>
              {author.role ? <p className={styles.role}>{author.role}</p> : null}
              <span className={styles.courseCount}>{courseCountLabel(courses.length)}</span>
            </div>
          </div>
          {(author.experienceBadge || author.achievementBadge) ? <div className={styles.badges}>
            {author.experienceBadge ? <span>{author.experienceBadge}</span> : null}
            {author.achievementBadge ? <span>{author.achievementBadge}</span> : null}
          </div> : null}
        </div>

        <div className={styles.body}>
          {author.bio ? <p className={styles.bio}>{author.bio}</p> : null}
          {author.quote ? <p className={styles.quote}>«{author.quote}»</p> : null}
          {author.credentials && author.credentials.length > 0 ? (
            <ul className={styles.credentials}>
              {author.credentials.map((line) => (
                <li className={styles.credential} key={line}>
                  <Icon name="star" size={20} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      {author.facts?.length ? (
        <section className={styles.profileSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.label}>Коротко про автора</p>
            <h2 className={styles.courseTitle}>Досвід і головні орієнтири</h2>
          </div>
          <ul className={styles.factGrid}>
            {author.facts.map((line) => <li key={line}><Icon name="star" size={20} /><span>{line}</span></li>)}
          </ul>
        </section>
      ) : null}

      {author.profileBlocks?.map((block) => (
        <section className={styles.profileSection} key={block.id}>
          <div className={styles.sectionHeader}>
            {block.label ? <p className={styles.label}>{block.label}</p> : null}
            <h2 className={styles.courseTitle}>{block.title}</h2>
          </div>
          <div className={styles.profilePanel}>
            {block.body ? block.body.split(/\n{2,}/).map((paragraph) => <p className={styles.profileParagraph} key={paragraph}>{paragraph}</p>) : null}
            {block.items?.length && block.kind === "timeline" ? (
              <>
                <ul className={styles.timelineList}>{block.items.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
                {block.items.length > 4 ? <details className={styles.timelineMore}>
                  <summary>Показати весь шлях</summary>
                  <ul className={styles.timelineList}>{block.items.slice(4).map((item) => <li key={item}>{item}</li>)}</ul>
                </details> : null}
              </>
            ) : block.items?.length ? (
              <ul className={styles.credentials}>{block.items.map((item) => <li className={styles.credential} key={item}><Icon name="star" size={20} /><span>{item}</span></li>)}</ul>
            ) : null}
          </div>
        </section>
      ))}

      {author.consultation?.enabled ? <section className={styles.consultation} id="consultation">
        <p className={styles.label}>Консультація</p>
        <h2 className={styles.courseTitle}>{author.consultation.title || `Консультація з ${author.name}`}</h2>
        {author.consultation.summary ? <p className={styles.bio}>{author.consultation.summary}</p> : null}
        {author.consultation.points?.length ? <ul className={styles.credentials}>{author.consultation.points.map((point) => <li className={styles.credential} key={point}><Icon name="check" size={20} /><span>{point}</span></li>)}</ul> : null}
        <h2 className={styles.courseTitle}>Як це відбувається</h2>
        <ol className={styles.steps}>{consultationSteps.map((step) => <li key={step.id}><strong>{step.title}</strong><span>{step.text}</span></li>)}</ol>
        {author.consultation.contactUrl ? <a className={styles.consultationAction} href={author.consultation.contactUrl} target="_blank" rel="noopener noreferrer">Домовитися про консультацію</a> : null}
      </section> : null}
      {author.consultation?.enabled ? <><ConsultBoundary /><ConsultFaq /></> : null}

      <section className={styles.courses}>
        <div className={styles.courseHeader}>
          <div>
            <h2 className={styles.courseTitle}>Курси автора</h2>
          </div>
        </div>
        {courses.length > 0 ? (
          <PlatformOfferCarousel label={`Курси автора ${author.name}`} viewAllHref="/programs" viewAllLabel="Усі курси">
            {courses.map((course) => (
              <PlatformOfferCard
                key={course.slug}
                title={course.title}
                tag={course.tag}
                description={course.description}
                href={course.href}
                visual={course.visual}
                slug={course.slug}
                artwork={course.artwork}
                commercialMode={course.commercialMode}
                price={course.price}
                compareAtPrice={course.compareAtPrice}
                ctaLabel="Деталі курсу"
              />
            ))}
          </PlatformOfferCarousel>
        ) : (
          <p className={styles.empty}>Публічних курсів цього автора поки немає.</p>
        )}
      </section>
    </main>
  );
}
