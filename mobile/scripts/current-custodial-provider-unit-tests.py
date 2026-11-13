"""Current declared native JVM CI using a fully compiled, source-bound host fixture.
No APK, AndroidKeyStore, private native ACK, manager or physical authority.
Run inside the caller's existing isolated CI environment; no network/config changes.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,shutil,signal,subprocess,sys,time
import xml.etree.ElementTree as ET

def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for raw in iter(lambda:f.read(1048576),b''):h.update(raw)
 return h.hexdigest()

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--profile',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
 frontend=Path(__file__).resolve().parents[2];source=frontend/'mobile/plugins/custodial-native-vault/android/src'
 profile=Path(args.profile);output=Path(args.output)
 for p in [profile,output]:assert p.is_absolute() and p.resolve()==p and not p.is_symlink(),'exact absolute nonsymlink paths required'
 assert profile.is_file() and profile.stat().st_uid==os.getuid() and not output.exists() and output.parent.is_dir()
 p=json.loads(profile.read_text());assert p['schema']=='custodial.current-compiled-native-ci.v1'
 for field in ['hardware_acceptance','production','release_admission']:assert p[field]is False
 assert p['shipping_cipher_sha256']=='04257ca59fd0b34cd896447f2445cb7b67b54597ccaf9ec5b1f17446ec9b39cb'
 assert p['system_properties']['custodial.fixture.synthetic.jce.adapter']=='EXPLICIT_SYNTHETIC_JCE_NO_HARDWARE_AUTHORITY'
 actual=[]
 for subset in ['main/java','test/java','test/resources']:
  for file in sorted((source/subset).rglob('*')):
   assert not file.is_symlink()
   if file.is_file():actual.append({'path':str(file.relative_to(frontend)),'sha256':digest(file),'bytes':file.stat().st_size})
 assert actual==p['sources'],'current complete main/test source and resources must match actual compiled fixture'
 assert digest(source/'main/java/org/memphiszoo/custodial/vault/AndroidKeystoreCipher.java')==p['shipping_cipher_sha256']
 def verify_artifacts():
  expected={r['path']:r for r in p['artifacts']};observed=set()
  for entry in p['classpath']:
   base=Path(entry);assert base.resolve()==base and not base.is_symlink() and base.is_relative_to(profile.parent)
   for file in ([base]if base.is_file()else sorted(base.rglob('*'))):
    assert not file.is_symlink()
    if not file.is_file():continue
    key=str(file);assert key in expected and file.stat().st_uid==os.getuid() and file.stat().st_size==expected[key]['bytes'] and digest(file)==expected[key]['sha256'];observed.add(key)
  assert observed==set(expected),'exact closed compiled classpath required'
 verify_artifacts();cases=p['cases'];assert len(cases)==len({(x['class'],x['method'])for x in cases})==484
 assert sorted({x['class']for x in cases})==p['classes'] and len(p['classes'])==40
 runner_source=(frontend/'mobile/scripts/custodial-provider-storage-tests.mjs').read_text();selection=runner_source[runner_source.index('const tests = ['):runner_source.index('const fixtureSources =')]
 declared=re.findall("'([A-Za-z0-9]+Test)'",selection);assert sorted('org.memphiszoo.custodial.vault.'+x for x in declared)==p['classes']
 output.mkdir(mode=0o700);runtime=output/'runtime';runtime.mkdir(mode=0o700);reporter=runtime/'reporter';reporter.mkdir();(runtime/'tmp').mkdir();(runtime/'home').mkdir()
 env={k:v for k,v in os.environ.items()if k in ['PATH','LANG','JAVA_HOME']};env.update(HOME=str(runtime/'home'),TMPDIR=str(runtime/'tmp'),TZ='America/Chicago')
 golden=json.dumps({'z':'Español / </script> 🐘 \u2028 \u2029','a':'quote" slash\\ newline\n tab\t carriage\r back\b form\f null\0 unit\u001f'},ensure_ascii=False,separators=(',',':'),sort_keys=True);env.update(PROVIDER_WIRE_GOLDEN=golden,PROVIDER_WIRE_GOLDEN_SHA256=hashlib.sha256(golden.encode()).hexdigest())
 cp=os.pathsep.join(p['classpath']+[str(source/'test/resources')]);reporter_java=frontend/'mobile/scripts/fixtures/CurrentNativeJUnitMemberRunner.java'
 compile=subprocess.run(['javac','-cp',cp,'-d',str(reporter),str(reporter_java)],env=env,text=True,capture_output=True,timeout=60);(output/'reporter-compile.log').write_text(compile.stdout+compile.stderr);assert compile.returncode==0,'standard JUnit reporter compilation failed'
 cp=str(reporter)+os.pathsep+cp;classfile=runtime/'classes.txt';classfile.write_text('\n'.join(p['classes'])+'\n');members=runtime/'actual-members.tsv'
 discovery=subprocess.run(['java','-Xmx512m','-cp',cp,'CurrentNativeJUnitMemberRunner','--members',str(classfile),str(members)],env=env,text=True,capture_output=True,timeout=30);(output/'discovery.log').write_text(discovery.stdout+discovery.stderr);assert discovery.returncode==0,'actual compiled JUnit member discovery failed'
 assert set(members.read_text().splitlines())=={x['class']+'\t'+x['method']for x in cases},'every current compiled declared member must execute; no skipped/suppressed cases'
 results=[];start=time.time()
 for i,case in enumerate(cases):
  case_root=runtime/('case-'+str(i).zfill(3));case_root.mkdir(mode=0o700);xml=output/(str(i).zfill(3)+'.xml');log=output/(str(i).zfill(3)+'.log');props={**p['system_properties'],'custodial.custody.fixture.root':str(case_root)};argv=['java','-Xmx512m',*['-D'+k+'='+v for k,v in props.items()],'-cp',cp,'CurrentNativeJUnitMemberRunner',case['class'],str(xml),case['method']];before=time.time()
  with log.open('w')as stream:
   child=subprocess.Popen(argv,env=env,cwd=frontend,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True);timed=False
   try:code=child.wait(timeout=70)
   except subprocess.TimeoutExpired:
    timed=True;os.killpg(child.pid,signal.SIGTERM)
    try:code=child.wait(timeout=3)
    except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait()
  row={**case,'exit_code':code,'timeout':timed,'seconds':round(time.time()-before,3),'log_sha256':digest(log)}
  if xml.exists():
   a=ET.parse(xml).getroot();row['JUnit']={key:int(a.get(key,0))for key in ['tests','failures','errors','skipped']};row['xml_sha256']=digest(xml)
  row['passed']=code==0 and not timed and row.get('JUnit')=={'tests':1,'failures':0,'errors':0,'skipped':0};results.append(row)
  with(output/'results.jsonl').open('a')as stream:stream.write(json.dumps(row)+'\n')
  print(json.dumps({'case':i+1,'total':len(cases),'class':case['class'],'method':case['method'],'passed':row['passed']}),flush=True)
 verify_artifacts()
 after=[]
 for row in p['sources']:
  file=frontend/row['path'];after.append({'path':row['path'],'sha256':digest(file),'bytes':file.stat().st_size})
 assert after==p['sources'],'compiled source changed during test run'
 summary={'schema':'custodial.current-native-default-ci-result.v1','passed':len(results)==484 and all(x['passed']for x in results),'classes':40,'tests':len(results),'passed_tests':sum(x['passed']for x in results),'nonzero_cases':sum(x['exit_code']!=0 for x in results),'timeouts':sum(x['timeout']for x in results),'skipped':sum(x.get('JUnit',{}).get('skipped',0)for x in results),'profile_sha256':digest(profile),'reporter_source_sha256':digest(reporter_java),'results_sha256':digest(output/'results.jsonl'),'seconds':round(time.time()-start,3),'source_and_compiled_artifacts_unchanged':True,'scope':p['scope'],'hardware_acceptance':False,'release_admission':False,'production':False}
 (output/'SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary),flush=True);return 0 if summary['passed']else 1
if __name__=='__main__':sys.exit(main())
