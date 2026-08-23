-- SILORA complete Supabase baseline
-- Run once in the Supabase SQL Editor on an empty project.
-- Frontend uses user_roles as the authorization source; profiles.role is a
-- synchronized Table Editor convenience field. Never put service-role keys in Vite.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  mobile text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  description text, image_url text, display_order integer not null default 0,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null,
  description text, price numeric(12,2) not null default 0 check (price >= 0),
  original_price numeric(12,2) check (original_price is null or original_price >= 0),
  stock integer not null default 0 check (stock >= 0), sku text,
  category_id uuid references public.categories(id) on delete set null,
  is_featured boolean not null default false, is_bestseller boolean not null default false,
  is_trending boolean not null default false, is_new boolean not null default false,
  is_active boolean not null default true, rating numeric(2,1) not null default 0,
  review_count integer not null default 0, sales_count integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  name text not null, value text not null, price_override numeric(12,2) check (price_override is null or price_override >= 0),
  stock integer not null default 0 check (stock >= 0), created_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  url text not null, alt text, display_order integer not null default 0, created_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0), created_at timestamptz not null default now(),
  unique (user_id, product_id, variant_id)
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null default 'Home', full_name text not null, mobile text not null, line1 text not null,
  line2 text, city text not null, state text not null, pincode text not null,
  is_default boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(), name text not null,
  type text not null check (type in ('upi','upi_qr','cod','gateway','other')),
  description text, instructions text, upi_id text, enabled boolean not null default true,
  display_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.payment_qr_codes (
  id uuid primary key default gen_random_uuid(), payment_method_id uuid not null references public.payment_methods(id) on delete cascade,
  name text not null, description text, image_url text not null, enabled boolean not null default true,
  display_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique,
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  customer_name text not null, email text not null, mobile text, address_line1 text not null,
  address_line2 text, city text not null, state text not null, pincode text not null,
  subtotal numeric(12,2) not null default 0, discount numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  amount_paid numeric(12,2), coupon_code text, payment_method_id uuid references public.payment_methods(id) on delete set null,
  payment_method_name text, payment_proof_path text,
  payment_status text not null default 'Pending' check (payment_status in ('Pending','pending_verification','Payment Submitted','Under Verification','Paid','Failed','Refunded','Cancelled')),
  delivery_status text not null default 'Pending' check (delivery_status in ('Pending','pending','Confirmed','Processing','Packed','Shipped','Out for Delivery','Delivered','Cancelled','Returned')),
  tracking_number text, courier text, delivery_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null, product_image text,
  variant_name text, price numeric(12,2) not null default 0, original_price numeric(12,2),
  quantity integer not null default 1 check (quantity > 0), created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payment_method_id uuid references public.payment_methods(id) on delete set null, payment_method_name text,
  amount numeric(12,2) not null default 0, status text not null default 'Pending' check (status in ('Pending','pending_verification','Payment Submitted','Under Verification','Paid','Failed','Refunded','Cancelled')),
  payment_reference text, submitted_at timestamptz, verified_at timestamptz, verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  previous_status text, new_status text not null, changed_by uuid references auth.users(id) on delete set null,
  note text, created_at timestamptz not null default now()
);

create table if not exists public.payment_status_history (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id) on delete cascade,
  previous_status text, new_status text not null, changed_by uuid references auth.users(id) on delete set null,
  note text, created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(), code text not null unique, description text,
  discount_type text not null check (discount_type in ('percentage','fixed')), discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  min_order numeric(12,2) not null default 0, max_usage integer, usage_count integer not null default 0,
  expires_at timestamptz, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(), admin_id uuid references auth.users(id) on delete set null,
  action text not null, target text, target_id text, details jsonb, created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, rating integer not null default 5 check (rating between 1 and 5),
  title text, body text, author_name text, is_active boolean not null default true, created_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_active_idx on public.products(is_active);
