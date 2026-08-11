import { labelSizes, getBarcodeConfig } from "../utils/barcodeConfig.js";

const { ref, watch, nextTick } = Vue;

const DEFAULT_BARCODE_TYPE = "code128";
const DEFAULT_LABEL = "75x25";
const VALID_BARCODE_TYPES = ["code128", "qr"];

export function useBarcode({ showToast }) {
    const printQueue = ref([]);
    const savedBarcodeType = localStorage.getItem("barcode_type");
    const savedLabelSize = localStorage.getItem("barcode_label_size");

    const barcodeType = ref(VALID_BARCODE_TYPES.includes(savedBarcodeType) ? savedBarcodeType : DEFAULT_BARCODE_TYPE);
    const selectedLabel = ref(labelSizes[savedLabelSize] ? savedLabelSize : DEFAULT_LABEL);

    const previewBarcodeRefs = new Map();
    const previewQrRefs = new Map();

    const addToPrintQueue = (item) => {
        const existing = printQueue.value.find(i => i.kode === item.kode);
        if (existing) {
            existing.qty++;
            showToast(`Jumlah cetak ${item.nama} menjadi ${existing.qty}`, "success");
        } else {
            printQueue.value.unshift({ ...item, qty: 1 });
            showToast(`${item.nama} masuk ke antrean cetak`, "success");
        }
        renderBarcodes();
    };

    const updateQty = (kode, action) => {
        const item = printQueue.value.find(i => i.kode === kode);
        if (!item) return;
        if (action === "increase") item.qty++;
        if (action === "decrease" && item.qty > 1) item.qty--;
        renderBarcodes();
    };

    const validateQty = (item) => {
        let qty = Number(item.qty);
        if (isNaN(qty) || qty < 1) qty = 1;
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
        if (!force && !confirm("Bersihkan semua antrean cetak?")) return;
        printQueue.value = [];
        previewBarcodeRefs.clear();
        previewQrRefs.clear();
        showToast("Antrean cetak berhasil dibersihkan.", "success");
    };

    const setPreviewRef = (kode, el) => {
        if (!el) { previewBarcodeRefs.delete(kode); return; }
        previewBarcodeRefs.set(kode, el);
        if (barcodeType.value === "code128") renderSingleBarcode(el, kode);
    };

    const setQrPreviewRef = (kode, el) => {
        if (!el) { previewQrRefs.delete(kode); return; }
        previewQrRefs.set(kode, el);
        if (barcodeType.value === "qr") renderSingleQr(el, kode);
    };

    const renderSingleQr = async (canvas, kode) => {
        if (!canvas) return;
        try {
            const context = canvas.getContext("2d");
            if (context) context.clearRect(0, 0, canvas.width, canvas.height);
            await QRCode.toCanvas(canvas, String(kode), {
                width: 160, margin: 0, errorCorrectionLevel: "M",
                color: { dark: "#000000", light: "#ffffff" }
            });
        } catch (error) {
            console.error("QR gagal:", kode, error);
        }
    };

    const renderSingleBarcode = (svg, kode) => {
        if (!svg) return;
        try {
            svg.innerHTML = "";
            const config = getBarcodeConfig(selectedLabel.value);
            JsBarcode(svg, String(kode), config);
        } catch (error) {
            console.error("Barcode gagal:", kode, error);
        }
    };

    const renderBarcodes = async () => {
        await nextTick();
        if (barcodeType.value === "code128") {
            previewBarcodeRefs.forEach((svg, kode) => {
                if (svg) renderSingleBarcode(svg, kode);
            });
            return;
        }
        if (barcodeType.value === "qr") {
            previewQrRefs.forEach((canvas, kode) => {
                if (canvas) renderSingleQr(canvas, kode);
            });
        }
    };

    watch(barcodeType, async (value) => {
        if (!VALID_BARCODE_TYPES.includes(value)) {
            barcodeType.value = DEFAULT_BARCODE_TYPE;
            return;
        }
        localStorage.setItem("barcode_type", value);
        await nextTick();
        await renderBarcodes();
    });

    watch(selectedLabel, async (value) => {
        if (!labelSizes[value]) {
            selectedLabel.value = DEFAULT_LABEL;
            return;
        }
        localStorage.setItem("barcode_label_size", value);
        await nextTick();
        if (barcodeType.value === "code128") await renderBarcodes();
    });

    const initializePreview = async () => {
        await nextTick();
        await renderBarcodes();
    };

    return {
        printQueue, selectedLabel, barcodeType, labelSizes,
        addToPrintQueue, updateQty, validateQty, removeFromQueue,
        clearQueue, setPreviewRef, setQrPreviewRef, renderBarcodes, initializePreview
    };
}
