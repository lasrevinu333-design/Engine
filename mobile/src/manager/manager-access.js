// Native and web management use the same server-authorized shared-PIN flow.
// Name selection never generates an individual enrollment credential.
const target=new URL('./ops-manager-hub.html',window.location.href);
target.searchParams.set('return','index.html');
window.location.replace(target.toString());
