package org.memphiszoo.manager.vault;

interface InstallationSealGenerator {
    String newSeal() throws VaultFailure;
}
