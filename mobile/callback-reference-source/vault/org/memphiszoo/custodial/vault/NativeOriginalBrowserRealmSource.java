package org.memphiszoo.custodial.vault;

import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Native document-start read prerequisite, not a writer/ACK capability.
 * The normal private capture asset remains unchanged. This closed sidecar
 * observes actual packaged-document policy and the actual service-worker
 * container through methods captured before application script execution.
 * Absence here is not a claim about unseen foreign WebViews/OS processes.
 */
final class NativeOriginalBrowserRealmSource {
    static final String COMMAND="REALM_FENCE";
    private static final String SCHEMA="custodial.native-original-browser-realm-observation.v1";
    private static final String STATE="PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY";
    private NativeOriginalBrowserRealmSource(){}

    static String script(String grant,String reply)throws VaultFailure {
        if(grant==null||reply==null||!grant.matches("[a-f0-9]{64}")||!reply.matches("[a-f0-9]{64}")||grant.equals(reply))
            throw invalid();
        return "(()=>{'use strict';const grant="+JSONObject.quote(grant)+",reply="+JSONObject.quote(reply)+";\n"+BODY+"\n})();";
    }

    /** Representation validation only. The caller must own the real native
     * view/origin/document/Pending/phase and check lifetime before AND after.
     * No imported JSON or private response label creates an effect right.
     */
    static void verify(String raw,String expectedReply,String requestNonce,String phase,JSONObject binding)throws VaultFailure {
        try{
            if(raw==null||raw.length()>32768||binding==null)throw invalid();
            var data=ProviderWireJson.object(raw.getBytes(StandardCharsets.UTF_8),32768);
            NativeRetainedAttempt.keys(data,"schema","state","reply_token","request_nonce","phase_nonce",
                "operation_id","frame_sha256","original_generation_id","native_mutation_stamp");
            if(!SCHEMA.equals(data.get("schema"))||!STATE.equals(data.get("state"))
                ||!expectedReply.equals(data.get("reply_token"))||!requestNonce.equals(data.get("request_nonce"))
                ||!phase.equals(data.get("phase_nonce")))throw invalid();
            for(String key:new String[]{"operation_id","frame_sha256","original_generation_id","native_mutation_stamp"})
                if(!binding.get(key).equals(data.get(key)))throw invalid();
        }catch(VaultFailure failure){throw failure;}catch(Exception failure){throw invalid();}
    }
    private static VaultFailure invalid(){return new VaultFailure("custodial_original_browser_realm_unavailable");}

