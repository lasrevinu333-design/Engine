package org.memphiszoo.custodial.vault;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.file.*;
import java.security.MessageDigest;
/** Host adapter profile boundary only. No Android hardware/storage qualification. */
public final class CustodialSyntheticHostGuardTest {
 @Test public void adapterIsLoadedOnlyFromExplicitOwnedHostDirectory() throws Exception {
  assertEquals("EXPLICIT_SYNTHETIC_JCE_NO_HARDWARE_AUTHORITY",AndroidKeystoreCipher.syntheticHostModel());
  Path expected=Path.of(System.getProperty("custodial.fixture.synthetic.adapter.classes")).toRealPath();
  Path actual=Path.of(AndroidKeystoreCipher.class.getProtectionDomain().getCodeSource().getLocation().toURI()).toRealPath();
  assertEquals(expected,actual);
 }
 @Test public void shippingCipherSourceIsStillExactAndContainsNoSyntheticHooks() throws Exception {
  byte[] bytes=Files.readAllBytes(Path.of(System.getProperty("custodial.fixture.shipping.cipher.source")));
  assertEquals("04257ca59fd0b34cd896447f2445cb7b67b54597ccaf9ec5b1f17446ec9b39cb",java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
  String source=new String(bytes,java.nio.charset.StandardCharsets.UTF_8);
  for(String hook:new String[]{"installSynthetic","selectSyntheticKey","afterSyntheticChecks","clearSynthetic"})assertFalse(source.contains(hook));
  assertTrue(source.contains("custodial_native_shared_key_retirement_refused"));
 }
}
