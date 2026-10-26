import {deferredCustodialFeature} from '../src/custodial/release-scope.js';
import {lstat,readFile,readdir,writeFile} from 'node:fs/promises';
import {extname,join} from 'node:path';

// A fixed additional packaged-document policy, not native or all-realm
// authority. Existing CSP is retained: browsers enforce both policies.
export const CUSTODIAL_PACKAGED_REALM_POLICY="frame-src 'none'; worker-src 'none'; object-src 'none'";
const realmMeta='\n<meta http-equiv="Content-Security-Policy" content="'+CUSTODIAL_PACKAGED_REALM_POLICY+'">\n';

// This distribution transform accepts the explicit HTML document/head shape
// used by packaged pages. It is deliberately NOT a repairing DOM serializer:
// preserve all source bytes and refuse unsupported/ambiguous tokenizer shapes.
export function custodialPackagedRealmContainment(html){
  const refuse=reason=>{throw new Error('Unsupported Custodial packaged HTML: '+reason);};
  if(typeof html!=='string'||html.includes('\0'))refuse('text input');
  const space=char=>char!==undefined&&/[\t\n\f\r ]/.test(char);
  const white=text=>/^[\t\n\f\r ]*$/.test(text);
  function tag(at){
    let i=at+1,closing=false;
    if(html[i]==='/'){closing=true;i++;}
    const nameStart=i;
    while(i<html.length&&/[A-Za-z0-9:-]/.test(html[i]))i++;
    if(i===nameStart||!/[A-Za-z]/.test(html[nameStart]))refuse('tag name');
    const name=html.slice(nameStart,i).toLowerCase(),attrs=new Map();
    let selfClosing=false;
    while(i<html.length){
      const separated=space(html[i]);
      while(space(html[i]))i++;
      if(html[i]==='>')return {start:at,end:i+1,name,closing,selfClosing,attrs};
      if(html[i]==='/'&&html[i+1]==='>'){
        if(closing)refuse('closing tag slash');
        selfClosing=true;return {start:at,end:i+2,name,closing,selfClosing,attrs};
      }
      if(closing||!separated)refuse('tag/attribute boundary');
      const begin=i;
      while(i<html.length&&/[A-Za-z0-9_:.-]/.test(html[i]))i++;
      if(i===begin)refuse('unsupported attribute name');
      const key=html.slice(begin,i).toLowerCase();
      if(attrs.has(key))refuse('duplicate attribute');
      const afterName=i;
      while(space(html[i]))i++;
      let value=null;
      if(html[i]==='='){
        i++;while(space(html[i]))i++;
        if(html[i]==='"'||html[i]==="'"){
          const quote=html[i++],from=i;i=html.indexOf(quote,i);
          if(i<0)refuse('unterminated attribute');
          value=html.slice(from,i++);
        }else{
          const from=i;
          while(i<html.length&&!space(html[i])&&html[i]!=='>'){
            if(/["'`=<>]/.test(html[i]))refuse('unquoted attribute');
            i++;
          }
          if(i===from)refuse('missing attribute value');
          value=html.slice(from,i);
        }
      }else i=afterName; // retain the separator after a boolean attribute
      attrs.set(key,value);
    }
    refuse('unterminated tag');
  }
  let position=html.charCodeAt(0)===0xfeff?1:0,phase='doctype',headEnd=-1;
  let heads=0,headCloses=0,bodies=0,bodyCloses=0,htmlCloses=0,policies=0,charsetEnd=-1;
  const headTags=new Set(['meta','title','link','style','script','base']);
  // CSP alone does not prevent inline srcdoc execution. Packaged native input
  // is a single document: refuse actual opening child/plugin contexts, never
  // tag-shaped literals inside raw text, comments or quoted attributes.
  const childContexts=new Set(['iframe','frame','frameset','object','embed','portal','fencedframe']);
  const rawTags=new Set(['script','style','title','textarea','xmp','iframe','noembed','noframes']);
  while(position<html.length){
    const next=html.indexOf('<',position),end=next<0?html.length:next;
    if(['doctype','html','head','in-head','after-html'].includes(phase)&&!white(html.slice(position,end)))refuse('text outside supported document/head');
    if(next<0){position=html.length;break;}
    position=next;
    if(html.startsWith('<!--',position)){
      const close=html.indexOf('-->',position+4);if(close<0)refuse('unterminated comment');
      const comment=html.slice(position+4,close);
      if(comment.startsWith('>')||comment.startsWith('->')||comment.includes('<!--')||comment.includes('--!>'))refuse('ambiguous comment');
      position=close+3;continue;
    }
    if(/^<!doctype\b/i.test(html.slice(position,position+10))){
      const close=html.indexOf('>',position);
      if(phase!=='doctype'||close<0||!/^<!doctype[\t\n\f\r ]+html[\t\n\f\r ]*>$/i.test(html.slice(position,close+1)))refuse('doctype');
      phase='html';position=close+1;continue;
    }
    if(html[position+1]==='!'||html[position+1]==='?')refuse('unsupported declaration');
    if(!/[A-Za-z/]/.test(html[position+1]??'')){
      if(phase!=='in-body')refuse('unsupported markup');
      position++;continue;
    }
    const current=tag(position);position=current.end;
    const {name,closing,selfClosing,attrs}=current;
    if(!closing&&childContexts.has(name))refuse('active child context '+name);
    if(name==='html'){
      if(!closing){if(phase!=='html'||selfClosing)refuse('html opening');phase='head';}
      else{if(phase!=='after-body'||++htmlCloses!==1)refuse('html closing');phase='after-html';}
      continue;
    }
    if(name==='head'){
      if(!closing){if(phase!=='head'||selfClosing||++heads!==1)refuse('head opening');headEnd=current.end;phase='in-head';}
      else{if(phase!=='in-head'||++headCloses!==1)refuse('head closing');phase='body';}
      continue;
    }
    if(['doctype','html','head','after-html'].includes(phase))refuse('content before head/after html');
    if(name==='body'){
      if(!closing){if(phase!=='body'||selfClosing||++bodies!==1)refuse('body opening');phase='in-body';}
      else{if(phase!=='in-body'||++bodyCloses!==1)refuse('body closing');phase='after-body';}
      continue;
    }
    if(phase==='body'||phase==='after-body')refuse('content outside explicit body');
    if(name==='template'||name==='noscript'||name==='plaintext')refuse('unsupported parser context');
    if(phase==='in-head'&&(closing||!headTags.has(name)))refuse('unsupported head element');
    if(!closing&&name==='meta'){
      if(attrs.has('charset')){
        if(phase!=='in-head'||charsetEnd!==-1||typeof attrs.get('charset')!=='string'||attrs.get('charset').toLowerCase()!=='utf-8')refuse('charset');
        charsetEnd=current.end;
      }
      if(attrs.has('http-equiv')){
        const equiv=attrs.get('http-equiv');
        // Encoded keywords are unsupported, not silently missed CSP. Other
        // quoted content/URLs are never decoded or rewritten by this stage.
        if(typeof equiv!=='string'||equiv.includes('&'))refuse('encoded/empty http-equiv');
        const keyword=equiv.trim().toLowerCase();
        if(keyword==='content-security-policy'){
          if(phase!=='in-head'||++policies>1||typeof attrs.get('content')!=='string'||!attrs.get('content').trim()
            ||attrs.get('content')===CUSTODIAL_PACKAGED_REALM_POLICY)refuse('duplicate/unsupported CSP');
        }else if(keyword.startsWith('content-security-policy'))refuse('unsupported CSP kind');
      }
    }
    if(!closing&&rawTags.has(name)){
      if(selfClosing)refuse('self-closing raw-text element');
      const ending=new RegExp('</'+name+'(?=[\\t\\n\\f\\r />])','ig');
      ending.lastIndex=position;const match=ending.exec(html);if(!match)refuse('unclosed raw-text element');
      if(name==='script'&&(/<!--|<script(?=[\t\n\f\r />])/i.test(html.slice(position,match.index))))refuse('unsupported escaped script context');
      const close=tag(match.index);
      if(!close.closing||close.name!==name)refuse('raw-text closing');
      position=close.end;
    }
  }
  if(phase!=='after-html'||heads!==1||headCloses!==1||bodies!==1||bodyCloses!==1||charsetEnd<0)refuse('incomplete document/head/charset');
  if(Buffer.byteLength(html.slice(0,charsetEnd)+realmMeta,'utf8')>1024)refuse('charset would exceed original HTML encoding window');
  return html.slice(0,headEnd)+realmMeta+html.slice(headEnd);
}

// Invoke only for the normal Custodial distribution AFTER role-shell output,
// BEFORE runtime hashing. Validate every HTML input before any policy writes.
export async function containCustodialPackagedHtml(directory){
  const pages=[];
  async function collect(current){
    const root=await lstat(current);
    if(!root.isDirectory()||root.isSymbolicLink())throw new Error('Unsupported Custodial package directory');
    for(const entry of (await readdir(current,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
      const path=join(current,entry.name);
      if(entry.isSymbolicLink())throw new Error('Unsupported Custodial package symlink');
      if(entry.isDirectory())await collect(path);
      else if(entry.isFile()&&extname(entry.name).toLowerCase()==='.html')
        pages.push({path,html:custodialPackagedRealmContainment(await readFile(path,'utf8'))});
    }
  }
  await collect(directory);
  if(!pages.length)throw new Error('Custodial package has no HTML pages');
  for(const page of pages)await writeFile(page.path,page.html,'utf8');
  return pages.length;
}


// Historical filename retained for existing imports. October2's complete-system
// scope supersedes disabled shell derivation; this is not runtime admission.
export function custodialDeferredPage(path){
  const feature=deferredCustodialFeature(path);if(!feature)return null;
  const title={messenger:'Messenger',events:'Events',feedback:'Feedback'}[feature];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title} — Memphis Zoo</title>
<style>html{color-scheme:dark}body{margin:0;background:#102018;color:#fff;font:1.1rem Arial,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:30rem;padding:2rem}a{display:inline-block;padding:1rem;background:#b7e66a;color:#102018;border-radius:1rem;font-weight:bold}a:focus-visible{outline:4px solid white;outline-offset:4px}</style>
<script src="./memphis-custodial-bridge.js"></script></head><body data-memphis-context="employee"><main><h1>${title}</h1><p>Not enabled in this release. Cleaning and Schedule are available from Home.</p><a href="./index.html">Back to Home</a></main></body></html>`;
}
export function custodialInitialReleaseHome(html,{cleaningFirst=false}={}){
  const entries=[...html.matchAll(/<a class="homeButton" href="\.\/([^"?]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map(match=>match[1]);
  // The fifth entry is ONLY the owner-approved packaged static placeholder.
  // No request UI/catalog/API or future external destination is included.
  const expected=['employee-schedule.html','messages.html','events.html','employee-feedback.html','supply-coming-soon.html'];
  if(entries.length!==5||expected.some(path=>entries.filter(entry=>entry===path).length!==1))throw Error('Complete-system Home must contain exactly the four operational entries and local Supplies placeholder.');
  if(entries.some(path=>deferredCustodialFeature(path)))throw Error('Complete-system Home cannot silently defer an included module.');
  const extra=html.match(/<a\b[^>]*class="memphisHome"[\s\S]*?<\/a>/g)||[];
  if(extra.length!==1)throw Error('Exact direct Memphis Home entry not found.');
  if(cleaningFirst)return html.replace(/<a class="homeButton" href="\.\/([^"?]+)[^"]*"[^>]*>[\s\S]*?<\/a>/g,(all,path)=>path==='supply-coming-soon.html'?all:'');
  return html; // Preserve artwork, spacing, facts and accessibility byte-for-byte.
}

export const CLEANING_FIRST_DEFERRED_PAGES=Object.freeze(['employee-schedule.html','messages.html','messages-chatscope.html','thread.html','events.html','employee-feedback.html','system-feedback.html']);
export function cleaningFirstDeferredPage(){return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; connect-src \'self\' https://memphis-zoo-mcp.onrender.com; img-src \'self\' data:; media-src \'self\' data:; font-src \'self\' data:; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; object-src \'none\'; base-uri \'self\'; form-action \'self\'"><meta name="referrer" content="no-referrer"><title>Memphis Zoo Cleaning</title><script src="./memphis-build-identity.js"></script><script src="./memphis-custodial-bridge.js"></script></head><body data-memphis-context="employee"><main><h1>Cleaning</h1><p>Other modules are not enabled in this release.</p><a href="./index.html">Back to Home</a></main></body></html>';}
export async function deferCleaningFirstPackagedPages(directory){
  for(const page of CLEANING_FIRST_DEFERRED_PAGES){const path=join(directory,page),st=await lstat(path);if(!st.isFile()||st.isSymbolicLink())throw Error('Missing/unsafe exact deferred page '+page);}
  for(const page of CLEANING_FIRST_DEFERRED_PAGES)await writeFile(join(directory,page),cleaningFirstDeferredPage(),'utf8');
}
