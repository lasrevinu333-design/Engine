set -eu
for f in recurring-regression.mjs test-bad-status.mjs test-changing-status.mjs test-http.mjs test-status.mjs test-throwing-status.mjs test-transport.mjs; do node "$f" --native-runtime; done
for c in 1 2 3 unknown getter changing object inherited prefix unknown-fields code-getter readiness-getter projection-getter code0 code1 code2 code3 code4 code5 code6 code7 code8 code9 code10 code11 ready0 ready1 ready2 ready3 ready4 ready5 ready6; do node response-test.mjs --native-runtime --case="$c"; done
node phone-lock-tests.mjs
node navigation-tests.mjs

for c in proxy-descriptor retire-proxy retire-ok; do node response-test.mjs --native-runtime --case="$c"; done
