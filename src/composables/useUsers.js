const { ref, computed } = Vue;

import {
	fetchUsers,
	createUser,
	deleteUser,
	approveUser,
	toggleUserStatus,
	updateUserRole,
	togglePhotoAccess,
} from "../services/userService.js";

export function useUsers({ userData, loading, showToast, closeUserModal }) {
	const adminUsers = ref([]);
	const isSubmitting = ref(false);
	const userSearchQuery = ref("");

	/* ================= LOAD USERS ================= */

	const loadUsers = async () => {
		if (!userData.value || userData.value.role !== "ADMIN") return;

		loading.value = true;
		try {
			adminUsers.value = await fetchUsers();
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			loading.value = false;
		}
	};

	/* ================= CREATE ================= */

	const submitNewUser = async (newUser) => {
		try {
			isSubmitting.value = true;
			const createdUser = await createUser(newUser);

			adminUsers.value.unshift(createdUser);
			showToast("User berhasil ditambahkan!", "success");
			closeUserModal?.();
		} catch (err) {
			showToast(err.message, "error");
		} finally {
			isSubmitting.value = false;
		}
	};

	/* ================= DELETE ================= */

	const handleDeleteUser = async (user) => {
		const confirmed = confirm(`Hapus user ${user.nama}?`);
		if (!confirmed) return;

		try {
			await deleteUser(user.username);
			adminUsers.value = adminUsers.value.filter((u) => u.username !== user.username);
			showToast("User berhasil dihapus", "success");
		} catch (err) {
			showToast(err.message, "error");
		}
	};

	/* ================= TOGGLE STATUS ================= */

	const toggleUser = async (user) => {
		try {
			const newStatus = await toggleUserStatus(user.username, user.status);
			user.status = newStatus;
			showToast("Status berhasil diubah", "success");
		} catch (err) {
			showToast(err.message, "error");
		}
	};

	/* ================= UPDATE ROLE ================= */

	const handleUpdateUserRole = async (user) => {
		const oldRole = user.role;
		try {
			await updateUserRole(user.username, user.role);
			showToast("Role berhasil diperbarui", "success");
		} catch (err) {
			user.role = oldRole;
			showToast(err.message, "error");
		}
	};

	/* ================= APPROVE ================= */

	const approveWithRole = async (user, role) => {
		try {
			const updatedUser = await approveUser(user.username, role);
			Object.assign(user, updatedUser);
			showToast(`User ${user.username} disetujui sebagai ${role}!`, "success");
		} catch (err) {
			showToast(err.message, "error");
		}
	};

	/* ================= PHOTO ACCESS ================= */

	const handleTogglePhotoAccess = async (user, value) => {

		const oldValue = user.can_preview_photo;

		try {

			user.can_preview_photo = value;

			await togglePhotoAccess(
				user.username,
				value
			);

			showToast(
				"Akses foto berhasil diubah",
				"success"
			);

		} catch (err) {

			user.can_preview_photo = oldValue;

			showToast(
				err.message,
				"error"
			);
		}
	};

	/* ================= FILTER & COMPUTED ================= */

	const filteredAdminUsers = computed(() => {
		const query = userSearchQuery.value?.toLowerCase() || "";
		if (!query) return adminUsers.value;

		return adminUsers.value.filter((u) => {
			return (
				u.nama?.toLowerCase().includes(query) ||
				u.username?.toLowerCase().includes(query) ||
				u.role?.toLowerCase().includes(query)
			);
		});
	});

	const pendingUsers = computed(() =>
		filteredAdminUsers.value.filter((u) => u.status === "PENDING")
	);

	return {
		adminUsers,
		isSubmitting,
		userSearchQuery,
		filteredAdminUsers,
		pendingUsers,
		loadUsers,
		submitNewUser,
		handleDeleteUser,
		toggleUser,
		handleUpdateUserRole,
		approveWithRole,
		handleTogglePhotoAccess,
	};
}