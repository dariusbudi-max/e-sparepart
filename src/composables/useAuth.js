import { getDeviceInfo } from "../utils/device.js";
import {
	login,
	register,
	updateProfile,
	validateSession,
	updateDeviceInfo,
	updateSessionToken
} from "../services/authService.js";

export function useAuth({
	loading,
	loadingProfile,
	userData,
	isLoggedIn,
	page,
	showToast,
	refreshAllData,
	ROLE_LANDING_PAGE,
}) {
	const handleLogin = async (loginData) => {
		if (!loginData?.username || !loginData?.password) {
			showToast("Username dan Password wajib diisi", "error");
			return;
		}

		loading.value = true;

		try {
			const user = await login(loginData.username, loginData.password);
			const sessionToken = crypto.randomUUID();
			const { deviceId, deviceName } = getDeviceInfo();

			await updateSessionToken(user.username, sessionToken);
			await updateDeviceInfo(user.username, deviceId, deviceName);

			userData.value = {
				username: user.username,
				nama: user.nama,
				role: user.role,
				canPreviewPhoto: user.can_preview_photo,
				device_id: deviceId,
				device_name: deviceName,
				session_token: sessionToken
			};

			isLoggedIn.value = true;

			page.value = ROLE_LANDING_PAGE[user.role] || "dashboard";

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					page: page.value,
					session_token: sessionToken,
					loginAt: Date.now(),
				})
			);

			await refreshAllData();

			showToast(`Selamat datang, ${user.nama}!`, "success");
		} catch (err) {
			showToast(err.message || "Login gagal", "error");
		} {
			loading.value = false;
		}
	};

	const handleRegister = async ({ regData, showRegisterModal }) => {
		if (regData.value.password.length < 6) {
			showToast("Password minimal 6 karakter", "error");
			return;
		}

		loading.value = true;

		try {
			const { deviceId, deviceName } = getDeviceInfo();

			await register(regData.value, {
				device_id: deviceId,
				device_name: deviceName
			});

			showToast("Pendaftaran berhasil! Menunggu approval.", "success");
			showRegisterModal.value = false;
			regData.value = {
				nama: "",
				username: "",
				password: ""
			};
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loading.value = false;
		}
	};

	const handleUpdateProfile = async ({ profileForm, showProfileModal }) => {
		loadingProfile.value = true;

		try {
			const updatedUser = await updateProfile(userData.value.username, profileForm);

			userData.value.nama = updatedUser.nama;

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					loginAt: Date.now()
				})
			);

			if (showProfileModal?.value !== undefined) {
				showProfileModal.value = false;
			}

			showToast("Profil berhasil diperbarui", "success");
			await refreshSession();
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loadingProfile.value = false;
		}
	};

	const refreshSession = async () => {
		try {
			const saved = localStorage.getItem("wms_user");
			if (!saved) return;

			const parsed = JSON.parse(saved);
			const { deviceId, deviceName } = getDeviceInfo();
			const freshUser = await validateSession(parsed.username);

			if (freshUser.session_token !== parsed.session_token) {
				showToast("Sesi login digunakan di perangkat lain", "error");
				await handleLogout();
				return;
			}

			if (freshUser.device_id && freshUser.device_id !== deviceId) {
				showToast("Perangkat tidak dikenali", "error");
				await handleLogout();
				return;
			}

			userData.value = {
				username: freshUser.username,
				nama: freshUser.nama,
				role: freshUser.role,
				canPreviewPhoto: freshUser.can_preview_photo,
				device_id: deviceId,
				device_name: deviceName,
				session_token: parsed.session_token
			};

			isLoggedIn.value = true;

			localStorage.setItem(
				"wms_user",
				JSON.stringify({
					...userData.value,
					page: page.value,
					loginAt: Date.now()
				})
			);
		} catch (err) {
			console.error("Refresh session error:", err);
			await handleLogout();
		}
	};

	const handleLogout = async () => {
		try {
			if (userData.value?.username) {
				await updateSessionToken(userData.value.username, null);
			}
		} catch (err) { }

		isLoggedIn.value = false;
		userData.value = {
			username: "",
			nama: "",
			role: "",
			canPreviewPhoto: false
		};

		localStorage.removeItem("wms_user");
		page.value = "login";
	};

	return {
		handleLogin,
		handleRegister,
		handleUpdateProfile,
		refreshSession,
		handleLogout,
	};
}
