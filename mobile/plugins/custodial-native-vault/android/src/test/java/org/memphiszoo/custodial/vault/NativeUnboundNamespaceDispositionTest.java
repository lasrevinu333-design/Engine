package org.memphiszoo.custodial.vault;
import static org.junit.Assert.*;
import org.junit.Test;
/** NEW owning engine/join negative: invalid batch owner must not lend source
 * classification to its retained write/query rows. Existing factories compile
 * only; their old test methods are not run. No SQL/Android disk/browser/phone. */
public final class NativeUnboundNamespaceDispositionTest {
    @Test public void unboundWriteQueryRowsRemainUnclassifiedAndProtected() throws Exception {
        var fixture=new NativeRetainedNamespaceSemanticJoinTest.Fixture();
        fixture.x.complete("RAW_VALUES_RETAINED_PENDING_SEMANTIC_RECONCILIATION");
        fixture.x.f.batch.root.memory.put("foreign-layout-row","synthetic original retained");
        var result=fixture.inspect();
        int unbound=0,classified=0,unresolved=0;
        for(int i=0;i<result.getJSONArray("records").length();i++){
            var row=result.getJSONArray("records").getJSONObject(i);
            if("UNBOUND_ORIGINAL_JOURNAL_ROWS_RETAINED".equals(row.get("local_source_classification"))){
                unbound++;
                assertFalse("unbound original journal row must not count as source-classified",row.getBoolean("local_source_classified"));
                assertEquals("UNKNOWN_RETAINED",row.get("application_semantic_disposition"));
                for(String flag:new String[]{"current_server_readback","inventory_acknowledged","work_accepted","resend_allowed","finalizer_allowed","key_removal"})
                    assertFalse(row.getBoolean(flag));
            }
            if(row.getBoolean("local_source_classified"))classified++;else unresolved++;
        }
        assertTrue("fixture must contain retained unbound WRITE and QUERY source rows",unbound>=2);
        assertEquals(classified,result.getInt("source_classified_record_count"));
        assertEquals(unresolved,result.getInt("unresolved_source_record_count"));
        assertEquals(classified+unresolved,fixture.x.total());
        assertFalse(result.getBoolean("complete_namespace_inventory"));
    }
}

