function calculateDoshaResult(vata, pitta, kapha) {
  const scores = [
    { key: "vata", score: vata },
    { key: "pitta", score: pitta },
    { key: "kapha", score: kapha },
  ];

  const toDualResult = (first, second) => {
    const pair = new Set([first, second]);
    if (pair.has("vata") && pair.has("pitta")) return "vata_pitta";
    if (pair.has("pitta") && pair.has("kapha")) return "pitta_kapha";
    if (pair.has("vata") && pair.has("kapha")) return "vata_kapha";
    throw new Error("Invalid dual dosha pair");
  };

  const maxScore = Math.max(vata, pitta, kapha);
  const top = scores.filter((item) => item.score === maxScore).map((item) => item.key);

  if (top.length === 1) {
    const ranked = [...scores].sort((a, b) => b.score - a.score);
    const leader = ranked[0];
    const second = ranked[1];
    const third = ranked[2];
    if (third.score === 0 && second.score > 0) {
      const topTwoTotal = leader.score + second.score;
      const leaderShare = topTwoTotal > 0 ? leader.score / topTwoTotal : 0;
      if (leaderShare >= 0.55 && leaderShare <= 0.65) {
        return toDualResult(leader.key, second.key);
      }
    }
    return top[0];
  }
  if (top.length === 3) return "tridosha";
  return toDualResult(top[0], top[1]);
}

const cases = [
  { v: 6, p: 3, k: 3, expected: "vata" },
  { v: 3, p: 6, k: 3, expected: "pitta" },
  { v: 3, p: 3, k: 6, expected: "kapha" },
  { v: 5, p: 5, k: 2, expected: "vata_pitta" },
  { v: 2, p: 5, k: 5, expected: "pitta_kapha" },
  { v: 5, p: 2, k: 5, expected: "vata_kapha" },
  { v: 7, p: 5, k: 0, expected: "vata_pitta" },
  { v: 0, p: 5, k: 7, expected: "pitta_kapha" },
  { v: 5, p: 0, k: 7, expected: "vata_kapha" },
  { v: 8, p: 4, k: 0, expected: "vata" },
  { v: 4, p: 4, k: 4, expected: "tridosha" },
];

let failed = 0;
for (const tc of cases) {
  const got = calculateDoshaResult(tc.v, tc.p, tc.k);
  if (got !== tc.expected) {
    console.error(`FAIL: V=${tc.v} P=${tc.p} K=${tc.k} expected=${tc.expected} got=${got}`);
    failed += 1;
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log("Dosha result engine matrix OK");
