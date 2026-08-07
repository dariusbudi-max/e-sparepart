import {
    getQrLabelSize,
    getQrConfig,
    getQrA4Layout
} from "../utils/qrConfig.js";

export async function downloadQrPDF({ items = [] }) {
    if (!items.length) {
        alert("Antrean QR kosong");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const layout = getQrA4Layout();
    const label = getQrLabelSize();

    const {
        columns,
        rows,
        perPage,
        gapX,
        gapY,
        pageWidth,
        pageHeight
    } = layout;

    const usedWidth = columns * label.width + ((columns - 1) * gapX);
    const usedHeight = rows * label.height + ((rows - 1) * gapY);

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
        if (index > 0 && index % perPage === 0) {
            pdf.addPage();
        }

        const position = index % perPage;
        const col = position % columns;
        const row = Math.floor(position / columns);

        const x = marginX + col * (label.width + gapX);
        const y = marginY + row * (label.height + gapY);

        await drawQrLabel({
            pdf,
            item: labels[index],
            x,
            y,
            width: label.width,
            height: label.height
        });
    }

    pdf.save(`qr-label-${Date.now()}.pdf`);
}

async function drawQrLabel({ pdf, item, x, y, width, height }) {
    pdf.setDrawColor(180);
    pdf.rect(x, y, width, height);

    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(
        canvas,
        String(item.kode || "-"),
        getQrConfig()
    );

    const image = canvas.toDataURL("image/png");
    const qrSize = 22;

    pdf.addImage(
        image,
        "PNG",
        x + ((width - qrSize) / 2),
        y + 2,
        qrSize,
        qrSize
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text(
        String(item.kode || "-"),
        x + (width / 2),
        y + height - 3,
        { align: "center" }
    );
}