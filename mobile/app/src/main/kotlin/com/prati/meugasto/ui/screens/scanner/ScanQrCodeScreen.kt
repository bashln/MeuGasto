package com.prati.meugasto.ui.screens.scanner

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.domain.model.Item
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.domain.model.Supermarket
import com.prati.meugasto.domain.nfce.NfceScrapedData
import com.prati.meugasto.domain.nfce.NfceScraperEngine
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.util.concurrent.Executors
import kotlin.math.min

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanQrCodeScreen(
    repository: PurchaseRepository,
    onNavigateBack: () -> Unit,
    onPurchaseCreated: (Long) -> Unit,
    onPurchaseSaved: (Long) -> Unit = {}
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()
    val scraperEngine = remember { NfceScraperEngine() }

    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val barcodeScanner = remember { BarcodeScanning.getClient() }

    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
            barcodeScanner.close()
        }
    }

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    var scanState by remember { mutableStateOf<ScanState>(ScanState.Scanning) }
    var scrapedData by remember { mutableStateOf<NfceScrapedData?>(null) }
    var isSaving by remember { mutableStateOf(false) }

    val handleBack: () -> Unit = {
        when {
            isSaving -> Unit
            scanState is ScanState.Confirmation -> {
                scanState = ScanState.Scanning
                scrapedData = null
            }
            else -> onNavigateBack()
        }
    }
    BackHandler(onBack = handleBack)

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Escanear NFC-e",
                navigationIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onNavigateBack = handleBack
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val state = scanState) {
                is ScanState.Scanning -> {
                    CameraPreview(
                        hasCameraPermission = hasCameraPermission,
                        lifecycleOwner = lifecycleOwner,
                        cameraExecutor = cameraExecutor,
                        barcodeScanner = barcodeScanner,
                        onQrDetected = { url ->
                            scanState = ScanState.Processing
                            coroutineScope.launch {
                                val result = scraperEngine.scrapeUrl(url)
                                result.onSuccess { data ->
                                    scrapedData = data
                                    isSaving = false
                                    scanState = ScanState.Confirmation(data)
                                }.onFailure { error ->
                                    scanState = ScanState.Error(mapScrapeFailure(error))
                                }
                            }
                        },
                        onError = {
                            scanState = ScanState.Error(ScanFailure.CameraUnavailable)
                        },
                        permissionLauncher = permissionLauncher
                    )
                }

                is ScanState.Processing -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.height(AppSpacing.LG))
                        Text(
                            text = "Extraindo dados da nota fiscal...",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }

                is ScanState.Confirmation -> {
                    ConfirmationScreen(
                        data = state.data,
                        isSaving = isSaving,
                        onConfirm = {
                            if (isSaving) return@ConfirmationScreen
                            isSaving = true
                            coroutineScope.launch {
                                try {
                                    val purchase = Purchase(
                                        supermarket = Supermarket(
                                            name = state.data.supermarket.name,
                                            cnpj = state.data.supermarket.cnpj,
                                            state = state.data.supermarket.state,
                                            type = state.data.supermarket.type
                                        ),
                                        date = state.data.date,
                                        totalPrice = state.data.totalPrice,
                                        accessKey = state.data.accessKey,
                                        products = state.data.items.map { itm ->
                                            Item(
                                                name = itm.name,
                                                quantity = itm.quantity,
                                                unit = itm.unit,
                                                price = itm.price
                                            )
                                        }
                                    )
                                    val id = repository.savePurchase(purchase)
                                    onPurchaseSaved(id)
                                    onPurchaseCreated(id)
                                } catch (e: CancellationException) {
                                    throw e
                                } catch (e: Exception) {
                                    isSaving = false
                                    scanState = ScanState.Error(ScanFailure.SaveFailed)
                                }
                            }
                        },
                        onCancel = {
                            if (!isSaving) {
                                scanState = ScanState.Scanning
                                scrapedData = null
                            }
                        }
                    )
                }

                is ScanState.Error -> {
                    ErrorScreen(
                        failure = state.failure,
                        onRetry = {
                            isSaving = false
                            val pendingData = scrapedData
                            scanState = if (state.failure == ScanFailure.SaveFailed && pendingData != null) {
                                ScanState.Confirmation(pendingData)
                            } else {
                                ScanState.Scanning
                            }
                        },
                        onBack = onNavigateBack
                    )
                }
            }
        }
    }
}

sealed class ScanState {
    data object Scanning : ScanState()
    data object Processing : ScanState()
    data class Confirmation(val data: NfceScrapedData) : ScanState()
    data class Error(val failure: ScanFailure) : ScanState()
}

sealed interface ScanFailure {
    data object CameraUnavailable : ScanFailure
    data object InvalidQrCode : ScanFailure
    data class UnsupportedState(
        val detectedUf: String?,
        val supportedUfs: List<String>
    ) : ScanFailure
    data object NetworkError : ScanFailure
    data object ReceiptParseFailed : ScanFailure
    data object SaveFailed : ScanFailure
}

internal fun mapScrapeFailure(error: Throwable): ScanFailure = when (error) {
    is com.prati.meugasto.domain.nfce.NfceScrapeException.UnsupportedState ->
        ScanFailure.UnsupportedState(error.detectedUf, error.supportedUfs)
    is com.prati.meugasto.domain.nfce.NfceScrapeException.InvalidUrl ->
        ScanFailure.InvalidQrCode
    is com.prati.meugasto.domain.nfce.NfceScrapeException.NetworkFailure ->
        ScanFailure.NetworkError
    is com.prati.meugasto.domain.nfce.NfceScrapeException.ParseFailure ->
        ScanFailure.ReceiptParseFailed
    else -> ScanFailure.NetworkError
}

internal fun scanFailureCopy(failure: ScanFailure): Pair<String, String> = when (failure) {
    ScanFailure.CameraUnavailable -> "Não foi possível iniciar a câmera" to
        "Verifique se o MeuGasto tem permissão para usar a câmera e tente novamente."
    ScanFailure.InvalidQrCode -> "QR Code não reconhecido" to
        "Este código não aponta para uma nota fiscal eletrônica. Escaneie o QR Code impresso no cupom."
    is ScanFailure.UnsupportedState -> {
        val supported = failure.supportedUfs.sorted().joinToString(", ")
        val title = if (failure.detectedUf != null) {
            "Nota de ${failure.detectedUf} ainda não suportada"
        } else {
            "Estado ainda não suportado"
        }
        title to "O MeuGasto já lê notas de $supported. Novos estados são adicionados aos poucos."
    }
    ScanFailure.NetworkError -> "Não foi possível consultar a SEFAZ" to
        "Confira sua conexão e tente novamente. O portal do estado também pode estar indisponível."
    ScanFailure.ReceiptParseFailed -> "Não foi possível ler a NFC-e" to
        "O portal respondeu, mas os itens não puderam ser extraídos. Confira se o QR Code está legível e tente novamente."
    ScanFailure.SaveFailed -> "Não foi possível salvar a compra" to
        "Os dados foram lidos, mas não puderam ser gravados no aparelho. Tente novamente."
}