create index if not exists product_images_product_idx on public.product_images(product_id);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(payment_status, delivery_status);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists reviews_product_idx on public.reviews(product_id);

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
        or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function public.sync_profile_role() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role
     and auth.uid() is not null
     and not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') then
    raise exception 'Only an administrator can change roles';
  end if;
  if new.role = 'admin' and (old is null or old.role <> 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  elsif new.role = 'customer' and old is not null and old.role = 'admin' then
    delete from public.user_roles where user_id = new.id and role = 'admin';
  end if;
  return new;
end; $$;

drop trigger if exists profile_role_sync on public.profiles;
create trigger profile_role_sync after insert or update of role on public.profiles for each row execute function public.sync_profile_role();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email,full_name,mobile) values
    (new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'mobile',''),'\s+','','g'),''))
    on conflict (id) do update set email = excluded.email;
  insert into public.user_roles(user_id,role) values (new.id,'customer') on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
do $$ declare table_name text; begin
  foreach table_name in array array['profiles','categories','products','payment_methods','payment_qr_codes','orders','payments','addresses','coupons','site_settings'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I',table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',table_name);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.cart_items enable row level security;
alter table public.addresses enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payment_qr_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payment_status_history enable row level security;
alter table public.site_settings enable row level security;
alter table public.coupons enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.reviews enable row level security;

do $$ declare table_name text; policy_name text; begin
  foreach table_name in array array['profiles','user_roles','categories','products','product_variants','product_images','cart_items','addresses','payment_methods','payment_qr_codes','orders','order_items','payments','order_status_history','payment_status_history','site_settings','coupons','admin_audit_logs','reviews'] loop
    execute format('drop policy if exists admin_all on public.%I',table_name);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',table_name);
  end loop;
end $$;

create policy profiles_own_select on public.profiles for select to authenticated using (auth.uid()=id);
create policy profiles_own_update on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);
create policy roles_own_select on public.user_roles for select to authenticated using (auth.uid()=user_id);
create policy catalog_public_categories on public.categories for select to anon,authenticated using (is_active or public.is_admin());
create policy catalog_public_products on public.products for select to anon,authenticated using (is_active or public.is_admin());
create policy catalog_public_variants on public.product_variants for select to anon,authenticated using (exists(select 1 from public.products p where p.id=product_id and p.is_active) or public.is_admin());
create policy catalog_public_images on public.product_images for select to anon,authenticated using (exists(select 1 from public.products p where p.id=product_id and p.is_active) or public.is_admin());
create policy cart_own on public.cart_items for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy addresses_own on public.addresses for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy payment_methods_public on public.payment_methods for select to anon,authenticated using (enabled or public.is_admin());
create policy payment_qr_public on public.payment_qr_codes for select to anon,authenticated using (enabled and exists(select 1 from public.payment_methods m where m.id=payment_method_id and m.enabled) or public.is_admin());
create policy orders_own on public.orders for select to authenticated using (auth.uid()=user_id);
create policy orders_own_payment_update on public.orders for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy order_items_own on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy payments_own on public.payments for select to authenticated using (auth.uid()=user_id);
create policy payments_own_update on public.payments for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy order_history_own on public.order_status_history for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy payment_history_own on public.payment_status_history for select to authenticated using (exists(select 1 from public.payments p where p.id=payment_id and p.user_id=auth.uid()));
create policy settings_public on public.site_settings for select to anon,authenticated using (true);
create policy coupons_public on public.coupons for select to anon,authenticated using (is_active and (expires_at is null or expires_at>now()));
create policy reviews_public on public.reviews for select to anon,authenticated using (is_active);
create policy reviews_own_insert on public.reviews for insert to authenticated with check (auth.uid()=user_id);

