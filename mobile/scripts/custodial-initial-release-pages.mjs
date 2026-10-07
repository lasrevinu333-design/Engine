import {deferredCustodialFeature} from '../src/custodial/release-scope.js';

// Historical filename retained for existing imports. October2's complete-system
// scope supersedes disabled shell derivation; this is not runtime admission.
export function custodialDeferredPage(path){
  const feature=deferredCustodialFeature(path);if(!feature)return null;
  const title={messenger:'Messenger',events:'Events',feedback:'Feedback'}[feature];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title} — Memphis Zoo</title>
<style>html{color-scheme:dark}body{margin:0;background:#102018;color:#fff;font:1.1rem Arial,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:30rem;padding:2rem}a{display:inline-block;padding:1rem;background:#b7e66a;color:#102018;border-radius:1rem;font-weight:bold}a:focus-visible{outline:4px solid white;outline-offset:4px}</style>
<script src="./memphis-custodial-bridge.js"></script></head><body data-memphis-context="employee"><main><h1>${title}</h1><p>Not enabled in this release. Cleaning and Schedule are available from Home.</p><a href="./index.html">Back to Home</a></main></body></html>`;
}
export function custodialInitialReleaseHome(html){
  const entries=[...html.matchAll(/<a class="homeButton" href="\.\/([^"?]+)[^"]*">([\s\S]*?)<\/a>/g)].map(match=>match[1]);
  const expected=['employee-schedule.html','messages.html','events.html','employee-feedback.html'];
  if(entries.length!==4||expected.some(path=>entries.filter(entry=>entry===path).length!==1))throw Error('Complete-system Home must contain exactly the four approved entries.');
  if(entries.some(path=>deferredCustodialFeature(path)))throw Error('Complete-system Home cannot silently defer an included module.');
  const extra=html.match(/<a\b[^>]*class="memphisHome"[\s\S]*?<\/a>/g)||[];
  if(extra.length!==1)throw Error('Exact direct Memphis Home entry not found.');
  return html; // Preserve artwork, spacing, facts and accessibility byte-for-byte.
}
