package org.memphiszoo.custodial.sync

import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class OperationTransportFactoryTest {
    @Test
    fun disabledRuntimeFailsClosedWithoutRequiringNetwork() {
        val transport = OperationTransportFactory.create(
            configuration = NativeOperationRuntimeConfiguration(enabled = false, baseUrl = ""),
        )
        assertTrue(transport is UnconfiguredOperationTransport)
    }

    @Test
    fun enabledRuntimeCreatesExactHttpTransport() {
        val transport = OperationTransportFactory.create(
            configuration = NativeOperationRuntimeConfiguration(enabled = true, baseUrl = "https://example.invalid"),
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
    @Test
    fun enabledRuntimeRefusesMissingCredentialOwningClient() {
        assertThrows(IllegalArgumentException::class.java) {
            OperationTransportFactory.create(
                configuration = NativeOperationRuntimeConfiguration(
                    enabled = true,
                    baseUrl = "https://example.invalid",
                ),
            )
        }
    }

}
