const target=new URL('./index.html',window.location.href);
for(const key of ['hub','device','origin']){const value=new URL(window.location.href).searchParams.get(key);if(value)target.searchParams.set(key,value);}
window.location.replace(target.toString());
