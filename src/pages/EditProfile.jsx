import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AuthLayout from "../components/AuthLayout";
import "../styles/EditProfile.css";

function EditProfile() {
  const { user, profile, updateProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Pre-fill fields with current user information
  useEffect(() => {
    let active = true;
    if (user || profile) {
      setTimeout(() => {
        if (!active) return;
        setFullName(profile?.full_name || user?.user_metadata?.full_name || "");
        setPhoneNumber(profile?.phone_number || user?.user_metadata?.phone_number || "");
      }, 0);
    }
    return () => {
      active = false;
    };
  }, [user, profile]);

  // Handlers to block modifications to read-only fields
  const handleLockedKeyDown = (e) => {
    const allowedKeys = [
      "Tab",
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown"
    ];
    if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  };

  const handleLockedPasteCut = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    // Validate inputs
    if (!fullName.trim()) {
      setErrorMsg("Full Name is required.");
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMsg("Phone Number is required.");
      return;
    }

    setSaving(true);
    try {
      await updateProfile(fullName.trim(), phoneNumber.trim());
      addToast("Profile updated successfully.");
      navigate("/menu");
    } catch (err) {
      console.error("Failed to save profile changes:", err);
      setErrorMsg(err.message || "Unable to update your profile. Please try again.");
      addToast("Unable to update your profile. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/menu");
  };

  return (
    <AuthLayout>
      <div className="edit-profile-wrapper">
        <div className="edit-profile-container">
          <div className="edit-profile-content">
            <div className="edit-profile-header">
              <h1 className="edit-profile-title">Edit Account Details</h1>
              <p className="edit-profile-subtitle">Update your personal information below.</p>
            </div>

            {errorMsg && (
              <div 
                style={{
                  backgroundColor: "var(--color-error-container)",
                  color: "var(--color-on-error-container)",
                  padding: "12px 16px",
                  borderRadius: "var(--border-radius-lg)",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "var(--spacing-lg)",
                  border: "1px solid rgba(186, 26, 26, 0.15)"
                }}
              >
                {errorMsg}
              </div>
            )}

            <form className="edit-profile-form" onSubmit={handleSubmit}>
              {/* Full Name */}
              <div className="form-field-group">
                <label className="form-field-label" htmlFor="full_name">
                  Full Name
                </label>
                <div className="input-relative-wrapper">
                  <span className="material-symbols-outlined input-icon">person</span>
                  <input
                    className="form-field-input"
                    id="full_name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="form-field-group">
                <label className="form-field-label" htmlFor="phone_number">
                  Phone Number
                </label>
                <div className="input-relative-wrapper">
                  <span className="material-symbols-outlined input-icon">call</span>
                  <input
                    className="form-field-input"
                    id="phone_number"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Student ID (Disabled) */}
              <div className="form-field-group">
                <div className="form-field-header">
                  <label className="form-field-label" htmlFor="student_id">
                    Student ID
                  </label>
                  <span className="read-only-badge">
                    <span className="material-symbols-outlined">lock</span> Read Only
                  </span>
                </div>
                <div className="input-relative-wrapper">
                  <span className="material-symbols-outlined input-icon disabled-icon">badge</span>
                  <input
                    className="form-field-input"
                    id="student_id"
                    type="text"
                    disabled
                    readOnly
                    value={profile?.student_number || ""}
                    onKeyDown={handleLockedKeyDown}
                    onPaste={handleLockedPasteCut}
                    onCut={handleLockedPasteCut}
                    onDrop={handleLockedPasteCut}
                  />
                </div>
                <p className="input-helper-text">
                  Contact Academic Affairs to update your Student ID.
                </p>
              </div>

              {/* University Email (Disabled) */}
              <div className="form-field-group">
                <div className="form-field-header">
                  <label className="form-field-label" htmlFor="university_email">
                    University Email
                  </label>
                  <span className="read-only-badge">
                    <span className="material-symbols-outlined">lock</span> Read Only
                  </span>
                </div>
                <div className="input-relative-wrapper">
                  <span className="material-symbols-outlined input-icon disabled-icon">mail</span>
                  <input
                    className="form-field-input"
                    id="university_email"
                    type="email"
                    disabled
                    readOnly
                    value={user?.email || ""}
                    onKeyDown={handleLockedKeyDown}
                    onPaste={handleLockedPasteCut}
                    onCut={handleLockedPasteCut}
                    onDrop={handleLockedPasteCut}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions-wrapper">
                <button
                  className="btn-cancel"
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn-save"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="material-symbols-outlined animate-spin">sync</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">save</span>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

export default EditProfile;
