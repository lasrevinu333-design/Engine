package org.memphiszoo.custodial.sync

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.NoRouteToHostException
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext

/** Android HTTPS implementation for [OperationHttpClient]. */
class AndroidOperationHttpClient(
    private val connectTimeoutMs: Int = 15_000,
    private val readTimeoutMs: Int = 30_000,
    private val maxResponseBytes: Int = 256 * 1024,
) : OperationHttpClient {
    init {
        require(connectTimeoutMs > 0)
        require(readTimeoutMs > 0)
        require(maxResponseBytes in 1..(1024 * 1024))
    }

    override suspend fun execute(request: OperationHttpRequest): OperationHttpResponse = withContext(Dispatchers.IO) {
        coroutineContext.ensureActive()
        require(request.url.startsWith("https://")) { "Custodial operation requests require HTTPS." }
        var bodyWriteStarted = false
        var responseStarted = false
        val connection = try {
            (URL(request.url).openConnection() as? HttpsURLConnection)
                ?: throw OperationRequestNotSentException("The operation endpoint is not HTTPS.")
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: OperationRequestNotSentException) {
            throw failure
        } catch (failure: Throwable) {
            throw OperationRequestNotSentException("The secure operation connection could not be opened.", failure)
        }

        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = connectTimeoutMs
            connection.readTimeout = readTimeoutMs
            connection.requestMethod = request.method
            connection.useCaches = false
            connection.doInput = true
            for ((name, value) in request.headers) {
                connection.setRequestProperty(name, value)
            }
            request.body?.let { body ->
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(body.size)
                bodyWriteStarted = true
                connection.outputStream.use { output ->
                    output.write(body)
                    output.flush()
                }
            }
            coroutineContext.ensureActive()
            val status = connection.responseCode
            responseStarted = true
            val body = readBounded(
                stream = if (status >= HttpURLConnection.HTTP_BAD_REQUEST) connection.errorStream else connection.inputStream,
                maxBytes = maxResponseBytes,
            )
            val headers = linkedMapOf<String, String>()
            for ((name, values) in connection.headerFields.orEmpty()) {
                if (name != null && !values.isNullOrEmpty()) headers[name] = values.joinToString(",")
            }
            OperationHttpResponse(statusCode = status, headers = headers, body = body)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: UnknownHostException) {
            throw OperationRequestNotSentException("The operation host could not be found.", failure)
        } catch (failure: NoRouteToHostException) {
            throw OperationRequestNotSentException("The operation host could not be reached.", failure)
        } catch (failure: ConnectException) {
            throw OperationRequestNotSentException("The operation connection was refused.", failure)
        } catch (failure: ResponseTooLargeException) {
            throw OperationDeliveryUnknownException("The operation response exceeded the accepted size.", failure)
        } catch (failure: SocketTimeoutException) {
            if (bodyWriteStarted || responseStarted) {
                throw OperationDeliveryUnknownException("The operation timed out after delivery may have started.", failure)
            }
            throw OperationRequestNotSentException("The operation connection timed out before delivery.", failure)
        } catch (failure: IOException) {
            if (bodyWriteStarted || responseStarted) {
                throw OperationDeliveryUnknownException("The operation connection ended after delivery may have started.", failure)
            }
            throw OperationRequestNotSentException("The operation could not leave the phone.", failure)
        } finally {
            connection.disconnect()
        }
    }

    private fun readBounded(stream: java.io.InputStream?, maxBytes: Int): ByteArray {
        if (stream == null) return byteArrayOf()
        stream.use { input ->
            val output = ByteArrayOutputStream(minOf(maxBytes, 16 * 1024))
            val buffer = ByteArray(8 * 1024)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > maxBytes) throw ResponseTooLargeException()
                output.write(buffer, 0, count)
            }
            return output.toByteArray()
        }
    }

    private class ResponseTooLargeException : IOException()
}
