import { XLSX, getTimestamp, createWorkbook } from "./excelUtils.js";

export const exportOpnameExcel = ({ data, showToast }) => {
    if (!data.length) {
        alert("Data selisih opname kosong atau sudah kedaluwarsa!");
        return;
    }
    const ws = XLSX.utils.json_to_sheet(
        data.map(item => ({
            "TANGGAL OPNAME": item.tanggal ? new Date(item.tanggal).toLocaleString("id-ID") : "-",
            "KODE BARANG": item.barang_kode,
            "NAMA BARANG": item.barang_nama,
            "STOK SISTEM (SEBELUM)": item.stok_sebelum,
            "STOK NYATA (OPNAME)": item.stok_opname,
            "SELISIH STOK": item.selisih
        })),
        { origin: "A5" }
    );
    XLSX.utils.sheet_add_aoa(ws, [
        ["LAPORAN DETAIL SELISIH OPNAME (7 HARI TERAKHIR)"],
        [`Tanggal Unduh : ${new Date().toLocaleString("id-ID")}`],
        [`Total Item Selisih : ${data.length}`]
    ], { origin: "A1" });
    ws["!cols"] = [
        { wch: 22 },
        { wch: 15 },
        { wch: 35 },
        { wch: 22 },
        { wch: 22 },
        { wch: 15 }
    ];
    createWorkbook(
        ws,
        "Selisih Opname",
        `Detail_Selisih_Opname_${getTimestamp()}.xlsx`
    );
    showToast(`Export Berhasil (${data.length} data)`, "success");
};

export const exportLowStockExcel = ({ data }) => {
    if (!data.length) {
        alert("Data stok kritis kosong!");
        return;
    }
    const ws = XLSX.utils.json_to_sheet(
        data.map(item => ({
            "KODE BARANG": item.kode,
            "NAMA BARANG": item.nama,
            "SATUAN": item.satuan,
            "STOK SAAT INI": item.stok,
            "MINIMUM STOK": item.min_stok,
            "KEKURANGAN": item.min_stok - item.stok,
            "SARAN ORDER (PR)": item.min_stok * 2
        })),
        { origin: "A5" }
    );
    XLSX.utils.sheet_add_aoa(ws, [
        ["LAPORAN STOK KRITIS"],
        [`Tanggal Export : ${new Date().toLocaleString("id-ID")}`],
        [`Total Item : ${data.length}`]
    ], { origin: "A1" });
    createWorkbook(
        ws,
        "Low Stock",
        `Low_Stock_${getTimestamp()}.xlsx`
    );
};

export const exportInventoryExcel = async ({ getExportInventory }) => {
    const exportData = await getExportInventory();
    if (!exportData.length) {
        alert("Data kosong!");
        return;
    }
    const rows = [
        ["KODE", "NAMA BARANG", "CATEGORY", "STOK", "STATUS"]
    ];
    exportData.forEach(item => {
        rows.push([
            item.kode,
            item.nama,
            item.category || "-",
            item.stok,
            item.lokasi
        ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
        { wch: 18 },
        { wch: 40 },
        { wch: 20 },
        { wch: 10 },
        { wch: 12 }
    ];
    createWorkbook(
        ws,
        "Inventory",
        `Inventory_${getTimestamp()}.xlsx`
    );
};

export const exportDashboardExcel = async ({ exportHistory, dashFilter, showToast }) => {
    const rows = await exportHistory();
    if (!rows.length) {
        alert("Data kosong!");
        return;
    }
    const ws = XLSX.utils.json_to_sheet(
        rows.map(tx => ({
            "TANGGAL": tx.tanggal,
            "USER": tx.user,
            "KODE": tx.kode,
            "NAMA BARANG": tx.nama,
            "JENIS": tx.jenis,
            "QTY": tx.qty,
            "STOK AKHIR": tx.stokAkhir,
            "DEPT": tx.dept || "-",
            "KETERANGAN": tx.ket || "-"
        })),
        { origin: "A5" }
    );
    XLSX.utils.sheet_add_aoa(ws, [
        ["LAPORAN LOG AKTIVITAS"],
        [`Tanggal Export : ${new Date().toLocaleString("id-ID")}`],
        [`Filter : ${dashFilter.startDate || "-"} s/d ${dashFilter.endDate || "-"}`],
        [`Total Data : ${rows.length}`]
    ], { origin: "A1" });
    createWorkbook(
        ws,
        "Riwayat",
        `Riwayat_${getTimestamp()}.xlsx`
    );
    showToast(`Export berhasil (${rows.length} data)`, "success");
};

export const exportScrapExcel = ({
    data,
    summary,
    filterStartDate,
    filterEndDate,
    showToast
}) => {
    if (!data.length) {
        showToast("Tidak ada data yang dapat diexport!", "error");
        return;
    }

    const ws = XLSX.utils.json_to_sheet(
        data.map((row, index) => ({
            "NO": index + 1,
            "TANGGAL INPUT DATA": row.created_at
                ? new Date(row.created_at).toLocaleString("id-ID")
                : "-",
            "TANGGAL TUKAR": row.tgl_penukaran,
            "NAMA BARANG": row.nama_barang,
            "TGL AWAL PAKAI": row.tgl_awal_pakai || "-",
            "TGL AKHIR PAKAI": row.tgl_akhir_pakai || "-",
            "DEPARTMENT": row.department,
            "QTY": row.qty,
            "CREATED BY": row.created_by
        })),
        { origin: "A7" }
    );

    XLSX.utils.sheet_add_aoa(
        ws,
        [
            ["LAPORAN REKAP MONITORING SCRAP"],
            [`Tanggal Export : ${new Date().toLocaleString("id-ID")}`],
            [`Filter : ${filterStartDate || "Semua"} s/d ${filterEndDate || "Semua"}`],
            [`Total Data : ${summary.totalRecords}`],
            [`Total Qty : ${summary.totalQty}`],
            [`Dept Terbanyak : ${summary.topDept}`]
        ],
        { origin: "A1" }
    );

    ws["!cols"] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 18 },
        { wch: 35 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
        { wch: 12 },
        { wch: 25 }
    ];

    createWorkbook(
        ws,
        "Rekap Scrap",
        `Rekap_Scrap_${getTimestamp()}.xlsx`
    );

    showToast(`Berhasil export ${data.length} data`, "success");
};