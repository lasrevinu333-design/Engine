package org.memphiszoo.custodial.vault;

import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/** Normal fixed counter publication only, not WORK, auth or ACK authority.
 * The native issuer owns the original records, empty reservation and lock.
 * Failure retains unknown slots/originals; no fallback, retry or deletion. */
final class NativePrivateMutationEpochPublisher {
    private NativePrivateMutationEpochPublisher() {}

    static void publish(NativePrivateMutationEpochStore.FixedCounterPublication publication) throws VaultFailure {
        if(publication==null)throw new VaultFailure(NativePrivateMutationEpochStore.FAILURE);
        try(FileChannel reserved=publication.reserveDestination()) {
            Path source=publication.source();
            Path destination=publication.destination();
            publication.requireReservedDestination(reserved);
            Files.move(source,destination,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
            publication.requirePublishedOriginal();
        } catch(VaultFailure failure) {
            throw failure;
        } catch(Exception failure) {
            throw new VaultFailure(NativePrivateMutationEpochStore.FAILURE,failure);
        }
    }
}
