function drawFormToPDF(doc, items, startY, dept, tgl, resv, noDoc, pageNum, userName, totalPages) {
    const PAGE_WIDTH = 210;
    const PAGE_HEIGHT = 148.5;
    const LEFT = 10;
    const RIGHT = 10;
    const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
    const TOP = startY + 8;
    const BOTTOM = startY + PAGE_HEIGHT - 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    const headerTop = TOP;
    const barcodeHeight = 11.1;
    const barcodeWidth = 48;
    const barcodeX = 200 - barcodeWidth;
    const barcodeY = headerTop;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PT BINTANG INDOKARYA GEMILANG", LEFT, headerTop + 3);

    doc.setFontSize(11);
    doc.text("BUKTI PERMINTAAN SUKU CADANG", LEFT, headerTop + 9);

    try {
        if (window.JsBarcode) {
            const canvas = document.createElement("canvas");
            JsBarcode(canvas, String(noDoc), {
                format: "CODE128",
                height: 42,
                width: 1.5,
                displayValue: false,
                margin: 0,
                background: "#ffffff",
                lineColor: "#000000"
            });

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            let drawWidth = barcodeWidth;
            let drawHeight = drawWidth * (canvasHeight / canvasWidth);

            if (drawHeight > barcodeHeight) {
                drawHeight = barcodeHeight;
                drawWidth = drawHeight * (canvasWidth / canvasHeight);
            }

            const actualBarcodeX = 200 - drawWidth;
            doc.addImage(canvas, "PNG", actualBarcodeX, barcodeY, drawWidth, drawHeight);
        }
    } catch (error) {
        console.warn("Gagal membuat barcode PDF:", error);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`${noDoc}`, 200, barcodeY + barcodeHeight + 1, { align: "right" });

    const headerLineY = headerTop + 15;
    doc.setLineWidth(0.7);
    doc.line(LEFT, headerLineY, PAGE_WIDTH - RIGHT, headerLineY);

    const transactionY = headerLineY + 7;
    const col1X = LEFT;
    const col2X = 85;
    const col3X = 155;
    const transactionFontSize = 7.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(transactionFontSize);

    doc.text(`DEPT: ${dept}`, col1X, transactionY);
    doc.setLineWidth(0.25);
    doc.line(col1X, transactionY + 1.5, 72, transactionY + 1.5);

    doc.text(`TGL: ${tgl}`, col2X, transactionY);
    doc.line(col2X, transactionY + 1.5, 140, transactionY + 1.5);

    doc.text(`RESV: ${resv}`, col3X, transactionY);
    doc.line(col3X, transactionY + 1.5, 200, transactionY + 1.5);

    const tableY = transactionY + 6;
    const colX = [10, 39, 94, 105, 120, 135, 165, 200];
    const headerHeight = 6;
    const rowHeight = 6;

    doc.setFillColor(243, 243, 243);
    doc.rect(LEFT, tableY, CONTENT_WIDTH, headerHeight, "F");

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(LEFT, tableY, CONTENT_WIDTH, headerHeight);

    colX.forEach((x) => {
        doc.line(x, tableY, x, tableY + headerHeight);
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("Kode", 24.5, tableY + 4, { align: "center" });
    doc.text("Nama Barang", 41, tableY + 4);
    doc.text("Sat", 99.5, tableY + 4, { align: "center" });
    doc.text("Qty", 112.5, tableY + 4, { align: "center" });
    doc.text("Real", 127.5, tableY + 4, { align: "center" });
    doc.text("No. Mesin", 150, tableY + 4, { align: "center" });
    doc.text("Keterangan", 182.5, tableY + 4, { align: "center" });

    const displayItems = Array.isArray(items) ? [...items] : [];
    while (displayItems.length < 11) {
        displayItems.push({});
    }

    const rows = displayItems.slice(0, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    rows.forEach((item, index) => {
        const rowY = tableY + headerHeight + index * rowHeight;

        doc.setFillColor(248, 248, 248);
        doc.rect(120, rowY, 15, rowHeight, "F");

        doc.setDrawColor(0, 0, 0);
        doc.rect(LEFT, rowY, CONTENT_WIDTH, rowHeight);

        colX.forEach((x) => {
            doc.line(x, rowY, x, rowY + rowHeight);
        });

        if (!item || !item.kode) return;

        const kode = String(item.kode || "");
        const nama = String(item.nama || "");
        const satuan = String(item.satuan || "");
        const qty = String(item.qty ?? "");
        const noMesin = String(item.noMesin || "");
        const keterangan = String(item.keterangan || "");

        doc.text(kode.substring(0, 16), 24.5, rowY + 4, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.text(nama.substring(0, 32), 41, rowY + 4);
        doc.setFont("helvetica", "normal");

        doc.text(satuan.substring(0, 8), 99.5, rowY + 4, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.text(qty, 112.5, rowY + 4, { align: "center" });
        doc.setFont("helvetica", "normal");

        doc.text(noMesin.substring(0, 18), 150, rowY + 4, { align: "center" });
        doc.text(keterangan.substring(0, 28), 167, rowY + 4);
    });

    const tableBottom = tableY + headerHeight + (11 * rowHeight);
    const approvalY = tableBottom + 8;

    const roles = [
        { label: "Diminta Oleh,", name: userName || "............", sub: "UH/SH" },
        { label: "Diketahui Oleh,", name: "............", sub: "Manager" },
        { label: "Disetujui Oleh,", name: "............", sub: "Senior Manager" },
        { label: "Diserahkan Oleh,", name: "............", sub: "Admin Sparepart" }
    ];

    const approvalColumnWidth = CONTENT_WIDTH / 4;

    roles.forEach((role, index) => {
        const centerX = LEFT + approvalColumnWidth * index + approvalColumnWidth / 2;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text(role.label, centerX, approvalY, { align: "center" });

        const signatureWidth = 35;
        const lineY = approvalY + 13;

        doc.setLineWidth(0.25);
        doc.line(centerX - signatureWidth / 2, lineY, centerX + signatureWidth / 2, lineY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text(String(role.name).toUpperCase(), centerX, lineY + 4, { align: "center" });

        doc.setFont("helvetica", "italic");
        doc.setFontSize(5.5);
        doc.setTextColor(120, 120, 120);
        doc.text(role.sub, centerX, lineY + 7, { align: "center" });
        doc.setTextColor(0, 0, 0);
    });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(5.5);
    doc.setTextColor(150, 150, 150);

    const footerY = startY + PAGE_HEIGHT - 4;
    doc.text(`Hal ${pageNum} / ${totalPages}`, LEFT, footerY);
    doc.setTextColor(0, 0, 0);
}

export function downloadBONPDF({ paginatedItems, txDept, txTanggal, txReservasi, docNumber, userData }) {
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
    });

    const dept = String(txDept || "-").toUpperCase();
    const tgl = txTanggal || "-";
    const resv = String(txReservasi || "-").toUpperCase();
    const noDoc = docNumber || new Date().getTime().toString().substring(7);
    const userName = userData?.nama || "............";

    const allPages = Array.isArray(paginatedItems) ? paginatedItems : [];
    if (!allPages.length) return;

    const A4_WIDTH = 210;
    const A4_HEIGHT = 297;
    const HALF_HEIGHT = 148.5;

    for (let i = 0; i < allPages.length; i += 2) {
        if (i > 0) {
            doc.addPage("a4", "portrait");
        }

        drawFormToPDF(doc, allPages[i], 0, dept, tgl, resv, noDoc, i + 1, userName, allPages.length);

        doc.setDrawColor(119, 119, 119);
        doc.setLineWidth(0.25);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(5, HALF_HEIGHT, A4_WIDTH - 5, HALF_HEIGHT);

        doc.setLineDashPattern([], 0);
        doc.setDrawColor(0, 0, 0);

        if (allPages[i + 1]) {
            drawFormToPDF(doc, allPages[i + 1], HALF_HEIGHT, dept, tgl, resv, noDoc, i + 2, userName, allPages.length);
        }
    }

    const safeDept = dept.replace(/[\\/:*?"<>|]/g, "_").trim();
    const safeDoc = String(noDoc).replace(/[\\/:*?"<>|]/g, "_").trim();

    doc.save(`BON BPSC_${safeDept}_${safeDoc}.pdf`);
}