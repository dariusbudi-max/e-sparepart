import {
    getLabelSize, getBarcodeConfig,
    getA4Layout
} from "../utils/barcodeConfig.js";

export async function downloadBarcodePDF({
    items = [],
    labelKey = "60x40"
}) {
    labelKey = labelKey?.value ?? labelKey;
    if (!items.length) {
        alert("Antrean barcode kosong");
        return;
    }

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const layout = getA4Layout(labelKey);
    const label = getLabelSize(labelKey);
    const columns = layout.columns;
    const rows = layout.rows;
    const gapX = layout.gapX;
    const gapY = layout.gapY;
    const pageWidth = layout.pageWidth;
    const pageHeight = layout.pageHeight;

    const usedWidth = columns * label.width + (columns - 1) * gapX;
    const usedHeight = rows * label.height + (rows - 1) * gapY;

    const marginX = (pageWidth - usedWidth) / 2;
    const marginY = (pageHeight - usedHeight) / 2;

    const labels = [];

    items.forEach(item => {
        const qty = Number(item.qty) || 1;
        for (let i = 0; i < qty; i++) {
            labels.push(item);
        }
    });

    for (let index = 0; index < labels.length; index++) {
        if (index > 0 && index % layout.perPage === 0) {
            pdf.addPage();
        }

        const position = index % layout.perPage;
        const col = position % columns;
        const row = Math.floor(position / columns);

        const x = marginX + col * (label.width + gapX);
        const y = marginY + row * (label.height + gapY);

        drawLabel({
            pdf,
            item: labels[index],
            x,
            y,
            width: label.width,
            height: label.height,
            labelKey
        });
    }

    pdf.save(`barcode-label-${Date.now()}.pdf`);
}

function drawLabel({
    pdf,
    item,
    x,
    y,
    width,
    height,
    labelKey
}) {
    pdf.setDrawColor(180);
    pdf.rect(x, y, width, height);

    pdf.setFont("helvetica", "bold");
    const codeFont =
        width <= 40 ? 5 :
            width <= 50 ? 6 :
                width <= 75 ? 7 :
                    8;
    pdf.setFontSize(codeFont);
    pdf.text(
        String(item.kode || "-"),
        x + 2,
        y + 4
    );

    const canvas = document.createElement("canvas");
    const barcodeConfig = getBarcodeConfig(labelKey);
    JsBarcode(
        canvas,
        String(item.kode || "-"),
        {
            ...barcodeConfig,
            displayValue: false,
            margin: 0
        }
    );

    const barcodeImage = canvas.toDataURL("image/png");

    let barcodeWidth;
    let barcodeHeight;

    switch (labelKey) {
        case "40x20":
            barcodeWidth = width - 6;
            barcodeHeight = 7;
            break;
        case "50x30":
            barcodeWidth = width - 6;
            barcodeHeight = 12;
            break;
        case "60x40":
            barcodeWidth = width - 8;
            barcodeHeight = 18;
            break;
        case "75x25":
            barcodeWidth = width - 8;
            barcodeHeight = 12;
            break;
        case "80x50":
            barcodeWidth = width - 10;
            barcodeHeight = 24;
            break;
        default:
            barcodeWidth = width - 6;
            barcodeHeight = height * 0.4;
    }

    pdf.addImage(
        barcodeImage,
        "PNG",
        x + (width - barcodeWidth) / 2,
        y + 6,
        barcodeWidth,
        barcodeHeight
    );

    pdf.setFont("helvetica", "normal");
    let namaSize =
        width <= 40 ? 3 :
            width <= 50 ? 5 :
                6;
    pdf.setFontSize(namaSize);

    let nama = String(item.nama || "-");
    const maxWidth = width - 4;

    while (pdf.getTextWidth(nama) > maxWidth && namaSize > 3) {
        namaSize--;
        pdf.setFontSize(namaSize);
    }
    if (pdf.getTextWidth(nama) > maxWidth) {
        nama = nama.substring(0, 15) + "...";
    }
    let namaY;
    if (height <= 20) {
        namaY = y + height - 2;
    } else if (height <= 25) {
        namaY = y + height - 4;
    } else {
        namaY = y + height - 6;
    }
    pdf.text(nama, x + 2, namaY);

    if (height >= 25) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6);
        let lokasi = `Loc:${item.lokasi || "-"}`;
        const maxLokasiWidth = width * 0.35;
        while (pdf.getTextWidth(lokasi) > maxLokasiWidth && lokasi.length > 5) {
            lokasi = lokasi.substring(0, lokasi.length - 1);
        }
        pdf.text(lokasi, x + width - 2, y + 4, { align: "right" });
    }
}