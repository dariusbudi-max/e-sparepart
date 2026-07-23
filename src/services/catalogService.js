import { supabaseClient } from "../api/supabase.js";

export const fetchCatalogFolders = async () => {
    const { data, error } = await supabaseClient
        .from("catalog_folder")
        .select("*")
        .eq("status", "AKTIF")
        .order("sort_order", { ascending: true })
        .order("nama", { ascending: true });

    if (error) throw error;
    return data || [];
};

export const createCatalogFolder = async (nama, parent_id = null) => {
    const { data, error } = await supabaseClient
        .from("catalog_folder")
        .insert({ nama, parent_id, status: "AKTIF" })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateCatalogFolder = async (id, nama) => {
    const { data, error } = await supabaseClient
        .from("catalog_folder")
        .update({ nama })
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteCatalogFolderService = async (id) => {
    const { error } = await supabaseClient
        .from("catalog_folder")
        .delete()
        .eq("id", id);

    if (error) throw error;
    return true;
};

export const assignItemsToFolder = async (kodesArray = [], folderId = null) => {
    if (!kodesArray.length) return [];

    const { data, error } = await supabaseClient
        .from("inventory")
        .update({ folder_id: folderId })
        .in("kode", kodesArray)
        .select("kode, folder_id");

    if (error) throw error;
    return data;
};

export const searchCatalogItems = async ({
    folderId = null,
    search = "",
    page = 0,
    pageSize = 100
}) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseClient
        .from("inventory")
        .select(`
            kode,
            nama,
            lokasi,
            folder_id,
            status,
            category,
            catalog_folder:folder_id(
                id,
                nama
            ),
            inventory_photos(
                id,
                photo_url,
                is_cover,
                sort_order
            )
        `, { count: "exact" });

    if (!search || !search.trim()) {
        if (folderId !== "ALL") {
            if (folderId === null) {
                query = query.is("folder_id", null);
            } else {
                query = query.eq("folder_id", folderId);
            }
        }
    }

    if (search && search.trim()) {
        const keyword = search.trim();
        query = query.or(`nama.ilike.%${keyword}%,kode.ilike.%${keyword}%,lokasi.ilike.%${keyword}%`);
    }

    query = query
        .order("nama", { ascending: true })
        .range(from, to);

    const { data, error, count } = await query;

    if (error) {
        console.error("CATALOG QUERY ERROR", error);
        throw error;
    }

    return {
        data: data || [],
        total: count || 0
    };
};