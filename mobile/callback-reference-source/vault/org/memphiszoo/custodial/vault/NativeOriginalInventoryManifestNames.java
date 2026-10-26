package org.memphiszoo.custodial.vault;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.json.JSONArray;
import org.json.JSONObject;

/** Synchronous DATA projection of the already parsed original MZBRV001 realms.
 * No source/currentness, browser, manager, acceptance or effect authority. */
final class NativeOriginalInventoryManifestNames {
    static final String ENCODING="UTF16_CODE_UNITS_BE_BASE64";
    private NativeOriginalInventoryManifestNames() {}

    static Projection project(NativeOriginalBrowserValueFrame.OriginalRecords original)throws VaultFailure {
        if(original==null)throw fail();
        try{return new Projection(original);}
        catch(VaultFailure failure){throw failure;}
        catch(Exception failure){throw fail();}
    }

    /** Explicit code-unit bytes, NOT a Charset encoder (which replaces lone
     * surrogates). Null and empty names remain different original DATA. */
    private static Object name(String original) {
        if(original==null)return JSONObject.NULL;
        byte[] units=new byte[Math.multiplyExact(original.length(),2)];
        try{
            for(int i=0;i<original.length();i++){
                char unit=original.charAt(i);
                units[2*i]=(byte)(unit>>>8);units[2*i+1]=(byte)unit;
            }
            return NativeRetainedAttempt.encodeBase64(units);
        }finally{Arrays.fill(units,(byte)0);}
    }

    private static final class Realm {
        final String store,database,objectStore;
        final Long version;
        Realm(String store,String database,Long version,String objectStore){
            this.store=store;this.database=database;this.version=version;this.objectStore=objectStore;
        }
        @Override public boolean equals(Object other){
            if(!(other instanceof Realm))return false;Realm r=(Realm)other;
            return Objects.equals(store,r.store)&&Objects.equals(database,r.database)
                &&Objects.equals(version,r.version)&&Objects.equals(objectStore,r.objectStore);
        }
        @Override public int hashCode(){return Objects.hash(store,database,version,objectStore);}
    }

    /** A method-local census only: retains immutable row DATA, not a validated
     * source verdict. Engine must keep its full before/after owning checks. */
    static final class Projection {
        final JSONArray domains=new JSONArray();
        final int declaredRecordCount;
        private final List<NativeOriginalBrowserValueFrame.Record> originals;
        private final Map<Realm,Integer> ordinals=new HashMap<>();
        private final int[] expected,observed;
        private final boolean[] seen;
        private boolean refused,finished;
        private Projection(NativeOriginalBrowserValueFrame.OriginalRecords original)throws Exception{
            originals=original.originalRecords();var catalog=original.declaredDomains();
            if(original.recordCount!=originals.size())throw fail();
            seen=new boolean[originals.size()];expected=new int[catalog.size()];observed=new int[catalog.size()];
            int total=0;
            for(int i=0;i<catalog.size();i++){
                var realm=catalog.get(i);
                boolean storage="localStorage".equals(realm.store)||"sessionStorage".equals(realm.store);
                boolean unknown="UNAVAILABLE_UNRESOLVED_RETAINED".equals(realm.state);
                boolean empty="DECLARED_EMPTY_DATABASE_NOT_AUTHORITY".equals(realm.state);
                boolean rows="DECLARED_ORIGINAL_ROWS_NOT_AUTHORITY".equals(realm.state);
                if(!(rows||empty||unknown)||storage&&(realm.database!=null||realm.version!=null||realm.objectStore!=null)
                    ||!storage&&(!"indexedDB".equals(realm.store)||realm.database==null||realm.version==null
                        ||realm.version<1||realm.version>9007199254740991L)
                    ||unknown&&(!"sessionStorage".equals(realm.store)||realm.recordCount!=-1)
                    ||empty&&(storage||realm.objectStore!=null||realm.recordCount!=0)
                    ||rows&&(realm.recordCount<0||!storage&&realm.objectStore==null))throw fail();
                Realm key=new Realm(realm.store,realm.database,realm.version,realm.objectStore);
                if(ordinals.put(key,i)!=null)throw fail();
                expected[i]=realm.recordCount;
                if(realm.recordCount>=0)total=Math.addExact(total,realm.recordCount);
                domains.put(new JSONObject().put("domain_ordinal",i).put("store",realm.store)
                    .put("database_utf16be_base64",name(realm.database))
                    .put("version",realm.version==null?JSONObject.NULL:realm.version)
                    .put("object_store_utf16be_base64",name(realm.objectStore))
                    .put("record_count",realm.recordCount<0?JSONObject.NULL:realm.recordCount)
                    .put("state",realm.state));
            }
            if(total!=original.recordCount)throw fail();
            declaredRecordCount=total;
        }

        /** Consume exactly the actual original row once, without concatenated
         * realm keys or re-reading/reclassifying its acceptance disposition. */
        int domainOrdinal(NativeOriginalBrowserValueFrame.Record row)throws VaultFailure{
            try{
                if(refused||finished||row==null||row.ordinal<0||row.ordinal>=originals.size()
                    ||originals.get(row.ordinal)!=row||seen[row.ordinal])throw fail();
                Integer ordinal=ordinals.get(new Realm(row.store,row.database,row.version,row.objectStore));
                if(ordinal==null||expected[ordinal]<0||observed[ordinal]>=expected[ordinal])throw fail();
                seen[row.ordinal]=true;observed[ordinal]++;
                return ordinal;
            }catch(Exception failure){refused=true;throw fail();}
        }

        void finish()throws VaultFailure{
            try{
                if(refused||finished)throw fail();
                for(boolean present:seen)if(!present)throw fail();
                for(int i=0;i<expected.length;i++)
                    if(observed[i]!=(expected[i]<0?0:expected[i]))throw fail();
                finished=true;
            }catch(Exception failure){refused=true;throw fail();}
        }
    }
    private static VaultFailure fail(){return new VaultFailure(NativeRetainedAttempt.FAILURE);}
}
