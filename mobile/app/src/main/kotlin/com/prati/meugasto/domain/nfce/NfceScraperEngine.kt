package com.prati.meugasto.domain.nfce

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.header
import io.ktor.client.request.prepareGet
import io.ktor.client.statement.bodyAsChannel
import io.ktor.http.HttpHeaders
import io.ktor.http.charset
import io.ktor.utils.io.readAvailable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.net.URI
import java.util.concurrent.TimeUnit

sealed class NfceScrapeException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause) {
    class InvalidUrl(
        message: String = "QR Code inválido ou fora do padrão de portal NFC-e."
    ) : NfceScrapeException(message)

    class UnsupportedState(
        val detectedUf: String?,
        val supportedUfs: List<String>
    ) : NfceScrapeException(
        buildString {
            if (detectedUf != null) {
                append("Estado $detectedUf ainda não suportado.")
            } else {
                append("Estado desta NFC-e ainda não suportado.")
            }
            if (supportedUfs.isNotEmpty()) {
                append(" Estados disponiveis: ${supportedUfs.joinToString(", ")}.")
            }
        }
    )

    class NetworkFailure(
        message: String,
        cause: Throwable? = null
    ) : NfceScrapeException(message, cause)

    class ParseFailure(
        message: String,
        cause: Throwable? = null
    ) : NfceScrapeException(message, cause)
}

class NfceScraperEngine(
    private val strategies: List<NfceStateStrategy> = NfceStateRegistry.strategies,
    httpClient: HttpClient? = null
) {
    private val client: HttpClient by lazy {
        httpClient ?: HttpClient(OkHttp) {
            followRedirects = false
            engine {
                config {
                    followRedirects(false)
                    followSslRedirects(false)
                    connectTimeout(15, TimeUnit.SECONDS)
                    readTimeout(15, TimeUnit.SECONDS)
                }
            }
        }
    }

    suspend fun scrapeUrl(url: String): Result<NfceScrapedData> = withContext(Dispatchers.IO) {
        try {
            val normalizedUrl = NfceStateRegistry.promoteKnownPortalToHttps(url, strategies)
            val strategy = resolveStrategyOrThrow(normalizedUrl)
            val html = fetchPortalHtml(normalizedUrl, strategy)
            val scrapedData = try {
                strategy.parseHtml(html, normalizedUrl)
            } catch (e: Exception) {
                throw NfceScrapeException.ParseFailure(
                    e.message ?: "Não foi possível extrair os itens da nota fiscal.",
                    e
                )
            }
            Result.success(scrapedData)
        } catch (e: CancellationException) {
            throw e
        } catch (e: NfceScrapeException) {
            Result.failure(e)
        } catch (e: Exception) {
            Result.failure(
                NfceScrapeException.NetworkFailure(
                    "Falha de comunicação com o portal da SEFAZ.",
                    e
                )
            )
        }
    }

    fun parseWithStrategy(html: String, url: String): Result<NfceScrapedData> {
        return try {
            val normalizedUrl = NfceStateRegistry.promoteKnownPortalToHttps(url, strategies)
            val strategy = resolveStrategyOrThrow(normalizedUrl)
            val parsed = try {
                strategy.parseHtml(html, normalizedUrl)
            } catch (e: Exception) {
                throw NfceScrapeException.ParseFailure(
                    e.message ?: "Não foi possível extrair os itens da nota fiscal.",
                    e
                )
            }
            Result.success(parsed)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun resolveStrategyOrThrow(normalizedUrl: String): NfceStateStrategy {
        val uri = runCatching { URI(normalizedUrl) }.getOrNull()
        val scheme = uri?.scheme?.lowercase()
        val host = uri?.host?.lowercase()
        if (uri == null || host.isNullOrBlank() || uri.userInfo != null || (scheme != "https" && scheme != "http")) {
            throw NfceScrapeException.InvalidUrl()
        }

        strategies.firstOrNull { it.canHandle(normalizedUrl) }?.let { return it }

        val detectedUf = NfceStateRegistry.detectUfFromUrl(normalizedUrl)
        if (detectedUf != null || host.endsWith(".gov.br")) {
            throw NfceScrapeException.UnsupportedState(
                detectedUf = detectedUf,
                supportedUfs = strategies.map { it.stateUf }
            )
        }

        throw NfceScrapeException.InvalidUrl()
    }

    private suspend fun fetchPortalHtml(initialUrl: String, strategy: NfceStateStrategy): String {
        var currentUrl = initialUrl
        var redirectCount = 0

        while (true) {
            if (!isAllowedStrategyRedirectTarget(currentUrl, strategy)) {
                throw NfceScrapeException.NetworkFailure("Portal de destino não autorizado para consulta NFC-e.")
            }

            var nextUrl: String? = null
            var htmlBody: String? = null

            client.prepareGet(currentUrl) {
                header(
                    HttpHeaders.UserAgent,
                    "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
                )
                header(
                    HttpHeaders.Accept,
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                )
            }.execute { response ->
                val status = response.status.value
                when (status) {
                    in 300..399 -> {
                        if (redirectCount >= MAX_REDIRECTS) {
                            throw NfceScrapeException.NetworkFailure("Excesso de redirecionamentos no portal da SEFAZ.")
                        }
                        val location = response.headers[HttpHeaders.Location]
                            ?: throw NfceScrapeException.NetworkFailure("Redirecionamento sem destino no portal da SEFAZ.")
                        val resolved = runCatching { URI(currentUrl).resolve(location).toString() }.getOrNull()
                            ?: throw NfceScrapeException.NetworkFailure("URL de redirecionamento inválida.")
                        val promoted = NfceStateRegistry.promoteKnownPortalToHttps(resolved, listOf(strategy))
                        if (!isAllowedStrategyRedirectTarget(promoted, strategy)) {
                            throw NfceScrapeException.NetworkFailure("Redirecionamento bloqueado fora do portal SEFAZ autorizado.")
                        }
                        nextUrl = promoted
                        redirectCount++
                    }

                    in 200..299 -> {
                        val channel = response.bodyAsChannel()
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        val out = ByteArrayOutputStream()
                        var totalBytes = 0
                        while (!channel.isClosedForRead) {
                            val read = channel.readAvailable(buffer, 0, buffer.size)
                            if (read < 0) break
                            if (read == 0) continue
                            totalBytes += read
                            if (totalBytes > MAX_HTML_BYTES) {
                                throw NfceScrapeException.NetworkFailure("Resposta do portal da SEFAZ excedeu o limite seguro.")
                            }
                            out.write(buffer, 0, read)
                        }
                        val charset = response.charset() ?: Charsets.UTF_8
                        htmlBody = out.toByteArray().toString(charset)
                    }

                    else -> {
                        throw NfceScrapeException.NetworkFailure("Portal da SEFAZ retornou erro HTTP $status.")
                    }
                }
            }

            if (htmlBody != null) {
                return htmlBody!!
            }
            currentUrl = nextUrl ?: throw NfceScrapeException.NetworkFailure("Resposta vazia do portal da SEFAZ.")
        }
    }

    private fun isAllowedStrategyRedirectTarget(url: String, strategy: NfceStateStrategy): Boolean {
        val uri = runCatching { URI(url) }.getOrNull() ?: return false
        if (uri.userInfo != null) return false
        return strategy.canHandle(url)
    }

    private companion object {
        const val MAX_REDIRECTS = 5
        const val MAX_HTML_BYTES = 2 * 1024 * 1024
    }
}
