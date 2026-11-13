package org.memphiszoo.custodial.vault;
import org.junit.runner.JUnitCore;
import org.junit.runner.Request;
import org.junit.runner.Result;
public final class NativeCompletionValuesFocusedRunner {
    public static void main(String[] args){
        if(args.length!=1)throw new AssertionError("exact affected scope required");
        Result r;
        if("affected-inventory".equals(args[0]))r=new JUnitCore().run(Request.method(NativeProtectedWorkInventoryTest.class,"frozenDiscoveryRetainsEveryRecordWithoutClaimingAcceptance"));
        else if("legacy-large".equals(args[0]))r=new JUnitCore().run(Request.method(NativeCompletionOriginalValuesTest.class,"largeLegacyV2ExactReplayIsNotRejectedByNewBodyRetentionLimit"));
        else throw new AssertionError("unknown scope");
        r.getFailures().forEach(f->System.out.println(f.getTrace()));System.out.println("AFFECTED "+args[0]+": "+r.getRunCount()+" cases, "+r.getFailureCount()+" failures");
        if(!r.wasSuccessful()||r.getRunCount()!=1)throw new AssertionError("affected inventory failed");
    }
}
