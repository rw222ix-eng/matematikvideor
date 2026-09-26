#!/bin/zsh
# Hela stresstestet av Newtons guide (2026-09-26), dator 1440×900 och telefon 390×844, tre körningar åt gången.
#   python3 -m http.server 8791 --directory public     (egen port, inte 8765)
#   zsh verktyg/guidetest/svit.sh [port] [utmapp]
# Varje körning skriver <utmapp>/r-<namn>.txt. Sammanfattning: grep -h "VAKT\|    [a-zå]*:\|FASTNAT" <utmapp>/r-*.txt
# "ute" direkt efter ett storleksbyte är vaktens stickprov mellan ändringen och resize-händelsen (ritas aldrig).
cd "${0:A:h}/../.."
PORT=${1:-8791}; UT=${2:-${TMPDIR:-/tmp}/guidetest}; U=http://127.0.0.1:$PORT; mkdir -p $UT
k() { local namn=$1 manus=$2 url=$3; shift 3; [[ $# -eq 0 ]] && set -- 1440x900 390x844
  for st in "$@"; do node verktyg/guidetest.mjs "$url" ${st%x*} ${st#*x} verktyg/guidetest/$manus.mjs $UT/$namn-$st > $UT/$namn-$st.log 2>&1 & done; wait
  for st in "$@"; do echo "--------- $namn $st"; cat $UT/$namn-$st.log; done > $UT/r-$namn.txt; }
k grund grund "$U/#filmer" & k dubbel s1-dubbel "$U/#filmer" & k tips s1-tips-fraga "$U/#filmer" & wait
k tang s1-tangenter "$U/#filmer" 1440x900 & k pil s1-pil "$U/#formelbladet-2-funktioner" 1440x900 & k omst s1-omstart "$U/" 1440x900 & k s2 s2-vybyten "$U/#filmer" & wait
k bakat s2-bakat "$U/#filmer" & k s4 s4-tidig "$U/#filmer" & k utanfor s5-utanfor "$U/#filmer" & wait
NAMN=intro k s3-intro s3-start "$U/" & NAMN=fb k s3-fb s3-start "$U/#formelbladet" & NAMN=fb2 k s3-fb2 s3-start "$U/#formelbladet-ma2" & wait
NAMN=spelar FORE_KLICK="#duk-lock" FORE_VANTA=2500 k s3-spelar s3-start "$U/#formelbladet-3-plan-geometri" & NAMN=hel FORE_KLICK="#duk-lock||#duk-hel" FORE_VANTA=1500 START_JS='document.getElementById("hjalp").click()' k s3-hel s3-start "$U/#delos-och-altaret" & NAMN=sok FORE_KLICK=".vy.aktiv .sok-oppna" FORE_VANTA=800 k s3-sok s3-start "$U/#filmer" & wait
NAMN=sokf FORE_KLICK=".vy.aktiv .sok-oppna" FORE_VANTA=800 k s3-sokf s3-start "$U/#delos-och-altaret" & NAMN=dintur FORE='(() => { const i = document.querySelector("#dintur-delar input"); i.scrollIntoView({ block: "center" }); i.focus(); i.value = "x^3 = "; i.dispatchEvent(new Event("input", { bubbles: true })); return document.activeElement.id; })()' FORE_VANTA=1200 k s3-dintur s3-start "$U/#delos-och-altaret" & NAMN=ma2a k s3-ma2a s3-start "$U/#ma2a" & wait
k avbryt s8-avbryt "$U/#filmer" & wait
# Livet medan han väntar (logg över blink, putsa, kast och steg under 70 s; SERIER=n ger bildserier runt Newton):
STEG="Här ligger" DUR=70 k liv s6-liv "$U/#filmer"
grep -h "VAKT\|^\[.*\]    [a-zå]*:\|FASTNAT\|förgäves" $UT/r-*.txt
