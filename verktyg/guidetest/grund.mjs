// Grundkörning: guiden från filmvalet rakt igenom (Nästa/Hoppa över) till Klar.
export default async (s) => {
  await s.vanta(800);
  await s.starta();
  await s.guide({ val: "hoppa" });
  await s.vanta(5000);
  await s.vakt("grund");
};
