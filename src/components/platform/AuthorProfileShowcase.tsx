import { Icon } from "@/components/Icon";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import type { StorefrontCard } from "@/lib/platform/offers";
import type { Author } from "@/lms-core";
import styles from "./AuthorProfileShowcase.module.css";

/** Public author identity and course showcase. */
export function AuthorProfileShowcase({ author, courses }: { author: Author; courses: StorefrontCard[] }) {
  return (
    <main>
      <header className={styles.hero}>
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
            {author.role ? <p className={styles.role}>{author.role}</p> : null}
          </div>
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

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Статус</dt>
            <dd>{author.role || "Автор CenterWay"}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Опубліковані курси</dt>
            <dd>{courses.length}</dd>
          </div>
        </dl>
      </header>

      <section className={styles.courses}>
        <div className={styles.courseHeader}>
          <div>
            <p className={styles.label}>Вітрина</p>
            <h2 className={styles.courseTitle}>Курси від {author.name}</h2>
          </div>
        </div>
        {courses.length > 0 ? (
          <div className={offerStyles.aggregateRail}>
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
                ctaLabel="Деталі курсу"
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>Публічних курсів цього автора поки немає.</p>
        )}
      </section>
    </main>
  );
}
