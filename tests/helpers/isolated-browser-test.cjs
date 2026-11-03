// Explicit test-only network DATA for the network-namespace-isolated CI runner.
// Browser/HTTP routes remain real; this models requested online/offline state,
// never Internet, handset, delivery or native authority. Disabled by default.
const base=require('@playwright/test');
const enabled=process.env.CUSTODIAL_ISOLATED_BROWSER_NETWORK_MODEL==='1';
const install=async context=>{
 let offline=false;const original=context.setOffline;
 await context.addInitScript(()=>{
  const model={offline:false};Object.defineProperty(window,'__isolatedCiNetworkState',{value:model});
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>!model.offline});
 });
 context.setOffline=async function(value){
  if(typeof value!=='boolean')throw new TypeError('Explicit fixture offline boolean required');
  const changed=offline!==value;offline=value;
  await context.addInitScript(value=>{window.__isolatedCiNetworkState.offline=value;},value);
  for(const page of context.pages())await page.evaluate(value=>{if(window.__isolatedCiNetworkState)window.__isolatedCiNetworkState.offline=value;},value).catch(error=>{if(!page.isClosed())throw error;});
  await original.call(context,value);
  if(changed)for(const page of context.pages())await page.evaluate(value=>window.dispatchEvent(new Event(value?'offline':'online')),value).catch(error=>{if(!page.isClosed())throw error;});
 };
};
const test=enabled?base.test.extend({browser:[async({browser},use)=>{
 const original=browser.newContext;
 browser.newContext=async function(options){const context=await original.call(browser,options);await install(context);return context;};
 try{await use(browser);}finally{browser.newContext=original;}
},{scope:'worker'}]}):base.test;
module.exports={...base,test};
