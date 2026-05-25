import { permanentRedirect } from "next/navigation";

export const metadata = {
  title: "Detox - CenterWay",
  description: "Платформена сторінка Detox: м'яке очищення, травлення, ритм і 21-денний маршрут без медичних обіцянок.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DetoxProgramPage() {
  permanentRedirect("/programs/way21");
}
