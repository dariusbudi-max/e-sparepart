import { supabaseClient } from "../api/supabase.js";

export const fetchPivotInventory = async (filter) => {
    const { startDate, endDate, dept, type, kode } = filter;

    if (!startDate || !endDate) return [];

    let periodQuery = supabaseClient
        .from("riwayat")
        .select(`
            barang_kode,
            barang_nama,
            jenis,
            qty,
            stok_akhir,
            tanggal,
            dept,
            is_void
        `)
        .gte("tanggal", `${startDate}T00:00:00`)
        .lte("tanggal", `${endDate}T23:59:59`)
        .eq("is_void", false)
        .order("tanggal", { ascending: true });

    if (dept) {
        periodQuery = periodQuery.eq("dept", dept);
    }

    if (type && type !== "ALL") {
        periodQuery = periodQuery.eq("jenis", type);
    }

    if (kode) {
        periodQuery = periodQuery.ilike("barang_kode", `%${kode}%`);
    }

    const { data: periodData, error: periodError } = await periodQuery;

    if (periodError) throw periodError;

    let openingQuery = supabaseClient
        .from("riwayat")
        .select(`
            barang_kode,
            stok_akhir,
            tanggal,
            dept,
            is_void
        `)
        .lt("tanggal", `${startDate}T00:00:00`)
        .eq("is_void", false)
        .order("tanggal", { ascending: false });

    if (dept) {
        openingQuery = openingQuery.eq("dept", dept);
    }

    if (kode) {
        openingQuery = openingQuery.ilike("barang_kode", `%${kode}%`);
    }

    const { data: openingData, error: openingError } = await openingQuery;

    if (openingError) throw openingError;

    const openingMap = {};

    (openingData || []).forEach((tx) => {
        const kodeBarang = tx.barang_kode;
        if (openingMap[kodeBarang] === undefined) {
            openingMap[kodeBarang] = Number(tx.stok_akhir || 0);
        }
    });

    const pivotMap = {};

    (periodData || []).forEach((tx) => {
        const kodeBarang = tx.barang_kode;

        if (!pivotMap[kodeBarang]) {
            pivotMap[kodeBarang] = {
                kode: kodeBarang,
                nama: tx.barang_nama || "-",
                opening: openingMap[kodeBarang] || 0,
                masuk: 0,
                keluar: 0,
                closing: 0
            };
        }

        if (tx.jenis === "MASUK") {
            pivotMap[kodeBarang].masuk += Number(tx.qty || 0);
        }

        if (tx.jenis === "KELUAR") {
            pivotMap[kodeBarang].keluar += Number(tx.qty || 0);
        }

        pivotMap[kodeBarang].closing = Number(tx.stok_akhir || 0);
    });

    Object.values(pivotMap).forEach((item) => {
        const calculatedClosing = item.opening + item.masuk - item.keluar;

        if (item.closing === null || item.closing === undefined) {
            item.closing = calculatedClosing;
        }
    });

    return Object.values(pivotMap).sort((a, b) =>
        a.kode.localeCompare(b.kode)
    );
};