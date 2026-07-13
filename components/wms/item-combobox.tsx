"use client";

import { Check, ChevronsUpDown, Loader2, PackageSearch, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useItemSearch } from "@/hooks/use-wms";
import type { Item } from "@/lib/wms/types";
import { cn, num } from "@/lib/utils";

/**
 * 품목 검색 콤보박스 (등록 폼용).
 *
 * 품목 마스터를 전량 로드하지 않는다 — 검색어를 DB(ilike push-down)로 보내
 * 상위 20건만 받아온다. 품목이 수만 건으로 늘어도 동작이 같다.
 * - 조회는 팝오버가 열려 있을 때만 (enabled 게이트)
 * - 검색어는 useDeferredValue로 지연시켜 타이핑마다 요청이 나가지 않게 한다
 * - 키보드 내비게이션: ↑/↓ 이동, Enter 선택, Esc 닫기
 */
export function ItemCombobox({
  selected,
  onSelect,
}: {
  /** 현재 라인에 선택된 품목 (없으면 null) */
  selected: Item | null;
  onSelect: (item: Item) => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [highlight, setHighlight] = useState(0);

  const deferredKeyword = useDeferredValue(keyword);
  const { data, isPending, isFetching } = useItemSearch(deferredKeyword, open);
  const rows = data?.rows ?? [];
  const hiddenCount = (data?.total ?? 0) - rows.length;

  const pick = (item: Item) => {
    onSelect(item);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[highlight]) pick(rows[highlight]);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // 다시 열 때 이전 검색 상태가 남지 않도록 초기화
        if (next) {
          setKeyword("");
          setHighlight(0);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-w-0 flex-1 justify-between font-normal"
        >
          {selected ? (
            <span className="truncate">
              <span className="text-muted-foreground">[{selected.sku}]</span> {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">품목 검색·선택</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-80 p-0">
        {/* 검색 입력 — 서버로 push-down 되는 검색어 */}
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="SKU 또는 품목명 검색"
            className="h-8 pl-8"
            aria-label="품목 검색"
          />
          {isFetching && (
            <Loader2
              className="absolute top-1/2 right-4.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
        </div>

        <ul className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="품목 목록">
          {isPending ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">불러오는 중…</li>
          ) : rows.length === 0 ? (
            <li className="flex flex-col items-center gap-1.5 px-2 py-6 text-sm text-muted-foreground">
              <PackageSearch className="size-5" aria-hidden />
              &lsquo;{deferredKeyword}&rsquo; 검색 결과가 없습니다
            </li>
          ) : (
            rows.map((item, index) => {
              const isSelected = selected?.id === item.id;
              return (
                <li key={item.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      index === highlight && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-xs text-muted-foreground">[{item.sku}]</span>{" "}
                      {item.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.category}</span>
                    <Check
                      className={cn("size-4 shrink-0", isSelected ? "text-primary" : "invisible")}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {/* 결과가 잘렸으면 검색을 유도 — 전량 로드 대신 서버 검색을 쓰는 이유를 그대로 노출 */}
        {hiddenCount > 0 && (
          <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            {num.format(hiddenCount)}건 더 있음 — 검색어로 좁혀보세요
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
