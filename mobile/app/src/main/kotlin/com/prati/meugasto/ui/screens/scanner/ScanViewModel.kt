package com.prati.meugasto.ui.screens.scanner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.domain.model.Item
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.domain.model.Supermarket
import com.prati.meugasto.domain.nfce.NfceScrapedData
import com.prati.meugasto.domain.nfce.NfceScraper
import com.prati.meugasto.domain.nfce.NfceScraperEngine
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

data class ScanUiState(
    val step: ScanState = ScanState.Scanning,
    val isSaving: Boolean = false
)

data class PurchaseSavedEvent(val id: Long)

class ScanViewModel(
    private val repository: PurchaseRepository,
    private val scraper: NfceScraper = NfceScraperEngine()
) : ViewModel() {

    private val _state = MutableStateFlow(ScanUiState())
    val state = _state.asStateFlow()

    private val savedPurchaseEvents = Channel<PurchaseSavedEvent>(Channel.BUFFERED)
    val savedPurchases = savedPurchaseEvents.receiveAsFlow()

    private var lastScrapedData: NfceScrapedData? = null

    fun onQrDetected(url: String) {
        if (_state.value.step != ScanState.Scanning) return
        _state.value = ScanUiState(step = ScanState.Processing)
        viewModelScope.launch {
            scraper.scrapeUrl(url)
                .onSuccess { data ->
                    lastScrapedData = data
                    _state.value = ScanUiState(step = ScanState.Confirmation(data))
                }
                .onFailure { error ->
                    _state.value = ScanUiState(step = ScanState.Error(mapScrapeFailure(error)))
                }
        }
    }

    fun onCameraUnavailable() {
        if (_state.value.isSaving) return
        _state.value = ScanUiState(step = ScanState.Error(ScanFailure.CameraUnavailable))
    }

    fun cancelConfirmation() {
        if (_state.value.isSaving) return
        lastScrapedData = null
        _state.value = ScanUiState()
    }

    fun confirmPurchase() {
        val current = _state.value
        if (current.isSaving) return
        val data = (current.step as? ScanState.Confirmation)?.data ?: return

        _state.value = current.copy(isSaving = true)
        viewModelScope.launch {
            try {
                val result = repository.savePurchase(data.toPurchase())
                if (result.warning == null) lastScrapedData = null
                if (result.alreadyExisted) {
                    _state.value = ScanUiState(step = ScanState.Duplicate(result.id, result.warning))
                } else {
                    _state.value = ScanUiState()
                    savedPurchaseEvents.send(PurchaseSavedEvent(result.id))
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = ScanUiState(
                    step = ScanState.Error(ScanFailure.SaveFailed),
                    isSaving = false
                )
            }
        }
    }

    fun retryPriceVerification() {
        if (_state.value.isSaving) return
        val duplicate = _state.value.step as? ScanState.Duplicate ?: return
        if (duplicate.warning == null) return
        val data = lastScrapedData ?: return
        _state.value = ScanUiState(step = ScanState.Confirmation(data))
        confirmPurchase()
    }

    fun retry() {
        if (_state.value.isSaving) return
        val failure = (_state.value.step as? ScanState.Error)?.failure
        val data = lastScrapedData
        _state.value = if (failure == ScanFailure.SaveFailed && data != null) {
            ScanUiState(step = ScanState.Confirmation(data))
        } else {
            lastScrapedData = null
            ScanUiState()
        }
    }
}

private fun NfceScrapedData.toPurchase(): Purchase = Purchase(
    supermarket = Supermarket(
        name = supermarket.name,
        cnpj = supermarket.cnpj,
        state = supermarket.state,
        type = supermarket.type
    ),
    date = date,
    totalPrice = totalPrice,
    accessKey = accessKey,
    products = items.map { item ->
        Item(
            name = item.name,
            quantity = item.quantity,
            unit = item.unit,
            price = item.price
        )
    }
)
