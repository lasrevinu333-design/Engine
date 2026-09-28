import {deferredCustodialFeature} from '../src/custodial/release-scope.js';

// Build-time derivation leaves source pages/history unchanged. Old employee
// aliases remain real, byte-identical local pages, but cannot boot deferred UI.
export function custodialDeferredPage(path){
  const feature=deferredCustodialFeature(path);if(!feature)return null;
  const title={messenger:'Messenger',events:'Events',feedback:'Feedback'}[feature];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title} — Memphis Zoo</title>
<style>html{color-scheme:dark}body{margin:0;background:#102018;color:#fff;font:1.1rem Arial,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:30rem;padding:2rem}a{display:inline-block;padding:1rem;background:#b7e66a;color:#102018;border-radius:1rem;font-weight:bold}a:focus-visible{outline:4px solid white;outline-offset:4px}</style>
<script src="./memphis-custodial-bridge.js"></script></head><body data-memphis-context="employee"><main><h1>${title}</h1><p>Not enabled in this release. Cleaning and Schedule are available from Home.</p><a href="./index.html">Back to Home</a></main></body></html>`;
}
export function custodialInitialReleaseHome(html){
  let buttons=0,disabled=0;
  html=html.replace(/<a class="homeButton" href="\.\/([^"?]+)[^"]*">([\s\S]*?)<\/a>/g,(original,path,content)=>{
    buttons++;if(!deferredCustodialFeature(path))return original;
    disabled++;return `<button type="button" class="homeButton deferredFeature" disabled aria-disabled="true" title="Available in a later update">${content}</button>`;
  });
  if(buttons!==4||disabled!==3)throw Error('Initial release Home must contain exactly four entries, only Schedule enabled.');
  const extra=html.match(/<a\b[^>]*class="memphisHome"[\s\S]*?<\/a>/g)||[];
  if(extra.length!==1)throw Error('Exact deferred Memphis Home entry not found.');
  html=html.replace(extra[0],'');
  const style='.homeMenu{grid-template-columns:repeat(2,minmax(0,1fr))}.deferredFeature{border:0;padding:0;background:transparent;color:inherit;font:inherit;cursor:default;filter:grayscale(1);opacity:.48}.deferredFeature:active{transform:none}';
  if(!html.includes('</style>'))throw Error('Home stylesheet missing.');
  return html.replace('</style>',style+'</style>');
}
