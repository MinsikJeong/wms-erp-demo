-- ============================================================
-- NewSelect WMS — 창고/입고/출고/재고/ERP전표 스키마 + 시드
-- Supabase Dashboard > SQL Editor 에 전체를 붙여넣고 Run 1회 실행
--
-- 설계 원칙
-- - 조회: anon(publishable key)은 RLS select만 허용
-- - 변경: 테이블 직접 쓰기 불가, security definer RPC를 통해서만
--   (입고/출고 처리·전표 생성의 원자성과 재고 정합성을 DB가 보장)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 이전 도메인(재무 대사) 오브젝트 정리 ----------
drop function if exists public.recon_summary();
drop table if exists public.reconciliations;

-- ---------- 기존 WMS 오브젝트 재생성 대비 정리 ----------
drop view if exists public.v_warehouse_stock_summary;
drop view if exists public.v_zone_inventory;
drop view if exists public.v_warehouse_inventory;
drop view if exists public.v_inventory_by_item;
drop view if exists public.v_vouchers;
drop view if exists public.v_wms_orders;
drop function if exists public.wms_summary();
drop function if exists public.wms_create_voucher(uuid);
drop function if exists public.wms_process_order(uuid, jsonb);
drop function if exists public.wms_create_order(text, uuid, text, date, text, jsonb);
drop function if exists public.wms_default_zone(uuid, uuid);
drop table if exists public.erp_vouchers;
drop table if exists public.wms_order_items;
drop table if exists public.wms_orders;
drop table if exists public.inventory;
drop table if exists public.items;
drop table if exists public.warehouses;
drop sequence if exists public.wms_order_seq;
drop sequence if exists public.voucher_seq;

-- ============================================================
-- 1. 테이블
-- ============================================================

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  location text not null,
  -- 지도 마커용 좌표 (WGS84)
  lat double precision,
  lng double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null,
  unit text not null default 'EA',
  unit_price bigint not null,
  created_at timestamptz not null default now()
);

-- 입고/출고 예정·처리 문서 (direction으로 입/출고 구분 — UI/RPC 공용)
create table public.wms_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  direction text not null check (direction in ('IN','OUT')),
  warehouse_id uuid not null references public.warehouses(id),
  -- IN: 공급처 / OUT: 출고처(판매채널·거래처)
  partner text not null,
  expected_date date not null,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED','PROCESSED','VOUCHERED')),
  memo text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  seed_idx int -- 시드 생성용 (마지막에 drop)
);

create index wms_orders_dir_status_idx on public.wms_orders (direction, status);
create index wms_orders_expected_idx on public.wms_orders (expected_date desc);

create table public.wms_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.wms_orders(id) on delete cascade,
  item_id uuid not null references public.items(id),
  expected_qty int not null check (expected_qty > 0),
  processed_qty int check (processed_qty >= 0),
  unique (order_id, item_id)
);

create index wms_order_items_order_idx on public.wms_order_items (order_id);

-- 창고 × 품목 현재고
create table public.inventory (
  warehouse_id uuid not null references public.warehouses(id),
  item_id uuid not null references public.items(id),
  -- 고정 로케이션(존) — 평면도 히트맵/존 필터용, wms_default_zone 규칙으로 배정
  zone_code text not null,
  qty int not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, item_id)
);

-- ERP 회계 전표 (입고=매입, 출고=매출)
create table public.erp_vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_no text not null unique,
  order_id uuid not null unique references public.wms_orders(id),
  direction text not null check (direction in ('IN','OUT')),
  total_amount bigint not null,
  line_count int not null,
  status text not null default 'POSTED' check (status in ('POSTED')),
  created_at timestamptz not null default now()
);

create sequence public.wms_order_seq;
create sequence public.voucher_seq;

-- 존 코드 결정 함수 — (창고, 품목) 해시로 항상 같은 존(A~C × 01~06)을 돌려준다
create function public.wms_default_zone(p_warehouse uuid, p_item uuid)
returns text
language sql
immutable
as $$
  select (array['A','B','C'])[1 + mod(abs(hashtext(p_warehouse::text || p_item::text)), 3)]
    || '-' || lpad((1 + mod(abs(hashtext(p_item::text || p_warehouse::text)), 6))::text, 2, '0');
$$;

-- ============================================================
-- 2. RLS — anon 은 조회만 가능, 쓰기는 RPC(security definer)로만
-- ============================================================

