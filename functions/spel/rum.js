// /spel/rum går till spelservern (geogebra-guidens repo, server/) genom service bindingen SPEL i wrangler.toml, så att
// eleven bara pratar med videotekets egen adress. _routes.json (verktyg/cloudflare.mjs) gör att bara spelserverns
// adresser kör den här funktionen.
export const onRequest = ({ request, env }) => env.SPEL
  ? env.SPEL.fetch(request)
  : new Response(JSON.stringify({ fel: "server", text: "Spelservern är inte kopplad." }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } });
