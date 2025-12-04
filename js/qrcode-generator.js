/**
 * QR Code Generator
 * Wrapper around qrcode.js
 */

const QRCodeGenerator = {
    /**
     * Generates a QR code in the specified container.
     * @param {HTMLElement|string} element - The DOM element or ID.
     * @param {string} text - The text/URL to encode.
     * @param {number} size - Size in pixels.
     */
    generate: (element, text, size = 128) => {
        const container = typeof element === 'string' ? document.getElementById(element) : element;
        if (!container) {
            console.error("QR Code container not found");
            return;
        }

        if (typeof QRCode === 'undefined') {
            console.error("QRCode library not loaded");
            container.innerHTML = '<p class="text-red-500">QR Code library missing</p>';
            return;
        }

        container.innerHTML = ''; // Clear previous

        try {
            new QRCode(container, {
                text: text,
                width: size,
                height: size,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.L
            });
        } catch (e) {
            console.error("QR Code generation failed:", e);
            container.innerHTML = '<p class="text-red-500">QR Generation Failed</p>';
        }
    }
};

window.QRCodeGenerator = QRCodeGenerator;
