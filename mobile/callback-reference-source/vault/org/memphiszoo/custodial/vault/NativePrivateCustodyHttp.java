package org.memphiszoo.custodial.vault;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.net.ssl.HttpsURLConnection;

/** UNMOUNTED native-only one-shot transport. Only the owning engine can mint
 * the dispatch after durable original UNKNOWN. No URL/body/nonce signer API,
 * redirects, TLS override, retry or custody/semantic acceptance is provided. */
final class NativePrivateCustodyHttp {
    static final String ORIGIN=NativeRetainedHttp.ORIGIN;
    static final int MAX_RESPONSE=262144;
    // Resource budget only, not attestation freshness or qualified work time.
    private static final long MAX_EXCHANGE_NANOS=30_000_000_000L;
    interface Connections { HttpsURLConnection open(URL exact) throws Exception; }
    private final Connections connections;private final VaultClock clock;private final long budgetNanos;
    NativePrivateCustodyHttp(){this(url->(HttpsURLConnection)url.openConnection(),System::currentTimeMillis);}
    /** Package-private synthetic connection seam, never employee configuration. */
    NativePrivateCustodyHttp(Connections connections,VaultClock clock){
        this(connections,clock,MAX_EXCHANGE_NANOS);
    }
    /** Private finite-budget owning test seam; never employee configuration. */
    private NativePrivateCustodyHttp(Connections connections,VaultClock clock,long budgetNanos){
        if(connections==null||clock==null)throw new IllegalArgumentException("private_custody_HTTP_dependencies_required");
        if(budgetNanos<=0||budgetNanos>MAX_EXCHANGE_NANOS)throw new IllegalArgumentException("private_custody_HTTP_budget_required");
        this.connections=connections;this.clock=clock;this.budgetNanos=budgetNanos;
    }
    static final class Exchange implements AutoCloseable {
        final int status;final String nativeRequestId,bodySha256;
        private byte[] response;
        private Exchange(int status,String id,String bodySha,byte[] bytes){this.status=status;nativeRequestId=id;bodySha256=bodySha;response=bytes.clone();}
        byte[] response()throws VaultFailure{if(response==null)throw unknown();return response.clone();}
        @Override public void close(){if(response!=null)Arrays.fill(response,(byte)0);response=null;}
    }
    Exchange send(VaultEngine.NativePrivateCustodyDispatch dispatch,String device,char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();
        AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,VaultEngine.NativePrivateCustodyPreparedExchange.PATH,NativeRetainedAttempt.MAX_BODY,started);
    }
    /** Fixed original WRITE/QUERY only, after the real durable UNKNOWN.
     * The same frame owns the full typed take before one network piece;
     * the existing sealed response loan keeps that piece owned through
     * the Engine's original response-journal and transient cleanup. */
    ControlledStatusRead sendUnderControl(VaultEngine.NativePrivateCustodyDispatch dispatch,String device,
        char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,VaultEngine.NativePrivateCustodyPreparedExchange.PATH,
                NativeRetainedAttempt.MAX_BODY,started,control::check);
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    Exchange sendCurrentQuery(VaultEngine.NativePrivateCustodyCurrentQueryDispatch dispatch,String device,char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();
        AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeCurrentQueryRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,"/device-auth/private-custody-current-read",526336,started);
    }
    /** Fixed frame-owned CURRENT QUERY only. Local locked source/HMAC work in
     * the one typed take belongs to the SAME original frame, not its network
     * piece. No raw request, purpose/path selector or renewed Attempt escapes.
     * The manual sendCurrentQuery(...,Attempt) entry remains independent. */
    Exchange sendCurrentQueryUnderControl(VaultEngine.NativePrivateCustodyCurrentQueryDispatch dispatch,String device,
        char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange result=null;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeCurrentQueryRequest();control.check();
            // The original native take has settled and released its locks.
            // Cancellation between take and begin consumes no new transport;
            // the consumed request is only wiped, never restored or re-signed.
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            result=sendOwned(request,device,credential,piece,VaultEngine.NativePrivateCustodyCurrentQueryDispatch.PATH,
                526336,started,control::check);
            control.check();return result;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            try{
                // sendOwned has already joined disconnect/detach and wiped
                // its body on every exit. Also cover refusal BEFORE sendOwned.
                if(request!=null)Arrays.fill(request.body,(byte)0);
                if(primary!=null&&result!=null)result.close();
            }catch(RuntimeException|Error cleanup){
                if(result!=null)result.close();
                if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}
            }finally{
                // Only this exact piece is released, AFTER original HTTP and
                // request-buffer cleanup. No release while IO is still owned.
                if(piece!=null)try{control.endPiece(piece);}
                catch(VaultFailure|RuntimeException|Error cleanup){
                    if(result!=null)result.close();
                    if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;
                }
            }
        }
    }
    /** Fixed metadata read only. No arbitrary URL, body, signer or writer. */
    Exchange sendOriginalRecoveryTarget(VaultEngine.NativePrivateCustodyCurrentQueryDispatch dispatch,String device,char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeOriginalRecoveryTargetRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH,526336,started);
    }
    /** Fixed frame-owned ORIGINAL TARGET metadata lookup only. The same
     * frame owns the complete local typed take before its one network piece;
     * no raw request, purpose selector or renewed Attempt is accepted. */
    Exchange sendOriginalRecoveryTargetUnderControl(VaultEngine.NativePrivateCustodyCurrentQueryDispatch dispatch,String device,
        char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange result=null;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();
            request=dispatch.takeOriginalRecoveryTargetRequest();
            control.check();
            // The owning native source/lock/HMAC take has fully settled.
            // A withdrawn frame only wipes consumed transient bytes; it
            // cannot restore this request or begin a replacement transport.
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            result=sendOwned(request,device,credential,piece,VaultEngine.NativePrivateCustodyCurrentQueryDispatch.TARGET_PATH,
                526336,started,control::check);
            control.check();return result;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            try{
                // sendOwned has settled disconnect/detach/body cleanup. This
                // also covers refusal after take but before entering sendOwned.
                if(request!=null)Arrays.fill(request.body,(byte)0);
                if(primary!=null&&result!=null)result.close();
            }catch(RuntimeException|Error cleanup){
                if(result!=null)result.close();
                if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}
            }finally{
                if(piece!=null)try{control.endPiece(piece);}
                catch(VaultFailure|RuntimeException|Error cleanup){
                    if(result!=null)result.close();
                    if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;
                }
            }
        }
    }
    /** Fixed NEW-purpose challenge only, after the owning original UNKNOWN.
     * No arbitrary request, path, nonce, timestamp or signer is accepted. */
    Exchange sendOriginalRecoveryChallenge(VaultEngine.NativeSameOriginalRecoveryDispatch dispatch,String device,char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,NativeSameOriginalRecoveryChallengeEnvelope.PATH,786432,started);
    }
    /** Fixed first original challenge only, after the owning UNKNOWN. The
     * same frame covers the full typed take before one network piece; the
     * unchanged sealed response loan keeps that exact piece owned through
     * the Engine's response-journal and original transient cleanup. */
    ControlledStatusRead sendOriginalRecoveryChallengeUnderControl(VaultEngine.NativeSameOriginalRecoveryDispatch dispatch,
        String device,char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,NativeSameOriginalRecoveryChallengeEnvelope.PATH,
                786432,started,control::check);
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    /** Read-only current transport of one archived original challenge. The
     * Engine owns both the typed take and its exact archived bytes/pins. */
    Exchange readOriginalRecoveryChallengeStatus(VaultEngine.NativeSameOriginalRecoveryStatusDispatch dispatch,String device,char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,NativeSameOriginalRecoveryChallengeEnvelope.STATUS_PATH,
            NativeSameOriginalRecoveryChallengeEnvelope.MAX_STATUS,started);
    }
    Exchange readCurrentOriginalManagerPreparation(VaultEngine.NativeSameOriginalRecoveryStatusDispatch dispatch,String device,char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,NativeSameOriginalRecoveryChallengeEnvelope.MANAGER_PREPARATION_PATH,
            NativeSameOriginalRecoveryChallengeEnvelope.MAX_STATUS,started);
    }
    /** Successful fixed status reads lend the SAME live network piece to the
     * owning Engine's decoder. No Attempt, request or frame setter escapes.
     * HTTP has already settled IO; the Engine retires this loan only after
     * response/dispatch/credential/buffer cleanup on the original thread. */
    static final class ControlledStatusRead implements AutoCloseable {
        private final NativePrivateCustodyFrameReadControl control;
        private final NativeRetainedHttp.Attempt piece;
        private final Exchange response;
        private final Thread owner=Thread.currentThread();
        private boolean closing;
        private ControlledStatusRead(NativePrivateCustodyFrameReadControl control,NativeRetainedHttp.Attempt piece,Exchange response){
            this.control=control;this.piece=piece;this.response=response;
        }
        void check()throws VaultFailure {
            if(Thread.currentThread()!=owner||closing)throw unknown();
            piece.check();control.check();
        }
        Exchange response()throws VaultFailure {check();return response;}
        @Override public void close()throws VaultFailure {
            if(Thread.currentThread()!=owner)throw unknown();
            if(closing)return;
            // Sticky even on failed cleanup: never retry an uncertain release.
            closing=true;response.close();control.endPiece(piece);
        }
    }
    ControlledStatusRead readOriginalRecoveryChallengeStatusUnderControl(VaultEngine.NativeSameOriginalRecoveryStatusDispatch dispatch,
        String device,char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,NativeSameOriginalRecoveryChallengeEnvelope.STATUS_PATH,
                NativeSameOriginalRecoveryChallengeEnvelope.MAX_STATUS,started,control::check);
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    ControlledStatusRead readCurrentOriginalManagerPreparationUnderControl(VaultEngine.NativeSameOriginalRecoveryStatusDispatch dispatch,
        String device,char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,NativeSameOriginalRecoveryChallengeEnvelope.MANAGER_PREPARATION_PATH,
                NativeSameOriginalRecoveryChallengeEnvelope.MAX_STATUS,started,control::check);
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    /** Fixed-purpose observation of retained original completion arguments.
     * Only the Engine's current owning dispatch can supply the request. */
    Exchange readOriginalCompletion(VaultEngine.NativeSameOriginalCompletionReadDispatch dispatch,String device,char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,NativeSameOriginalCompletionReadEnvelope.PATH,
            NativeSameOriginalCompletionReadEnvelope.MAX_OUTPUT,started);
    }
    /** Fixed native completion READ only. The original frame owns local
     * typed source/manager/journal validation before its one network piece;
     * the unchanged sealed loan retains that piece through Engine decoding
     * and the complete original transient/dispatch/credential cleanup. */
    ControlledStatusRead readOriginalCompletionUnderControl(VaultEngine.NativeSameOriginalCompletionReadDispatch dispatch,
        String device,char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,NativeSameOriginalCompletionReadEnvelope.PATH,
                NativeSameOriginalCompletionReadEnvelope.MAX_OUTPUT,started,control::check);
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    /** Fixed registration only after the Engine's live first-write UNKNOWN.
     * Same saved bytes/ID/time/HMAC; no fresh signing, retry or ACK privilege. */
    Exchange registerOriginalInventoryRequest(VaultEngine.NativeOriginalInventoryAckDispatch dispatch,String device,
        char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,VaultEngine.NativeOriginalInventoryAckRequestControl.PATH,
            VaultEngine.NativeOriginalInventoryAckRequestControl.MAX_BODY,started,dispatch::requireCurrent);
    }
    /** Fixed first registration only. Local original/UNKNOWN authentication
     * belongs to the unchanged frame; its one network piece is lent through
     * owning response decoding and complete native cleanup. */
    ControlledStatusRead registerOriginalInventoryRequestUnderControl(VaultEngine.NativeOriginalInventoryAckDispatch dispatch,
        String device,char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,VaultEngine.NativeOriginalInventoryAckRequestControl.PATH,
                VaultEngine.NativeOriginalInventoryAckRequestControl.MAX_BODY,started,()->{control.check();dispatch.requireCurrent();control.check();});
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                boolean cleaned=false;
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();cleaned=true;}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null&&cleaned)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    private interface OriginalSourceCheck { void check()throws VaultFailure; }
    /** Fixed native manifest writer/status only; a plugin cannot supply the
     * path, body, index or purpose. UNKNOWN is durable before a first write. */
    Exchange exchangeOriginalInventoryManifestChunk(VaultEngine.NativeOriginalInventoryManifestDispatch dispatch,
        String device,char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();}
        catch(VaultFailure failure){throw failure;}catch(Exception failure){throw unknown();}
        boolean status=dispatch.statusOnly();
        return sendOwned(request,device,credential,attempt,status?NativeOriginalInventoryManifestChunkStatusEnvelope.PATH:
            VaultEngine.NativeOriginalInventoryManifestPublication.PATH,status?NativeOriginalInventoryManifestChunkStatusEnvelope.MAX_OUTPUT:65536,
            started,dispatch::requireCurrent);
    }
    /** Same fixed manifest WRITE/status selection, never a caller purpose.
     * Typed take settles before the piece starts; every existing source IO
     * boundary still checks the original dispatch as well as the same frame. */
    ControlledStatusRead exchangeOriginalInventoryManifestChunkUnderControl(VaultEngine.NativeOriginalInventoryManifestDispatch dispatch,
        String device,char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            boolean status=dispatch.statusOnly();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,status?NativeOriginalInventoryManifestChunkStatusEnvelope.PATH:
                VaultEngine.NativeOriginalInventoryManifestPublication.PATH,status?NativeOriginalInventoryManifestChunkStatusEnvelope.MAX_OUTPUT:65536,
                started,()->{control.check();dispatch.requireCurrent();control.check();});
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                boolean cleaned=false;
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();cleaned=true;}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null&&cleaned)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    /** Read-only current transport of the same archived original. */
    Exchange readOriginalInventoryRegistrationStatus(VaultEngine.NativeOriginalInventoryStatusDispatch dispatch,String device,
        char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,NativeOriginalInventoryAckStatusEnvelope.PATH,
            NativeOriginalInventoryAckStatusEnvelope.MAX_OUTPUT,started,dispatch::requireCurrent);
    }
    /** Fixed registration READ only. The same frame covers typed original
     * validation before one network piece; the unchanged loan keeps that
     * piece through the owning Engine's response processing and cleanup. */
    ControlledStatusRead readOriginalInventoryRegistrationStatusUnderControl(VaultEngine.NativeOriginalInventoryStatusDispatch dispatch,
        String device,char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,NativeOriginalInventoryAckStatusEnvelope.PATH,
                NativeOriginalInventoryAckStatusEnvelope.MAX_OUTPUT,started,()->{control.check();dispatch.requireCurrent();control.check();});
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                boolean cleaned=false;
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();cleaned=true;}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null&&cleaned)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    Exchange readOriginalInventoryManagerDecisionStatus(VaultEngine.NativeOriginalInventoryStatusDispatch dispatch,String device,
        char[] credential,NativeRetainedHttp.Attempt attempt)throws VaultFailure {
        final long started=System.nanoTime();AuthorizedRequest request;
        try{
            if(dispatch==null||attempt==null)throw unknown();attempt.check();request=dispatch.takeRequest();
        }catch(VaultFailure error){throw error;}catch(Exception error){throw unknown();}
        return sendOwned(request,device,credential,attempt,NativeOriginalInventoryAckStatusEnvelope.APPROVAL_PATH,
            NativeOriginalInventoryAckStatusEnvelope.MAX_OUTPUT,started,dispatch::requireCurrent);
    }
    /** Fixed manager-decision READ only. Engine clock evidence is sampled
     * before this typed take; neither the frame nor that decision interval
     * is renewed when its one network piece begins. */
    ControlledStatusRead readOriginalInventoryManagerDecisionStatusUnderControl(VaultEngine.NativeOriginalInventoryStatusDispatch dispatch,
        String device,char[] credential,NativePrivateCustodyFrameReadControl control)throws VaultFailure {
        AuthorizedRequest request=null;NativeRetainedHttp.Attempt piece=null;Exchange response=null;
        boolean transferred=false;Throwable primary=null;
        try{
            if(dispatch==null||control==null)throw unknown();
            control.check();request=dispatch.takeRequest();control.check();
            piece=control.beginPiece();control.check();
            final long started=System.nanoTime();
            response=sendOwned(request,device,credential,piece,NativeOriginalInventoryAckStatusEnvelope.APPROVAL_PATH,
                NativeOriginalInventoryAckStatusEnvelope.MAX_OUTPUT,started,()->{control.check();dispatch.requireCurrent();control.check();});
            Arrays.fill(request.body,(byte)0);
            var loan=new ControlledStatusRead(control,piece,response);loan.check();
            transferred=true;return loan;
        }catch(VaultFailure failure){primary=failure;throw failure;}
        catch(Exception error){var failure=unknown();primary=failure;throw failure;}
        catch(Error failure){primary=failure;throw failure;}
        finally{
            if(!transferred){
                boolean cleaned=false;
                try{if(request!=null)Arrays.fill(request.body,(byte)0);if(response!=null)response.close();cleaned=true;}
                catch(RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else{primary=cleanup;throw cleanup;}}
                finally{if(piece!=null&&cleaned)try{control.endPiece(piece);}
                    catch(VaultFailure|RuntimeException|Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}}
            }
        }
    }
    // Private shared lifetime only AFTER an actual engine-minted typed take.
    // Neither callers nor plugins can supply arbitrary requests/path/cap here.
    private Exchange sendOwned(AuthorizedRequest request,String device,char[] credential,NativeRetainedHttp.Attempt attempt,
        String expectedPath,int maximumBody,long started)throws VaultFailure {
        return sendOwned(request,device,credential,attempt,expectedPath,maximumBody,started,null);
    }
    private Exchange sendOwned(AuthorizedRequest request,String device,char[] credential,NativeRetainedHttp.Attempt attempt,
        String expectedPath,int maximumBody,long started,OriginalSourceCheck originalSource)throws VaultFailure {
        HttpsURLConnection connection=null;byte[] received=null;Exchange result=null;ExchangeLifetime lifetime=null;
        Throwable primaryFailure=null;
        try {
            if(request==null||!expectedPath.equals(request.path)||!"POST".equals(request.method)
                ||request.body.length<1||request.body.length>maximumBody||!device.equals(VaultValidation.deviceId(device)))throw unknown();
            String nonce=request.headers.get("X-Memphis-Native-Request-Id"),time=request.headers.get("X-Memphis-Native-Request-Timestamp");
            long originalMillis=VaultTimestamps.epochMillis(time,NativeRetainedAttempt.FAILURE);NativeRetainedAttempt.requireFresh(time,clock.nowMillis());
            if(!NativeAttestation.requestHeaders(request,device,credential,nonce,originalMillis).equals(request.headers))throw unknown();
            URL exact=new URL(ORIGIN+expectedPath);connection=connections.open(exact);
            if(connection==null||!exact.toString().equals(connection.getURL().toString()))throw unknown();
            // Short private test budgets cover IO, not costly synthetic source
            // preparation. Production retains the whole-send budget plus the
            // SAME original Attempt deadline; neither clock renews attestation.
            lifetime=new ExchangeLifetime(connection,attempt,budgetNanos==MAX_EXCHANGE_NANOS?started:System.nanoTime(),budgetNanos,originalSource);
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(lifetime.timeout(5000));connection.setReadTimeout(lifetime.timeout(10000));
            connection.setUseCaches(false);connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setFixedLengthStreamingMode(request.body.length);
            for(Map.Entry<String,String> header:request.headers.entrySet())connection.setRequestProperty(header.getKey(),header.getValue());
            connection.setRequestProperty("Content-Type","application/json; charset=utf-8");connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("Accept-Encoding","identity");connection.setRequestProperty("Origin","https://localhost");
            connection.setRequestProperty("X-Memphis-App-Edition","custodial");connection.setRequestProperty("X-Device-Id",device);
            String privateHeader=new String(credential);connection.setRequestProperty("Authorization","Device "+privateHeader);
            connection.setRequestProperty("X-Device-Credential",privateHeader);connection.setRequestProperty("X-Memphis-Device-Credential",privateHeader);privateHeader=null;
            lifetime.check();NativeRetainedAttempt.requireFresh(time,clock.nowMillis());
            try(OutputStream output=connection.getOutputStream()){lifetime.check();output.write(request.body);lifetime.check();}
            lifetime.check();connection.setReadTimeout(lifetime.timeout(10000));int status=connection.getResponseCode();lifetime.check();if(status<100||status>599)throw unknown();
            Map<String,List<String>> headers=connection.getHeaderFields();lifetime.check();if(headers==null)throw unknown();int types=0,encodings=0;String type=null;
            for(var header:headers.entrySet())if(header.getKey()!=null){String name=header.getKey().toLowerCase(Locale.ROOT);
                if(name.equals("content-type")){if(++types!=1||header.getValue()==null||header.getValue().size()!=1)throw unknown();type=header.getValue().get(0);}
                if(name.equals("content-encoding")){if(++encodings!=1||header.getValue()==null||header.getValue().size()!=1||!"identity".equalsIgnoreCase(header.getValue().get(0)))throw unknown();}
            }
            received=read(status>=400?connection.getErrorStream():connection.getInputStream(),connection,lifetime);
            if(received.length>0){if(type==null||!type.toLowerCase(Locale.ROOT).matches("application/json(?:;\\s*charset=utf-8)?"))throw unknown();
                if(SecretScrubber.containsSecret(ProviderWireJson.parse(received,MAX_RESPONSE),credential))throw new VaultFailure("custodial_native_secret_response_refused");}
            lifetime.check();result=new Exchange(status,nonce,NativeRetainedAttempt.hash(request.body),received);
        }catch(VaultFailure error){primaryFailure=error;throw error;}
        catch(Exception error){VaultFailure failure=unknown();primaryFailure=failure;throw failure;}
        catch(Error error){primaryFailure=error;throw error;}
        finally{
            try {
                if(lifetime!=null){lifetime.finish();lifetime.check();}
                else if(connection!=null)connection.disconnect();
            }catch(Exception cleanup){
                if(result!=null)result.close();
                // Cleanup details can contain private provider/response data.
                // Retain the primary failure and attach only the bounded code.
                VaultFailure failure=unknown();
                if(primaryFailure!=null)primaryFailure.addSuppressed(failure);else throw failure;
            }
            finally{if(request!=null)Arrays.fill(request.body,(byte)0);if(received!=null)Arrays.fill(received,(byte)0);}
        }
        return result;
    }
    private static byte[] read(InputStream stream,HttpsURLConnection connection,ExchangeLifetime lifetime)throws Exception {
        lifetime.check();
        if(stream==null)return new byte[0];byte[] buffer=new byte[8192],result=null;
        try(InputStream input=stream;WipedBuffer out=new WipedBuffer()){
            while(true){lifetime.check();connection.setReadTimeout(lifetime.timeout(10000));int n=input.read(buffer,0,Math.min(buffer.length,MAX_RESPONSE-out.size()+1));lifetime.check();if(n<0)break;
                if(n>MAX_RESPONSE-out.size())throw unknown();out.write(buffer,0,n);}result=out.toByteArray();
        }catch(Exception failure){if(result!=null)Arrays.fill(result,(byte)0);throw failure;
        }finally{Arrays.fill(buffer,(byte)0);}
        return result;
    }
    /** IO remains on its original caller. A disconnect signal is not settled
     * IO, and cannot release the caller's dispatch/credential ownership. */
    private static final class ExchangeLifetime {
        private final NativeRetainedHttp.Attempt attempt;
        private final CancellationHandle handle;
        private final long started,budget;
        private final Thread caller,watchdog;
        private boolean finished;
        private volatile boolean expired;
        ExchangeLifetime(HttpsURLConnection connection,NativeRetainedHttp.Attempt attempt,long started,long budget)throws VaultFailure {
            this(connection,attempt,started,budget,null);
        }
        private final OriginalSourceCheck originalSource;
        ExchangeLifetime(HttpsURLConnection connection,NativeRetainedHttp.Attempt attempt,long started,long budget,OriginalSourceCheck originalSource)throws VaultFailure {
            this.attempt=attempt;this.started=started;this.budget=budget;caller=Thread.currentThread();
            this.originalSource=originalSource;
            handle=new CancellationHandle(connection);
            attempt.attach(handle);
            watchdog=new Thread(this::watch,"custodial-original-private-http-lifetime");
            try{watchdog.start();}catch(RuntimeException failure){expired=true;/* Fail closed; finish still owns cleanup/detach. */}
        }
        private long remaining(){return budget-(System.nanoTime()-started);}
        void check()throws VaultFailure {
            attempt.check();if(expired||remaining()<=0||caller.isInterrupted())throw unknown();
            // Native original owners are caller-thread observations, not a
            // second inventory reader on the cancellation watchdog. Recheck
            // at EVERY owning I/O boundary; timeout/cancel stays independent.
            if(originalSource!=null&&Thread.currentThread()==caller)originalSource.check();
        }
        int timeout(int maximum)throws VaultFailure {
            check();return (int)Math.max(1,Math.min(attempt.timeout(maximum),(remaining()+999_999L)/1_000_000L));
        }
        private void watch(){
            synchronized(this){
                while(!finished){
                    try{check();wait(Math.min(20,timeout(20)));}
                    catch(VaultFailure|InterruptedException cancellation){expired=true;break;}
                }
                if(finished)return;
            }
            try{handle.disconnect();}catch(RuntimeException ignored){/* UNKNOWN; finish retains failure. */}
        }
        void finish(){
            synchronized(this){finished=true;notifyAll();}
            boolean interrupted=false;
            for(;;)try{watchdog.join();break;}catch(InterruptedException pending){interrupted=true;}
            try{handle.disconnect();}
            finally{attempt.detach(handle);if(interrupted)Thread.currentThread().interrupt();}
        }
    }
    /** Attached only as Attempt's cancellation identity, never used for HTTP
     * or TLS. Concurrent/late cancel calls join the SAME disconnect; even a
     * cancel which captured this handle before detach cannot reopen cleanup. */
    private static final class CancellationHandle extends HttpsURLConnection {
        private final HttpsURLConnection connection;
        private boolean disconnecting,settled;
        private RuntimeException failure;
        CancellationHandle(HttpsURLConnection connection){super(connection.getURL());this.connection=connection;}
        @Override public void disconnect(){
            boolean interrupted=false;
            synchronized(this){
                while(disconnecting&&!settled)try{wait();}catch(InterruptedException pending){interrupted=true;}
                if(settled){if(interrupted)Thread.currentThread().interrupt();if(failure!=null)throw failure;return;}
                disconnecting=true;
            }
            try{connection.disconnect();}catch(RuntimeException error){synchronized(this){failure=error;}throw error;}
            finally{synchronized(this){settled=true;notifyAll();}if(interrupted)Thread.currentThread().interrupt();}
        }
        @Override public boolean usingProxy(){throw new UnsupportedOperationException("cancellation_only");}
        @Override public void connect(){throw new UnsupportedOperationException("cancellation_only");}
        @Override public String getCipherSuite(){throw new UnsupportedOperationException("cancellation_only");}
        @Override public java.security.cert.Certificate[] getLocalCertificates(){throw new UnsupportedOperationException("cancellation_only");}
        @Override public java.security.cert.Certificate[] getServerCertificates(){throw new UnsupportedOperationException("cancellation_only");}
    }
    private static final class WipedBuffer extends ByteArrayOutputStream { @Override public void close(){Arrays.fill(buf,(byte)0);reset();} }
    private static VaultFailure unknown(){return new VaultFailure("custodial_private_custody_transport_outcome_unknown");}
}
