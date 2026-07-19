-- ============================================================
-- AI 어시스턴트 — 예정 문서 취소 RPC (재실행 안전)
-- Supabase Dashboard > SQL Editor 에 붙여넣고 Run 1회 실행
--
-- 취소 = SCHEDULED(예정) 상태 문서의 삭제.
--   - 처리 전이라 재고에 영향이 없는 상태에서만 허용한다.
--   - PROCESSED/VOUCHERED 문서는 재고·전표가 걸려 있으므로 거부.
-- AI 어시스턴트뿐 아니라 일반 화면에서도 재사용 가능한 범용 RPC다.
-- ============================================================

drop function if exists public.wms_cancel_order(uuid);

create function public.wms_cancel_order(
  p_order_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order wms_orders%rowtype;
begin
  select * into v_order from wms_orders where id = p_order_id for update;
  if not found then
    raise exception '문서를 찾을 수 없습니다.';
  end if;
  if v_order.status <> 'SCHEDULED' then
    raise exception '예정 상태 문서만 취소할 수 있습니다: % (%)', v_order.order_no, v_order.status;
  end if;

  delete from wms_order_items where order_id = p_order_id;
  delete from wms_orders where id = p_order_id;

  return v_order.order_no;
end;
$$;
