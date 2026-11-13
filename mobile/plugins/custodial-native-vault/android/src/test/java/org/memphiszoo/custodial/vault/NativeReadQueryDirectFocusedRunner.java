package org.memphiszoo.custodial.vault;

import java.util.HashSet;
import org.junit.runner.JUnitCore;
import org.junit.runner.Request;
import org.junit.runner.Result;

/** Runs only named newly affected direct query methods, never old suites. */
public final class NativeReadQueryDirectFocusedRunner {
    public static void main(String[] methods) {
        if(methods.length==0)throw new AssertionError("explicit affected methods required");
        var seen=new HashSet<String>();int count=0;
        for(String method:methods) {
            if(!seen.add(method))throw new AssertionError("duplicate method");
            Result result=new JUnitCore().run(Request.method(NativeRetainedReadQueryDirectTest.class,method));
            result.getFailures().forEach(failure->System.out.println(failure.getTrace()));
            System.out.println(method+": "+result.getRunCount()+" cases, "+result.getFailureCount()+" failures");
            if(!result.wasSuccessful()||result.getRunCount()!=1)throw new AssertionError("affected method failed");
            count+=result.getRunCount();
        }
        System.out.println("NEW AFFECTED DIRECT QUERY METHODS PASS: "+count);
    }
}
