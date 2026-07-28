import { supabaseClient } from "../api/supabase.js";

const handleResponse = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
};

const cleanUsername = (username) => username.trim().toLowerCase();

export const login = async (username, password) => {
    const usernameClean = cleanUsername(username);

    const res = await supabaseClient
        .from("users")
        .select("*")
        .eq("username", usernameClean)
        .eq("status", "AKTIF")
        .single();

    const user = handleResponse(res);

    if (user.password !== password) {
        throw new Error("Password salah");
    }

    const currentTimestamp = new Date().toISOString();
    const updateRes = await supabaseClient
        .from("users")
        .update({ last_login: currentTimestamp })
        .eq("username", usernameClean)
        .select()
        .single();

    return handleResponse(updateRes);
};

export const register = async (payload, deviceInfo) => {
    const usernameClean = cleanUsername(payload.username);

    const { data: existing } = await supabaseClient
        .from("users")
        .select("username")
        .eq("username", usernameClean)
        .maybeSingle();

    if (existing) {
        throw new Error("Username sudah terdaftar");
    }

    const res = await supabaseClient
        .from("users")
        .insert([{
            nama: payload.nama.trim(),
            username: usernameClean,
            password: payload.password,
            role: "VIEWER",
            status: "PENDING",
            permissions:{},
            device_id: deviceInfo.device_id,
            device_name: deviceInfo.device_name
        }])
        .select()
        .single();

    return handleResponse(res);
};

export const updateProfile = async (username, data) => {
    const payload = {
        nama: data.nama
    };

    if (data.password && data.password.trim() !== "") {
        payload.password = data.password;
    }

    const res = await supabaseClient
        .from("users")
        .update(payload)
        .eq("username", username)
        .select()
        .single();

    return handleResponse(res);
};

export const validateSession = async (username) => {
    const { data, error } = await supabaseClient
        .from("users")
        .select(`
            username,
            nama,
            role,
            status,
            permissions,
            session_token,
            device_id,
            device_name,
            last_login 
        `)
        .eq("username", username)
        .single();

    if (error || !data) {
        throw new Error("Session tidak valid");
    }

    if (data.status !== "AKTIF") {
        throw new Error("Akun dinonaktifkan");
    }

    return data;
};

export const updateDeviceInfo = async (
    username,
    deviceId,
    deviceName
) => {
    const res = await supabaseClient
        .from("users")
        .update({
            device_id: deviceId,
            device_name: deviceName
        })
        .eq("username", username)
        .select()
        .single();

    return handleResponse(res);
};

export const updateSessionToken = async (
    username,
    token
) => {
    const { error } = await supabaseClient
        .from("users")
        .update({
            session_token: token
        })
        .eq("username", username);

    if (error) throw error;
};
