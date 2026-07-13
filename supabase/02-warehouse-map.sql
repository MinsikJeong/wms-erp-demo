-- ============================================================
-- 창고 지도 연동 (기존 데이터 유지, 재실행 안전)
--  1) 창고 좌표(lat/lng)          → 창고관리 Leaflet 지도
--  2) 존(로케이션) 개념 추가        → 창고별재고현황 SVG 평면도 히트맵
--  3) 요약 뷰 2종 + 처리 RPC 갱신
-- Supabase Dashboard > SQL Editor 에 붙여넣고 Run 1회 실행
-- ============================================================

-- ---------- 1) 창고 좌표 (WGS84) ----------
alter table public.warehouses
  add column if not exists lat double precision,
  add column if not exists lng double precision;

update public.warehouses set lat = 37.4490, lng = 126.4510 where code = 'WH-ICN1'; -- 인천공항 화물권역
update public.warehouses set lat = 37.6010, lng = 126.7700 where code = 'WH-GMP1'; -- 김포 고촌
update public.warehouses set lat = 37.2260, lng = 127.2830 where code = 'WH-YJU1'; -- 용인 양지
update public.warehouses set lat = 35.1550, lng = 128.8550 where code = 'WH-BSN1'; -- 부산 미음산단

-- ---------- 2) 존(로케이션) ----------
-- 평면도는 창고당 A~C 3열 × 6칸 = 18존 고정 격자를 사용한다.
-- 품목은 창고별로 고정 로케이션(존)에 적재된다고 가정 (fixed location 전략).

-- 존 코드 결정 함수 — (창고, 품목) 해시로 항상 같은 존을 돌려준다.
-- 시드 배정과 입고 처리 시 신규 재고 행 생성이 같은 규칙을 공유한다.
create or replace function public.wms_default_zone(p_warehouse uuid, p_item uuid)
returns text
language sql
immutable
as $$
  select (array['A','B','C'])[1 + mod(abs(hashtext(p_warehouse::text || p_item::text)), 3)]
    || '-' || lpad((1 + mod(abs(hashtext(p_item::text || p_warehouse::text)), 6))::text, 2, '0');
$$;

alter table public.inventory
  add column if not exists zone_code text;

update public.inventory
set zone_code = public.wms_default_zone(warehouse_id, item_id)
where zone_code is null;

alter table public.inventory alter column zone_code set not null;

-- 입고 처리 RPC 갱신: 신규 재고 행 생성 시 존 자동 배정
create or replace function public.wms_process_order(
  p_order_id uuid,
  p_lines jsonb
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

-- ---------- 3) 뷰 ----------

-- 지리 지도 팝업용: 창고별 재고 요약
drop view if exists public.v_warehouse_stock_summary;
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
drop view if exists public.v_zone_inventory;
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

-- 창고별 재고 상세에 존 코드 노출 (존 클릭 → 테이블 필터용)
drop view if exists public.v_warehouse_inventory;
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

-- 확인용
select code, name, lat, lng, total_qty from public.v_warehouse_stock_summary order by code;
select zone_code, count(*) from public.inventory group by zone_code order by zone_code limit 5;
