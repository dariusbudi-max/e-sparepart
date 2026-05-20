import { supabaseClient } from "../api/supabase.js";

export const fetchInventory = async (page = 0, pageSize = 300) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabaseClient
        .from("inventory")
        .select("*", { count: 'exact' })
        .order("nama", { ascending: true })
        .range(from, to);

    if (error) throw error;
    return { data: data || [], total: count };
};

export const upsertItem = async (payload) => {
    const cleanPayload = {
        ...payload,
        status: (payload.status || "AKTIF").toString().trim().toUpperCase(),
    };

    const { data, error } = await supabaseClient
        .from("inventory")
        .upsert(cleanPayload, { onConflict: "kode" })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateLocation = async (kode, lokasi) => {
    const { data, error } = await supabaseClient
        .from("inventory")
        .update({ lokasi })
        .eq("kode", kode)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const toggleStatusService = async (kode, currentStatus) => {
    const newStatus = currentStatus === "AKTIF" ? "NONAKTIF" : "AKTIF";
    const { data, error } = await supabaseClient
        .from("inventory")
        .update({ status: newStatus })
        .eq("kode", kode)
        .select()
        .single();

    if (error) throw error;
    return data.status;
};

export const searchInventory = async (q, onlyAvailable = false) => {
    let query = supabaseClient
        .from("inventory")
        .select("*")
        .or(`nama.ilike.%${q}%,kode.ilike.%${q}%,lokasi.ilike.%${q}%`)
        .limit(100); // Batasi hasil pencarian agar cepat

    if (onlyAvailable) {
        query = query.gt("stok", 0); // Hanya yang stok > 0
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

export const fetchAllInventory = async ({
    search = "",
    category = "all",
    stock = "all",
    location = "",
    onlyAvailable = false
} = {}) => {
    const pageSize = 1000;
    let from = 0;
    let allData = [];
    let hasMore = true;

    while (hasMore) {
        let query = supabaseClient
            .from("inventory")
            .select("*")
            .order("nama", { ascending: true })
            .range(from, from + pageSize - 1);

        if (search) {
            query = query.or(`nama.ilike.%${search}%,kode.ilike.%${search}%,lokasi.ilike.%${search}%`);
        }

        if (category && category !== "all") {
            query = query.eq("category", category);
        }

        if (location) {
            query = query.ilike("lokasi", `%${location}%`);
        }

        if (stock === "available") {
            query = query.gt("stok", 0);
        }

        if (stock === "empty") {
            query = query.lte("stok", 0);
        }

        if (onlyAvailable) {
            query = query.gt("stok", 0).eq("status", "AKTIF");
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += pageSize;
            hasMore = data.length === pageSize;
        } else {
            hasMore = false;
        }
    }

    return allData;
};

export const updatePhoto = async (kode, foto) => {
    if (!kode) throw new Error("Kode barang kosong");
    const { error } = await supabaseClient
        .from("inventory")
        .update({ foto })
        .eq("kode", kode);
    if (error) throw error;
    return true;
};