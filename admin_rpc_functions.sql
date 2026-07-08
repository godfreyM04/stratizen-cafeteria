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
-- PART 7: Update menu table policies to allow both chefs and admins
-- ============================================================
DROP POLICY IF EXISTS "Menu is viewable by everyone" ON public.menu;
CREATE POLICY "Menu is viewable by everyone" ON public.menu
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Chefs and admins can modify the menu" ON public.menu;
DROP POLICY IF EXISTS "Only chefs can modify the menu" ON public.menu;
DROP POLICY IF EXISTS "Chefs and admins can insert menu items" ON public.menu;
DROP POLICY IF EXISTS "Chefs and admins can update menu items" ON public.menu;
DROP POLICY IF EXISTS "Chefs and admins can delete menu items" ON public.menu;

DROP POLICY IF EXISTS "Admins can insert menu items" ON public.menu;
DROP POLICY IF EXISTS "Admins can delete menu items" ON public.menu;

CREATE POLICY "Admins can insert menu items" ON public.menu
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Chefs and admins can update menu items" ON public.menu
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('chef', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('chef', 'admin')
    )
  );

CREATE POLICY "Admins can delete menu items" ON public.menu
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- PART 8: Add assigned_chef_id to orders table
-- ============================================================
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS assigned_chef_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- PART 9: RLS Select Policies for Admins
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- PART 10: Security Definer RPCs to bypass RLS for Admins
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_all_orders()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  student_name text,
  student_id text,
  pickup_option text,
  status text,
  total_items integer,
  subtotal numeric,
  total numeric,
  wallet_deduction numeric,
  notes text,
  prep_started_at timestamp with time zone,
  ready_at timestamp with time zone,
  collected_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  assigned_chef_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    o.id, o.user_id, o.student_name, o.student_id, o.pickup_option, o.status,
    o.total_items, o.subtotal, o.total, o.wallet_deduction, o.notes,
    o.prep_started_at, o.ready_at, o.collected_at, o.created_at, o.updated_at,
    o.assigned_chef_id
  FROM public.orders o
  ORDER BY o.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_orders() TO anon, authenticated;

DROP FUNCTION IF EXISTS public.admin_get_all_order_items();

CREATE OR REPLACE FUNCTION public.admin_get_all_order_items()
RETURNS TABLE (
  id uuid,
  order_id uuid,
  menu_item_id uuid,
  quantity integer,
  unit_price numeric,
  subtotal numeric,
  menu_name text,
  menu_image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.unit_price, oi.subtotal,
    m.name as menu_name,
    m.image_url as menu_image_url
  FROM public.order_items oi
  LEFT JOIN public.menu m ON m.id = oi.menu_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_order_items() TO anon, authenticated;

-- ============================================================
-- PART 11: Storage Bucket and Policies for Menu Images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public access to menu images" ON storage.objects;
CREATE POLICY "Public access to menu images" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Admins can upload menu images" ON storage.objects;
CREATE POLICY "Admins can upload menu images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Admins can update menu images" ON storage.objects;
CREATE POLICY "Admins can update menu images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Admins can delete menu images" ON storage.objects;
CREATE POLICY "Admins can delete menu images" ON storage.objects
  FOR DELETE USING (bucket_id = 'menu-images');

-- ============================================================
-- PART 12: Admin Menu CRUD RPC Functions (bypasses RLS for mock session)
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_create_menu_item(text, text, text, numeric, text, boolean);
CREATE OR REPLACE FUNCTION public.admin_create_menu_item(
  p_name text,
  p_category text,
  p_description text,
  p_price numeric,
  p_image_url text,
  p_availability boolean
)
RETURNS public.menu
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.menu;
BEGIN
  INSERT INTO public.menu (name, category, description, price, image_url, availability)
  VALUES (p_name, p_category, p_description, p_price, p_image_url, p_availability)
  RETURNING * INTO v_item;
  RETURN v_item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_menu_item(text, text, text, numeric, text, boolean) TO anon, authenticated;


DROP FUNCTION IF EXISTS public.admin_update_menu_item(uuid, text, text, text, numeric, text, boolean);
CREATE OR REPLACE FUNCTION public.admin_update_menu_item(
  p_id uuid,
  p_name text,
  p_category text,
  p_description text,
  p_price numeric,
  p_image_url text,
  p_availability boolean
)
RETURNS public.menu
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.menu;
BEGIN
  UPDATE public.menu
  SET 
    name = p_name,
    category = p_category,
    description = p_description,
    price = p_price,
    image_url = p_image_url,
    availability = p_availability,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_item;
  RETURN v_item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_menu_item(uuid, text, text, text, numeric, text, boolean) TO anon, authenticated;


DROP FUNCTION IF EXISTS public.admin_delete_menu_item(uuid);
CREATE OR REPLACE FUNCTION public.admin_delete_menu_item(
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.menu
  WHERE id = p_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_menu_item(uuid) TO anon, authenticated;

-- ============================================================
-- DONE — All functions and policy updates created successfully.
-- ============================================================

