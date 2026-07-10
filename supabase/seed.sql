-- ============================================================
-- NewSelect FIS — 재무 대사(Reconciliation) 데모 스키마 + 시드
-- Supabase Dashboard > SQL Editor 에 전체를 붙여넣고 Run 1회 실행
-- ============================================================

create extension if not exists pgcrypto;

drop table if exists public.reconciliations;

create table public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  order_no text not null,
  channel text not null,
  transaction_date date not null,
  -- OMS(주문) 스냅샷 — null 이면 해당 시스템 레코드 누락
  oms_document_no text,
  oms_amount bigint,
  oms_quantity int,
  oms_recorded_at timestamptz,
  -- WMS(출고) 스냅샷
  wms_document_no text,
  wms_amount bigint,
  wms_quantity int,
  wms_recorded_at timestamptz,
  -- PG(정산) 스냅샷 (결제 단위라 수량 없음)
  pg_document_no text,
  pg_amount bigint,
  pg_recorded_at timestamptz,
  -- 대사 엔진 판정 결과
  status text not null check (status in ('MATCH','MISMATCH','DUPLICATED','MISSING')),
  status_reason text,
  amount_diff bigint,
  settlement_status text not null check (settlement_status in ('PENDING','CONFIRMED','PAID','HOLD')),
  created_at timestamptz not null default now()
);

-- 조회 패턴(기간 필터 + 상태 필터)에 맞춘 인덱스
create index reconciliations_tx_date_idx on public.reconciliations (transaction_date desc);
create index reconciliations_status_idx on public.reconciliations (status);

-- RLS: 데모는 익명(publishable key) 읽기만 허용, 쓰기는 차단
alter table public.reconciliations enable row level security;

create policy "anon can read reconciliations"
  on public.reconciliations for select
  to anon
  using (true);

-- ------------------------------------------------------------
-- 시드 1) 검증용 대표 케이스 12건 (상태·사유가 정교하게 구성된 행)
-- ------------------------------------------------------------
insert into public.reconciliations
  (order_no, channel, transaction_date,
   oms_document_no, oms_amount, oms_quantity, oms_recorded_at,
   wms_document_no, wms_amount, wms_quantity, wms_recorded_at,
   pg_document_no, pg_amount, pg_recorded_at,
   status, status_reason, amount_diff, settlement_status)
