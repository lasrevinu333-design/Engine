package org.memphiszoo.custodial.vault;

import java.util.Map;
import java.util.UUID;

/** In-memory Activity presentation. Grants no credential, data, or effect authority. */
final class PhonePresentation {
    private Object wake;
    private String principal;
    private String challenge;
    private boolean unlocked;

    synchronized void resume() {
        pause();
        wake = new Object();
    }

    synchronized void pause() {
        wake = null;
        principal = null;
        challenge = null;
        unlocked = false;
    }

    synchronized Object captureWake() { return wake; }

    synchronized Map<String, Object> observe(Object originalWake, String boundPrincipal, String unlockChallenge) {
        if (originalWake == null || originalWake != wake) return Map.of("unlocked", false);
        if (boundPrincipal == null) {
            principal = null;
            challenge = null;
            unlocked = false;
            return Map.of("unlocked", false);
        }
        if (!boundPrincipal.equals(principal)) {
            principal = boundPrincipal;
            challenge = UUID.randomUUID().toString();
            unlocked = false;
        }
        if (challenge.equals(unlockChallenge)) unlocked = true;
        return Map.of("wake", challenge, "unlocked", unlocked);
    }
}
