package org.memphiszoo.custodial.vault;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.os.Build;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class AndroidProviderAppIdentity {
    private AndroidProviderAppIdentity() {}
    static NativeProviderAppIdentity read(Context context) throws VaultFailure {
        try {
            Context app = context.getApplicationContext();
            if (!NativeProviderAppIdentity.PACKAGE.equals(app.getPackageName())) throw new VaultFailure("custodial_provider_native_build_identity_invalid");
            PackageInfo info = app.getPackageManager().getPackageInfo(app.getPackageName(), 0);
            long version = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            // This is the immutable asset embedded and verified by existing release admission,
            // not WebView/localStorage, the network, a caller path or stale generated directory.
            try (InputStream input = app.getAssets().open("public/build.json"); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > 65536) throw new VaultFailure("custodial_provider_native_build_identity_invalid");
                    bytes.write(buffer, 0, count);
                }
                String json = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
                return NativeProviderAppIdentity.fromPackaged(info.packageName, info.versionName, version, new JSONObject(json));
            }
        } catch (VaultFailure error) { throw error; }
        catch (Exception error) { throw new VaultFailure("custodial_provider_native_build_identity_unavailable", error); }
    }
}
