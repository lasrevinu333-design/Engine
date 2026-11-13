package org.memphiszoo.custodial.vault;

interface InstallationSealGenerator {
    String newSeal() throws VaultFailure;
}
