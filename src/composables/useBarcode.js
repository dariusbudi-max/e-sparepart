import { labelSizes, getBarcodeConfig } from "../utils/barcodeConfig.js";

const { ref, computed, watch, nextTick } = Vue;

export function useBarcode({ showToast }) {
    const printQueue = ref([]);
    const selectedLabel = ref("75x25");
    const previewBarcodeRefs = new Map();
    const previewQrRefs = new Map();
    const barcodeType = ref("code128");

    const addToPrintQueue = (item) => {
        const existing = printQueue.value.find(i => i.kode === item.kode);

        if (existing) {
            existing.qty++;
            showToast(`Jumlah cetak ${item.nama} menjadi ${existing.qty}`, "success");
        } else {
            printQueue.value.unshift({
                ...item,
                qty: 1
            });
            showToast(`${item.nama} masuk ke antrean cetak`, "success");
        }

        renderBarcodes();
    };

    const updateQty = (kode, action) => {
        const item = printQueue.value.find(i => i.kode === kode);

        if (!item) return;

        if (action === "increase") {
            item.qty++;
        }

        if (action === "decrease" && item.qty > 1) {
            item.qty--;
        }

        renderBarcodes();
    };

    const validateQty = (item) => {
        let qty = Number(item.qty);
        if (isNaN(qty) || qty < 1) {
            qty = 1;
        }
        item.qty = Math.floor(qty);
        renderBarcodes();
    };

    const removeFromQueue = (kode) => {
        printQueue.value = printQueue.value.filter(item => item.kode !== kode);
        previewBarcodeRefs.delete(kode);
        previewQrRefs.delete(kode);
        renderBarcodes();
    };

    const clearQueue = (force = false) => {
        if (!force && !confirm("Bersihkan semua antrean cetak?")) {
            return;
        }

        printQueue.value = [];
        previewBarcodeRefs.clear();
        showToast("Antrean cetak berhasil dibersihkan.", "success");
    };

    const setPreviewRef = (kode, el) => {
        if (!el) {
            previewBarcodeRefs.delete(kode);
            return;
        }
        previewBarcodeRefs.set(kode, el);
        renderSingleBarcode(el, kode);
    };

    const setQrPreviewRef = (kode, el) => {
        if (!el) {
            previewQrRefs.delete(kode);
            return;
        }
        previewQrRefs.set(kode, el);
        if (barcodeType.value === "qr") {
            renderSingleQr(el, kode);
        }
    };

    const renderSingleQr = async (canvas, kode) => {
        try {
            canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
            await QRCode.toCanvas(
                canvas,
                String(kode),
                {
                    width: 160,
                    margin: 0,
                    color: {
                        dark: "#000000",
                        light: "#ffffff"
                    }
                }
            );
        } catch (error) {
            console.error("QR gagal:", kode, error);
        }
    };

    const renderSingleBarcode = (svg, kode) => {
        try {
            svg.innerHTML = "";
            JsBarcode(svg, String(kode), getBarcodeConfig(selectedLabel.value));
        } catch (error) {
            console.error("Barcode gagal:", kode, error);
        }
    };

    const renderBarcodes = async () => {
        await nextTick();
        previewBarcodeRefs.forEach((svg, kode) => {
            if (!svg) return;
            renderSingleBarcode(svg, kode);
        });
        previewQrRefs.forEach((canvas, kode) => {
            if (!canvas) return;
            renderSingleQr(canvas, kode);
        });
    };

    watch(
        selectedLabel,
        async (value) => {
            if (!labelSizes[value]) {
                selectedLabel.value = "60x40";
                return;
            }
            localStorage.setItem("barcode_label_size", value);
            await nextTick();
            renderBarcodes();
        }
    );

    watch(
        barcodeType,
        async () => {
            await nextTick();
            renderBarcodes();
        }
    );

    return {
        printQueue,
        selectedLabel,
        barcodeType,
        labelSizes,
        addToPrintQueue,
        updateQty,
        validateQty,
        removeFromQueue,
        clearQueue,
        setPreviewRef,
        setQrPreviewRef,
        renderBarcodes
    };
}