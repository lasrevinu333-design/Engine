package org.memphiszoo.custodial.sync

/** Release-controlled runtime configuration. */
data class NativeOperationRuntimeConfiguration(
    val enabled: Boolean,
    val baseUrl: String,
    val pathPrefix: String = "/custodial-native/v1/operations",
) {
    init {
        if (enabled) require(baseUrl.startsWith("https://")) { "Enabled native operation transport requires HTTPS." }
        require(!baseUrl.endsWith('/'))
        require(pathPrefix.startsWith('/') && !pathPrefix.endsWith('/'))
    }
}

object OperationTransportFactory {
    fun create(
        configuration: NativeOperationRuntimeConfiguration,
        authorizationProvider: DeviceAuthorizationProvider,
        client: OperationHttpClient = AndroidOperationHttpClient(),
        receiptDecoder: CanonicalReceiptDecoder = HeaderCanonicalReceiptDecoder(),
    ): OperationTransport {
        if (!configuration.enabled) return UnconfiguredOperationTransport()
        return HttpOperationTransport(
            configuration = OperationEndpointConfiguration(
                baseUrl = configuration.baseUrl,
                operationPathPrefix = configuration.pathPrefix,
            ),
            authorizationProvider = authorizationProvider,
            client = client,
            receiptDecoder = receiptDecoder,
        )
    }
}