alter table public.warehouses enable row level security;
alter table public.items enable row level security;
alter table public.wms_orders enable row level security;
alter table public.wms_order_items enable row level security;
alter table public.inventory enable row level security;
alter table public.erp_vouchers enable row level security;

create policy "anon read warehouses" on public.warehouses for select to anon using (true);
create policy "anon read items" on public.items for select to anon using (true);
create policy "anon read wms_orders" on public.wms_orders for select to anon using (true);
create policy "anon read wms_order_items" on public.wms_order_items for select to anon using (true);
create policy "anon read inventory" on public.inventory for select to anon using (true);
create policy "anon read erp_vouchers" on public.erp_vouchers for select to anon using (true);

-- ============================================================
-- 3. 조회용 뷰 (security_invoker → 위 RLS가 그대로 적용됨)
-- ============================================================

-- 입/출고 현황 목록 (창고명·품목수·수량 합계·전표번호 평면화)
create view public.v_wms_orders
with (security_invoker = true) as
select
  o.id, o.order_no, o.direction, o.warehouse_id,
  w.code as warehouse_code, w.name as warehouse_name,
  o.partner, o.expected_date, o.status, o.memo,
  o.processed_at, o.created_at,
  count(oi.id)::int as item_kinds,
  coalesce(sum(oi.expected_qty), 0)::int as total_expected_qty,
  coalesce(sum(oi.processed_qty), 0)::int as total_processed_qty,
  v.voucher_no
from public.wms_orders o
join public.warehouses w on w.id = o.warehouse_id
left join public.wms_order_items oi on oi.order_id = o.id
left join public.erp_vouchers v on v.order_id = o.id
group by o.id, w.code, w.name, v.voucher_no;

-- 전표 목록 (문서번호·거래처·창고 평면화)
create view public.v_vouchers
with (security_invoker = true) as
select
  v.id, v.voucher_no, v.direction, v.total_amount, v.line_count,
  v.status, v.created_at,
  o.order_no, o.partner, w.name as warehouse_name
from public.erp_vouchers v
join public.wms_orders o on o.id = v.order_id
join public.warehouses w on w.id = o.warehouse_id;

-- 품목별 전체 재고 (전 창고 합산)
create view public.v_inventory_by_item
with (security_invoker = true) as
select
  i.id as item_id, i.sku, i.name, i.category, i.unit, i.unit_price,
  coalesce(sum(inv.qty), 0)::int as total_qty,
  count(distinct inv.warehouse_id) filter (where inv.qty > 0)::int as warehouse_count,
  (coalesce(sum(inv.qty), 0) * i.unit_price)::bigint as total_value
from public.items i
left join public.inventory inv on inv.item_id = i.id
group by i.id;

-- 창고별 재고 (창고 × 품목 상세)
create view public.v_warehouse_inventory
with (security_invoker = true) as
select
  inv.warehouse_id, w.code as warehouse_code, w.name as warehouse_name,
  inv.item_id, i.sku, i.name as item_name, i.category, i.unit,
  inv.zone_code,
  inv.qty, (inv.qty * i.unit_price)::bigint as value,
  inv.updated_at
from public.inventory inv
join public.warehouses w on w.id = inv.warehouse_id
join public.items i on i.id = inv.item_id;

-- 지리 지도 팝업용: 창고별 재고 요약
create view public.v_warehouse_stock_summary
with (security_invoker = true) as
select
  w.id, w.code, w.name, w.location, w.is_active, w.lat, w.lng,
  count(inv.item_id) filter (where inv.qty > 0)::int as item_kinds,
  coalesce(sum(inv.qty), 0)::int as total_qty,
  coalesce(sum(inv.qty * i.unit_price), 0)::bigint as total_value
from public.warehouses w
left join public.inventory inv on inv.warehouse_id = w.id
left join public.items i on i.id = inv.item_id
group by w.id;

-- 평면도 히트맵용: 창고 × 존 재고 집계
create view public.v_zone_inventory
with (security_invoker = true) as
select
  inv.warehouse_id,
  inv.zone_code,
  count(*) filter (where inv.qty > 0)::int as item_kinds,
  coalesce(sum(inv.qty), 0)::int as total_qty,
  coalesce(sum(inv.qty * i.unit_price), 0)::bigint as total_value
