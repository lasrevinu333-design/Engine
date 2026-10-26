package org.memphiszoo.custodial.vault;

import org.junit.runner.JUnitCore;
import org.junit.runner.Request;
import org.junit.runner.Result;

/** Execute only changed owning binding cases; unchanged passing cases stay
 * in their original source-bound receipt, not a fabricated fresh aggregate. */
public final class NativeNamespaceFocusedRunner {
    public static void main(String[] methods){
        if(methods.length==0)throw new IllegalArgumentException("explicit changed methods required");
        int failures=0;
        for(String method:methods){
            if(!method.matches("[A-Za-z][A-Za-z0-9]+"))throw new IllegalArgumentException("invalid method");
            Result result=new JUnitCore().run(Request.method(NativeProtectedNamespaceObservationTest.class,method));
            System.out.println(method+" run="+result.getRunCount()+" failures="+result.getFailureCount());
            for(var failure:result.getFailures())System.err.println(failure);
            if(result.getRunCount()!=1||result.getIgnoreCount()!=0)throw new AssertionError("missing selected method");
            failures+=result.getFailureCount();
        }
        if(failures!=0)throw new AssertionError("targeted namespace cases failed: "+failures);
    }
}