-- Orders are created only by the trusted RPC below; no direct INSERT policy is granted.
create or replace function public.create_order_with_proof(
  p_items jsonb, p_address jsonb, p_coupon_code text default null, p_payment_method_id uuid default null,
  p_payment_proof_path text default null, p_payment_amount numeric default null, p_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); oid uuid:=coalesce(p_order_id,gen_random_uuid()); num text:='SL'||to_char(now(),'YYMMDD')||lpad(floor(random()*10000)::text,4,'0');
  item jsonb; prod record; variant record; pm record; profile record; subtotal numeric:=0; discount numeric:=0; total numeric; qty integer; price numeric; image text; coupon record; proof text:=p_payment_proof_path; status text:='Pending';
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into profile from public.profiles where id=uid and is_active;
  if profile is null then raise exception 'Customer profile not found'; end if;
  select * into pm from public.payment_methods where id=p_payment_method_id and enabled and type<>'cod';
  if pm is null then raise exception 'Invalid payment method'; end if;
  if pm.type='upi_qr' and (proof is null or split_part(proof,'/',1)<>uid::text or split_part(proof,'/',2)<>oid::text or split_part(proof,'/',3)='') then raise exception 'Payment proof is required'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    qty=(item->>'quantity')::integer; if qty is null or qty<=0 then raise exception 'Invalid quantity'; end if;
    select * into prod from public.products where id=(item->>'product_id')::uuid and is_active for update;
    if prod is null or prod.stock<qty then raise exception 'Product is unavailable or out of stock'; end if;
    price=prod.price; variant=null;
    if nullif(item->>'variant_id','') is not null then select * into variant from public.product_variants where id=(item->>'variant_id')::uuid and product_id=prod.id for update; if variant is null or variant.stock<qty then raise exception 'Variant is unavailable or out of stock'; end if; if variant.price_override is not null then price=variant.price_override; end if; update public.product_variants set stock=stock-qty where id=variant.id; end if;
    update public.products set stock=stock-qty,sales_count=sales_count+qty where id=prod.id;
    select url into image from public.product_images where product_id=prod.id order by display_order limit 1;
    subtotal=subtotal+(price*qty);
    insert into public.order_items(order_id,product_id,product_name,product_image,variant_name,price,original_price,quantity) values(oid,prod.id,prod.name,image,case when variant is null then null else variant.name||': '||variant.value end,price,prod.original_price,qty);
  end loop;
  if nullif(p_coupon_code,'') is not null then select * into coupon from public.coupons where code=upper(p_coupon_code) and is_active and (expires_at is null or expires_at>now()) and (max_usage is null or usage_count<max_usage) and min_order<=subtotal; if coupon is null then raise exception 'Invalid or expired coupon'; end if; discount=case when coupon.discount_type='percentage' then least(subtotal*coupon.discount_value/100,subtotal) else least(coupon.discount_value,subtotal) end; update public.coupons set usage_count=usage_count+1 where id=coupon.id; end if;
  total=greatest(0,subtotal-discount); if pm.type='upi_qr' then if p_payment_amount is null or round(p_payment_amount*100)<>round(total*100) then raise exception 'Payment amount does not match the order total'; end if; status='pending_verification'; end if;
  insert into public.orders(id,order_number,user_id,customer_name,email,mobile,address_line1,address_line2,city,state,pincode,subtotal,discount,shipping,total,amount_paid,coupon_code,payment_method_id,payment_method_name,payment_proof_path,payment_status,delivery_status) values(oid,num,uid,coalesce(p_address->>'full_name',profile.full_name,''),profile.email,p_address->>'mobile',p_address->>'line1',p_address->>'line2',p_address->>'city',p_address->>'state',p_address->>'pincode',subtotal,discount,0,total,case when pm.type='upi_qr' then p_payment_amount end,nullif(upper(p_coupon_code),''),pm.id,pm.name,proof,status,'Pending');
  insert into public.payments(order_id,user_id,payment_method_id,payment_method_name,amount,status) values(oid,uid,pm.id,pm.name,total,status);
  delete from public.cart_items where user_id=uid;
  return jsonb_build_object('order_id',oid,'order_number',num,'total',total,'payment_method_name',pm.name,'payment_status',status,'delivery_status','Pending');
end; $$;

