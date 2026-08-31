package org.memphiszoo.custodial.sync

/** Release-controlled runtime configuration. */
data class NativeOperationRuntimeConfiguration(
    val enabled: Boolean,
    val baseUrl: String,
    val pathPrefix: String = "/scan-api/native-v1/operations",
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
        client: OperationHttpClient? = null,
        receiptDecoder: CanonicalReceiptDecoder = HeaderCanonicalReceiptDecoder(),
    ): OperationTransport {
        if (!configuration.enabled) return UnconfiguredOperationTransport()
        val authorizedClient = requireNotNull(client) {
            "Enabled native operation transport requires a credential-owning HTTP client."
        }
        return HttpOperationTransport(
            configuration = OperationEndpointConfiguration(
                baseUrl = configuration.baseUrl,
                operationPathPrefix = configuration.pathPrefix,
            ),
            client = authorizedClient,
            receiptDecoder = receiptDecoder,
        )
    }
}