@Composable
fun CameraPreview(
    hasCameraPermission: Boolean,
    lifecycleOwner: androidx.lifecycle.LifecycleOwner,
    cameraExecutor: java.util.concurrent.ExecutorService,
    barcodeScanner: com.google.mlkit.vision.barcode.BarcodeScanner,
    onQrDetected: (String) -> Unit,
    onError: () -> Unit,
    permissionLauncher: androidx.activity.result.ActivityResultLauncher<String>
) {
    val context = LocalContext.current
    val cameraProviderRef = remember { mutableStateOf<ProcessCameraProvider?>(null) }
    val released = remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        onDispose {
            released.value = true
            cameraProviderRef.value?.unbindAll()
            cameraProviderRef.value = null
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (hasCameraPermission) {
            var isProcessing by remember { mutableStateOf(false) }

            AndroidView(
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

                    cameraProviderFuture.addListener({
                        if (released.value) return@addListener
                        val cameraProvider = cameraProviderFuture.get()
                        cameraProviderRef.value = cameraProvider
                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                        val imageAnalysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()

                        imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                            @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
                            val mediaImage = imageProxy.image
                            if (mediaImage != null && !isProcessing) {
                                val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                barcodeScanner.process(inputImage)
                                    .addOnSuccessListener { barcodes ->
                                        for (barcode in barcodes) {
                                            val rawValue = barcode.rawValue
                                            if (!rawValue.isNullOrBlank() && (rawValue.startsWith("http://") || rawValue.startsWith("https://"))) {
                                                isProcessing = true
                                                onQrDetected(rawValue)
                                                break
                                            }
                                        }
                                    }
                                    .addOnCompleteListener {
                                        imageProxy.close()
                                    }
                            } else {
                                imageProxy.close()
                            }
                        }

                        try {
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageAnalysis
                            )
                        } catch (_: Exception) {
                            onError()
                        }
                    }, ContextCompat.getMainExecutor(ctx))

                    previewView
                },
                modifier = Modifier.fillMaxSize()
            )

            QrScanOverlay(
                modifier = Modifier.fillMaxSize(),
                frameColor = MaterialTheme.colorScheme.primary
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(AppSpacing.XL),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom
            ) {
                Card(
                    shape = AppShapes.Medium,
                    colors = CardDefaults.cardColors(
                        containerColor = Color.Black.copy(alpha = 0.75f)
                    )
                ) {
                    Text(
                        text = "Aponte a câmera para o QR Code da NFC-e",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White,
                        modifier = Modifier.padding(AppSpacing.LG)
                    )
                }
                Spacer(modifier = Modifier.height(AppSpacing.XXL))
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(AppSpacing.XL),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PhotoCamera,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(AppSpacing.LG))
                Text(
                    text = "Permissão de câmera necessária para ler QR Codes de NFC-e.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(AppSpacing.LG))
                Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                    Text("Conceder Permissão")
                }
                TextButton(
                    onClick = {
                        val intent = Intent(
                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.fromParts("package", context.packageName, null)
                        )
                        context.startActivity(intent)
                    }
                ) {
                    Text("Abrir Ajustes do App")
                }
            }
        }
    }
}

/**
 * Overlay de guia de escaneamento: moldura com cantos destacados, escurecimento
 * externo e linha de leitura pulsante.
 */
@Composable
fun QrScanOverlay(
    modifier: Modifier = Modifier,
    frameColor: Color = Color.White
) {
    val infiniteTransition = rememberInfiniteTransition(label = "qr-scan-line")
    val lineAlpha by infiniteTransition.animateFloat(
        initialValue = 0.25f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 900),
            repeatMode = RepeatMode.Reverse
        ),
        label = "qr-scan-line-alpha"
    )

    Canvas(modifier = modifier) {
        val frameSize = min(size.width, size.height) * 0.64f
        val left = (size.width - frameSize) / 2f
        val top = (size.height - frameSize) / 2f - frameSize * 0.05f
        val right = left + frameSize
        val bottom = top + frameSize
        val cornerLength = frameSize * 0.14f
        val strokeWidth = 4.dp.toPx()
        val scrimColor = Color.Black.copy(alpha = 0.45f)

        // Escurece a área fora da moldura para direcionar o foco
        drawRect(color = scrimColor, topLeft = Offset(0f, 0f), size = Size(size.width, top))
        drawRect(color = scrimColor, topLeft = Offset(0f, bottom), size = Size(size.width, size.height - bottom))
        drawRect(color = scrimColor, topLeft = Offset(0f, top), size = Size(left, frameSize))
        drawRect(color = scrimColor, topLeft = Offset(right, top), size = Size(size.width - right, frameSize))

        fun corner(x1: Float, y1: Float, x2: Float, y2: Float) {
            drawLine(
                color = frameColor,
                start = Offset(x1, y1),
                end = Offset(x2, y2),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round
            )
        }

        // Cantos da moldura
        corner(left, top, left + cornerLength, top)
        corner(left, top, left, top + cornerLength)
        corner(right, top, right - cornerLength, top)
        corner(right, top, right, top + cornerLength)
        corner(left, bottom, left + cornerLength, bottom)
        corner(left, bottom, left, bottom - cornerLength)
        corner(right, bottom, right - cornerLength, bottom)
        corner(right, bottom, right, bottom - cornerLength)

        // Linha de leitura pulsante ao centro
        val centerY = top + frameSize / 2f
        drawLine(
            color = frameColor.copy(alpha = lineAlpha),
            start = Offset(left + cornerLength, centerY),
            end = Offset(right - cornerLength, centerY),
            strokeWidth = 2.dp.toPx(),
            cap = StrokeCap.Round
        )
    }
}

