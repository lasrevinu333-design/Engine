package org.memphiszoo.custodial.vault;

import static org.junit.Assert.*;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;

/** ONE NEW opposite-order encrypted-record comparison source case. No file
 * write, actual key/storage, old filesystem case rerun or runtime acceptance. */
public final class NativePrivateCapsuleRecordCompareConcurrencyTest {
    @Test public void oppositeOrderPrivateRecordComparisonsCompleteAndKeepOriginalBytes()throws Exception {
        var x=new NativeRetainedNamespaceCustodyLayoutTest.Fixture();var f=x.f;
        try(var g=f.x.f.generation();var n=f.x.observe();var v=f.values(g,n);var s=f.join(v);var l=x.layout(s);
            var c=NativeRetainedNamespacePrivateCapsuleTest.capsule(v,l,NativeRetainedNamespacePrivateCapsuleTest.key(1));var a=c.savedLocalRecord()){
            byte[] captured=((byte[])NativeRetainedNamespacePrivateCapsuleTest.field(a,"encoded")).clone(),snapshot=captured.clone();
            try(var b=NativeRetainedNamespacePrivateCapsule.SavedLocalRecord.fromStoredEncryptedRecord(captured)){
                CountDownLatch start=new CountDownLatch(1);AtomicReference<Throwable> problem=new AtomicReference<>();
                Thread one=new Thread(()->{try{start.await();for(int i=0;i<500;i++)assertTrue(a.sameOriginalEncryptedRecord(b));}catch(Throwable e){problem.compareAndSet(null,e);}},"owned-record-compare-a");
                Thread two=new Thread(()->{try{start.await();for(int i=0;i<500;i++)assertTrue(b.sameOriginalEncryptedRecord(a));}catch(Throwable e){problem.compareAndSet(null,e);}},"owned-record-compare-b");
                one.setDaemon(true);two.setDaemon(true);one.start();two.start();start.countDown();one.join(3000);two.join(3000);
                assertFalse("first comparison must finish",one.isAlive());assertFalse("second comparison must finish",two.isAlive());
                if(problem.get()!=null)throw new AssertionError("comparison failure",problem.get());assertArrayEquals(snapshot,captured);
                assertFalse(a.sameOriginalEncryptedRecord(null));assertTrue(a.sameOriginalEncryptedRecord(a));assertEquals(a.metadata().get("record_sha256"),b.metadata().get("record_sha256"));
            }finally{Arrays.fill(captured,(byte)0);Arrays.fill(snapshot,(byte)0);}
        }f.x.f.preserved();
    }
}
