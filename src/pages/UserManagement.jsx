import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "../styles/UserManagement.css";

// Isolated signup client — never persists session, so it never
// disturbs the admin's active session in localStorage.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const signupClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "sb-signup-client-temp",
  },
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatKES(amount) {
  const num = parseFloat(amount) || 0;
  return "KES " + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Component ───────────────────────────────────────────────────────────────

function UserManagement() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("students");
  const [loading, setLoading] = useState(true);
  const [rpcAvailable, setRpcAvailable] = useState(null); // null = unknown, true/false

  // Data
  const [students, setStudents] = useState([]);
  const [chefs, setChefs] = useState([]);

  // Search
  const [studentSearch, setStudentSearch] = useState("");
  const [chefSearch, setChefSearch] = useState("");

  // Dropdown (three-dot menu per student row)
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Dialogs
  const [studentToSuspend, setStudentToSuspend] = useState(null);
  const [chefToDelete, setChefToDelete] = useState(null);

  // Add Chef modal
  const [addChefOpen, setAddChefOpen] = useState(false);
  const [chefFormName, setChefFormName] = useState("");
  const [chefFormEmail, setChefFormEmail] = useState("");
  const [chefFormPassword, setChefFormPassword] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);
  const [creatingChef, setCreatingChef] = useState(false);
  const [formError, setFormError] = useState("");

  // Toast
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error' }

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Data Fetching ───────────────────────────────────────────────────────────

  /**
   * Fetch students via the SECURITY DEFINER RPC that bypasses wallet RLS.
   * Falls back to plain profile fetch (no balances) if RPC not yet deployed.
   */
  const fetchStudents = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_all_student_balances");

      if (error) {
        // RPC doesn't exist yet — fall back to plain profiles query
        console.warn("[UM] RPC get_all_student_balances not found, falling back:", error.message);
        setRpcAvailable(false);

        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("id, full_name, student_number, email, phone_number, role, created_at")
          .eq("role", "student")
          .order("created_at", { ascending: false });

        if (profileErr) throw profileErr;

        setStudents(
          (profileData || []).map((p) => ({
            id: p.id,
            fullName: p.full_name || "Student",
            studentNumber: p.student_number || "—",
            email: p.email || "—",
            walletBalance: null, // unknown without RPC
            status: p.phone_number === "suspended" ? "suspended" : "active",
          }))
        );
        return;
      }

      setRpcAvailable(true);
      setStudents(
        (data || []).map((row) => ({
          id: row.id,
          fullName: row.full_name || "Student",
          studentNumber: row.student_number || "—",
          email: row.email || "—",
          walletBalance: parseFloat(row.wallet_balance) || 0,
          status: row.phone_number === "suspended" ? "suspended" : "active",
        }))
      );
    } catch (err) {
      console.error("[UM] fetchStudents error:", err);
    }
  }, []);

  const fetchChefs = useCallback(async () => {
    try {
      // Try RPC first
      const { data, error } = await supabase.rpc("get_all_chefs");

      if (error) {
        console.warn("[UM] RPC get_all_chefs not found, falling back:", error.message);
        // Fallback — profiles table (public SELECT policy allows this)
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, created_at")
          .eq("role", "chef")
          .order("created_at", { ascending: false });

        if (profileErr) throw profileErr;

        setChefs(
          (profileData || []).map((p) => ({
            id: p.id,
            fullName: p.full_name || "Chef",
            email: p.email || "—",
          }))
        );
        return;
      }

      setChefs(
        (data || []).map((row) => ({
          id: row.id,
          fullName: row.full_name || "Chef",
          email: row.email || "—",
        }))
      );
    } catch (err) {
      console.error("[UM] fetchChefs error:", err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStudents(), fetchChefs()]);
    setLoading(false);
  }, [fetchStudents, fetchChefs]);

  useEffect(() => {
    fetchAll();

    // Realtime subscriptions — refresh when profiles or wallets change
    const profilesChannel = supabase
      .channel("um_profiles_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchStudents();
        fetchChefs();
      })
      .subscribe();

    const walletsChannel = supabase
      .channel("um_wallets_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, () => {
        fetchStudents();
      })
      .subscribe();

    // Close dropdown on outside click
    const handleOutsideClick = () => setActiveDropdownId(null);
    document.addEventListener("click", handleOutsideClick);

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(walletsChannel);
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [fetchAll, fetchStudents, fetchChefs]);

  // ── Filtered lists ──────────────────────────────────────────────────────────

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const filteredChefs = useMemo(() => {
    const q = chefSearch.toLowerCase().trim();
    if (!q) return chefs;
    return chefs.filter(
      (c) => c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [chefs, chefSearch]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const handleSuspendStudent = async () => {
    if (!studentToSuspend) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone_number: "suspended" })
        .eq("id", studentToSuspend.id);

      if (error) throw error;

      showToast(`${studentToSuspend.fullName} has been suspended.`);
      fetchStudents();
    } catch (err) {
      console.error("[UM] Suspend error:", err);
      showToast("Failed to suspend student. Please try again.", "error");
    } finally {
      setStudentToSuspend(null);
    }
  };

  const handleUnsuspendStudent = async (student) => {
    if (!student) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone_number: "" })
        .eq("id", student.id);

      if (error) throw error;

      showToast(`${student.fullName} has been unsuspended.`);
      fetchStudents();
    } catch (err) {
      console.error("[UM] Unsuspend error:", err);
      showToast("Failed to unsuspend student. Please try again.", "error");
    }
  };

  const handleDeleteChef = async () => {
    if (!chefToDelete) return;
    try {
      // Try RPC first
      const { error: rpcErr } = await supabase.rpc("admin_delete_chef", { p_id: chefToDelete.id });

      if (rpcErr) {
        // Fallback — direct delete (works if profiles SELECT policy is open)
        console.warn("[UM] admin_delete_chef RPC failed, falling back:", rpcErr.message);
        const { error: deleteErr } = await supabase
          .from("profiles")
          .delete()
          .eq("id", chefToDelete.id)
          .eq("role", "chef");

        if (deleteErr) throw deleteErr;
      }

      showToast(`Chef ${chefToDelete.fullName} has been deleted.`);
      fetchChefs();
    } catch (err) {
      console.error("[UM] Delete chef error:", err);
      showToast("Failed to delete chef. Please try again.", "error");
    } finally {
      setChefToDelete(null);
    }
  };

  /**
   * Create a new chef account:
   * 1. signUp via isolated client (won't affect admin session)
   * 2. The auth trigger automatically creates a profile row.
   *    If the trigger is updated, it reads role from metadata → 'chef'.
   *    If the trigger is NOT updated, we call admin_upsert_chef_profile RPC
   *    to correct the role from 'student' → 'chef'.
   * 3. The chef can log in immediately (email confirmation is disabled).
   */
  const handleCreateChef = async (e) => {
    e.preventDefault();
    setFormError("");

    // Client-side validation
    if (!chefFormName.trim()) { setFormError("Chef name is required."); return; }
    if (!chefFormEmail.trim()) { setFormError("Email address is required."); return; }
    if (chefFormPassword.length < 6) { setFormError("Password must be at least 6 characters."); return; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(chefFormEmail)) { setFormError("Please enter a valid email address."); return; }

    setCreatingChef(true);

    try {
      // Step 1: Create Supabase Auth user
      // We pass role='chef' in metadata so the updated trigger sets it correctly.
      const { data: signupData, error: signupErr } = await signupClient.auth.signUp({
        email: chefFormEmail.trim().toLowerCase(),
        password: chefFormPassword,
        options: {
          data: {
            full_name: chefFormName.trim(),
            role: "chef",
          },
        },
      });

      if (signupErr) {
        if (signupErr.message?.includes("already registered") || signupErr.message?.includes("already been registered")) {
          throw new Error("An account with this email already exists. Please use a different email.");
        }
        throw new Error(signupErr.message || "Failed to create authentication account.");
      }

      if (!signupData?.user?.id) {
        throw new Error("Account creation returned no user. Please try again.");
      }

      const newChefId = signupData.user.id;
      const newChefName = chefFormName.trim();
      const newChefEmail = chefFormEmail.trim().toLowerCase();

      // Step 2: Ensure profile has role='chef'.
      // This is a safety net — the fixed trigger already sets it, but if the
      // trigger is the old version, this RPC corrects it.
      const { error: rpcErr } = await supabase.rpc("admin_upsert_chef_profile", {
        p_id: newChefId,
        p_full_name: newChefName,
        p_email: newChefEmail,
      });

      if (rpcErr) {
        // RPC not deployed yet — try direct update as fallback
        console.warn("[UM] admin_upsert_chef_profile RPC not available:", rpcErr.message);
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ role: "chef", full_name: newChefName, email: newChefEmail })
          .eq("id", newChefId);

        if (updateErr) {
          console.warn("[UM] Direct profile update also failed:", updateErr.message);
          // Don't throw — the account was created; just log the issue.
          // The chef will appear with role='student' until SQL is applied.
        }
      }

      // Step 3: Success — refresh table and close modal
      showToast(`Chef account for ${newChefName} created successfully. They can log in immediately.`);
      setAddChefOpen(false);
      setChefFormName("");
      setChefFormEmail("");
      setChefFormPassword("");
      setPwdVisible(false);

      // Refresh after a short delay to allow trigger to complete
      setTimeout(() => fetchChefs(), 1000);

    } catch (err) {
      console.error("[UM] handleCreateChef error:", err);
      setFormError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setCreatingChef(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="um-loading-screen">
        <div className="um-spinner" />
        <p>Loading User Management...</p>
      </div>
    );
  }

  return (
    <div className="um-page-container">

      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="um-sidebar">
        <div className="um-sidebar-header">
          <div className="um-avatar-container">
            <img
              alt="Admin"
              className="um-avatar-img"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
            />
          </div>
          <div>
            <h1 className="um-admin-name">Stratizen Admin</h1>
            <p className="um-admin-role">Executive Control</p>
          </div>
        </div>

        <nav className="um-nav-menu">
          <a className="um-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a className="um-nav-item active" style={{ cursor: "pointer" }}>
            <span className="material-symbols-outlined font-fill">group</span>
            <span>User Management</span>
          </a>
          <a className="um-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span>Menu Management</span>
          </a>
          <a className="um-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/orders")}>
            <span className="material-symbols-outlined">shopping_cart</span>
            <span>Orders</span>
          </a>
          <a className="um-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/reports")}>
            <span className="material-symbols-outlined">analytics</span>
            <span>Reports & Analytics</span>
          </a>
        </nav>

        <div className="um-sidebar-footer">
          <button className="um-logout-btn" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ───────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="um-mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <aside className="um-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="um-sidebar-header">
              <div className="um-avatar-container">
                <img
                  alt="Admin"
                  className="um-avatar-img"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
                />
              </div>
              <div>
                <h1 className="um-admin-name">Stratizen Admin</h1>
                <p className="um-admin-role">Executive Control</p>
              </div>
            </div>
            <nav className="um-nav-menu">
              <a className="um-nav-item" onClick={() => { navigate("/admin/dashboard"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">dashboard</span>
                <span>Dashboard</span>
              </a>
              <a className="um-nav-item active" onClick={() => setMobileMenuOpen(false)}>
                <span className="material-symbols-outlined font-fill">group</span>
                <span>User Management</span>
              </a>
              <a className="um-nav-item" onClick={() => { navigate("/admin/menu"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">restaurant_menu</span>
                <span>Menu Management</span>
              </a>
              <a className="um-nav-item" onClick={() => { navigate("/admin/orders"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">shopping_cart</span>
                <span>Orders</span>
              </a>
              <a className="um-nav-item" onClick={() => { navigate("/admin/reports"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">analytics</span>
                <span>Reports & Analytics</span>
              </a>
            </nav>
            <div className="um-sidebar-footer">
              <button className="um-logout-btn" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="um-main-wrapper">
        <header className="um-topbar">
          <div className="um-topbar-left">
            <button className="um-menu-toggle" onClick={() => setMobileMenuOpen(true)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="um-brand-title">Stratizen Cafeteria</h2>
          </div>
          <div className="um-search-container">
            <span className="material-symbols-outlined um-search-icon">search</span>
            <input className="um-search-input" placeholder="Search across modules..." type="text" readOnly />
          </div>
          <div className="um-topbar-right" />
        </header>

        <main className="um-main-canvas">
          {/* Page header */}
          <div className="um-page-header">
            <div>
              <h1 className="um-page-title">User Management</h1>
              <p className="um-page-subtitle">Manage student accounts, balances, and cafeteria staff access.</p>
            </div>
          </div>

          {/* RPC warning banner */}
          {rpcAvailable === false && (
            <div className="um-rpc-warning">
              <span className="material-symbols-outlined">warning</span>
              <span>
                <strong>Admin database functions not deployed.</strong> Wallet balances are unavailable.
                Please run <code>admin_rpc_functions.sql</code> in the Supabase SQL Editor to enable all features.
              </span>
            </div>
          )}

          {/* Content card with tabs */}
          <div className="um-content-card">
            <div className="um-tabs-header">
              <button
                className={`um-tab-btn ${activeTab === "students" ? "active" : ""}`}
                onClick={() => setActiveTab("students")}
              >
                Students
                <span className="um-tab-count">{students.length}</span>
              </button>
              <button
                className={`um-tab-btn ${activeTab === "chefs" ? "active" : ""}`}
                onClick={() => setActiveTab("chefs")}
              >
                Chefs
                <span className="um-tab-count">{chefs.length}</span>
              </button>
            </div>

            <div className="um-tab-content">

              {/* ── STUDENTS TAB ─────────────────────────────── */}
              {activeTab === "students" && (
                <div className="um-tab-view">
                  <div className="um-toolbar">
                    <div className="um-toolbar-search">
                      <span className="material-symbols-outlined">search</span>
                      <input
                        className="um-toolbar-input"
                        placeholder="Search by name, student ID, or email..."
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                      />
                    </div>
                    <button className="um-filter-btn" onClick={fetchStudents} title="Refresh">
                      <span className="material-symbols-outlined">refresh</span>
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="um-table-container">
                    <table className="um-table">
                      <thead className="um-table-head">
                        <tr>
                          <th>Profile</th>
                          <th>Name</th>
                          <th>Student ID</th>
                          <th className="hidden-mobile">Email</th>
                          <th>Wallet Balance</th>
                          <th style={{ textAlign: "right" }}>Status</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="um-empty-row">
                              {studentSearch ? "No students match your search." : "No students found."}
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((student) => (
                            <tr key={student.id} className="um-table-row">
                              <td>
                                <div className="um-user-initials">{getInitials(student.fullName)}</div>
                              </td>
                              <td className="bold-text">{student.fullName}</td>
                              <td className="sub-text">{student.studentNumber}</td>
                              <td className="sub-text hidden-mobile">{student.email}</td>
                              <td>
                                {student.walletBalance === null ? (
                                  <span className="um-balance-unavailable">—</span>
                                ) : (
                                  <span className={`um-balance ${student.walletBalance <= 0 ? "zero" : ""}`}>
                                    {formatKES(student.walletBalance)}
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <span className={`um-status-pill ${student.status}`}>
                                  {student.status === "active" ? "Active" : "Suspended"}
                                </span>
                              </td>
                              <td style={{ textAlign: "right", position: "relative" }}>
                                <button
                                  className="um-action-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownId(
                                      activeDropdownId === student.id ? null : student.id
                                    );
                                  }}
                                >
                                  <span className="material-symbols-outlined">more_vert</span>
                                </button>

                                {activeDropdownId === student.id && (
                                  <div
                                    className="um-dropdown-menu"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {student.status === "active" ? (
                                      <button
                                        className="um-dropdown-item suspend"
                                        onClick={() => {
                                          setStudentToSuspend(student);
                                          setActiveDropdownId(null);
                                        }}
                                      >
                                        <span className="material-symbols-outlined">block</span>
                                        Suspend Student
                                      </button>
                                    ) : (
                                      <button
                                        className="um-dropdown-item unsuspend"
                                        onClick={() => {
                                          handleUnsuspendStudent(student);
                                          setActiveDropdownId(null);
                                        }}
                                      >
                                        <span className="material-symbols-outlined">check_circle</span>
                                        Unsuspend Student
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="um-table-footer">
                    Showing {filteredStudents.length} of {students.length} students
                  </div>
                </div>
              )}

              {/* ── CHEFS TAB ─────────────────────────────────── */}
              {activeTab === "chefs" && (
                <div className="um-tab-view">
                  <div className="um-toolbar">
                    <div className="um-toolbar-search">
                      <span className="material-symbols-outlined">search</span>
                      <input
                        className="um-toolbar-input"
                        placeholder="Search chef by name or email..."
                        type="text"
                        value={chefSearch}
                        onChange={(e) => setChefSearch(e.target.value)}
                      />
                    </div>
                    <button className="um-add-chef-btn" onClick={() => { setFormError(""); setAddChefOpen(true); }}>
                      <span className="material-symbols-outlined">person_add</span>
                      <span>Add Chef</span>
                    </button>
                  </div>

                  <div className="um-table-container">
                    <table className="um-table">
                      <thead className="um-table-head">
                        <tr>
                          <th>Profile</th>
                          <th>Name</th>
                          <th className="hidden-mobile">Email</th>
                          <th style={{ textAlign: "right" }}>Status</th>
                          <th style={{ textAlign: "right" }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredChefs.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="um-empty-row">
                              {chefSearch ? "No chefs match your search." : "No chefs found. Add one using the button above."}
                            </td>
                          </tr>
                        ) : (
                          filteredChefs.map((chef) => (
                            <tr key={chef.id} className="um-table-row">
                              <td>
                                <div className="um-user-initials chef-initials">{getInitials(chef.fullName)}</div>
                              </td>
                              <td className="bold-text">{chef.fullName}</td>
                              <td className="sub-text hidden-mobile">{chef.email}</td>
                              <td style={{ textAlign: "right" }}>
                                <span className="um-status-pill active">Active</span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  className="um-action-btn delete-btn"
                                  title="Delete chef"
                                  onClick={() => setChefToDelete(chef)}
                                >
                                  <span className="material-symbols-outlined">delete</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="um-table-footer">
                    Showing {filteredChefs.length} of {chefs.length} chefs
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── STUDENT SUSPENSION DIALOG ──────────────────────── */}
      {studentToSuspend && (
        <div className="um-dialog-overlay" onClick={() => setStudentToSuspend(null)}>
          <div className="um-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="um-dialog-icon-wrap warning">
              <span className="material-symbols-outlined">block</span>
            </div>
            <h3 className="um-dialog-title">Suspend Student Account</h3>
            <div className="um-dialog-student-info">
              <div className="um-user-initials">{getInitials(studentToSuspend.fullName)}</div>
              <div>
                <p className="bold-text" style={{ margin: 0 }}>{studentToSuspend.fullName}</p>
                <p className="sub-text" style={{ margin: "2px 0 0", fontSize: "12px" }}>
                  {studentToSuspend.studentNumber} · {studentToSuspend.email}
                </p>
              </div>
            </div>
            <p className="um-dialog-msg">
              Suspending this student will immediately block their access to the app. They will not be able to log in until the account is reactivated.
            </p>
            <div className="um-dialog-actions">
              <button className="um-dialog-btn cancel" onClick={() => setStudentToSuspend(null)}>Cancel</button>
              <button className="um-dialog-btn confirm-suspend" onClick={handleSuspendStudent}>
                Suspend Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHEF DELETION DIALOG ───────────────────────────── */}
      {chefToDelete && (
        <div className="um-dialog-overlay" onClick={() => setChefToDelete(null)}>
          <div className="um-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="um-dialog-icon-wrap danger">
              <span className="material-symbols-outlined">delete_forever</span>
            </div>
            <h3 className="um-dialog-title">Delete Chef Account</h3>
            <div className="um-dialog-student-info">
              <div className="um-user-initials chef-initials">{getInitials(chefToDelete.fullName)}</div>
              <div>
                <p className="bold-text" style={{ margin: 0 }}>{chefToDelete.fullName}</p>
                <p className="sub-text" style={{ margin: "2px 0 0", fontSize: "12px" }}>{chefToDelete.email}</p>
              </div>
            </div>
            <p className="um-dialog-msg">
              This chef will be permanently removed from the system. Their account will no longer have access to the Chef Module. <strong>This action cannot be undone.</strong>
            </p>
            <div className="um-dialog-actions">
              <button className="um-dialog-btn cancel" onClick={() => setChefToDelete(null)}>Cancel</button>
              <button className="um-dialog-btn confirm-delete" onClick={handleDeleteChef}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD CHEF MODAL ──────────────────────────────────── */}
      {addChefOpen && (
        <div className="um-dialog-overlay" onClick={() => !creatingChef && setAddChefOpen(false)}>
          <div className="um-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-header">
              <div>
                <h2 className="um-modal-title">Add New Chef</h2>
                <p className="um-modal-subtitle">Create credentials for a new kitchen staff member.</p>
              </div>
              <button
                className="um-close-btn"
                onClick={() => setAddChefOpen(false)}
                disabled={creatingChef}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="um-modal-form" onSubmit={handleCreateChef} noValidate>
              {/* Form error banner */}
              {formError && (
                <div className="um-form-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{formError}</span>
                </div>
              )}

              <div className="um-modal-group">
                <label className="um-modal-label">Full Name</label>
                <div className="um-modal-input-wrapper">
                  <span className="material-symbols-outlined um-modal-input-icon">person</span>
                  <input
                    className="um-modal-input"
                    placeholder="e.g. Johnathan Onyango"
                    type="text"
                    required
                    value={chefFormName}
                    onChange={(e) => { setChefFormName(e.target.value); setFormError(""); }}
                    disabled={creatingChef}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="um-modal-group">
                <label className="um-modal-label">Email Address</label>
                <div className="um-modal-input-wrapper">
                  <span className="material-symbols-outlined um-modal-input-icon">alternate_email</span>
                  <input
                    className="um-modal-input"
                    placeholder="chef@stratizen.com"
                    type="email"
                    required
                    value={chefFormEmail}
                    onChange={(e) => { setChefFormEmail(e.target.value); setFormError(""); }}
                    disabled={creatingChef}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="um-modal-group">
                <label className="um-modal-label">Password</label>
                <div className="um-modal-input-wrapper">
                  <span className="material-symbols-outlined um-modal-input-icon">lock</span>
                  <input
                    className="um-modal-input"
                    placeholder="Minimum 6 characters"
                    type={pwdVisible ? "text" : "password"}
                    required
                    minLength={6}
                    value={chefFormPassword}
                    onChange={(e) => { setChefFormPassword(e.target.value); setFormError(""); }}
                    disabled={creatingChef}
                    autoComplete="new-password"
                  />
                  <button
                    className="um-pwd-toggle"
                    type="button"
                    onClick={() => setPwdVisible(!pwdVisible)}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined">
                      {pwdVisible ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                <p className="um-modal-hint">
                  The chef can log in immediately after the account is created.
                </p>
              </div>

              <div className="um-modal-actions">
                <button
                  className="um-modal-btn cancel"
                  type="button"
                  onClick={() => setAddChefOpen(false)}
                  disabled={creatingChef}
                >
                  Cancel
                </button>
                <button className="um-modal-btn submit" type="submit" disabled={creatingChef}>
                  {creatingChef ? (
                    <>
                      <span className="um-btn-spinner" />
                      <span>Creating Chef...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">person_add</span>
                      <span>Create Chef Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TOAST ──────────────────────────────────────────── */}
      {toast && (
        <div className={`um-toast ${toast.type}`}>
          <span className="material-symbols-outlined um-toast-icon">
            {toast.type === "error" ? "error" : "check_circle"}
          </span>
          <p className="um-toast-message">{toast.message}</p>
          <button className="um-toast-close" onClick={() => setToast(null)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