@Composable
fun ConfirmationScreen(
    data: NfceScrapedData,
    isSaving: Boolean = false,
    onConfirm: () -> Unit,
    onCancel: () -> Unit
) {
    val displayDate = remember(data.date) {
        val parts = data.date.split("-")
        if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else data.date
    }

    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = AppSpacing.LG),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.SM)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Medium,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Column(modifier = Modifier.padding(AppSpacing.LG)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = data.supermarket.name,
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.weight(1f)
                            )
                            Surface(
                                shape = AppShapes.Full,
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                            ) {
                                Text(
                                    text = data.supermarket.type.displayName,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                    modifier = Modifier.padding(horizontal = AppSpacing.SM, vertical = AppSpacing.XS)
                                )
                            }
                        }
                        if (data.supermarket.cnpj != null) {
                            Text(
                                text = "CNPJ: ${data.supermarket.cnpj}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                        Text(
                            text = "Data: $displayDate",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(AppSpacing.SM))
                Text(
                    text = "${data.items.size} itens encontrados",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            items(data.items) { item ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Small,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(AppSpacing.MD),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.name,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            val unitPriceText = remember(item) {
                                val quantity = if (item.quantity % 1.0 == 0.0) {
                                    item.quantity.toLong().toString()
                                } else {
                                    item.quantity.toString().replace('.', ',')
                                }
                                if (item.quantity != 1.0 && item.quantity > 0.0) {
                                    val formatted = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("pt", "BR")).format(item.unitPrice)
                                    "$quantity ${item.unit} • $formatted / ${item.unit}"
                                } else {
                                    "$quantity ${item.unit}"
                                }
                            }
                            Text(
                                text = unitPriceText,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        MoneyText(
                            value = item.price,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(AppSpacing.LG))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Medium,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(AppSpacing.LG),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Total",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        MoneyText(
                            value = data.totalPrice,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(AppSpacing.LG))
            }
        }

        Surface(
            modifier = Modifier.fillMaxWidth(),
            tonalElevation = 3.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(AppSpacing.LG),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.MD)
            ) {
                OutlinedButton(
                    onClick = onCancel,
                    enabled = !isSaving,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Escanear Novamente")
                }
                Button(
                    onClick = onConfirm,
                    enabled = !isSaving,
                    modifier = Modifier.weight(1f)
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Icon(Icons.Default.Check, contentDescription = null)
                    }
                    Spacer(modifier = Modifier.width(AppSpacing.SM))
                    Text(if (isSaving) "Salvando..." else "Salvar")
                }
            }
        }
    }
}

@Composable
fun ErrorScreen(
    failure: ScanFailure,
    onRetry: () -> Unit,
    onBack: () -> Unit
) {
    val (title, guidance) = scanFailureCopy(failure)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(AppSpacing.XL),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(AppSpacing.SM))
        Text(
            text = guidance,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(AppSpacing.XL))
        Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.MD)) {
            OutlinedButton(onClick = onBack) {
                Text("Voltar")
            }
            Button(onClick = onRetry) {
                Text("Tentar Novamente")
            }
        }
    }
}
