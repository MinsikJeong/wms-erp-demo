import type { PageResult } from "@/lib/wms/api";

/**
 * 엑셀(.xlsx) 내보내기 공용 헬퍼 (클라이언트 전용).
 *
 * 목록 화면은 서버 사이드 페이지네이션이라 화면에는 현재 페이지만 있다 —
 * 내보내기는 "현재 필터 조건 전체"가 대상이므로 같은 조회 함수를
 * 1,000행 청크(PostgREST 1회 응답 상한)로 반복 호출해 모은다.
 * 초대형 결과로 브라우저가 멈추지 않도록 10,000행에서 자른다.
 */

export interface ExportColumn<T> {
  header: string;
  /** 셀 값 — number를 반환하면 엑셀에서 숫자 타입(합계 가능)으로 저장된다 */
  value: (row: T) => string | number;
}

export const EXPORT_MAX_ROWS = 10_000;
const CHUNK_SIZE = 1_000;

export interface ExportResult {
  /** 실제 파일에 담긴 행 수 */
  exported: number;
  /** 필터 조건 전체 행 수 */
  total: number;
  truncated: boolean;
}

/** 페이지 조회 함수를 청크 반복 호출해 필터 조건 전체 행을 수집한다 */
export async function fetchAllRows<T>(
  fetchPage: (pageIndex: number, pageSize: number) => Promise<PageResult<T>>,
): Promise<{ rows: T[]; total: number; truncated: boolean }> {
  const rows: T[] = [];
  let total = 0;

  for (let pageIndex = 0; rows.length < EXPORT_MAX_ROWS; pageIndex += 1) {
    const page = await fetchPage(pageIndex, CHUNK_SIZE);
    total = page.total;
    rows.push(...page.rows);
    // 마지막 페이지(총 건수 도달 또는 짧은 페이지)면 종료
    if (rows.length >= total || page.rows.length < CHUNK_SIZE) break;
  }

  return {
    rows: rows.slice(0, EXPORT_MAX_ROWS),
    total,
    truncated: total > Math.min(rows.length, EXPORT_MAX_ROWS),
  };
}

/**
 * 행 데이터를 .xlsx로 다운로드한다.
 * SheetJS는 무겁기 때문에(≈400KB) 내보내기 시점에만 동적 로드한다.
 */
export async function exportRowsToXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filenameBase: string,
): Promise<void> {
  const XLSX = await import("xlsx");

  const data = rows.map((row) =>
    Object.fromEntries(columns.map((col) => [col.header, col.value(row)])),
  );
  const worksheet = XLSX.utils.json_to_sheet(data, {
    header: columns.map((col) => col.header),
  });
  // 헤더 길이 기반 대략적 열 너비 (한글 2칸 가정)
  worksheet["!cols"] = columns.map((col) => ({
    wch: Math.max(col.header.length * 2 + 2, 12),
  }));

  const workbook = XLSX.utils.book_new();
  // 시트명 제약(31자, 특수문자 금지)을 피해 파일명 앞부분만 사용
  XLSX.utils.book_append_sheet(workbook, worksheet, filenameBase.slice(0, 31));

  const today = new Date();
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(workbook, `${filenameBase}_${stamp}.xlsx`);
}

/**
 * "필터 전체 조회 → xlsx 다운로드" 원스톱 헬퍼.
 * 각 목록 화면은 컬럼 정의와 (현재 필터가 바인딩된) 조회 함수만 넘긴다.
 */
export async function exportFiltered<T>(
  fetchPage: (pageIndex: number, pageSize: number) => Promise<PageResult<T>>,
  columns: ExportColumn<T>[],
  filenameBase: string,
): Promise<ExportResult> {
  const { rows, total, truncated } = await fetchAllRows(fetchPage);
  await exportRowsToXlsx(rows, columns, filenameBase);
  return { exported: rows.length, total, truncated };
}
