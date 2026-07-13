"use client";

import L from "leaflet";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { maskAmount } from "@/lib/rbac";
import type { WarehouseStockSummary } from "@/lib/wms/types";
import type { UserRole } from "@/lib/types";
import { krw, num } from "@/lib/utils";

/**
 * 전국 물류 거점 지도 (Leaflet + OpenStreetMap — API 키 불필요).
 *
 * - Leaflet은 window에 의존하므로 이 모듈은 반드시 dynamic(ssr:false)로만
 *   임포트해야 한다 (warehouse-map-panel.tsx 참조).
 * - 기본 마커 이미지는 번들러 경로 문제가 있어 DivIcon(HTML 마커)으로 대체
 *   — 창고 코드가 그대로 보여 식별성도 더 좋다.
 */

/** 대한민국 전체가 들어오는 중심/줌 */
const KOREA_CENTER: [number, number] = [36.3, 127.6];

function warehouseIcon(code: string): L.DivIcon {
  return L.divIcon({
    className: "", // leaflet 기본 스타일 제거
    html: `<div style="
      display:inline-flex;align-items:center;gap:4px;
      background:oklch(0.205 0 0);color:#fff;
      padding:3px 8px;border-radius:9999px;
      font-size:11px;font-weight:600;white-space:nowrap;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      transform:translate(-50%,-100%);
    ">📦 ${code}</div>`,
    iconSize: [0, 0],
  });
}

export default function WarehouseMap({
  summaries,
  role,
}: {
  summaries: WarehouseStockSummary[];
  role: UserRole;
}) {
  const markers = summaries.filter(
    (w): w is WarehouseStockSummary & { lat: number; lng: number } =>
      w.lat !== null && w.lng !== null,
  );

  return (
    <MapContainer
      center={KOREA_CENTER}
      zoom={7}
      scrollWheelZoom={false}
      className="z-0 h-80 w-full rounded-lg"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((warehouse) => (
        <Marker
          key={warehouse.id}
          position={[warehouse.lat, warehouse.lng]}
          icon={warehouseIcon(warehouse.code)}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{warehouse.name}</p>
              <p className="text-xs text-zinc-500">{warehouse.location}</p>
              <p className="tabular-nums">
                품목 {num.format(warehouse.itemKinds)}종 · 총{" "}
                {num.format(warehouse.totalQty)}개
              </p>
              <p className="tabular-nums">
                재고금액{" "}
                <span className="font-semibold">
                  {maskAmount(krw.format(warehouse.totalValue), role)}
                </span>
              </p>
              <Link
                href={`/inventory/warehouse?warehouse=${warehouse.id}`}
                className="inline-block font-medium underline underline-offset-2"
              >
                이 창고 재고 보기 →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
