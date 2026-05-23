import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "@/components/platform/PlatformContentStyles";
import { featuredPrograms, miniCourses, programs } from "@/lib/platform/content";

type ProgramTileData = Pick<
  (typeof programs)[number],
  "artwork" | "description" | "duration" | "href" | "slug" | "tag" | "title" | "visual"
>;

function ProgramTile({ program, compact = false }: { program: ProgramTileData; compact?: boolean }) {
  const tileStyle =
    program.artwork?.desktop
      ? ({
          "--program-photo-image": `url("${program.artwork.desktop}")`,
          "--program-photo-image-mobile": `url("${program.artwork.mobile ?? program.artwork.desktop}")`,
          "--program-photo-position-desktop": program.artwork.desktopPosition ?? "center 20%",
          "--program-photo-position-mobile": program.artwork.mobilePosition ?? "center 42%",
        } as CSSProperties)
      : undefined;

  return (
    <article
      className={styles.programTile}
      data-has-art={program.artwork?.desktop ? "true" : "false"}
      data-program={program.slug}
      data-size={compact ? "compact" : "default"}
      data-visual={program.visual}
      style={tileStyle}
    >
      <div className={styles.programPhoto} aria-hidden="true" />
      <div className={styles.programTileBody}>
        <p className={styles.label}>{program.tag}</p>
        <h3>{program.title}</h3>
        <p>{program.description}</p>
        <Link className={styles.programLink} href={program.href}>
          {compact ? "Деталі курсу" : "Деталі програми"}
        </Link>
      </div>
    </article>
  );
}

export function HubMini() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="mini-courses">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>М&apos;який вхід без довгого зобов&apos;язання</h2>
        </div>
      </div>
      <div className={styles.programShowcase} data-layout="mini">
        {miniCourses.map((program) => (
          <ProgramTile key={program.title} compact program={program} />
        ))}
      </div>
    </section>
  );
}

export function HubPrograms() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="programs">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Глибші програми для тіла, харчування і ритму</h2>
        </div>
      </div>
      <div className={styles.programShowcase}>
        {featuredPrograms.map((program) => (
          <ProgramTile key={program.title} program={program} />
        ))}
      </div>
    </section>
  );
}
