-- STRATIZEN CAFETERIA SUPABASE SCHEMA
-- Copy and run this script in the Supabase SQL Editor (https://supabase.com)

-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  student_number text,
  email text,
  phone_number text,
  avatar_url text,
  role text default 'student' check (role in ('student', 'chef')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure columns exist if the table was created by an older schema version
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text default 'student';

-- Ensure the check constraint exists on role
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'chef'));

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles RLS Policies (Idempotent)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);


-- ==========================================
-- 2. WALLETS TABLE
-- ==========================================
create table if not exists public.wallets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade unique not null,
  balance numeric(10,2) default 0.00 not null check (balance >= 0.00),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on wallets
alter table public.wallets enable row level security;

-- Wallets RLS Policies (Idempotent)
drop policy if exists "Users can view their own wallet" on public.wallets;
create policy "Users can view their own wallet" on public.wallets
  for select using (auth.uid() = user_id);

drop policy if exists "Chefs can view all wallets" on public.wallets;
create policy "Chefs can view all wallets" on public.wallets
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'chef'
    )
  );

drop policy if exists "Users can update their own wallet" on public.wallets;
create policy "Users can update their own wallet" on public.wallets
  for update using (auth.uid() = user_id);

drop policy if exists "Users can insert their own wallet" on public.wallets;
create policy "Users can insert their own wallet" on public.wallets
  for insert with check (auth.uid() = user_id);


-- ==========================================
-- 3. WALLET TRANSACTIONS TABLE
-- ==========================================
create table if not exists public.wallet_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null check (type in ('deposit', 'purchase', 'refund')),
  amount numeric(10,2) not null,
  previous_balance numeric(10,2) not null,
  new_balance numeric(10,2) not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on transactions
alter table public.wallet_transactions enable row level security;

-- Transactions RLS Policies (Idempotent)
drop policy if exists "Users can view their own transactions" on public.wallet_transactions;
create policy "Users can view their own transactions" on public.wallet_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Chefs can view all transactions" on public.wallet_transactions;
create policy "Chefs can view all transactions" on public.wallet_transactions
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'chef'
    )
  );

drop policy if exists "Users can insert their own transactions" on public.wallet_transactions;
create policy "Users can insert their own transactions" on public.wallet_transactions
  for insert with check (auth.uid() = user_id);


-- ==========================================
-- 4. MENU TABLE
-- ==========================================
create table if not exists public.menu (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  availability boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enforce unique constraint on name to make seed data repeatable without duplicates
alter table public.menu drop constraint if exists menu_name_key;
alter table public.menu add constraint menu_name_key unique (name);

-- Enable RLS on menu
alter table public.menu enable row level security;

-- Menu RLS Policies (Idempotent)
drop policy if exists "Menu is viewable by everyone" on public.menu;
create policy "Menu is viewable by everyone" on public.menu
  for select using (true);

drop policy if exists "Only chefs can modify the menu" on public.menu;
create policy "Only chefs can modify the menu" on public.menu
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'chef'
    )
  );


-- ==========================================
-- 5. ORDERS TABLE
-- ==========================================
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  student_name text not null,
  student_id text not null,
  pickup_option text not null check (pickup_option in ('dine_in', 'takeaway')),
  status text default 'pending' not null check (status in ('pending', 'preparing', 'ready', 'collected')),
  total_items integer not null,
  subtotal numeric(10,2) not null,
  total numeric(10,2) not null,
  wallet_deduction numeric(10,2) not null,
  notes text,
  prep_started_at timestamp with time zone,
  ready_at timestamp with time zone,
  collected_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on orders
alter table public.orders enable row level security;

-- Orders RLS Policies (Idempotent)
drop policy if exists "Students can view their own orders" on public.orders;
create policy "Students can view their own orders" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "Chefs can view all orders" on public.orders;
create policy "Chefs can view all orders" on public.orders
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'chef'
    )
  );

drop policy if exists "Students can place orders" on public.orders;
create policy "Students can place orders" on public.orders
  for insert with check (auth.uid() = user_id);

drop policy if exists "Chefs can update orders" on public.orders;
create policy "Chefs can update orders" on public.orders
  for update using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'chef'
    )
  );


-- ==========================================
-- 6. ORDER ITEMS TABLE
-- ==========================================
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders on delete cascade not null,
  menu_item_id uuid references public.menu on delete set null,
  quantity integer not null,
  unit_price numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

-- Enable RLS on order items
alter table public.order_items enable row level security;

-- Order Items RLS Policies (Idempotent)
drop policy if exists "Students can view their own order items" on public.order_items;
create policy "Students can view their own order items" on public.order_items
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );

drop policy if exists "Chefs can view all order items" on public.order_items;
create policy "Chefs can view all order items" on public.order_items
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'chef'
    )
  );

drop policy if exists "Students can insert order items" on public.order_items;
create policy "Students can insert order items" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );


-- ==========================================
-- 7. AUTH TRIGGER TO CREATE PROFILE & WALLET
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  if new.email = 'chef1@gmail.com' then
    insert into public.profiles (id, full_name, student_number, email, role)
    values (new.id, 'Chef Anderson', 'CHEF01', new.email, 'chef');
  else
    insert into public.profiles (id, full_name, student_number, email, phone_number, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', 'Student'),
      coalesce(new.raw_user_meta_data->>'student_number', ''),
      new.email,
      coalesce(new.phone, ''),
      'student'
    );
    
    insert into public.wallets (user_id, balance)
    values (new.id, 0.00);
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ==========================================
-- 8. ATOMIC PLACE ORDER STORED PROCEDURE (RPC)
-- ==========================================
create or replace function public.place_order(
  p_user_id uuid,
  p_student_name text,
  p_student_id text,
  p_pickup_option text,
  p_total_items integer,
  p_subtotal numeric,
  p_total numeric,
  p_notes text,
  p_items jsonb -- Array of {menu_item_id, quantity, unit_price, subtotal}
)
returns uuid as $$
declare
  v_wallet_balance numeric;
  v_order_id uuid;
  v_item jsonb;
begin
  -- A. Check if the user already has an active order
  if exists (
    select 1 from public.orders
    where user_id = p_user_id and status in ('pending', 'preparing', 'ready')
  ) then
    raise exception 'ACTIVE_ORDER_EXISTS';
  end if;

  -- B. Check and lock wallet balance
  select balance into v_wallet_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  if v_wallet_balance is null then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if v_wallet_balance < p_total then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  -- C. Deduct wallet balance
  update public.wallets
  set balance = balance - p_total,
      updated_at = now()
  where user_id = p_user_id;

  -- D. Record wallet transaction
  insert into public.wallet_transactions (user_id, type, amount, previous_balance, new_balance, description)
  values (
    p_user_id,
    'purchase',
    p_total,
    v_wallet_balance,
    v_wallet_balance - p_total,
    'Food purchase - Order #'
  );

  -- E. Create order
  insert into public.orders (
    user_id, student_name, student_id, pickup_option, status,
    total_items, subtotal, total, wallet_deduction, notes
  )
  values (
    p_user_id, p_student_name, p_student_id, p_pickup_option, 'pending',
    p_total_items, p_subtotal, p_total, p_total, p_notes
  )
  returning id into v_order_id;

  -- F. Create order items
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
    values (
      v_order_id,
      (v_item->>'menu_item_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'subtotal')::numeric
    );
  end loop;

  -- G. Update the transaction description with the order ID
  update public.wallet_transactions
  set description = 'Food purchase - Order #STR-' || substring(v_order_id::text, 1, 8)
  where user_id = p_user_id and description = 'Food purchase - Order #';

  return v_order_id;
end;
$$ language plpgsql security definer;


-- ==========================================
-- 8.5. ATOMIC DEPOSIT FUNDS STORED PROCEDURE (RPC)
-- ==========================================
create or replace function public.deposit_funds(
  p_user_id uuid,
  p_amount numeric
)
returns numeric as $$
declare
  v_wallet_balance numeric;
  v_new_balance numeric;
begin
  -- A. Get current balance and lock. If not exists, insert.
  select balance into v_wallet_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  if v_wallet_balance is null then
    insert into public.wallets (user_id, balance)
    values (p_user_id, 0.00)
    returning balance into v_wallet_balance;
  end if;

  v_new_balance := v_wallet_balance + p_amount;

  -- B. Update wallet balance
  update public.wallets
  set balance = v_new_balance,
      updated_at = now()
  where user_id = p_user_id;

  -- C. Record wallet transaction
  insert into public.wallet_transactions (user_id, type, amount, previous_balance, new_balance, description)
  values (
    p_user_id,
    'deposit',
    p_amount,
    v_wallet_balance,
    v_new_balance,
    'Manual Deposit'
  );

  return v_new_balance;
end;
$$ language plpgsql security definer;


-- ==========================================
-- 9. SEED INITIAL MENU DATA
-- ==========================================
insert into public.menu (name, category, description, price, image_url, availability)
values
  ('Grilled Tilapia + Ugali', 'Main Course', 'Freshly caught lake tilapia grilled to perfection, served with traditional ugali and sukuma wiki.', 650.00, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2', true),
  ('Chicken Burger', 'Fast Food', 'Juicy grilled chicken breast topped with melted cheddar, crisp lettuce, tomato, and chef sauce.', 450.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd', true),
  ('Sweet Potato Fries', 'Sides', 'Crisp, golden sweet potato fries lightly seasoned with sea salt.', 180.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877', true),
  ('Cold Brew Coffee', 'Beverages', 'Slow-steeped organic coffee served over ice for a smooth, refreshing kick.', 220.00, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c', true),
  ('Avocado Toast', 'Breakfast', 'Sourdough toast topped with mashed avocado, cherry tomatoes, and poached egg.', 350.00, 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77', true),
  ('Matcha Latte', 'Beverages', 'Ceremonial grade green tea whisked with steamed milk.', 250.00, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a', true)
on conflict do nothing;