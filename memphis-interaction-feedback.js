const ENABLED_KEY = 'mz_haptics_enabled';
function enabled(){return localStorage.getItem(ENABLED_KEY)!=='0'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}
function vibrate(pattern){if(!enabled()||typeof navigator.vibrate!=='function')return false;try{return navigator.vibrate(pattern);}catch{return false;}}
function selection(){return vibrate(8);}function success(){return vibrate([12,38,18]);}function warning(){return vibrate([24,45,24]);}function error(){return vibrate([40,35,40]);}
document.addEventListener('pointerdown',(event)=>{const control=event.target.closest('button,a,.tile,.tab,.threadRow,.cs-conversation');if(!control||control.matches('[disabled],[aria-disabled="true"]'))return;selection();},{passive:true});
window.addEventListener('memphis:feedback',(event)=>{const type=String(event.detail?.type||'selection');if(type==='success')success();else if(type==='error')error();else if(type==='warning')warning();else selection();});
window.MemphisInteraction={selection,success,warning,error,setHapticsEnabled(value){localStorage.setItem(ENABLED_KEY,value?'1':'0');},hapticsEnabled:enabled};
