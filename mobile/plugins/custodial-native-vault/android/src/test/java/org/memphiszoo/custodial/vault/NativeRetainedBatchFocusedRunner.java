package org.memphiszoo.custodial.vault;

import org.junit.runner.JUnitCore;
import org.junit.runner.Request;
import org.junit.runner.Result;

/** Qualifier-only selected-method launcher. It cannot touch production/phone. */
public final class NativeRetainedBatchFocusedRunner {
    public static void main(String[] methods){
        int tests=0,failures=0;if(methods.length==0)throw new IllegalArgumentException("exact changed methods required");
        for(String method:methods){Result result=new JUnitCore().run(Request.method(NativeRetainedBatchOwnerTest.class,method));
            tests+=result.getRunCount();failures+=result.getFailureCount();for(var failure:result.getFailures())System.err.println(failure.getTrace());
            System.out.println(method+": "+(result.wasSuccessful()?"PASS":"FAIL")+" tests="+result.getRunCount());
        }
        System.out.println("SELECTED_NEW_BATCH_METHODS tests="+tests+" failures="+failures);
        if(failures!=0)System.exit(1);
    }
}
