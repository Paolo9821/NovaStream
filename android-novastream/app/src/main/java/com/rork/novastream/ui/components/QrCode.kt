package com.rork.novastream.ui.components

import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/** Side of the generated matrix in pixels; scaled up without blur when drawn. */
private const val QR_MATRIX_PX = 512

/**
 * Encodes [content] as a QR matrix. Returns null when the payload is empty or too
 * long to fit, so callers can simply hide the block instead of crashing.
 */
private fun encodeQr(content: String): ImageBitmap? {
    if (content.isBlank()) return null
    return runCatching {
        val hints = mapOf<EncodeHintType, Any>(
            EncodeHintType.MARGIN to 1,
            EncodeHintType.CHARACTER_SET to "UTF-8",
            // Medium recovery keeps the code readable from a sofa distance.
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
        )
        val matrix = QRCodeWriter().encode(
            content,
            BarcodeFormat.QR_CODE,
            QR_MATRIX_PX,
            QR_MATRIX_PX,
            hints,
        )
        val width = matrix.width
        val height = matrix.height
        val pixels = IntArray(width * height)
        for (y in 0 until height) {
            val row = y * width
            for (x in 0 until width) {
                pixels[row + x] = if (matrix.get(x, y)) AndroidColor.BLACK else AndroidColor.WHITE
            }
        }
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
        bitmap.asImageBitmap()
    }.getOrNull()
}

/**
 * Scannable QR card. Always drawn on white with black modules, whatever the app
 * theme is, because phone cameras need that contrast to lock on.
 */
@Composable
fun QrCodePanel(
    content: String,
    title: String,
    caption: String,
    modifier: Modifier = Modifier,
    codeSize: Int = 168,
) {
    val bitmap = remember(content) { encodeQr(content) } ?: return

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF0B1220),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(12.dp))
            Image(
                // Nearest-neighbour keeps the modules crisp when scaled up on a TV.
                painter = BitmapPainter(bitmap, filterQuality = DrawScope.DefaultFilterQuality),
                contentDescription = title,
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(codeSize.dp),
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = caption,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF4B5563),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = content,
                style = MaterialTheme.typography.labelSmall,
                fontFamily = FontFamily.Monospace,
                color = Color(0xFF6B7280),
                textAlign = TextAlign.Center,
            )
        }
    }
}
