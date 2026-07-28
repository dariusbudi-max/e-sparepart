const { ref, computed } = Vue;

import {
	fetchUsers,
	createUser,
	deleteUser,
	approveUser,
	toggleUserStatus,
	updateUserRole,
	updateUserPermission
} from "../services/userService.js";

export function useUsers({ userData, loading, showToast, closeUserModal }) {
	const adminUsers = ref([]);
	const isSubmitting = ref(false);
	const userSearchQuery = ref("");
	const selectedPermissionUser = ref(null);
	const showPermissionModal = ref(false);

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
			const payload = {
				nama: newUser.nama,
				username: newUser.username,
				password: newUser.password,
				role: newUser.role,
				permissions: {}
			};

			const createdUser = await createUser(payload);

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

	const handleTogglePermission = async (user, permission, value) => {
		const oldPermissions = { ...(user.permissions || {}) };

		try {
			user.permissions = {
				...oldPermissions,
				[permission]: value
			};

			const updated = await updateUserPermission(user.username, permission, value);

			user.permissions = { ...(updated.permissions || {}) };

			showToast("Permission berhasil diperbarui", "success");
		} catch (err) {
			user.permissions = oldPermissions;
			showToast(err.message, "error");
		}
	};

	const openPermissionModal = (user) => {
		if (!user.permissions) {
			user.permissions = {};
		}

		selectedPermissionUser.value = user;
		showPermissionModal.value = true;
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
		handleTogglePermission,
		selectedPermissionUser,
		showPermissionModal,
		openPermissionModal
	};
}
