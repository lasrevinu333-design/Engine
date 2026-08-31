package org.memphiszoo.custodial.sync

import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class OperationTransportFactoryTest {
    @Test
    fun disabledRuntimeFailsClosedWithoutRequiringNetwork() {
        val transport = OperationTransportFactory.create(
            configuration = NativeOperationRuntimeConfiguration(enabled = false, baseUrl = ""),
            authorizationProvider = DeviceAuthorizationProvider { error("must not read credential") },
            client = OperationHttpClient { error("must not open network") },
        )
        assertTrue(transport is UnconfiguredOperationTransport)
    }

    @Test
    fun enabledRuntimeCreatesExactHttpTransport() {
        val transport = OperationTransportFactory.create(
            configuration = NativeOperationRuntimeConfiguration(enabled = true, baseUrl = "https://example.invalid"),
            authorizationProvider = DeviceAuthorizationProvider { "Bearer token" },
            client = OperationHttpClient { OperationHttpResponse(500) },
        )
        assertTrue(transport is HttpOperationTransport)
    }

    @Test
    fun enabledRuntimeRejectsInsecureOrMalformedEndpoint() {
        assertThrows(IllegalArgumentException::class.java) {
            NativeOperationRuntimeConfiguration(enabled = true, baseUrl = "http://example.invalid")
        }
        assertThrows(IllegalArgumentException::class.java) {
            NativeOperationRuntimeConfiguration(enabled = true, baseUrl = "https://example.invalid/")
        }
    }
}