from public.inventory inv
join public.items i on i.id = inv.item_id
group by inv.warehouse_id, inv.zone_code;

-- ============================================================
-- 4. 변경용 RPC (security definer — anon 직접 쓰기 차단 유지)
-- ============================================================

-- 4-1) 입고/출고 예정 등록
create function public.wms_create_order(
  p_direction text,
  p_warehouse_id uuid,
  p_partner text,
  p_expected_date date,
  p_memo text,
  p_items jsonb -- [{ "item_id": uuid, "qty": int }, ...]
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_no text;
  v_line jsonb;
begin
  if p_direction not in ('IN','OUT') then
    raise exception '잘못된 구분입니다: %', p_direction;
  end if;
  if p_partner is null or length(trim(p_partner)) = 0 then
    raise exception '거래처를 입력해 주세요.';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception '품목을 1개 이상 추가해 주세요.';
  end if;

  v_order_no := case when p_direction = 'IN' then 'IB-' else 'OB-' end
    || to_char(current_date, 'YYYYMMDD') || '-'
    || lpad(nextval('wms_order_seq')::text, 4, '0');

  insert into wms_orders (order_no, direction, warehouse_id, partner, expected_date, memo)
  values (v_order_no, p_direction, p_warehouse_id, trim(p_partner), p_expected_date, nullif(trim(coalesce(p_memo,'')), ''))
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_items) loop
    if coalesce((v_line->>'qty')::int, 0) <= 0 then
      raise exception '수량은 1 이상이어야 합니다.';
    end if;
    insert into wms_order_items (order_id, item_id, expected_qty)
    values (v_order_id, (v_line->>'item_id')::uuid, (v_line->>'qty')::int);
  end loop;

  return v_order_no;
end;
$$;

-- 4-2) 입고/출고 처리 — 실물 수량 확정 + 재고 반영 (원자적)
create function public.wms_process_order(
  p_order_id uuid,
  p_lines jsonb -- [{ "order_item_id": uuid, "qty": int }, ...]
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order wms_orders%rowtype;
  v_line jsonb;
  v_item_id uuid;
  v_qty int;
  v_stock int;
begin
  select * into v_order from wms_orders where id = p_order_id for update;
  if not found then
    raise exception '문서를 찾을 수 없습니다.';
  end if;
  if v_order.status <> 'SCHEDULED' then
    raise exception '이미 처리된 문서입니다: %', v_order.order_no;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := coalesce((v_line->>'qty')::int, 0);

    update wms_order_items
    set processed_qty = v_qty
    where id = (v_line->>'order_item_id')::uuid and order_id = p_order_id
    returning item_id into v_item_id;
    if v_item_id is null then
      raise exception '문서 품목이 올바르지 않습니다.';
    end if;

    if v_order.direction = 'IN' then
      -- 입고: 재고 가산 (신규 품목이면 고정 로케이션 규칙으로 존 배정)
      insert into inventory (warehouse_id, item_id, qty, zone_code, updated_at)
      values (
        v_order.warehouse_id, v_item_id, v_qty,
        wms_default_zone(v_order.warehouse_id, v_item_id), now()
      )
      on conflict (warehouse_id, item_id)
      do update set qty = inventory.qty + excluded.qty, updated_at = now();
    else
      -- 출고: 재고 차감 (부족 시 전체 롤백)
      select qty into v_stock from inventory
      where warehouse_id = v_order.warehouse_id and item_id = v_item_id
      for update;
      if coalesce(v_stock, 0) < v_qty then
        raise exception '재고 부족: 현재고 %개, 출고요청 %개', coalesce(v_stock, 0), v_qty;
      end if;
      update inventory
      set qty = qty - v_qty, updated_at = now()
      where warehouse_id = v_order.warehouse_id and item_id = v_item_id;
    end if;
  end loop;

  update wms_orders set status = 'PROCESSED', processed_at = now() where id = p_order_id;
  return v_order.order_no;
end;
$$;

-- 4-3) ERP 전표 생성 — 처리 완료 문서의 금액을 집계해 회계 전표 발행
create function public.wms_create_voucher(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order wms_orders%rowtype;
  v_total bigint;
  v_lines int;
  v_voucher_no text;
begin
  select * into v_order from wms_orders where id = p_order_id for update;
  if not found then
    raise exception '문서를 찾을 수 없습니다.';
  end if;
  if v_order.status <> 'PROCESSED' then
    raise exception '입/출고 처리 완료된 문서만 전표를 생성할 수 있습니다: %', v_order.order_no;
  end if;

  select coalesce(sum(oi.processed_qty * i.unit_price), 0), count(*)
  into v_total, v_lines
  from wms_order_items oi
  join items i on i.id = oi.item_id
  where oi.order_id = p_order_id;

  v_voucher_no := case when v_order.direction = 'IN' then 'VCI-' else 'VCO-' end
    || to_char(current_date, 'YYYYMMDD') || '-'
    || lpad(nextval('voucher_seq')::text, 4, '0');

  insert into erp_vouchers (voucher_no, order_id, direction, total_amount, line_count)
  values (v_voucher_no, p_order_id, v_order.direction, v_total, v_lines);

  update wms_orders set status = 'VOUCHERED' where id = p_order_id;
  return v_voucher_no;
end;
$$;

-- 4-4) 대시보드 요약 집계
create function public.wms_summary()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'todayInbound',  (select count(*) from wms_orders where direction='IN'  and expected_date = current_date),
    'todayOutbound', (select count(*) from wms_orders where direction='OUT' and expected_date = current_date),
    'pendingInbound',  (select count(*) from wms_orders where direction='IN'  and status='SCHEDULED'),
    'pendingOutbound', (select count(*) from wms_orders where direction='OUT' and status='SCHEDULED'),
    'unvoucheredCount', (select count(*) from wms_orders where status='PROCESSED'),
    'lowStockCount', (select count(*) from v_inventory_by_item where total_qty < 30),
    'totalInventoryValue', (select coalesce(sum(qty * i.unit_price), 0)
                            from inventory inv join items i on i.id = inv.item_id)
  );
