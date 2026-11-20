// /spel/rost (röstchattens knapp för läraren, kräver lärarens nyckel) går till spelservern (geogebra-guidens repo,
// server/src/rost.js) genom service bindingen SPEL i wrangler.toml. verktyg/spel-rost-larare.mjs i guiden går den här
// vägen. _routes.json (verktyg/cloudflare.mjs) gör att bara spelserverns adresser kör den här funktionen.
export const onRequest = ({ request, env }) => env.SPEL
  ? env.SPEL.fetch(request)
  : new Response(JSON.stringify({ fel: "server", text: "Spelservern är inte kopplad." }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } });
