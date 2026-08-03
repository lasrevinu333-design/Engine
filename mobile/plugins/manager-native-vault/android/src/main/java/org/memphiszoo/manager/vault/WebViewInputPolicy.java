package org.memphiszoo.manager.vault;

/** Bounds untrusted WebView values before any proportional native allocation. */
final class WebViewInputPolicy {
    static final int MAX_DECODED_BODY_BYTES = RequestPolicy.MAX_REQUEST_BYTES;
    static final int MAX_ENCODED_BODY_CHARS = 4 * ((MAX_DECODED_BODY_BYTES + 2) / 3);

    private WebViewInputPolicy() {}

    static String enrollmentCode(String value) throws VaultFailure {
        if (value == null || value.length() != 8) throw new VaultFailure("manager_native_invalid_enrollment");
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (character < '0' || character > '9') throw new VaultFailure("manager_native_invalid_enrollment");
        }
        return value;
    }

    static String deviceLabel(String value) throws VaultFailure {
        String label = VaultValidation.safeText(value, 160, "manager_v2_invalid_device_label");
        if (label.isEmpty()) throw new VaultFailure("manager_v2_invalid_device_label");
        return label;
    }

    static void validateBodyBase64(String encoded) throws VaultFailure {
        if (encoded == null || encoded.isEmpty()) return;
        int length = encoded.length();
        if (length > MAX_ENCODED_BODY_CHARS) throw new VaultFailure("manager_native_request_too_large");
        if ((length & 3) != 0) throw new VaultFailure("manager_native_body_refused");
        int padding = 0;
        if (encoded.charAt(length - 1) == '=') padding += 1;
        if (length > 1 && encoded.charAt(length - 2) == '=') padding += 1;
        for (int index = 0; index < length - padding; index += 1) {
            char character = encoded.charAt(index);
            boolean valid = (character >= 'A' && character <= 'Z')
                || (character >= 'a' && character <= 'z')
                || (character >= '0' && character <= '9')
                || character == '+'
                || character == '/';
            if (!valid) throw new VaultFailure("manager_native_body_refused");
        }
        for (int index = length - padding; index < length; index += 1) {
            if (encoded.charAt(index) != '=') throw new VaultFailure("manager_native_body_refused");
        }
        long decoded = ((long) length / 4L) * 3L - padding;
        if (decoded > MAX_DECODED_BODY_BYTES) throw new VaultFailure("manager_native_request_too_large");
    }

    static void validateHeader(String name, String value) throws VaultFailure {
        if (
            name == null
            || value == null
            || name.length() < 1
            || name.length() > 80
            || value.length() > 8192
            || value.indexOf('\r') >= 0
            || value.indexOf('\n') >= 0
        ) throw new VaultFailure("manager_native_headers_refused");
    }
}