values
  ('ORD-20260701-1042','자사몰','2026-07-01','OMS-88231',129000,2,'2026-07-01T10:12:33+09','WMS-55102',129000,2,'2026-07-01T15:40:02+09','PG-77281039',129000,'2026-07-02T04:00:00+09','MATCH',null,0,'PAID'),
  ('ORD-20260701-1187','쿠팡','2026-07-01','OMS-88307',254000,4,'2026-07-01T11:05:19+09','WMS-55210',254000,4,'2026-07-01T17:22:45+09','PG-77281440',249000,'2026-07-02T04:00:00+09','MISMATCH','OMS 주문금액(254,000원)과 PG 정산금액(249,000원) 5,000원 불일치 — 부분 취소 미반영 의심',5000,'HOLD'),
  ('ORD-20260702-0091','네이버','2026-07-02','OMS-88412',78000,1,'2026-07-02T09:31:02+09',null,null,null,null,'PG-77282019',78000,'2026-07-03T04:00:00+09','MISSING','WMS 출고 레코드 누락 — 주문·정산은 존재하나 출고 지시가 확인되지 않음 (미출고 과금 위험)',0,'CONFIRMED'),
  ('ORD-20260702-0233','자사몰','2026-07-02','OMS-88459',46000,1,'2026-07-02T13:44:51+09','WMS-55388',46000,1,'2026-07-02T18:02:10+09','PG-77282215',92000,'2026-07-03T04:00:00+09','DUPLICATED','PG 정산 레코드 2건 중복 집계 — 동일 주문번호로 92,000원(2배) 정산됨, PG사 이중 청구 확인 필요',-46000,'HOLD'),
  ('ORD-20260703-0412','카카오','2026-07-03',null,null,null,null,'WMS-55461',187000,3,'2026-07-03T10:15:33+09','PG-77283001',187000,'2026-07-04T04:00:00+09','MISSING','OMS 주문 레코드 누락 — 출고·정산만 존재, 채널 주문 수집 배치 실패 구간(07-03 09~11시) 재수집 필요',null,'PENDING'),
  ('ORD-20260703-0518','쿠팡','2026-07-03','OMS-88602',315000,5,'2026-07-03T14:20:08+09','WMS-55519',315000,5,'2026-07-03T19:55:41+09','PG-77283388',315000,'2026-07-04T04:00:00+09','MATCH',null,0,'PAID'),
  ('ORD-20260704-0077','네이버','2026-07-04','OMS-88710',59000,1,'2026-07-04T08:47:12+09','WMS-55602',59000,2,'2026-07-04T13:11:29+09','PG-77284102',59000,'2026-07-05T04:00:00+09','MISMATCH','OMS 주문수량(1)과 WMS 출고수량(2) 불일치 — 과출고 재고 손실 위험, 반품 여부 확인 필요',0,'CONFIRMED'),
  ('ORD-20260704-0154','자사몰','2026-07-04','OMS-88755',430000,2,'2026-07-04T11:30:55+09','WMS-55648',430000,2,'2026-07-04T16:44:03+09',null,null,null,'MISSING','PG 정산 레코드 누락 — 출고 완료 후 3영업일 경과에도 정산 미접수, 미수금 430,000원 발생',null,'PENDING'),
  ('ORD-20260705-0201','카카오','2026-07-05','OMS-88820',22000,1,'2026-07-05T09:02:44+09','WMS-55701',22000,1,'2026-07-05T14:38:17+09','PG-77285230',22000,'2026-07-06T04:00:00+09','MATCH',null,0,'PAID'),
  ('ORD-20260705-0342','쿠팡','2026-07-05','OMS-88871',168000,2,'2026-07-05T15:19:26+09','WMS-55749',168000,2,'2026-07-05T20:03:58+09','PG-77285512',151200,'2026-07-06T04:00:00+09','MISMATCH','OMS 주문금액(168,000원)과 PG 정산금액(151,200원) 16,800원 불일치 — 채널 수수료(10%) 차감 전/후 기준 상이 의심',16800,'HOLD'),
  ('ORD-20260706-0018','자사몰','2026-07-06','OMS-88930',96000,2,'2026-07-06T10:41:09+09','WMS-55803',96000,2,'2026-07-06T15:27:36+09','PG-77286077',96000,'2026-07-07T04:00:00+09','MATCH',null,0,'CONFIRMED'),
  ('ORD-20260706-0290','네이버','2026-07-06','OMS-88988',74000,1,'2026-07-06T17:55:48+09','WMS-55861',74000,1,'2026-07-06T21:12:20+09','PG-77286391',148000,'2026-07-07T04:00:00+09','DUPLICATED','OMS 주문 이벤트 중복 발행으로 PG 이중 결제 148,000원 — 1건 취소 처리 필요',-74000,'HOLD');

-- ------------------------------------------------------------
-- 시드 2) 대량 데이터 488건 자동 생성 (성능/필터 검증용)
--   상태 분포: MATCH 80% / MISMATCH 8% / DUPLICATED 6% / MISSING 6%
-- ------------------------------------------------------------
with base as (
  select
    i,
    (array['자사몰','쿠팡','네이버','카카오','토스쇼핑'])[1 + (i % 5)] as channel,
    date '2026-06-01' + (i % 40) as tx_date,
    ((10 + floor(random() * 490))::bigint) * 1000 as amount,
    (1 + floor(random() * 4))::int as qty,
    random() as r_status,
    random() as r_detail
  from generate_series(1, 488) as i
),
derived as (
  select *,
    'ORD-' || to_char(tx_date, 'YYYYMMDD') || '-' || lpad((2000 + i)::text, 4, '0') as order_no,
    case
      when r_status < 0.80 then 'MATCH'
      when r_status < 0.88 then 'MISMATCH'
      when r_status < 0.94 then 'DUPLICATED'
      else 'MISSING'
    end as status,
    -- MISMATCH 차액: 금액의 1~10%를 천원 단위로 절사
    greatest(1000, (floor(random() * 10 + 1) * 1000)::bigint) as mismatch_diff
  from base
)
insert into public.reconciliations
  (order_no, channel, transaction_date,
   oms_document_no, oms_amount, oms_quantity, oms_recorded_at,
   wms_document_no, wms_amount, wms_quantity, wms_recorded_at,
   pg_document_no, pg_amount, pg_recorded_at,
   status, status_reason, amount_diff, settlement_status)
