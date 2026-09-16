package com.prati.meugasto.ui.screens.scanner

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
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
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanQrCodeScreen(
    repository: PurchaseRepository,
    onNavigateBack: () -> Unit,
    onPurchaseCreated: (Long) -> Unit
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
    var errorMessage by remember { mutableStateOf<String?>(null) }

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
            TopAppBar(
                title = { Text("Escanear NFC-e") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Black.copy(alpha = 0.6f),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
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
                                    scanState = ScanState.Confirmation(data)
                                }.onFailure { err ->
                                    errorMessage = err.message
                                    scanState = ScanState.Error(err.message ?: "Erro desconhecido")
                                }
                            }
                        },
                        onError = { msg ->
                            errorMessage = msg
                            scanState = ScanState.Error(msg)
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
                        onConfirm = {
                            coroutineScope.launch {
                                val purchase = Purchase(
                                    supermarket = Supermarket(
                                        name = state.data.supermarket.name,
                                        cnpj = state.data.supermarket.cnpj,
                                        state = state.data.supermarket.state
                                    ),
                                    date = state.data.date,
                                    totalPrice = state.data.totalPrice,
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
                                onPurchaseCreated(id)
                            }
                        },
                        onCancel = {
                            scanState = ScanState.Scanning
                            scrapedData = null
                            errorMessage = null
                        }
                    )
                }

                is ScanState.Error -> {
                    ErrorScreen(
                        message = state.message,
                        onRetry = {
                            scanState = ScanState.Scanning
                            errorMessage = null
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
    data class Error(val message: String) : ScanState()
}

@Composable
fun CameraPreview(
    hasCameraPermission: Boolean,
    lifecycleOwner: androidx.lifecycle.LifecycleOwner,
    cameraExecutor: java.util.concurrent.ExecutorService,
    barcodeScanner: com.google.mlkit.vision.barcode.BarcodeScanner,
    onQrDetected: (String) -> Unit,
    onError: (String) -> Unit,
    permissionLauncher: androidx.activity.result.ActivityResultLauncher<String>
) {
    Box(modifier = Modifier.fillMaxSize()) {
        if (hasCameraPermission) {
            var isProcessing by remember { mutableStateOf(false) }

            AndroidView(
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()
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
                        } catch (exc: Exception) {
                            onError("Erro ao iniciar câmera: ${exc.message}")
                        }
                    }, ContextCompat.getMainExecutor(ctx))

                    previewView
                },
                modifier = Modifier.fillMaxSize()
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
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "Permissão de câmera necessária para ler QR Codes de NFC-e.",
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(AppSpacing.LG))
                Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                    Text("Conceder Permissão")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfirmationScreen(
    data: NfceScrapedData,
    onConfirm: () -> Unit,
    onCancel: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Confirmar Compra") },
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Cancelar")
                    }
                }
            )
        },
        bottomBar = {
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
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Escanear Novamente")
                    }
                    Button(
                        onClick = onConfirm,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(AppSpacing.SM))
                        Text("Salvar")
                    }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
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
                        Text(
                            text = data.supermarket.name,
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        if (data.supermarket.cnpj != null) {
                            Text(
                                text = "CNPJ: ${data.supermarket.cnpj}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                        Text(
                            text = "Data: ${data.date}",
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
                            Text(
                                text = "${item.quantity} ${item.unit}",
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
                Spacer(modifier = Modifier.height(100.dp))
            }
        }
    }
}

@Composable
fun ErrorScreen(
    message: String,
    onRetry: () -> Unit,
    onBack: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Erro ao ler NFC-e",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(AppSpacing.SM))
        Text(
            text = message,
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
