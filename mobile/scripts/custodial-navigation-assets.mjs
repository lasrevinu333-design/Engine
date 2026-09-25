// Runtime filenames do not confer manager authority: these compatibility pages
// must be byte-identical to their employee counterparts in the FINAL bundle.
export function assertCustodialNavigationAssets(hashes, policySource) {
  const block=policySource.match(/PAGES\s*=\s*new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\);/);
  if(!block)throw new Error('Custodial navigation allowlist cannot be read');
  const pages=[...block[1].matchAll(/"([^"]+)"/g)].map(match=>match[1]);
  if(!pages.length)throw new Error('Custodial navigation allowlist is empty');
  for(const page of pages){
    const path=page==='/'?'index.html':page.slice(1);
    if(!/^\/[a-z0-9_-]+\.html$/.test(page)&&page!=='/')throw new Error('Unreviewed Custodial navigation path: '+page);
    if(!hashes.has(path))throw new Error('Allowed Custodial page absent from final assets: '+path);
  }
  for(const [alias,employee] of [['start_page1.html','index.html'],['employee-hub.html','index.html'],
    ['events.html','employee-events.html'],['system-feedback.html','employee-feedback.html']]){
    if(!hashes.has(employee)||hashes.get(alias)!==hashes.get(employee))
      throw new Error('Custodial employee alias differs from exact employee page: '+alias);
  }
  for(const manager of ['manager-access.html','schedule-weekly.html','events-admin.html','ops-manager-hub.html','moxie-mobile.html']){
    if(hashes.has(manager)||pages.includes('/'+manager))throw new Error('Manager page in Custodial navigation assets: '+manager);
  }
}