$$;

-- ============================================================
-- 5. 시드 데이터
-- ============================================================

insert into public.warehouses (code, name, location, lat, lng) values
  ('WH-ICN1', '인천 제1물류센터', '인천 중구 공항동로 296', 37.4490, 126.4510),
  ('WH-GMP1', '김포 풀필먼트센터', '경기 김포시 고촌읍 아라육로 152', 37.6010, 126.7700),
  ('WH-YJU1', '용인 상온센터', '경기 용인시 처인구 양지면 추계로 32', 37.2260, 127.2830),
  ('WH-BSN1', '부산 남부센터', '부산 강서구 미음산단로 25', 35.1550, 128.8550);

insert into public.items (sku, name, category, unit, unit_price) values
  ('SKU-1001', '프리미엄 단백질 쉐이크 초코', '건강식품', 'EA', 32000),
  ('SKU-1002', '프리미엄 단백질 쉐이크 바닐라', '건강식품', 'EA', 32000),
  ('SKU-1003', '멀티비타민 90정', '건강식품', 'BOX', 24000),
  ('SKU-1004', '오메가3 파워 60캡슐', '건강식품', 'BOX', 28000),
  ('SKU-2001', '무선 이어버드 프로', '전자기기', 'EA', 129000),
  ('SKU-2002', '고속 충전기 65W', '전자기기', 'EA', 39000),
  ('SKU-2003', '스마트 체중계', '전자기기', 'EA', 45000),
  ('SKU-2004', 'USB-C 케이블 2m 3입', '전자기기', 'SET', 15000),
  ('SKU-3001', '순면 타월 세트 5입', '생활용품', 'SET', 22000),
  ('SKU-3002', '주방 밀폐용기 10종', '생활용품', 'SET', 34000),
  ('SKU-3003', '천연 세탁세제 3L', '생활용품', 'EA', 18000),
  ('SKU-3004', '극세사 이불 Q', '생활용품', 'EA', 59000),
  ('SKU-4001', '유기농 콜드브루 500ml', '식품', 'EA', 8500),
  ('SKU-4002', '수제 그래놀라 1kg', '식품', 'EA', 19000),
  ('SKU-4003', '프리미엄 꿀 500g', '식품', 'EA', 27000),
  ('SKU-4004', '현미 즉석밥 12입', '식품', 'BOX', 13800),
  ('SKU-5001', '요가매트 10mm', '스포츠', 'EA', 29000),
  ('SKU-5002', '접이식 덤벨 20kg', '스포츠', 'SET', 89000),
  ('SKU-5003', '러닝 암밴드', '스포츠', 'EA', 12000),
  ('SKU-5004', '스포츠 물통 1L', '스포츠', 'EA', 9500);

