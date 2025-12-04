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
        if (!container) return;

        container.innerHTML = ''; // Clear previous
        new QRCode(container, {
            text: text,
            width: size,
            height: size,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
};

window.QRCodeGenerator = QRCodeGenerator;
