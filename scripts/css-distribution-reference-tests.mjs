import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,mkdir,rm,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,relative,isAbsolute,extname} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

// Exercise the actual distribution verifier without invoking application
// packaging. No reimplementation of its scanner or admission decisions.
const source=readFileSync(new URL('../mobile/scripts/build.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function distributionHashes('),end=source.indexOf('async function buildRoleShell()',start);
assert.ok(start>0&&end>start);
const context={readdir,readFile,join,resolve,dirname,relative,isAbsolute,extname,createHash};
vm.runInNewContext(source.slice(start,end)+'\nthis.verify=verifyDistributionReferences;',context);
const folder=await mkdtemp(join(tmpdir(),'custodial-css-reference-test-'));
let checks=0;
async function check(css,expected){
 await writeFile(join(folder,'style.css'),css);
 if(expected)await assert.rejects(()=>context.verify(folder),expected);
 else await context.verify(folder);
 checks++;
}
try{
 await mkdir(join(folder,'images'));await writeFile(join(folder,'images/known image.svg'),'<svg/>');
 await check(`.a{background:url("data:image/svg+xml,%3Csvg%20fill='url(%23wood)'/%3E")}`);
 await check(`.a{background:url('data:image/svg+xml,%3Csvg%20fill="url(%23wood)"/%3E')}`);
 await check(`.a{background:url("./images/known%20image.svg")}.b{mask:url('#local-gradient')}`);
 await check(`.a{background:url(./images/known%20image.svg)}`);
 await check(`.a{background:url('./missing.png')}`,/missing distribution asset/);
 await check(`.a{background:url("data:image/svg+xml,%3Csvg%20fill='url(%23wood)'/%3E"),url('./missing.png')}`,/missing distribution asset/);
 await check(`.a{background:url('%2e%2e/outside.svg')}`,/escaping local reference/);
 await check(`.a{background:url('./%23wood')}`,/missing distribution asset/);
 await check(`.a{background:url('./bad%ZZ.svg')}`,/invalid encoded local reference/);
 await writeFile(join(folder,'index.html'),`<script>const text="url('./not-an-asset')";</script><style>.a{mask:url('#wood')}</style>`);
 await check(`.a{background:url("./images/known%20image.svg")}`);
 await writeFile(join(folder,'index.html'),`<style>.a{background:url("./missing-style.png")}</style>`);
 await check('',/missing distribution asset/);
 console.log(JSON.stringify({status:'PASS_ACTUAL_CSS_DISTRIBUTION_REFERENCES',checks,missingFilesStillRejected:true,encodedEscapesStillRejected:true,embeddedSvgReferencesStayInsideDataUrl:true,appBuild:false}));
}finally{await rm(folder,{recursive:true,force:false});}