-- 창고 × 품목 초기 재고 (결정적 의사난수 수량 40~490 — 출고 처리 시연에 충분)
insert into public.inventory (warehouse_id, item_id, zone_code, qty)
select w.id, i.id, public.wms_default_zone(w.id, i.id), 40 + ((w.rn * 97 + i.rn * 31) % 450)
from (select id, row_number() over (order by code) rn from public.warehouses) w
cross join (select id, row_number() over (order by sku) rn from public.items) i;

-- 입/출고 문서 240건 (IN 120 / OUT 120)
-- 상태 분포: seed_idx % 5 → 0,1: SCHEDULED / 2,3: PROCESSED / 4: VOUCHERED
insert into public.wms_orders
  (order_no, direction, warehouse_id, partner, expected_date, status, processed_at, seed_idx)
select
  case when d.dir = 'IN' then 'IB-' else 'OB-' end
    || to_char(dt.expected, 'YYYYMMDD') || '-' || lpad((1000 + g.i + case when d.dir='OUT' then 500 else 0 end)::text, 4, '0'),
  d.dir,
  w.id,
  case when d.dir = 'IN'
    then (array['(주)한빛유통','골드서플라이','제일무역','누리상사','대성물산'])[1 + (g.i % 5)]
    else (array['자사몰','쿠팡','네이버','카카오','토스쇼핑'])[1 + (g.i % 5)]
  end,
  dt.expected,
  case when g.i % 5 in (0,1) then 'SCHEDULED'
       when g.i % 5 in (2,3) then 'PROCESSED'
       else 'VOUCHERED' end,
  case when g.i % 5 in (0,1) then null
       else dt.expected + time '14:30' end,
  g.i + case when d.dir = 'OUT' then 1000 else 0 end
from generate_series(1, 120) as g(i)
cross join (values ('IN'), ('OUT')) as d(dir)
cross join lateral (
  -- SCHEDULED는 오늘~+6일(오늘 예정 건 보장), 처리/전표 건은 과거 30일 분포
  select case when g.i % 5 in (0,1)
    then current_date + (g.i % 7)
    else current_date - ((g.i * 3) % 30 + 1)
  end as expected
) dt
cross join lateral (
  select id from (select id, row_number() over (order by code) rn from public.warehouses) t
  where t.rn = 1 + (g.i % 4)
) w;

-- 문서 라인 1~3개 (결정적 품목/수량, 처리된 문서는 processed_qty 확정)
insert into public.wms_order_items (order_id, item_id, expected_qty, processed_qty)
select
  o.id,
  ni.id,
  q.expected,
  case when o.status = 'SCHEDULED' then null
       -- 처리 건의 8%는 부분 처리(검수 차이)로 시연
       when o.seed_idx % 13 = 0 then greatest(1, q.expected - 2)
       else q.expected end
from public.wms_orders o
join lateral (
  select id, rn from (select id, row_number() over (order by sku) rn from public.items) t
  where t.rn in (
    1 + (o.seed_idx % 20),
    1 + ((o.seed_idx * 7 + 3) % 20),
    case when o.seed_idx % 3 = 0 then 1 + ((o.seed_idx * 13 + 5) % 20) end
  )
) ni on true
cross join lateral (
  select 2 + ((o.seed_idx * ni.rn) % 38) as expected
) q;

-- VOUCHERED 문서의 전표 생성
insert into public.erp_vouchers (voucher_no, order_id, direction, total_amount, line_count)
select
  case when o.direction = 'IN' then 'VCI-' else 'VCO-' end
    || to_char(o.expected_date, 'YYYYMMDD') || '-' || lpad(nextval('voucher_seq')::text, 4, '0'),
  o.id,
  o.direction,
  coalesce(sum(oi.processed_qty * i.unit_price), 0),
  count(*)
from public.wms_orders o
join public.wms_order_items oi on oi.order_id = o.id
join public.items i on i.id = oi.item_id
where o.status = 'VOUCHERED'
group by o.id;

-- 시드 보조 컬럼 제거
alter table public.wms_orders drop column seed_idx;

-- 확인용
select direction, status, count(*) from public.wms_orders group by 1, 2 order by 1, 2;
