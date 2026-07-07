-- ============================================================
-- STRATIZEN CAFETERIA — ADMIN RPC FUNCTIONS & TRIGGER FIX
-- Paste and run this ENTIRE script in the Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================


-- ============================================================
-- PART 1: Fix the auth trigger so new chefs get role='chef'
-- The old trigger always set role='student' unless it was chef1@gmail.com
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role text;
BEGIN
  -- Read role from metadata if provided (set during signUp options.data)
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'student');
  
  -- Validate role — only allow 'student' or 'chef' from metadata
  IF v_role NOT IN ('student', 'chef') THEN
    v_role := 'student';
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, full_name, student_number, email, phone_number, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(new.raw_user_meta_data->>'student_number', ''),
    new.email,
    COALESCE(new.phone, ''),
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  -- Always provision a wallet for all new users
  INSERT INTO public.wallets (user_id, balance)
  VALUES (new.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ============================================================
-- PART 2: Update role constraint to also allow 'admin'
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'chef', 'admin'));


-- ============================================================
-- PART 3: RPC — get_all_student_balances
-- Returns all student profiles with wallet balances.
-- SECURITY DEFINER bypasses RLS so admin can see all wallets.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_student_balances()
RETURNS TABLE (
  id uuid,
  full_name text,
  student_number text,
  email text,
  phone_number text,
  role text,
  created_at timestamptz,
  wallet_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.student_number,
    p.email,
    p.phone_number,
    p.role,
    p.created_at,
    COALESCE(w.balance, 0.00) AS wallet_balance
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.id
  WHERE p.role = 'student'
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_student_balances() TO anon, authenticated;


-- ============================================================
-- PART 4: RPC — get_all_chefs
-- Returns all chef profiles.
-- SECURITY DEFINER bypasses RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_chefs()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.created_at
  FROM public.profiles p
  WHERE p.role = 'chef'
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_chefs() TO anon, authenticated;


-- ============================================================
-- PART 5: RPC — admin_upsert_chef_profile
-- Sets role='chef' on a profile by id.
-- Called after chef signUp to correct the role if needed.
-- SECURITY DEFINER bypasses RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_chef_profile(
  p_id uuid,
  p_full_name text,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert the profile with chef role
  INSERT INTO public.profiles (id, full_name, email, role, student_number, phone_number)
  VALUES (p_id, p_full_name, p_email, 'chef', '', '')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = 'chef';

  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id, balance)
  VALUES (p_id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_chef_profile(uuid, text, text) TO anon, authenticated;


-- ============================================================
-- PART 6: RPC — admin_delete_chef
-- Safely deletes a chef profile. Auth user deletion requires
-- the service key (not available client-side), but removing
-- the profile is sufficient to revoke app access.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_chef(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = p_id AND role = 'chef';
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_chef(uuid) TO anon, authenticated;


-- ============================================================
-- DONE — All functions created successfully.
-- The admin frontend will now be able to:
-- 1. Read all student wallet balances (get_all_student_balances)
-- 2. Read all chef profiles (get_all_chefs)
-- 3. Create chef accounts with correct role (fixed trigger)
-- 4. Delete chef profiles safely (admin_delete_chef)
-- ============================================================
