package com.prati.meugasto.domain.nfce

import android.util.Log
import com.prati.meugasto.domain.nfce.strategies.RjNfceStrategy
import com.prati.meugasto.domain.nfce.strategies.RsNfceStrategy
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.time.Duration
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

class NfceScraperEngine(
    private val strategies: List<NfceStateStrategy> = listOf(
        RsNfceStrategy(),
        RjNfceStrategy()
    )
) {
    private val httpClient by lazy {
        val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        })

        val sslContext = SSLContext.getInstance("TLS").apply {
            init(null, trustAllCerts, SecureRandom())
        }

        HttpClient(OkHttp) {
            engine {
                config {
                    sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as X509TrustManager)
                    hostnameVerifier { _, _ -> true }
                    followRedirects(true)
                    connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                    readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
                }
            }
        }
    }

    suspend fun scrapeUrl(url: String): Result<NfceScrapedData> = withContext(Dispatchers.IO) {
        try {
            val strategy = strategies.firstOrNull { it.canHandle(url) }
                ?: return@withContext Result.failure(
                    IllegalArgumentException("Estado não suportado para a URL: $url")
                )

            // Tentativa GET-first
            val response = httpClient.get(url) {
                header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36")
                header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            }

            val html = response.bodyAsText()
            Log.d("NfceScraperEngine", "HTML length: ${html.length}")
            Log.d("NfceScraperEngine", "HTML preview: ${html.take(2000)}")
            val scrapedData = strategy.parseHtml(html, url)
            Log.d("NfceScraperEngine", "Scraped items: ${scrapedData.items.size}")
            Result.success(scrapedData)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun parseWithStrategy(html: String, url: String): Result<NfceScrapedData> {
        return try {
            val strategy = strategies.firstOrNull { it.canHandle(url) }
                ?: return Result.failure(IllegalArgumentException("Nenhuma estratégia encontrada para a URL"))
            Result.success(strategy.parseHtml(html, url))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