select
  order_no,
  channel,
  tx_date,
  -- OMS: MISSING이면서 r_detail < 1/3 인 경우 누락
  case when status = 'MISSING' and r_detail < 0.34 then null else 'OMS-' || (80000 + i) end,
  case when status = 'MISSING' and r_detail < 0.34 then null else amount end,
  case when status = 'MISSING' and r_detail < 0.34 then null else qty end,
  case when status = 'MISSING' and r_detail < 0.34 then null else tx_date + time '10:00' end,
  -- WMS: MISSING이면서 1/3 <= r_detail < 2/3 인 경우 누락
  case when status = 'MISSING' and r_detail >= 0.34 and r_detail < 0.67 then null else 'WMS-' || (50000 + i) end,
  case when status = 'MISSING' and r_detail >= 0.34 and r_detail < 0.67 then null else amount end,
  case when status = 'MISSING' and r_detail >= 0.34 and r_detail < 0.67 then null else qty end,
  case when status = 'MISSING' and r_detail >= 0.34 and r_detail < 0.67 then null else tx_date + time '16:00' end,
  -- PG: MISSING이면서 r_detail >= 2/3 인 경우 누락 / MISMATCH는 차액 반영 / DUPLICATED는 2배
  case when status = 'MISSING' and r_detail >= 0.67 then null else 'PG-' || (77000000 + i) end,
  case
    when status = 'MISSING' and r_detail >= 0.67 then null
    when status = 'MISMATCH' then amount - mismatch_diff
    when status = 'DUPLICATED' then amount * 2
    else amount
  end,
  case when status = 'MISSING' and r_detail >= 0.67 then null else tx_date + 1 + time '04:00' end,
  status,
  case status
    when 'MISMATCH' then format('OMS 주문금액(%s원)과 PG 정산금액(%s원) %s원 불일치 — 수수료/부분취소 대조 필요',
                                to_char(amount, 'FM999,999,999'), to_char(amount - mismatch_diff, 'FM999,999,999'), to_char(mismatch_diff, 'FM999,999,999'))
    when 'DUPLICATED' then format('PG 정산 레코드 중복 집계 — 동일 주문번호로 %s원(2배) 정산, 이중 청구 확인 필요',
                                  to_char(amount * 2, 'FM999,999,999'))
    when 'MISSING' then case
      when r_detail < 0.34 then 'OMS 주문 레코드 누락 — 채널 주문 수집 배치 재수집 필요'
      when r_detail < 0.67 then 'WMS 출고 레코드 누락 — 미출고 과금 위험, 출고 지시 확인 필요'
      else format('PG 정산 레코드 누락 — 미수금 %s원 발생 가능', to_char(amount, 'FM999,999,999'))
    end
    else null
  end,
  case status
    when 'MATCH' then 0
    when 'MISMATCH' then mismatch_diff
    when 'DUPLICATED' then -amount
    else null
  end,
  case status
    when 'MATCH' then (case when r_detail < 0.7 then 'PAID' else 'CONFIRMED' end)
    when 'MISSING' then 'PENDING'
    else 'HOLD'
  end
from derived;

-- 확인용
select status, count(*) from public.reconciliations group by status order by status;
