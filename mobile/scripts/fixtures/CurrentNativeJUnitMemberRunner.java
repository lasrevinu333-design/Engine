import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.Test;
import org.junit.runner.*;
import org.junit.runner.notification.*;
import javax.xml.stream.*;
/** Test reporter only: no bytecode instrumentation, permission/key factories or Android authority. */
public final class CurrentNativeJUnitMemberRunner {
 static final class Entry {final Description d;long start=System.nanoTime(),nanos;Throwable failure;boolean ignored,assumed;Entry(Description d){this.d=d;}}
 public static void main(String[] args)throws Exception {
  if(args.length==3&&args[0].equals("--members")){
   List<String> members=new ArrayList<>();for(String name:Files.readAllLines(Path.of(args[1]),StandardCharsets.UTF_8)){
    Class<?> type=Class.forName(name,false,CurrentNativeJUnitMemberRunner.class.getClassLoader());
    for(var method:type.getMethods())if(method.getAnnotation(Test.class)!=null)members.add(name+"\t"+method.getName());
   }
   Collections.sort(members);Files.write(Path.of(args[2]),members,StandardCharsets.UTF_8,StandardOpenOption.CREATE_NEW);return;
  }

  if(args.length==3&&args[0].equals("--discover")){
   List<String> eligible=new ArrayList<>();
   for(String name:Files.readAllLines(Path.of(args[1]),StandardCharsets.UTF_8)){
    if(name.isBlank())continue;Class<?> c=Class.forName(name,false,CurrentNativeJUnitMemberRunner.class.getClassLoader());boolean found=c.getAnnotation(RunWith.class)!=null;
    for(var method:c.getMethods())if(method.getAnnotation(Test.class)!=null)found=true;
    if(found&&!java.lang.reflect.Modifier.isAbstract(c.getModifiers()))eligible.add(name);
   }
   Files.write(Path.of(args[2]),eligible,StandardCharsets.UTF_8,StandardOpenOption.CREATE_NEW);System.out.println("DISCOVERED_CURRENT_JUNIT_CLASSES="+eligible.size());return;
  }
  if(args.length!=2&&args.length!=3)throw new IllegalArgumentException("Exact class and new owned XML output required");
  List<Entry> entries=new ArrayList<>();Map<Description,Entry> active=new HashMap<>();
  JUnitCore core=new JUnitCore();core.addListener(new RunListener(){
   public void testStarted(Description d){Entry e=new Entry(d);entries.add(e);active.put(d,e);}
   public void testFailure(Failure f){Entry e=active.get(f.getDescription());if(e==null){e=new Entry(f.getDescription());entries.add(e);active.put(f.getDescription(),e);}e.failure=f.getException();}
   public void testAssumptionFailure(Failure f){Entry e=active.get(f.getDescription());if(e==null){e=new Entry(f.getDescription());entries.add(e);}e.assumed=true;}
   public void testIgnored(Description d){Entry e=new Entry(d);e.ignored=true;entries.add(e);}
   public void testFinished(Description d){Entry e=active.remove(d);if(e!=null)e.nanos=System.nanoTime()-e.start;}
  });
  Result result=args.length==3?core.run(Request.method(Class.forName(args[0]),args[2])):core.run(Class.forName(args[0]));
  Path output=Path.of(args[1]);try(var out=Files.newOutputStream(output,StandardOpenOption.CREATE_NEW)){
   XMLStreamWriter xml=XMLOutputFactory.newFactory().createXMLStreamWriter(out,"UTF-8");xml.writeStartDocument();xml.writeStartElement("testsuite");xml.writeAttribute("name",args[0]);xml.writeAttribute("tests",Integer.toString(result.getRunCount()+result.getIgnoreCount()));xml.writeAttribute("failures",Integer.toString(result.getFailureCount()));xml.writeAttribute("errors","0");xml.writeAttribute("skipped",Integer.toString(result.getIgnoreCount()+result.getAssumptionFailureCount()));xml.writeAttribute("time",Double.toString(result.getRunTime()/1000.0));
   for(Entry e:entries){xml.writeStartElement("testcase");xml.writeAttribute("classname",String.valueOf(e.d.getClassName()));xml.writeAttribute("name",String.valueOf(e.d.getMethodName()));xml.writeAttribute("time",Double.toString(e.nanos/1e9));if(e.ignored||e.assumed){xml.writeEmptyElement("skipped");}if(e.failure!=null){xml.writeStartElement("failure");xml.writeAttribute("type",e.failure.getClass().getName());xml.writeAttribute("message",String.valueOf(e.failure.getMessage()));java.io.StringWriter trace=new java.io.StringWriter();e.failure.printStackTrace(new java.io.PrintWriter(trace));xml.writeCharacters(trace.toString());xml.writeEndElement();}xml.writeEndElement();}
   xml.writeEndElement();xml.writeEndDocument();xml.close();
  }
  for(Failure f:result.getFailures())System.out.println(f.getTrace());
  System.out.println("ACTUAL_JUNIT_RESULT run="+result.getRunCount()+" failed="+result.getFailureCount()+" ignored="+result.getIgnoreCount()+" assumptions="+result.getAssumptionFailureCount());
  if(!result.wasSuccessful())System.exit(1);
 }
}
