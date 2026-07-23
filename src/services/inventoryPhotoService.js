import { supabaseClient } from "../api/supabase.js";

export const fetchPhotos = async (kode) => {
    const { data, error } = await supabaseClient
        .from("inventory_photos")
        .select("*")
        .eq("kode", kode)
        .order("is_cover", { ascending: false })
        .order("sort_order", { ascending: true });

    if (error) throw error;
    return data || [];
};

export const addPhoto = async (kode, photoUrl, driveFileId) => {
    const { data: lastPhoto } = await supabaseClient
        .from("inventory_photos")
        .select("sort_order")
        .eq("kode", kode)
        .order("sort_order", { ascending: false })
        .limit(1);

    const nextOrder = lastPhoto?.length ? lastPhoto[0].sort_order + 1 : 1;

    const { data, error } = await supabaseClient
        .from("inventory_photos")
        .insert({
            kode,
            photo_url: photoUrl,
            drive_file_id: driveFileId,
            sort_order: nextOrder,
            is_cover: nextOrder === 1
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deletePhoto = async (id) => {
    const { data, error } = await supabaseClient
        .from("inventory_photos")
        .delete()
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return true;
};

export const setCoverPhoto = async (kode, id) => {
    await supabaseClient
        .from("inventory_photos")
        .update({ is_cover: false })
        .eq("kode", kode);

    const { error } = await supabaseClient
        .from("inventory_photos")
        .update({ is_cover: true })
        .eq("id", id);

    if (error) throw error;
    return true;
};

export const updatePhotoOrder = async (photos = []) => {
    for (let i = 0; i < photos.length; i++) {
        await supabaseClient
            .from("inventory_photos")
            .update({ sort_order: i + 1 })
            .eq("id", photos[i].id);
    }

    return true;
};
