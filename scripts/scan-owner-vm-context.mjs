// Test-only closure and owner adapters. No native platform or private health authority.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {createProtectedBrowserAdmission} from '../mobile/src/custodial/protected-browser-admission.js';
import {createSyntheticScheduleLocks} from './synthetic-schedule-locks.mjs';

// Use the same pinned Node VM's fresh standard globals, never Node host capabilities.
const globals=new Set(vm.runInNewContext('Object.getOwnPropertyNames(globalThis)'));
const freeCache=new Map(),sourceCache=new Map();
export function freeOwnerIdentifiers(code){
  if(freeCache.has(code))return freeCache.get(code);
  const name='owning-vm-slice.js',file=ts.createSourceFile(name,code,ts.ScriptTarget.ESNext,true,ts.ScriptKind.JS);
  const host={getSourceFile:p=>p===name?file:undefined,getDefaultLibFileName:()=>'',writeFile(){},getCurrentDirectory:()=>'',getDirectories:()=>[],fileExists:p=>p===name,readFile:p=>p===name?code:undefined,getCanonicalFileName:p=>p,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const program=ts.createProgram([name],{allowJs:true,checkJs:true,noLib:true,noResolve:true,target:ts.ScriptTarget.ESNext},host);
  assert.equal(program.getSyntacticDiagnostics().length,0,'Owner slice syntax must parse before execution');
  const checker=program.getTypeChecker(),free=new Set();
  const visit=node=>{
    if(ts.isIdentifier(node)){
      const p=node.parent;
      const property=(ts.isPropertyAccessExpression(p)&&p.name===node)
        ||((ts.isPropertyAssignment(p)||ts.isMethodDeclaration(p)||ts.isPropertyDeclaration(p)||ts.isBindingElement(p))&&p.name===node&&!ts.isShorthandPropertyAssignment(p))
        ||(ts.isBindingElement(p)&&p.propertyName===node)
        ||((ts.isLabeledStatement(p)||ts.isBreakStatement(p)||ts.isContinueStatement(p))&&p.label===node);
      if(!property){
        const symbol=ts.isShorthandPropertyAssignment(p)?checker.getShorthandAssignmentValueSymbol(p):checker.getSymbolAtLocation(node);
        if(!symbol)free.add(node.text);
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(file);const result=Object.freeze([...free].sort());freeCache.set(code,result);return result;
}
export function assertOwnerContextClosed(code,context,label='owner VM'){
  const missing=freeOwnerIdentifiers(code).filter(name=>!globals.has(name)&&!Object.hasOwn(context,name));
  assert.deepEqual(missing,[],`${label}: missing context bindings: ${missing.join(', ')}`);
}
function declarations(source){
  if(sourceCache.has(source))return sourceCache.get(source);
  const file=ts.createSourceFile('memphis-scan-sync.js',source,ts.ScriptTarget.ESNext,true,ts.ScriptKind.JS);
  let body=null;
  const visit=node=>{if(!body&&ts.isArrowFunction(node)&&ts.isBlock(node.body))body=node.body;else if(!body)ts.forEachChild(node,visit);};visit(file);
  assert.ok(body,'Actual scan IIFE owner body required');const values=new Map();
  for(const node of body.statements){
    if(ts.isFunctionDeclaration(node)&&node.name)values.set(node.name.text,node.getFullText(file));
    if(ts.isVariableStatement(node))for(const d of node.declarationList.declarations){
      assert.ok(ts.isIdentifier(d.name),'Owner top-level declaration must have an explicit binding');
      values.set(d.name.text,node.getFullText(file));
    }
  }
  sourceCache.set(source,values);return values;
}
export function closedScanOwnerSource(source,entries,context){
  const owner=declarations(source),selected=new Map();
  const add=name=>{assert.ok(owner.has(name),`Actual owner declaration missing: ${name}`);selected.set(name,owner.get(name));};
  entries.forEach(add);
  for(let pass=0;pass<=owner.size;pass++){
    const code=[...new Set(selected.values())].join('\n');const missing=freeOwnerIdentifiers(code).filter(name=>!globals.has(name)&&!Object.hasOwn(context,name));
    if(!missing.length){assertOwnerContextClosed(code,context);return code;}
    for(const name of missing){assert.ok(owner.has(name)&&!selected.has(name),`Owner closure missing: ${name}`);add(name);}
  }
  throw Error('Owner closure did not converge');
}
export class FixtureStorage{
  constructor(){this.rows=new Map();}
  getItem(key){return this.rows.get(String(key))??null;}
  setItem(key,value){this.rows.set(String(key),String(value));}
  removeItem(key){this.rows.delete(String(key));}
}
export function createScanOwnerVm(source,entries,bindings,{onMutationOptions=()=>{}}={}){
  const context={structuredClone,queueMicrotask,TextEncoder,crypto:webcrypto,...bindings};
  const configCode=declarations(source).get('CONFIG');assertOwnerContextClosed(configCode,{});
  const actualConfig=vm.runInNewContext(configCode+'\nCONFIG;');
  for(const [key,value] of Object.entries(bindings.CONFIG||{})){
    if(key==='API_URL')assert.match(value,/^https:\/\/synthetic\.invalid\//,'Only the synthetic fetch adapter URL may replace the owning endpoint');
    else assert.deepEqual(value,actualConfig[key],`Fixture must retain actual CONFIG.${key}`);
  }
  context.CONFIG={...actualConfig,...bindings.CONFIG};
  const window=context.window||{},storage=context.localStorage||window.localStorage||new FixtureStorage();
  const owner=createProtectedBrowserAdmission({storage,locks:createSyntheticScheduleLocks()});
  const security={native:false,
    getStatus(){try{owner.requireAdmission();return {ready:true,available:true,quarantined:false};}catch{return {ready:false,available:false,quarantined:true};}},
    async waitForStableState(){owner.requireAdmission();return security.getStatus();},
    mutateProtectedWork(operation,options){onMutationOptions(options);return owner.mutate(()=>operation(Object.freeze({assertCurrent:()=>owner.requireMutation()})));}};
  Object.assign(window,{localStorage:storage,MemphisCustodialSecurity:security});
  window.setTimeout??=setTimeout;window.clearTimeout??=clearTimeout;
  Object.assign(context,{window,localStorage:storage});
  // These are the actual Source owner/security/checkpoint algorithms, never truthy fixture replacements.
  for(const name of ['custodialSecurity','queueMutationSecurity','queueSecurityUnavailable','mutateProtectedQueue','queueOpeningCheckpoint','queueOpeningRowsMatch','sameClaimedQueueRow','securityPause','securityErrorIsPause','canonicalJson','canonicalizeSemanticValue','normalizeRecord','storageRecord'])delete context[name];
  const code=closedScanOwnerSource(source,entries,context);assertOwnerContextClosed(code,context);
  vm.createContext(context);vm.runInContext(code,context,{timeout:1000});
  return context;
}