create or replace function public.log_admin_action(p_action text,p_target text default null,p_target_id text default null,p_details jsonb default null) returns void language plpgsql security definer set search_path=public as $$ begin if not public.is_admin() then raise exception 'Permission denied'; end if; insert into public.admin_audit_logs(admin_id,action,target,target_id,details) values(auth.uid(),p_action,p_target,p_target_id,p_details); end; $$;
create or replace function public.find_user_by_email(target_email text) returns table(id uuid,email text,full_name text) language sql security definer set search_path=public as $$ select p.id,p.email,p.full_name from public.profiles p where public.is_admin() and lower(p.email)=lower(trim(target_email)) limit 1; $$;
create or replace function public.list_admin_profiles() returns table(user_id uuid,email text,full_name text,created_at timestamptz,is_active boolean) language sql security definer set search_path=public as $$ select r.user_id,p.email,p.full_name,r.created_at,p.is_active from public.user_roles r join public.profiles p on p.id=r.user_id where public.is_admin() and r.role='admin' order by r.created_at; $$;
create or replace function public.set_admin_role(target_user_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not public.is_admin() then raise exception 'Permission denied'; end if; insert into public.user_roles(user_id,role) values(target_user_id,'admin') on conflict do nothing; update public.profiles set role='admin' where id=target_user_id; end; $$;
create or replace function public.remove_admin_role(target_user_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not public.is_admin() then raise exception 'Permission denied'; end if; if (select count(*) from public.user_roles where role='admin')<=1 then raise exception 'Cannot remove the last administrator'; end if; delete from public.user_roles where user_id=target_user_id and role='admin'; update public.profiles set role='customer' where id=target_user_id; end; $$;

create or replace function public.admin_revenue_summary() returns jsonb language plpgsql security definer set search_path=public as $$
declare total numeric; today numeric; week numeric; month numeric; year numeric; paid_count integer; order_count integer; pending integer; refunds numeric;
begin
  if not public.is_admin() then raise exception 'Permission denied'; end if;
  select coalesce(sum(total) filter (where payment_status='Paid'),0),coalesce(sum(total) filter (where payment_status='Paid' and created_at::date=current_date),0),coalesce(sum(total) filter (where payment_status='Paid' and created_at>=date_trunc('week',now())),0),coalesce(sum(total) filter (where payment_status='Paid' and created_at>=date_trunc('month',now())),0),coalesce(sum(total) filter (where payment_status='Paid' and created_at>=date_trunc('year',now())),0),count(*) filter (where payment_status='Paid'),count(*),count(*) filter (where payment_status in ('Pending','pending_verification','Payment Submitted','Under Verification')),coalesce(sum(total) filter (where payment_status='Refunded'),0)
  into total,today,week,month,year,paid_count,order_count,pending,refunds from public.orders;
  return jsonb_build_object('total',total,'today',today,'week',week,'month',month,'year',year,'paid_orders',paid_count,'total_orders',order_count,'pending_payments',pending,'aov',case when paid_count>0 then total/paid_count else 0 end,'refunds',refunds,'net',total-refunds);
end; $$;

create or replace function public.admin_revenue_by_day(p_days integer default 7) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permission denied'; end if;
  return (select coalesce(jsonb_agg(row_to_json(x) order by day),'[]'::jsonb) from (select d::date day,coalesce(sum(o.total),0) revenue,count(o.id) orders from generate_series(current_date-(p_days-1),current_date,'1 day') d left join public.orders o on o.created_at::date=d::date and o.payment_status='Paid' group by d::date) x);
end; $$;

create or replace function public.admin_revenue_by_month(p_months integer default 12) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permission denied'; end if;
  return (select coalesce(jsonb_agg(row_to_json(x) order by month),'[]'::jsonb) from (select to_char(d,'YYYY-MM') month,to_char(d,'Mon YYYY') label,coalesce(sum(o.total),0) revenue,count(o.id) orders from generate_series(date_trunc('month',now())-(p_months-1)*interval '1 month',date_trunc('month',now()),'1 month') d left join public.orders o on date_trunc('month',o.created_at)=d and o.payment_status='Paid' group by d) x);
end; $$;

create or replace function public.admin_revenue_by_method() returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permission denied'; end if;
  return (select coalesce(jsonb_agg(row_to_json(x) order by revenue desc),'[]'::jsonb) from (select coalesce(payment_method_name,'Unknown') method,sum(total) revenue,count(*) orders from public.orders where payment_status='Paid' group by payment_method_name) x);
end; $$;

create or replace function public.admin_revenue_by_category() returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Permission denied'; end if;
  return (select coalesce(jsonb_agg(row_to_json(x) order by revenue desc),'[]'::jsonb) from (select coalesce(c.name,'Uncategorized') category,sum(oi.price*oi.quantity) revenue from public.order_items oi join public.orders o on o.id=oi.order_id and o.payment_status='Paid' left join public.products p on p.id=oi.product_id left join public.categories c on c.id=p.category_id group by c.name) x);
end; $$;

revoke all on function public.is_admin() from public;
revoke all on function public.create_order_with_proof(jsonb,jsonb,text,uuid,text,numeric,uuid) from public;
revoke all on function public.log_admin_action(text,text,text,jsonb) from public;
revoke all on function public.find_user_by_email(text) from public;
revoke all on function public.list_admin_profiles() from public;
revoke all on function public.set_admin_role(uuid) from public;
revoke all on function public.remove_admin_role(uuid) from public;
revoke all on function public.admin_revenue_summary() from public;
revoke all on function public.admin_revenue_by_day(integer) from public;
revoke all on function public.admin_revenue_by_month(integer) from public;
revoke all on function public.admin_revenue_by_method() from public;
revoke all on function public.admin_revenue_by_category() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.create_order_with_proof(jsonb,jsonb,text,uuid,text,numeric,uuid) to authenticated;
grant execute on function public.log_admin_action(text,text,text,jsonb) to authenticated;
grant execute on function public.find_user_by_email(text) to authenticated;
grant execute on function public.list_admin_profiles() to authenticated;
grant execute on function public.set_admin_role(uuid) to authenticated;
grant execute on function public.remove_admin_role(uuid) to authenticated;
grant execute on function public.admin_revenue_summary() to authenticated;
grant execute on function public.admin_revenue_by_day(integer) to authenticated;
grant execute on function public.admin_revenue_by_month(integer) to authenticated;
grant execute on function public.admin_revenue_by_method() to authenticated;
grant execute on function public.admin_revenue_by_category() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('silora','silora',true,10485760,array['image/png','image/jpeg','image/webp']::text[]),
 ('payment-proofs','payment-proofs',false,5242880,array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy silora_public_read on storage.objects for select to anon,authenticated using (bucket_id='silora');
create policy silora_admin_write on storage.objects for all to authenticated using (bucket_id='silora' and public.is_admin()) with check (bucket_id='silora' and public.is_admin());
create policy proof_owner_upload on storage.objects for insert to authenticated with check (bucket_id='payment-proofs' and (storage.foldername(name))[1]=auth.uid()::text and array_length(storage.foldername(name),1)=3);
create policy proof_owner_or_admin_read on storage.objects for select to authenticated using (bucket_id='payment-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy proof_owner_or_admin_delete on storage.objects for delete to authenticated using (bucket_id='payment-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

insert into public.site_settings(key,value) values
 ('shipping','{"enabled":true,"shipping_fee":49,"free_shipping_threshold":2500,"message":"Free shipping on orders above the threshold"}'::jsonb),
 ('store','{"name":"SILORA","tagline":"Premium Online Shopping","support_email":"support@silora.in"}'::jsonb)
on conflict (key) do nothing;

-- After creating a user through Auth, make the first administrator from the
-- Table Editor by setting profiles.role='admin' (or inserting user_roles.role='admin').
-- Then refresh the app. Do not paste a password or service-role key here.
