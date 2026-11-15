// Range för menyns filmer i spelen (14/11). Cloudflare Pages svarar 200 med hela filen också när webbläsaren ber om
// en del av den (Range). Chrome spelar ändå, men Safari på iPhone, iPad och Mac vill ha 206, och utan det står menyns
// stillbild kvar. Funktionen svarar 206 med delen, på samma sätt som functions/_middleware.js i geogebra-guiden.
// _routes.json (verktyg/cloudflare.mjs) gör att bara /spel/figur/meny/* kör den. Allt annat än en GET med Range på en
// .mp4 går till filen som förut, med Accept-Ranges på filmerna. Delen strömmas ur filen utan att hela filen (upp till
// 25 MiB) läses in i minnet, eftersom en klass med iPhones ber om flera delar var.
export async function onRequest({ request, next, env }) {
  const film = /\.mp4$/i.test(new URL(request.url).pathname);
  const range = request.headers.get("Range");
  if (!film || request.method !== "GET" || !range) {
    const svar = await next();
    if (!film || !svar.ok) return svar;
    const ut = new Response(svar.body, svar);
    ut.headers.set("Accept-Ranges", "bytes");
    return ut;
  }
  const hel = await env.ASSETS.fetch(new Request(request.url));
  if (hel.status !== 200) return hel;
  // Filens egna huvuden (typ, cache, ETag och spelens policyer ur _headers) följer med delen.
  const huvud = new Headers(hel.headers);
  for (const k of ["Content-Length", "Content-Encoding", "Content-Range"]) huvud.delete(k);
  huvud.set("Accept-Ranges", "bytes");
  const langd = hel.headers.get("Content-Length");
  const kand = langd !== null && /^\d+$/.test(langd) && !hel.headers.has("Content-Encoding");
  const data = kand ? null : await hel.arrayBuffer();
  const n = kand ? Number(langd) : data.byteLength;
  const kropp = (fran, till) => data ? data.slice(fran, till + 1) : del(hel.body, fran, till);
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  // Flera delar på en gång (bytes=0-1,5-9), ett okänt format, eller en If-Range som inte stämmer med filen längre:
  // hela filen, som utan funktionen.
  const omRange = request.headers.get("If-Range");
  const gammal = omRange !== null && omRange !== hel.headers.get("ETag") && omRange !== hel.headers.get("Last-Modified");
  if (!m || (m[1] === "" && m[2] === "") || gammal) return new Response(n ? kropp(0, n - 1) : null, { status: 200, headers: huvud });
  let fran, till;
  if (m[1] === "") { fran = Math.max(0, n - Number(m[2])); till = n - 1; }
  else { fran = Number(m[1]); till = m[2] === "" ? n - 1 : Math.min(Number(m[2]), n - 1); }
  if (fran >= n || fran > till) { hel.body?.cancel(); huvud.set("Content-Range", `bytes */${n}`); return new Response(null, { status: 416, headers: huvud }); }
  huvud.set("Content-Range", `bytes ${fran}-${till}/${n}`);
  return new Response(kropp(fran, till), { status: 206, headers: huvud });
}

// Byte fran till till (med till) ur kroppen, som en ström med känd längd, så att svaret får Content-Length.
// Början hoppas över, och det som kommer efter delen hämtas inte.
function del(kropp, fran, till) {
  const { readable, writable } = new FixedLengthStream(till - fran + 1);
  (async () => {
    const las = kropp.getReader(), skriv = writable.getWriter();
    let pos = 0;
    try {
      while (pos <= till) {
        const { done, value } = await las.read();
        if (done) break;
        const a = Math.max(0, fran - pos), b = Math.min(value.byteLength, till + 1 - pos);
        if (b > a) await skriv.write(value.subarray(a, b));
        pos += value.byteLength;
      }
      await skriv.close();
    } catch (e) { await skriv.abort(e).catch(() => { }); }
    las.cancel().catch(() => { });
  })();
  return readable;
}
