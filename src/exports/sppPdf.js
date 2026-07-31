export function downloadSPPPDF({
    chunkedSppItems,
    noSPP,
    txTanggal,
    sppSign
}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("l", "mm", "a4");
    const totalPages = chunkedSppItems.length;

    chunkedSppItems.forEach((pageItems, index) => {
        if (index > 0) {
            doc.addPage();
        }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("PT BINTANG INDOKARYA GEMILANG", 15, 15);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text("Jl. Raya Cendrawasih No. 6 KM.20 Tengguli, Kec. Tanjung", 15, 20);
        doc.text("Brebes - Jawa Tengah", 15, 23);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");

        const title = "SURAT PERMOHONAN PEMBELIAN";
        const centerX = 148.5;
        const titleWidth = doc.getTextWidth(title);

        doc.text(title, centerX, 25, { align: "center" });
        doc.line(centerX - titleWidth / 2, 26.5, centerX + titleWidth / 2, 26.5);

        const boxX = 220;
        const boxY = 10;
        const labelX = 223;
        const valueX = 245;

        doc.setFontSize(8);
        doc.rect(boxX, boxY, 65, 18);
        doc.setFont("helvetica", "bold");

        doc.text("No. Internal", labelX, 15);
        doc.text(":", valueX, 15);
        doc.text(noSPP, valueX + 2, 15);

        doc.text("Tanggal", labelX, 20);
        doc.text(":", valueX, 20);
        doc.text(new Date().toLocaleDateString("id-ID"), valueX + 2, 20);

        doc.text("Department", labelX, 25);
        doc.text(":", valueX, 25);
        doc.text("SPAREPART", valueX + 2, 25);

        const tableData = pageItems.map((item, i) => [
            (index * 17) + i + 1,
            item.kode,
            item.nama,
            item.satuan,
            item.qtyDiminta,
            item.stok,
            txTanggal || "-",
            item.jmlPakai,
            item.keterangan || "-"
        ]);

        while (tableData.length < 17) {
            tableData.push(["", "", "", "", "", "", "", "", ""]);
        }

        doc.autoTable({
            startY: 34,
            head: [
                [
                    "No",
                    "Kode",
                    "Nama & Spesifikasi Barang",
                    "UoM",
                    "Qty",
                    "Stock",
                    "Tgl Dibutuhkan",
                    "Jumlah Pakai",
                    "Keterangan"
                ]
            ],
            body: tableData,
            theme: "grid",
            headStyles: {
                fillColor: [30, 41, 59],
                fontSize: 8,
                halign: "center",
                cellPadding: 1.5
            },
            styles: {
                fontSize: 7,
                cellPadding: 1.2,
                valign: "middle",
                overflow: "linebreak"
            },
            columnStyles: {
                0: { cellWidth: 8, halign: "center" },
                1: { cellWidth: 23 },
                2: { cellWidth: "auto" },
                3: { cellWidth: 12, halign: "center" },
                4: { cellWidth: 15, halign: "center", fontStyle: "bold" },
                5: { cellWidth: 12, halign: "center" },
                6: { cellWidth: 25, halign: "center" },
                7: { cellWidth: 22, halign: "center" },
                8: { cellWidth: 32 }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 5;

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("CATATAN PENDUKUNG:", 15, finalY);
        doc.rect(15, finalY + 2, 130, 25);

        doc.setFont("helvetica", "italic");
        doc.text("-", 17, finalY + 6);

        doc.setFont("helvetica", "bold");
        doc.text("REKOMENDASI :", 152, finalY);
        doc.rect(152, finalY + 2, 130, 25);

        const signY = finalY + 34;
        const colWidth = 297 / 4;

        const labels = [
            "Dibuat Oleh,",
            "Diperiksa,",
            "Diketahui,",
            "Disetujui,"
        ];

        const names = [
            sppSign.pembuat,
            sppSign.pemeriksa,
            sppSign.diketahui,
            sppSign.disetujui
        ];

        labels.forEach((label, i) => {
            const x = (colWidth * i) + (colWidth / 2);

            doc.setFontSize(8);
            doc.text(label, x, signY, { align: "center" });
            doc.text(names[i] || "", x, signY + 22, { align: "center" });

            const width = doc.getTextWidth(names[i] || "") + 10;
            doc.line(x - width / 2, signY + 18, x + width / 2, signY + 18);
        });

        doc.setFontSize(6);
        doc.setFont("helvetica", "italic");
        doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 15, 205);

        doc.setFont("helvetica", "bold");
        doc.text(`Hal: ${index + 1} / ${totalPages}`, 282, 202, { align: "right" });
    });

    doc.save(`${noSPP}.pdf`);
}