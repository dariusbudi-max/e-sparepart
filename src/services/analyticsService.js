import { supabaseClient } from "../api/supabase.js";

export const mapTx = (h = {}) => {
    const date = h.tanggal ? new Date(h.tanggal) : null;
    return {
        rowId: h.id,
        tanggalRaw: date,
        tanggal: date ? date.toLocaleString("id-ID", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }) : "-",
        kode: h.barang_kode || "-",
        nama: h.barang_nama || "-",
        jenis: h.jenis || "-",
        qty: Number(h.qty || 0),
        user: h.user_username || h.username || "-",
        dept: h.dept || "-",
        ket: h.keterangan || "-",
        stokAkhir: Number(h.stok_akhir || 0),
        isVoided: Boolean(h.is_void)
    };
};

export const fetchHistory = async (filter = {}) => {
    let query = supabaseClient
        .from("riwayat")
        .select(`id, tanggal, barang_kode, barang_nama, jenis, qty, user_username, dept, keterangan, stok_akhir, is_void`)
        .order("tanggal", { ascending: false })
        .limit(1000);

    if (filter.type && filter.type !== "ALL") query = query.eq("jenis", filter.type);
    if (filter.dept) query = query.eq("dept", filter.dept);
    if (filter.startDate) query = query.gte("tanggal", `${filter.startDate}T00:00:00`);
    if (filter.endDate) query = query.lte("tanggal", `${filter.endDate}T23:59:59`);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapTx);
};

export const fetchHistoryExport = async (filter = {}) => {
    const PAGE_SIZE = 1000;
    let allData = [], from = 0, hasMore = true;

    while (hasMore) {
        let query = supabaseClient
            .from("riwayat")
            .select("id, tanggal, barang_kode, barang_nama, jenis, qty, user_username, dept, keterangan, stok_akhir, is_void")
            .order("tanggal", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

        if (filter.type && filter.type !== "ALL") query = query.eq("jenis", filter.type);
        if (filter.dept) query = query.eq("dept", filter.dept);
        if (filter.startDate) query = query.gte("tanggal", `${filter.startDate}T00:00:00`);
        if (filter.endDate) query = query.lte("tanggal", `${filter.endDate}T23:59:59`);

        const { data, error } = await query;
        if (error) throw error;

        const rows = data || [];
        allData.push(...rows);
        hasMore = rows.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }

    return allData.map(mapTx);
};

export const fetchDashboard = async () => {
    const { data, error } = await supabaseClient
        .from("riwayat_today")
        .select("*")
        .order("tanggal", { ascending: false });

    if (error) throw error;

    return (data || []).map(mapTx);
};

export const fetchSummary = async () => {
    const { data, error } = await supabaseClient.rpc("get_inventory_dashboard");
    if (error) throw error;
    return {
        totalItem: data?.total_item || 0,
        totalStok: data?.total_stok || 0,
        totalLowStock: data?.total_low_stock || 0,
        selisihOpname: data?.selisih_opname || 0,
    };
};

export const fetchLowStock = async () => {
    const { data, error } = await supabaseClient.rpc("get_low_stock");
    if (error) throw error;
    return data || [];
};

export const fetchOpnameDetail = async () => {
    const { data, error } = await supabaseClient.rpc("get_opname_selisih_detail");
    if (error) throw error;
    return data || [];
};

export const fetchDepartments = async () => {
    const { data, error } = await supabaseClient.from("departments").select("nama_dept");
    if (error) throw error;
    return (data || []).map((d) => d.nama_dept);
};

