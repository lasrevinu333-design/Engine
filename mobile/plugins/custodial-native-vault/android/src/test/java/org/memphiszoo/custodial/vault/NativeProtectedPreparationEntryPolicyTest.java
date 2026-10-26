package org.memphiszoo.custodial.vault;

/** Tiny pure-JDK logical checks only: no Android/OS/manager proof. */
public final class NativeProtectedPreparationEntryPolicyTest {
    private static int checks;
    private static void check(int sdk,int launchedUid,int ownUid,boolean clean,boolean expected){
        checks++;
        if(NativeProtectedPreparationEntryPolicy.permits(sdk,launchedUid,ownUid,clean)!=expected)
            throw new AssertionError("entry_filter_truth_table_mismatch");
    }

    public static void main(String[] args){
        if(args.length!=1||!"--entry-policy-only".equals(args[0]))
            throw new IllegalArgumentException("new_entry_policy_selector_required");
        check(33,-1,100,true,false);
        check(34,-1,100,true,true);
        check(35,200,100,true,true);
        check(34,100,100,true,false);
        check(34,200,-1,true,false);
        check(34,-2,100,true,false);
        check(34,200,100,false,false);
        check(34,-1,0,true,true);
        check(34,0,0,true,false);
        check(Integer.MIN_VALUE,-1,0,true,false);
        check(Integer.MAX_VALUE,-1,Integer.MAX_VALUE,true,true);
        check(Integer.MAX_VALUE,Integer.MAX_VALUE,Integer.MAX_VALUE,true,false);
        check(34,Integer.MAX_VALUE,0,true,true);
        check(34,Integer.MIN_VALUE,0,true,false);
        check(34,-1,Integer.MIN_VALUE,true,false);
        int explicit=checks;
        int[] sdks={Integer.MIN_VALUE,-1,0,33,34,35,Integer.MAX_VALUE};
        int[] uids={Integer.MIN_VALUE,-2,-1,0,1,34,Integer.MAX_VALUE};
        for(int sdk:sdks)for(int own:uids)for(int launched:uids)for(boolean clean:new boolean[]{false,true}){
            boolean expected;
            if(sdk<34)expected=false;
            else if(own<0)expected=false;
            else if(launched<-1)expected=false;
            else if(launched==own)expected=false;
            else expected=clean;
            check(sdk,launched,own,clean,expected);
        }
        System.out.println("ENTRY_POLICY_LOGIC_PASS explicit="+explicit+" truth_table="+(checks-explicit)+" total="+checks);
        System.out.println("PURE_JDK_ONLY_NOT_ANDROID_OS_DUMP_GATE_MANAGER_AUTH_OR_EFFECT_AUTHORITY");
    }
}
