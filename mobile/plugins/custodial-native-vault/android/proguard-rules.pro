# Capacitor discovers the annotated plugin class through generated registration.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * extends com.getcapacitor.Plugin { *; }

# State-machine/adapters are referenced directly from the kept facade and may
# otherwise be optimized normally. No credential-bearing debug rules are used.