    private static final String BODY="""
        const apply=Reflect.apply,parse=JSON.parse,stringify=JSON.stringify,keys=Object.keys,create=Object.create,isArray=Array.isArray;
        const trim=String.prototype.trim,lower=String.prototype.toLowerCase,then=Promise.prototype.then;
        const doc=globalThis.document,nav=globalThis.navigator,port=globalThis.custodialOriginalBrowserPreparation;
        const tuple=['operation_id','frame_sha256','original_generation_id','native_mutation_stamp'];
        let retired=false,withdrawn=false,busy=false,post,listen,container,getRegistrations,controller,qsa,attr,position,head,readyState,parent,nodeLength,nodeItem;
        const retire=schema=>{
          const withdrawal=schema==='custodial.native-original-browser-realm-withdrawal.v1';
          if(retired&&(!withdrawal||withdrawn))return;retired=true;withdrawn=withdrawn||withdrawal;
          try{
            const notice=create(null);notice.schema=schema;notice.reply_token=reply;
            apply(post,port,[stringify(notice)]);
          }catch{}
        };
        const stop=()=>retire('custodial.native-original-browser-realm-withdrawal.v1');
        // Leaving one packaged document is not a realm violation in its
        // successor. Retire this closure only. Native navigation still
        // invalidates the old capture and independently starts a document.
        const pageRetired=()=>retire('custodial.native-original-browser-document-retired.v1');
        try{
          if(!doc||!nav||!port||globalThis.top!==globalThis||typeof port.postMessage!=='function'
            ||typeof port.addEventListener!=='function')return;
          post=port.postMessage;listen=port.addEventListener;
          container=nav.serviceWorker;
          if(!container||typeof container.getRegistrations!=='function')return; // unavailable, not zero registrations
          getRegistrations=container.getRegistrations;
          controller=Object.getOwnPropertyDescriptor(ServiceWorkerContainer.prototype,'controller')?.get;
          qsa=Document.prototype.querySelectorAll;attr=Element.prototype.getAttribute;
          position=Node.prototype.compareDocumentPosition;
          head=Object.getOwnPropertyDescriptor(Document.prototype,'head')?.get;
          readyState=Object.getOwnPropertyDescriptor(Document.prototype,'readyState')?.get;
          parent=Object.getOwnPropertyDescriptor(Node.prototype,'parentNode')?.get;
          nodeLength=Object.getOwnPropertyDescriptor(NodeList.prototype,'length')?.get;nodeItem=NodeList.prototype.item;
          if(![controller,qsa,attr,position,head,readyState,parent,nodeLength,nodeItem,then].every(value=>typeof value==='function'))return;
          const add=globalThis.addEventListener;
          apply(add,globalThis,['pagehide',pageRetired]);
          apply(container.addEventListener,container,['controllerchange',stop]);
        }catch{return;}

        // Fixed document-start DOM boundaries. A CSP frame restriction alone
        // does not prevent srcdoc/about:blank realm creation. Do not expose
        // those unguarded windows through normal application creation/sinks.
        // Original native methods stay closure-private; ordinary DOM content,
        // script/transport policy and historical protected data are unchanged.
        const own=Object.getOwnPropertyDescriptor,define=Object.defineProperty,StringType=String;
        const childSelector='iframe,frame,frameset,object,embed,portal,fencedframe',pins=[];
        const nodeType=own(Node.prototype,'nodeType')?.get,localName=own(Element.prototype,'localName')?.get;
        const elementQuery=Element.prototype.querySelectorAll,fragmentQuery=DocumentFragment.prototype.querySelectorAll;
        const addedNodes=own(MutationRecord.prototype,'addedNodes')?.get;
        const templateContent=own(HTMLTemplateElement.prototype,'content')?.get;
        const createElement=own(Document.prototype,'createElement')?.value,innerSetter=own(Element.prototype,'innerHTML')?.set;
        const refusal=()=>{stop();throw Error('custodial_original_browser_realm_creation_refused');};
        const inspectNode=(node,depth=0)=>{
          if(depth>64)refusal();
          let kind;
          try{kind=apply(nodeType,node,[]);}catch{return;} // non-Node arguments retain native conversion/error semantics
          if(kind===1){
            const name=apply(lower,apply(localName,node,[]),[]);
            if(name==='iframe'||name==='frame'||name==='frameset'||name==='object'||name==='embed'||name==='portal'||name==='fencedframe')refusal();
          }
          if(kind===1||kind===9||kind===11){
            const query=kind===1?elementQuery:kind===9?qsa:fragmentQuery;
            if(apply(nodeLength,apply(query,node,[childSelector]),[])!==0)refusal();
            const templates=apply(query,node,['template']);
            for(let i=0;i<apply(nodeLength,templates,[]);i++)
              inspectNode(apply(templateContent,apply(nodeItem,templates,[i]),[]),depth+1);
            if(kind===1&&apply(lower,apply(localName,node,[]),[])==='template')
              inspectNode(apply(templateContent,node,[]),depth+1);
          }
        };
        const htmlArgument=(args,index,emptyNull=false)=>{
          if(args.length<=index||typeof args[index]==='symbol')return;
          const value=emptyNull&&args[index]===null?'':StringType(args[index]);
          // Native template contents are inert: no browsing context or image
          // fetch is created by this private validation parse. Unlike a regex,
          // comments, script text and attribute literals stay ordinary DATA.
          const template=apply(createElement,doc,['template']);
          apply(innerSetter,template,[value]);inspectNode(apply(templateContent,template,[]));
          args[index]=value; // native DOMString conversion occurs exactly once
        };
        const method=(prototype,key,check)=>{
          const original=own(prototype,key);if(!original)return;
          if(typeof original.value!=='function')refusal();
          const guarded=function(...args){check(args);return apply(original.value,this,args);};
          define(prototype,key,{...original,value:guarded,writable:false,configurable:false});
          pins.push({prototype,key,field:'value',guarded});
        };
        const setter=(prototype,key)=>{
          const original=own(prototype,key);if(!original)return;
          if(typeof original.set!=='function')refusal();
          const guarded=function(value){
            const args=[value];let name='';try{name=apply(lower,apply(localName,this,[]),[]);}catch{}
            if(name!=='script'&&name!=='style'&&name!=='textarea'&&name!=='title'&&name!=='xmp'&&name!=='noembed'&&name!=='noframes')htmlArgument(args,0,true);
            return apply(original.set,this,args);
          };
          define(prototype,key,{...original,set:guarded,configurable:false});
          pins.push({prototype,key,field:'set',guarded});
        };
        try{
          if(![nodeType,localName,elementQuery,fragmentQuery,addedNodes,templateContent,createElement,innerSetter].every(value=>typeof value==='function'))return;
          // Create before returning a node, but never return a forbidden realm
          // even detached. Inert parser/imported nodes are checked on insertion.
          for(const key of ['createElement','createElementNS']){
            const original=own(Document.prototype,key);
            if(!original||typeof original.value!=='function')refusal();
            const guarded=function(...args){const node=apply(original.value,this,args);inspectNode(node);return node;};
            define(Document.prototype,key,{...original,value:guarded,writable:false,configurable:false});
            pins.push({prototype:Document.prototype,key,field:'value',guarded});
          }
          for(const key of ['appendChild','insertBefore','replaceChild'])
            method(Node.prototype,key,args=>{if(args.length)inspectNode(args[0]);});
          for(const prototype of [Element.prototype,Document.prototype,DocumentFragment.prototype])
            for(const key of ['append','prepend','replaceChildren','moveBefore'])
              method(prototype,key,args=>{for(let i=0;i<args.length;i++)inspectNode(args[i]);});
          for(const prototype of [Element.prototype,CharacterData.prototype,DocumentType.prototype])
            for(const key of ['before','after','replaceWith'])
              method(prototype,key,args=>{for(let i=0;i<args.length;i++)inspectNode(args[i]);});
          method(Element.prototype,'insertAdjacentElement',args=>{if(args.length>1)inspectNode(args[1]);});
          method(Element.prototype,'insertAdjacentHTML',args=>htmlArgument(args,1));
          for(const key of ['innerHTML','outerHTML'])setter(Element.prototype,key);
          if(typeof ShadowRoot==='function')setter(ShadowRoot.prototype,'innerHTML');
          for(const prototype of [Element.prototype,...(typeof ShadowRoot==='function'?[ShadowRoot.prototype]:[])])
            for(const key of ['setHTML','setHTMLUnsafe'])method(prototype,key,args=>htmlArgument(args,0));
          for(const key of ['insertNode','surroundContents'])method(Range.prototype,key,args=>{if(args.length)inspectNode(args[0]);});
          for(const key of ['open','write','writeln'])method(Document.prototype,key,refusal);
          if(!own(globalThis,'open'))refusal();
          method(globalThis,'open',refusal);
          method(Document.prototype,'execCommand',args=>{
            if(!args.length||typeof args[0]==='symbol')return;
            const command=StringType(args[0]);args[0]=command;
            const normalized=apply(lower,command,[]);
            if(normalized==='paste')refusal();
            if(normalized==='inserthtml')htmlArgument(args,2);
          });
          const observer=new MutationObserver(records=>{
            try{for(let i=0;i<records.length;i++){
              const nodes=apply(addedNodes,records[i],[]);
              for(let j=0;j<apply(nodeLength,nodes,[]);j++)inspectNode(apply(nodeItem,nodes,[j]));
            }}
            catch{stop();}
          });
          observer.observe(doc,{childList:true,subtree:true});
        }catch{stop();return;}
        const current=()=>{
          if(retired||globalThis.document!==doc||globalThis.navigator!==nav||globalThis.top!==globalThis
            ||apply(controller,container,[])!==null||apply(readyState,doc,[])==='loading')throw Error('realm unavailable');
          for(let i=0;i<pins.length;i++){
            const pin=pins[i],field=own(pin.prototype,pin.key);
            if(!field||field[pin.field]!==pin.guarded||field.configurable!==false
              ||pin.field==='value'&&field.writable!==false)throw Error('realm hook withdrawn');
          }
          const location=globalThis.location;
          if(location?.origin!=='https://localhost'||location.protocol!=='https:'||location.host!=='localhost')throw Error('origin');
          const h=apply(head,doc,[]),metas=apply(qsa,doc,['meta[http-equiv]']);
          let policy=null,count=0;
          for(let i=0;i<apply(nodeLength,metas,[]);i++){
            const meta=apply(nodeItem,metas,[i]),equiv=apply(attr,meta,['http-equiv']);
            if(typeof equiv==='string'&&apply(lower,apply(trim,equiv,[]),[])==='content-security-policy'){
              policy=meta;count++;
            }
          }
          if(!h||count!==1||apply(parent,policy,[])!==h)throw Error('one original head policy required');
          const value=apply(attr,policy,['content']),text=typeof value==='string'?apply(trim,value,[]):'';
          if(text!=="frame-src 'none'; worker-src 'none'; object-src 'none'"
            &&text!=="frame-src 'none'; worker-src 'none'; object-src 'none';")throw Error('policy unavailable');
          const scripts=apply(qsa,doc,['script']);
          for(let i=0;i<apply(nodeLength,scripts,[]);i++)
            if((apply(position,policy,[apply(nodeItem,scripts,[i])])&4)===0)throw Error('policy must precede application scripts');
          if(apply(nodeLength,apply(qsa,doc,[childSelector]),[])!==0)throw Error('child realm present');
        };
        const send=(request,ok)=>{
          const result=create(null);
          result.schema='custodial.native-original-browser-realm-observation.v1';
          result.state=ok?'PACKAGED_DOCUMENT_REALM_PRECONDITIONS_OBSERVED_NOT_AUTHORITY':'UNRESOLVED_RETAINED';
          result.reply_token=reply;result.request_nonce=request.request_nonce;result.phase_nonce=request.phase_nonce;
          for(let i=0;i<tuple.length;i++)result[tuple[i]]=request[tuple[i]];
          apply(post,port,[stringify(result)]);
        };
        const message=event=>{
          let request;
          try{
            const raw=event?.data;if(typeof raw!=='string'||raw.length>65536)return;
            request=parse(raw);
            if(!request||request.schema!=='custodial.native-original-browser-capture-request.v1'
              ||request.grant_token!==grant)return;
            if(request.command==='CLOSE'){pageRetired();return;}
            if(request.command!=='REALM_FENCE')return;
            if(keys(request).length!==9||typeof request.request_nonce!=='string'||typeof request.phase_nonce!=='string'
              ||typeof request.operation_id!=='string'||typeof request.frame_sha256!=='string'
              ||typeof request.original_generation_id!=='string'||typeof request.native_mutation_stamp!=='string')return;
            if(retired){send(request,false);return;}
            if(busy)throw Error('consumed or retired');
            busy=true;current();
            // Fixed original platform methods, not application callbacks,
            // and no await/overridden Promise.then result substitution.
            const deny=()=>{stop();try{send(request,false);}catch{}};
            // A retired document cannot publish a late observation, reset its
            // busy state or retire a successor merely because its old query
            // rejects. Independent violation hooks remain permanently sticky.
            const rejected=()=>{if(!retired)deny();};
            apply(then,apply(getRegistrations,container,[]),[first=>{
              try{
                if(retired)return;
                current();if(!isArray(first)||first.length!==0)throw Error('existing worker');
                apply(then,apply(getRegistrations,container,[]),[second=>{
                  try{if(retired)return;current();if(!isArray(second)||second.length!==0)throw Error('changed worker');send(request,true);busy=false;}
                  catch{deny();}
                },rejected]);
              }catch{deny();}
            },rejected]);
          }catch{stop();if(request)try{send(request,false);}catch{}}
        };
        try{apply(listen,port,['message',message]);}catch{stop();}
        """;
}
