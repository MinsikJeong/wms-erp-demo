-- ============================================================
-- 서버 사이드 페이지네이션/필터링 보강 (기존 데이터 유지)
-- Supabase Dashboard > SQL Editor 에 붙여넣고 Run 1회 실행
-- ============================================================

-- 1) 시스템 비교(OMS↔WMS / OMS↔PG) 필터용 생성 컬럼
--    PostgREST는 컬럼 간 비교 필터를 지원하지 않으므로,
--    대조 수식을 DB 생성 컬럼으로 내려 인덱스 가능한 boolean으로 만든다.
alter table public.reconciliations
  add column if not exists scope_oms_wms boolean generated always as (
    oms_document_no is null
    or wms_document_no is null
    or oms_quantity is distinct from wms_quantity
    or oms_amount is distinct from wms_amount
  ) stored,
  add column if not exists scope_oms_pg boolean generated always as (
    oms_document_no is null
    or pg_document_no is null
    or oms_amount is distinct from pg_amount
  ) stored;

-- 이슈 행만 조회하는 패턴이므로 partial index로 가볍게 유지
create index if not exists reconciliations_scope_oms_wms_idx
  on public.reconciliations (transaction_date desc) where scope_oms_wms;
create index if not exists reconciliations_scope_oms_pg_idx
  on public.reconciliations (transaction_date desc) where scope_oms_pg;

-- 2) Metric Card 집계 + 채널 목록 RPC
--    페이지 단위로만 행을 가져오므로 전체 집계는 DB에서 1회 계산해 내려준다.
--    security invoker(기본) → anon 의 RLS(select) 정책이 그대로 적용된다.
create or replace function public.recon_summary()
returns json
language sql
stable
as $$
  select json_build_object(
    'totalCount',      count(*),
    'matchCount',      count(*) filter (where status = 'MATCH'),
    'mismatchCount',   count(*) filter (where status = 'MISMATCH'),
    'duplicatedCount', count(*) filter (where status = 'DUPLICATED'),
    'missingCount',    count(*) filter (where status = 'MISSING'),
    'totalDiffAmount', coalesce(sum(abs(amount_diff)) filter (where status <> 'MATCH'), 0),
    'channels',        coalesce((select json_agg(distinct channel) from public.reconciliations), '[]'::json)
  )
  from public.reconciliations;
$$;

-- 확인용
select public.recon_summary();
