package org.memphiszoo.custodial.vault;

final class VaultFailure extends Exception {
    final String code;
    final int httpStatus;
    final String remoteReason;

    VaultFailure(String code) {
        this(code, 0, "", null);
    }

    VaultFailure(String code, Throwable cause) {
        this(code, 0, "", cause);
    }

    VaultFailure(String code, int httpStatus) {
        this(code, httpStatus, "", null);
    }

    VaultFailure(String code, int httpStatus, Throwable cause) {
        this(code, httpStatus, "", cause);
    }

    VaultFailure(String code, int httpStatus, String remoteReason) {
        this(code, httpStatus, remoteReason, null);
    }

    VaultFailure(String code, int httpStatus, String remoteReason, Throwable cause) {
        super(code, cause);
        this.code = code;
        this.httpStatus = httpStatus >= 100 && httpStatus <= 599 ? httpStatus : 0;
        String reason = remoteReason == null ? "" : remoteReason.trim().toLowerCase(java.util.Locale.ROOT);
        this.remoteReason = reason.matches("^[a-z][a-z0-9_:-]{0,95}$") ? reason : "";
    }
}
