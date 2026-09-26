// Blinkbilden över grundbilden (och speglad), i stor förstoring.
export default async (s) => {
  await s.starta();
  let t = await s.vantaPaKnapp(/Hej/); await s.vanta(3500);
  const huvud = await s.js(`(() => { const f = document.querySelector("#newton .newton-figur").getBoundingClientRect(); return [f.left + f.width * .25, f.top, f.width * .5, f.height * .22]; })()`);
  // Stoppa blink/liv medan bilderna tas: ta bort klasserna och sätt dem själv.
  const bildPar = async (namn, extra) => {
    await s.js(`(() => { const n = document.getElementById("newton"); n.classList.remove("blinkar", "ror"); ${extra} })()`); await s.vanta(60);
    await s.bild(namn + "-oppen", { klipp: huvud, skala: 5 });
    await s.js(`document.getElementById("newton").classList.add("blinkar")`); await s.vanta(30);
    await s.bild(namn + "-blink", { klipp: huvud, skala: 5 });
    await s.js(`document.getElementById("newton").classList.remove("blinkar")`);
  };
  await bildPar("vanlig", "");
  await bildPar("speglad", `n.classList.add("speglad")`);
  await s.js(`document.getElementById("newton").classList.remove("speglad")`);
};
