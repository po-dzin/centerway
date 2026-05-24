import type { Metadata } from "next";
import { PlatformLegalTemplate } from "@/components/platform/PlatformLegalTemplate";
import { contact, legal } from "@/lib/platform/content";

export const metadata: Metadata = {
  title: "Політика конфіденційності - CenterWay",
  description: "Політика конфіденційності CenterWay: збір, використання та захист персональних даних.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <PlatformLegalTemplate
      eyebrow="Privacy"
      title="Політика конфіденційності"
      lead={legal.privacy}
      panels={[
        {
          title: "Які дані збираються",
          tone: "proof",
          body: (
            <p>
              Ім&apos;я, телефон, email, коментар, обраний інтерес, технічні дані сторінки, UTM-мітки та дані, необхідні
              для обробки заявок або оплат.
            </p>
          ),
        },
        {
          title: "Як зв’язатися",
          tone: "policy",
          body: (
            <p>
              З питань персональних даних напишіть на {contact.email} або зв’яжіться за телефоном {contact.phone}.
            </p>
          ),
        },
      ]}
    />
  );
}
